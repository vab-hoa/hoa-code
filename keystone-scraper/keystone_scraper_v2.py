#!/usr/bin/env python3
"""
Keystone CINC Connect Scraper v2 — REST API version.

Flow:
  1. Login via Playwright (Flutter Web SPA requires browser for auth)
  2. Extract JWT token from localStorage
  3. Call REST API directly with Python requests (no browser navigation)
  4. Paginate with limit=100 (API max) through all pages
  5. Map to Google Sheet cache format and write

Key header: x-cinc-requested-from: kppm (required for API access)
API base: https://integrations-prod.onrapp.us
Auth: JWT <token> in Authorization header
"""
import json
import os
import sys
import re
import asyncio
import logging
import argparse
from datetime import datetime
from pathlib import Path

import requests
from playwright.async_api import async_playwright

from sheets_retry import retry_sheets_call

# ── Config ───────────────────────────────────────────────────────────────────

PORTAL_URL = "https://kppm.cincconnect.com"
API_BASE = "https://integrations-prod.onrapp.us"
GROUPING_ID = 1261  # Villas at the Boulders Association

CREDENTIALS_PATH = os.path.expanduser("~/.config/openclaw/google-service-account.json")
SPREADSHEET_ID = "1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ"
WORKORDERS_SHEET = "WorkOrders"
VIOLATIONS_SHEET = "Violations"
ARCHREVIEWS_SHEET = "ArchReviews"
PROFILES_SHEET = "Profiles"

PAGE_LIMIT = 100  # API max is 100

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def load_env():
    """Load credentials: environment variables first (CI), then .env next to script."""
    env_vars = {}
    if os.environ.get("KEYSTONE_USERNAME") and os.environ.get("KEYSTONE_PASSWORD"):
        env_vars["KEYSTONE_USERNAME"] = os.environ["KEYSTONE_USERNAME"]
        env_vars["KEYSTONE_PASSWORD"] = os.environ["KEYSTONE_PASSWORD"]
        return env_vars
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env_vars[k.strip()] = v.strip()
    return env_vars


# ── Address standardization ──────────────────────────────────────────────────

STREET_CODES = {
    'rock point': 'RP', 'rock pt': 'RP',
    'boulder point': 'BP', 'boulder pt': 'BP',
    'boulder circle': 'BC', 'boulder cir': 'BC',
    'broadlands': 'BL', 'broadlands lane': 'BL',
    'stone circle': 'SC', 'stone cir': 'SC',
    'plaster point': 'PP', 'plaster pt': 'PP',
}


def standardize_address(street_number, street_name, unit):
    if not street_number or not street_name:
        return None
    street_num = re.sub(r'\D', '', str(street_number))
    if not street_num:
        return None
    street_lower = street_name.lower().strip()
    street_code = None
    for street, code in STREET_CODES.items():
        if street in street_lower:
            street_code = code
            break
    if not street_code:
        return None
    unit_suffix = ''
    if unit:
        unit_clean = re.sub(r'[#\s]', '', str(unit))
        m = re.search(r'10([12])', unit_clean)
        if m:
            unit_suffix = m.group(1)
        elif re.search(r'^[12]$', unit_clean):
            unit_suffix = unit_clean
    return f"{street_num}{street_code}{unit_suffix}"


def parse_work_location(work_location):
    if not work_location:
        return None, None
    match = re.search(r'\d', work_location)
    if not match:
        return None, None
    address_text = work_location[match.start():].strip()
    street_num_match = re.match(r'^(\d{4,5})', address_text)
    if not street_num_match:
        return None, None
    street_number = street_num_match.group(1)
    remainder = address_text[len(street_number):].strip()
    parts = re.split(r'\s+(?:Unit|#|Apt|Apartment)\s*', remainder, flags=re.IGNORECASE)
    street_name = parts[0].strip()
    unit = ''
    if len(parts) > 1:
        unit_match = re.search(r'(10[12])', parts[1])
        if unit_match:
            unit = unit_match.group(1)
    if not unit:
        trailing = re.search(r'\s+(10[12])\s*$', remainder)
        if trailing:
            unit = trailing.group(1)
            street_name = re.sub(r'\s+10[12]\s*$', '', street_name).strip()
    return standardize_address(street_number, street_name, unit), street_name


