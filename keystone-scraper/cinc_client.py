"""Read-only client for Keystone's CINC Connect portal API.

Keystone's portal (kppm.cincconnect.com) is a Flutter web app over a JSON REST API at
integrations-prod.onrapp.us. This client talks to that API directly; no browser is involved.

How it was worked out (Oct 2026): the portal's public app bundle (main.dart.js) shows login
is a plain POST of email/password to /users/cinc/connect/authenticate, which returns a
token (already prefixed "JWT ", valid ~8 hours). Board endpoints such as
/api/v1/bod/work-orders/{grouping} accept that token directly; the grouping ID in the URL
selects the association (1261 = Villas at the Boulders, 1167 = Broadlands master).

Safety rules, enforced here so every job inherits them:
  - Read-only: GET only, plus POST to the few endpoints that read (login, download URL).
    The API also exposes write endpoints (e.g. invoice approval); this client refuses them.
  - The token is only ever sent to the API host, never logged.
  - Login is never retried on a rejected password (repeated failures could lock the account).
  - Paged fetches raise on errors or short results instead of returning partial data.
"""
import base64
import json
import logging
import os
import time
from pathlib import Path
from urllib.parse import urlsplit

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

API_BASE = "https://integrations-prod.onrapp.us"
API_HOST = urlsplit(API_BASE).hostname
PORTAL_ORIGIN = "https://kppm.cincconnect.com"

VILLAS_GROUPING = 1261
BROADLANDS_GROUPING = 1167

PAGE_LIMIT = 100          # API rejects larger pages
REQUEST_TIMEOUT = 30      # seconds
MIN_REQUEST_INTERVAL = 0.5  # seconds between calls; be a light, polite client

LOGIN_PATH = "/users/cinc/connect/authenticate"
# The only POST endpoints we call. Each is a read: login, and asking for a signed
# download link to a document.
ALLOWED_POSTS = {LOGIN_PATH, "/api/v2/file/download/url"}

logger = logging.getLogger(__name__)


class CincError(RuntimeError):
    """Any failure talking to the portal API."""


class CincAuthError(CincError):
    """Login rejected (wrong password, locked account, or the portal changed its login)."""


def load_credentials():
    """KEYSTONE_USERNAME/KEYSTONE_PASSWORD from the environment (CI), else .env beside this file."""
    user = os.environ.get("KEYSTONE_USERNAME")
    password = os.environ.get("KEYSTONE_PASSWORD")
    if user and password:
        return user, password
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        values = {}
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                values[k.strip()] = v.strip()
        user = values.get("KEYSTONE_USERNAME")
        password = values.get("KEYSTONE_PASSWORD")
    if not user or not password:
        raise CincAuthError("KEYSTONE_USERNAME/KEYSTONE_PASSWORD not set")
    return user, password


def token_expiry_minutes(token):
    """Minutes until the token's exp claim, or None if it can't be read. Reads, never verifies."""
    try:
        raw = token[4:] if token.startswith("JWT ") else token
        payload = raw.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        exp = json.loads(base64.urlsafe_b64decode(payload))["exp"]
        return round((exp - time.time()) / 60)
    except Exception:
        return None


