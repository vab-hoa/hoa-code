"""Minimal client for the HOA tracker's Supabase database (REST API, service key).

Used by the nightly Keystone notes import. Talks to Supabase's REST API with the secret
key, so GitHub Actions needs only the SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets
(no direct Postgres password).

Credentials: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the environment (CI), else
hoa-tracker-dashboard/.env.local on oregano. Never logs the key. This repo is public:
never put a key in any tracked file.
"""
import os
from pathlib import Path

import requests

DEFAULT_URL = "https://obveytoovkzjrpzrhrim.supabase.co"
LOCAL_ENV = Path(__file__).resolve().parent.parent / "hoa-tracker-dashboard" / ".env.local"
STORAGE_BUCKET = "work-item-documents"


class TrackerError(RuntimeError):
    pass


def _credentials():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if (not url or not key) and LOCAL_ENV.exists():
        values = {}
        for line in LOCAL_ENV.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                values[k.strip()] = v.strip()
        url = url or values.get("NEXT_PUBLIC_SUPABASE_URL")
        key = key or values.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise TrackerError("SUPABASE_SERVICE_ROLE_KEY not set")
    return (url or DEFAULT_URL).rstrip("/"), key


class TrackerDB:
    def __init__(self):
        self.url, key = _credentials()
        self.session = requests.Session()
        self.session.headers.update({"apikey": key, "Authorization": f"Bearer {key}"})

    def select(self, table, params):
        """Rows from a table; params are PostgREST query parameters."""
        resp = self.session.get(f"{self.url}/rest/v1/{table}", params=params, timeout=30)
        if resp.status_code != 200:
            raise TrackerError(f"select {table} failed: HTTP {resp.status_code}")
        return resp.json()

    def insert_new(self, table, rows, conflict_column="source_key"):
        """Insert rows, silently skipping any whose conflict_column value already exists.

        Returns the rows actually inserted.
        """
        if not rows:
            return []
        resp = self.session.post(
            f"{self.url}/rest/v1/{table}", params={"on_conflict": conflict_column}, json=rows,
            headers={"Prefer": "resolution=ignore-duplicates,return=representation"}, timeout=60)
        if resp.status_code not in (200, 201):
            raise TrackerError(f"insert into {table} failed: HTTP {resp.status_code} {resp.text[:200]}")
        return resp.json()

    def update(self, table, row_id, values):
        """Update one row by id; raises unless exactly one row changed."""
        resp = self.session.patch(
            f"{self.url}/rest/v1/{table}", params={"id": f"eq.{row_id}"}, json=values,
            headers={"Prefer": "return=representation"}, timeout=30)
        if resp.status_code != 200:
            raise TrackerError(f"update {table} {row_id} failed: HTTP {resp.status_code}")
        if len(resp.json()) != 1:
            raise TrackerError(f"update {table} {row_id}: expected 1 row, matched {len(resp.json())}")

    def upload(self, path, data, content_type):
        """Upload a file to the work-item documents bucket (overwrites the same path)."""
        resp = self.session.post(
            f"{self.url}/storage/v1/object/{STORAGE_BUCKET}/{path}", data=data,
            headers={"Content-Type": content_type or "application/octet-stream", "x-upsert": "true"},
            timeout=120)
        if resp.status_code not in (200, 201):
            raise TrackerError(f"upload failed: HTTP {resp.status_code}")