def validate_address(standardized_address, street_name):
    if not standardized_address:
        return False
    m = re.match(r'^(\d{4,5})', standardized_address)
    if not m:
        return False
    street_num = int(m.group(1))
    if standardized_address[-1] not in ('1', '2'):
        return False
    if street_name and 'broadlands' in street_name.lower():
        return 3500 <= street_num <= 3599
    return 13600 <= street_num <= 13799


# ── Login (Playwright) ────────────────────────────────────────────────────────

async def login_and_get_token(username, password):
    """Login to CINC Connect via Playwright and return JWT auth header."""
    logger.info("Launching browser for login...")
    auth_header = None

    async def on_request(request):
        nonlocal auth_header
        if "integrations-prod.onrapp.us" in request.url:
            auth = request.headers.get("authorization", "")
            if auth and not auth_header:
                auth_header = auth

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        page.on("request", on_request)

        logger.info("Navigating to login page...")
        await page.goto(f"{PORTAL_URL}/login", wait_until="domcontentloaded")

        # Wait for Flutter app
        for i in range(30):
            count = await page.evaluate("document.querySelectorAll('flt-semantics').length")
            if count > 0:
                logger.info(f"Flutter app loaded ({count} semantics)")
                break
            await page.wait_for_timeout(1000)
        else:
            raise RuntimeError("Flutter app did not load")
        await page.wait_for_timeout(3000)

        # Click "User Login"
        logger.info("Clicking 'User Login'...")
        await page.get_by_role("button", name="User Login").first.click(timeout=10000)
        await page.wait_for_timeout(5000)

        # Type credentials into Flutter canvas text fields
        logger.info("Typing credentials...")
        await page.mouse.click(540, 410)  # email field position
        await page.wait_for_timeout(2000)
        await page.keyboard.type(username, delay=30)
        await page.wait_for_timeout(300)
        await page.keyboard.press("Tab")  # move to password field
        await page.wait_for_timeout(1000)
        await page.keyboard.type(password, delay=30)
        await page.wait_for_timeout(500)

        # Click SIGN IN
        logger.info("Clicking SIGN IN...")
        await page.get_by_role("button", name="SIGN IN").first.click(timeout=10000)

        # Wait for redirect
        logger.info("Waiting for redirect...")
        for i in range(25):
            await page.wait_for_timeout(1000)
            if "/login" not in page.url or "/login#/main" in page.url:
                break
        await page.wait_for_timeout(3000)

        # Select Villas account
        logger.info("Selecting Villas account...")
        loc = page.get_by_text("Villas at the Boulders", exact=False)
        if await loc.count() > 0:
            await loc.first.click(timeout=10000)
        await page.wait_for_timeout(8000)

        # Navigate to boardroom to trigger the API auth header
        logger.info("Navigating to boardroom/workOrder to capture auth...")
        await page.evaluate("window.location.hash = '#/main/boardroom/workOrder'")
        await page.wait_for_timeout(8000)

        # Also try to get token from localStorage
        raw_token = await page.evaluate("window.localStorage.getItem('flutter.tokenLogin')")
        if raw_token:
            token = raw_token.strip('"')
            if not token.startswith("JWT "):
                token = f"JWT {token}"
            if not auth_header:
                auth_header = token

        await browser.close()

    if not auth_header:
        raise RuntimeError("Could not obtain JWT auth header")
    logger.info("Auth header obtained")
    return auth_header


# ── REST API client ──────────────────────────────────────────────────────────