class CincClient:
    def __init__(self, username=None, password=None):
        if username is None or password is None:
            username, password = load_credentials()
        self._username = username
        self._password = password
        self._token = None
        self._last_request = 0.0
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "Content-Type": "application/json; charset=UTF-8",
            "Origin": PORTAL_ORIGIN,
            "Referer": PORTAL_ORIGIN + "/",
            "x-cinc-requested-from": "kppm",  # API returns 500 without it
        })
        # Retry transient failures only. 401/403 are never retried here.
        retry = Retry(total=4, backoff_factor=2, status_forcelist=(429, 500, 502, 503, 504),
                      allowed_methods=frozenset({"GET"}), respect_retry_after_header=True,
                      raise_on_status=False)
        self.session.mount("https://", HTTPAdapter(max_retries=retry))

    # ── low level ─────────────────────────────────────────────────────────────

    def _request(self, method, path, **kwargs):
        if not path.startswith("/"):
            raise CincError(f"Path must be relative to the API host: {path}")
        if method == "POST" and path not in ALLOWED_POSTS:
            raise CincError(f"Refusing POST to {path}: client is read-only")
        if method not in ("GET", "POST"):
            raise CincError(f"Refusing {method} {path}: client is read-only")
        url = API_BASE + path
        if urlsplit(url).hostname != API_HOST:  # belt and braces: token only goes to the API
            raise CincError(f"Refusing request to unexpected host for {path}")

        wait = MIN_REQUEST_INTERVAL - (time.monotonic() - self._last_request)
        if wait > 0:
            time.sleep(wait)
        headers = kwargs.pop("headers", {})
        if self._token and path != LOGIN_PATH:
            headers["Authorization"] = self._token
        try:
            resp = self.session.request(method, url, headers=headers, timeout=REQUEST_TIMEOUT, **kwargs)
        except requests.RequestException as e:
            raise CincError(f"{method} {path} failed: {type(e).__name__}") from e
        finally:
            self._last_request = time.monotonic()
        return resp

    def _authed(self, method, path, **kwargs):
        """Request with the session token; on a 401, log in again once and retry."""
        if not self._token:
            self.login()
        resp = self._request(method, path, **kwargs)
        if resp.status_code == 401:
            logger.info("Token rejected mid-run; logging in again")
            self.login()
            resp = self._request(method, path, **kwargs)
        return resp

    @staticmethod
    def _json(resp, path):
        if resp.status_code != 200:
            raise CincError(f"API error {resp.status_code} on {path}")
        try:
            return resp.json()
        except ValueError as e:
            raise CincError(f"Non-JSON response on {path}") from e

    # ── public API ────────────────────────────────────────────────────────────

    def login(self):
        """Log in once. Never retried on rejection, to avoid locking the account."""
        resp = self._request("POST", LOGIN_PATH,
                             json={"email": self._username, "password": self._password})
        body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        token = body.get("token") if isinstance(body, dict) else None
        if resp.status_code != 200 or body.get("code") != 200 or not token:
            msg = body.get("msg") if isinstance(body, dict) else None
            raise CincAuthError(f"Keystone login rejected (HTTP {resp.status_code}"
                                f"{', ' + msg if msg else ''}); check the password or portal")
        self._token = token if token.startswith("JWT ") else f"JWT {token}"
        if os.environ.get("GITHUB_ACTIONS") == "true":
            print(f"::add-mask::{self._token[4:]}", flush=True)
        logger.info("Logged in to Keystone (token valid ~%s min)", token_expiry_minutes(self._token))

    def get(self, path, params=None):
        """GET a single (non-paged) endpoint and return its JSON body."""
        return self._json(self._authed("GET", path, params=params), path)

    def get_all(self, path, params=None):
        """Fetch every page of a paged list endpoint.

        Raises on any error, unexpected shape, or fewer docs than the API's totalDocs, so a
        partial result can never be mistaken for the full list.
        """
        docs, page, total = [], 1, 0
        while True:
            query = {"page": page, "limit": PAGE_LIMIT, **(params or {})}
            body = self.get(path, params=query)
            inner = body.get("data") if isinstance(body, dict) else None
            if not isinstance(inner, dict) or not isinstance(inner.get("docs"), list):
                raise CincError(f"Unexpected response shape on {path} page {page}")
            batch = inner["docs"]
            total = inner.get("totalDocs") or 0
            total_pages = inner.get("totalPages") or 1
            docs.extend(batch)
            if page >= total_pages or not batch:
                break
            page += 1
        if len(docs) < total:
            raise CincError(f"Short fetch on {path}: {len(docs)} of {total}")
        logger.info("%s: %d docs (%d page(s), totalDocs %d)", path, len(docs), page, total)
        return docs

    def download_url(self, key):
        """Ask the API for a signed, short-lived link to a document file."""
        path = "/api/v2/file/download/url"
        body = self._json(self._authed("POST", path, json={"key": key, "contentDisposition": "inline"}), path)
        url = (body.get("data") or {}).get("url") if isinstance(body, dict) else None
        if not url:
            raise CincError(f"No download URL returned for file key")
        return url

    def download(self, key):
        """Return the bytes of a document. The signed link is fetched without our token."""
        url = self.download_url(key)
        try:
            resp = requests.get(url, timeout=120)
        except requests.RequestException as e:
            raise CincError(f"Download failed: {type(e).__name__}") from e
        if resp.status_code != 200:
            raise CincError(f"Download failed with HTTP {resp.status_code}")
        return resp.content