class CINCApiClient:
    """Direct REST API client for CINC Connect / ONR."""

    def __init__(self, auth_header):
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": auth_header,
            "Accept": "application/json",
            "Content-Type": "application/json; charset=UTF-8",
            "Origin": "https://kppm.cincconnect.com",
            "Referer": "https://kppm.cincconnect.com/",
            "x-cinc-requested-from": "kppm",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        })

    def get_all(self, path, extra_params=None):
        """Fetch all pages of a paginated list endpoint.

        Raises on any non-200 response, unexpected shape, or fewer docs than the API's
        totalDocs, so a failed fetch can never be written to the sheet as an empty tab.
        """
        url = f"{API_BASE}{path}"
        all_docs = []
        page = 1
        total = 0

        while True:
            params = {"page": page, "limit": PAGE_LIMIT}
            if extra_params:
                params.update(extra_params)

            logger.info(f"  GET {path}?page={page}&limit={PAGE_LIMIT}")
            resp = self.session.get(url, params=params, timeout=30)

            if resp.status_code != 200:
                raise RuntimeError(f"API error {resp.status_code} on {path} page {page}")

            data = resp.json()
            inner = data.get("data", {}) if isinstance(data, dict) else None

            if not isinstance(inner, dict) or not isinstance(inner.get("docs"), list):
                raise RuntimeError(f"Unexpected response structure on {path} page {page}")

            docs = inner["docs"]
            total = inner.get("totalDocs", 0) or 0
            total_pages = inner.get("totalPages", 1) or 1

            all_docs.extend(docs)
            logger.info(f"  Page {page}/{total_pages}: {len(docs)} docs (total: {total})")

            if page >= total_pages or len(docs) == 0:
                break
            page += 1

        if len(all_docs) < total:
            raise RuntimeError(f"Short fetch on {path}: {len(all_docs)} of {total} docs")
        logger.info(f"  Collected {len(all_docs)} docs from {page} page(s)")
        return all_docs

    def get_single(self, path):
        """Fetch a non-paginated endpoint."""
        url = f"{API_BASE}{path}"
        logger.info(f"  GET {path}")
        resp = self.session.get(url, timeout=15)
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"  API error {resp.status_code}: {resp.text[:200]}")
        return None


# ── Data extraction ───────────────────────────────────────────────────────────

def extract_work_orders(docs):
    work_orders = []
    discarded = 0
    for wo in docs:
        wo_number = str(wo.get("_id", ""))
        work_location = wo.get("workLocation", "")
        if not wo_number or not work_location:
            discarded += 1
            continue
        standardized, street_name = parse_work_location(work_location)
        if not standardized or not validate_address(standardized, street_name):
            discarded += 1
            continue
        vendor = wo.get("vendor", {})
        work_orders.append({
            "address": standardized,
            "wo_number": wo_number,
            "date": wo.get("createdDate", "")[:10] if wo.get("createdDate") else "",
            "description": wo.get("description", ""),
            "vendor": (vendor.get("name", "") if vendor else ""),
            "status": wo.get("status", ""),
            "wo_type": wo.get("category", ""),
        })
    logger.info(f"Work orders: {len(work_orders)} extracted, {discarded} discarded")
    return work_orders


def extract_violations(docs):
    violations = []
    for v in docs:
        unit = v.get("unit", {})
        unit_name = unit.get("name", "") if unit else ""
        standardized, _ = parse_work_location(unit_name)
        violations.append({
            "address": standardized or unit_name,
            "date": v.get("violationDate", ""),
            "description": v.get("violationDescription", v.get("violationTypeDescription", "")),
            "status": v.get("violationStatus", ""),
        })
    logger.info(f"Violations: {len(violations)} extracted")
    return violations


def profile_address(name):
    """Standardize a home-owner unit name to a parcel code.

    The API gives e.g. "3510 Broadlands Lane #101  Broomfield CO 80023"; the city/state/ZIP
    follow a double space. Parse only the street part, with the same parser used for work
    orders, so "#101" becomes unit 1 -> "3510BL1".
    """
    street_part = name.split("  ")[0].strip() if name else ""
    standardized, street_name = parse_work_location(street_part)
    if standardized and validate_address(standardized, street_name):
        return standardized
    return None


def _join_unique(values, sep):
    seen = []
    for v in values:
        v = (v or "").strip()
        if v and v not in seen:
            seen.append(v)
    return sep.join(seen)


def extract_profiles(docs):
    """Extract one profile row per unit from the home-owner/grouping API response.

    The API returns one doc per owner contact, so a unit with two owners appears twice.
    Rows are merged by parcel code: owner names joined with " & ", emails/phones with "; ".
    Units whose address can't be parsed keep their raw street text as the key.
    """
    units = {}
    unparsed = 0
    for d in docs:
        name = d.get("name", "") or ""
        owner = d.get("owner", {}) or {}
        owner_name = " ".join(
            p for p in ((owner.get("names") or "").strip(), (owner.get("lastNames") or "").strip()) if p)

        address = profile_address(name)
        if not address:
            unparsed += 1
            address = name.split("  ")[0].strip()
        if not address:
            continue
        unit = units.setdefault(address, {"accounts": [], "names": [], "emails": [], "phones": []})
        unit["accounts"].append(str(d.get("accountNumber", "") or ""))
        unit["names"].append(owner_name)
        unit["emails"].append(owner.get("email", "") or "")
        unit["phones"].append(owner.get("phoneNumber", "") or "")

    today = datetime.now().strftime("%Y-%m-%d")
    profiles = []
    for address in sorted(units):
        u = units[address]
        profiles.append({
            "address": address,
            "account_number": _join_unique(u["accounts"], "; "),
            "account_name": _join_unique(u["names"], " & "),
            "email": _join_unique(u["emails"], "; "),
            "phone": _join_unique(u["phones"], "; "),
            "last_updated": today,
            "source": "Keystone",
        })
    logger.info(f"Profiles: {len(docs)} contacts merged into {len(profiles)} units"
                f" ({unparsed} with unparsed address)")
    return profiles


def extract_acc_reviews(docs):
    reviews = []
    for r in docs:
        unit = r.get("unit", {})
        unit_name = unit.get("name", "") if unit else ""
        standardized, _ = parse_work_location(unit_name)
        date_str = r.get("postedDate", "") or ""
        if "/" in date_str:
            parts = date_str.split("/")
            if len(parts) == 3:
                date_str = f"{parts[2]}-{parts[0]:0>2}-{parts[1]:0>2}"
        reviews.append({
            "address": standardized or unit_name,
            "date": date_str,
            "description": r.get("requestType", ""),
            "status": r.get("status", ""),
        })
    logger.info(f"ACC reviews: {len(reviews)} extracted")
    return reviews


# ── Google Sheets ─────────────────────────────────────────────────────────────

# Refuse to replace a tab with far fewer rows than it has now; a sudden drop almost always
# means a bad fetch, not real data. Small tabs (violations) legitimately swing, so the
# percentage rule only applies once a tab has GUARD_MIN_ROWS rows. --force overrides.
MIN_KEEP_FRACTION = 0.7
GUARD_MIN_ROWS = 20


def sheets_service():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    creds = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=['https://www.googleapis.com/auth/spreadsheets'])
    return build('sheets', 'v4', credentials=creds)


def current_row_count(svc, sheet_name):
    """Data rows (excluding header) currently in a tab; 0 if the tab doesn't exist."""
    from googleapiclient.errors import HttpError
    try:
        result = retry_sheets_call(lambda: svc.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range=f"{sheet_name}!A:A").execute())
    except HttpError as e:
        if e.resp.status == 400:
            return 0
        raise
    return max(0, len(result.get('values', [])) - 1)


def guard_problem(sheet_name, new_count, current_count):
    """Return a reason to refuse the write, or None if it looks safe."""
    if new_count == 0 and current_count > 0:
        return f"{sheet_name}: fetched 0 rows but the tab has {current_count}"
    if current_count >= GUARD_MIN_ROWS and new_count < MIN_KEEP_FRACTION * current_count:
        return (f"{sheet_name}: fetched {new_count} rows, below {MIN_KEEP_FRACTION:.0%} "
                f"of the {current_count} currently in the tab")
    return None


def write_sheet(svc, sheet_name, rows):
    """Write rows starting at A1, then clear only the stale rows below them.

    Writing before clearing means the tab is never empty, even if the run dies midway.
    """
    ss = retry_sheets_call(lambda: svc.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute())
    if not any(s['properties']['title'] == sheet_name for s in ss['sheets']):
        retry_sheets_call(lambda: svc.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={'requests': [{'addSheet': {'properties': {'title': sheet_name}}}]}
        ).execute())
    last_col = chr(ord('A') + len(rows[0]) - 1)
    retry_sheets_call(lambda: svc.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{sheet_name}!A1:{last_col}{len(rows)}",
        valueInputOption='RAW',
        body={'values': rows}).execute())
    retry_sheets_call(lambda: svc.spreadsheets().values().clear(
        spreadsheetId=SPREADSHEET_ID, range=f"{sheet_name}!A{len(rows) + 1}:Z").execute())
    logger.info(f"Wrote {len(rows)-1} rows to {sheet_name}")


# ── Main ──────────────────────────────────────────────────────────────────────

async def scrape(dry_run=False, force=False):
    env = load_env()
    username = env.get("KEYSTONE_USERNAME", "")
    password = env.get("KEYSTONE_PASSWORD", "")
    if not username or not password:
        logger.error("Could not read credentials from .env")
        return False

    # Step 1: Login via Playwright to get JWT
    try:
        auth_header = await login_and_get_token(username, password)
    except Exception as e:
        logger.error(f"Login failed: {e}")
        return False

    # Step 2: Fetch everything before writing anything, so a failure part-way through
    # can't leave some tabs new and others stale or empty.
    client = CINCApiClient(auth_header)
    try:
        logger.info("Fetching work orders...")
        all_work_orders = extract_work_orders(client.get_all(f"/api/v1/bod/work-orders/{GROUPING_ID}"))
        logger.info("Fetching violations...")
        all_violations = extract_violations(client.get_all(f"/api/v1/bod/violations/{GROUPING_ID}"))
        logger.info("Fetching ACC reviews...")
        all_acc_reviews = extract_acc_reviews(client.get_all(f"/api/v1/bod/acc-review/{GROUPING_ID}"))
        logger.info("Fetching homeowner profiles...")
        all_profiles = extract_profiles(client.get_all(f"/api/v1/bod/home-owner/grouping/{GROUPING_ID}"))
    except Exception as e:
        logger.error(f"Fetch failed, sheet left untouched: {e}")
        return False

    wo_rows = [['Address', 'WO Number', 'Date Created', 'Description', 'Vendor', 'Status', 'Type']]
    for wo in all_work_orders:
        wo_rows.append([wo['address'], wo['wo_number'], wo['date'],
                        wo['description'], wo['vendor'], wo['status'], wo['wo_type']])
    v_rows = [['Address', 'Date', 'Description', 'Status']]
    for v in all_violations:
        v_rows.append([v['address'], v['date'], v['description'], v['status']])
    a_rows = [['Address', 'Date', 'Description', 'Status']]
    for a in all_acc_reviews:
        a_rows.append([a['address'], a['date'], a['description'], a['status']])
    p_rows = [['Address', 'AccountNumber', 'AccountName', 'Email', 'Phone', 'LastUpdated', 'Source']]
    for p in all_profiles:
        p_rows.append([p['address'], p['account_number'], p['account_name'],
                       p['email'], p['phone'], p['last_updated'], p['source']])
    tabs = [(WORKORDERS_SHEET, wo_rows), (VIOLATIONS_SHEET, v_rows),
            (ARCHREVIEWS_SHEET, a_rows), (PROFILES_SHEET, p_rows)]

    svc = sheets_service()
    problems = []
    logger.info("=== Summary (new rows vs current tab) ===")
    for sheet_name, rows in tabs:
        current = current_row_count(svc, sheet_name)
        logger.info(f"{sheet_name}: {len(rows) - 1} new, {current} current")
        problem = guard_problem(sheet_name, len(rows) - 1, current)
        if problem:
            problems.append(problem)

    if problems:
        for problem in problems:
            logger.error(f"Guard: {problem}")
        if not force:
            logger.error("Refusing to write; sheet left untouched (use --force if the drop is real)")
            return False
        logger.warning("--force given; writing despite guard warnings")

    if dry_run:
        logger.info("[DRY RUN] Skipping sheet writes")
        return True

    for sheet_name, rows in tabs:
        write_sheet(svc, sheet_name, rows)

    last_run_path = Path(__file__).parent / "last_run.txt"
    with open(last_run_path, "w") as f:
        f.write(f"Last successful run: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n")

    return True


def main():
    parser = argparse.ArgumentParser(description='Keystone CINC Connect Scraper v2')
    parser.add_argument('--dry-run', action='store_true', help='Don\'t write to Google Sheets')
    parser.add_argument('--force', action='store_true',
                        help='Write even if a tab would shrink sharply (use only when the drop is real)')
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Keystone CINC Connect Scraper v2 (REST API)")
    logger.info("=" * 60)

    success = asyncio.run(scrape(dry_run=args.dry_run, force=args.force))
    if success:
        logger.info("Scraping completed successfully")
        sys.exit(0)
    else:
        logger.error("Scraping failed")
        sys.exit(1)


if __name__ == "__main__":
    main()