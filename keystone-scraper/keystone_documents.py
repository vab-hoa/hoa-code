#!/usr/bin/env python3
"""
Keystone portal Documents library monitor.

On each nightly run, scrapes the VaB Documents section of the Keystone portal.

For files in DOCUMENT_MAPPINGS:
  New files are downloaded and copied to the mapped Google Drive folder.

For new files anywhere else in the Documents tree:
  One alert email is sent to ALERT_EMAILS listing each file's name and location.

State is tracked in keystone_docs_manifest.json. That file is committed to
the hoa-code repo after each run so state persists between GitHub Actions runs.

Usage:
  python keystone_documents.py              # normal nightly run
  python keystone_documents.py --init       # build manifest from current state (run once)
  python keystone_documents.py --explore    # dump folder tree and exit (no manifest changes)
  python keystone_documents.py --dry-run    # detect changes, no downloads/uploads/email
  python keystone_documents.py --headed     # show browser window (for local debugging)
"""

import base64
import json
import mimetypes
import os
import re
import sys
import time
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

USE_CHROME = os.environ.get('USE_CHROME', '').lower() in ('1', 'true', 'yes')

# ── configuration ──────────────────────────────────────────────────────────────

KEYSTONE_URL  = "https://kppm.cincwebaxis.com"
CREDS_PATH    = os.path.expanduser("~/.config/openclaw/google-service-account.json")
MANIFEST_PATH = Path(__file__).parent / "keystone_docs_manifest.json"
WORK_DIR      = Path("/tmp/keystone_documents")

GMAIL_SENDER = "admin@villasboulders.org"

# Who gets emailed about new files that have no mapping
ALERT_EMAILS = [
    "president@villasboulders.org",
    "secretary@villasboulders.org",
    "itofficer@villasboulders.org",
    "admin@villasboulders.org",
]

# Maps portal path patterns to Google Drive destinations with year-based routing.
# Folders are on shared drives, so we include the shared drive ID for proper queries.
#
# Format: {
#   "parent": folder_id,
#   "shared_drive": shared_drive_id,
#   "intermediate": "folder_name" (optional)
# }
#
# The script extracts YYYY from the path and finds: parent → [intermediate] → year
DOCUMENT_MAPPINGS = {
    "Board - Financials": {
        "parent": "1MUlUcjTZ506AOifBThfuzhZmViUbHW2Q",  # Homeowner Docs/Financials
        "shared_drive": "0ALIbXXUEyG4GUk9PVA",  # VaB Homeowner Documents
        "intermediate": "Keystone Financial Reports"
    },
    "Financials": {
        "parent": "1MUlUcjTZ506AOifBThfuzhZmViUbHW2Q",  # Same destination as Board - Financials
        "shared_drive": "0ALIbXXUEyG4GUk9PVA",
        "intermediate": "Keystone Financial Reports"
    },
    "General Session Minutes": {
        "parent": "1I-A7N2b2tO-DD2nofyUd7Efhd19D2d4y",  # Homeowner Docs/Meetings
        "shared_drive": "0ALIbXXUEyG4GUk9PVA",
        "intermediate": None  # Year folders are direct children
    },
}

# ── helpers ────────────────────────────────────────────────────────────────────

def log(msg):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] {msg}", flush=True)

def load_manifest():
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {"last_checked": None, "files": {}}

def save_manifest(manifest):
    manifest["last_checked"] = datetime.now().isoformat()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))

def load_env():
    if not os.environ.get('KEYSTONE_USERNAME'):
        env_file = Path(__file__).parent / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

# ── browser setup ──────────────────────────────────────────────────────────────

def init_browser(headless=True):
    if USE_CHROME:
        options = ChromeOptions()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(options=options)
    else:
        options = FirefoxOptions()
        if headless:
            options.add_argument('--headless')
        try:
            service = Service(GeckoDriverManager().install())
            driver = webdriver.Firefox(service=service, options=options)
        except Exception:
            driver = webdriver.Firefox(options=options)
    driver.set_page_load_timeout(30)
    driver.implicitly_wait(5)
    return driver

def login(driver):
    log("Logging in to Keystone portal...")
    wait = WebDriverWait(driver, 15)
    driver.get(f"{KEYSTONE_URL}/Account/LoginModernThemes")
    time.sleep(2)
    wait.until(EC.presence_of_element_located((By.ID, "UserName"))).send_keys(
        os.environ['KEYSTONE_USERNAME'])
    driver.find_element(By.ID, "Password").send_keys(os.environ['KEYSTONE_PASSWORD'])
    driver.find_element(By.ID, "btnLogin").click()
    time.sleep(4)
    if 'dashboard' not in driver.current_url.lower() and 'home' not in driver.current_url.lower():
        raise RuntimeError(f"Login failed — URL: {driver.current_url}")
    log(f"Logged in: {driver.current_url}")

def make_session(driver):
    """Copy browser cookies into a requests.Session for file downloads."""
    session = requests.Session()
    for cookie in driver.get_cookies():
        session.cookies.set(cookie['name'], cookie['value'],
                            domain=cookie.get('domain', ''))
    session.headers['User-Agent'] = driver.execute_script("return navigator.userAgent;")
    return session

# ── portal folder tree ─────────────────────────────────────────────────────────

def discover_folder_tree(driver):
    """
    Navigate to the Documents page and infer the folder hierarchy from DOM nesting.
    Returns {folder_id: {name, path}} where path is like "Board - Financials/2025".

    Falls back gracefully if the portal renders a flat list (depth = 0 for all).
    """
    log("Loading Documents page...")
    driver.get(f"{KEYSTONE_URL}/p9060/documents/")
    time.sleep(5)

    # Extract all GetDocumentFiles elements with their DOM nesting depth (li-count)
    raw = driver.execute_script("""
        const result = [];
        document.querySelectorAll('[onclick]').forEach(el => {
            const oc = el.getAttribute('onclick') || '';
            const m = oc.match(/GetDocumentFiles\\((\\d+)\\)/);
            if (!m) return;
            const name = (el.textContent || '').trim().replace(/\\s+/g, ' ');
            if (!name) return;
            let depth = 0;
            let node = el.parentElement;
            while (node && node.tagName !== 'BODY') {
                if (node.tagName === 'LI') depth++;
                node = node.parentElement;
            }
            result.push({ id: parseInt(m[1]), name: name, depth: depth });
        });
        return result;
    """)

    if not raw:
        log("WARNING: No GetDocumentFiles elements found on Documents page.")
        return {}

    # Build paths using a stack keyed by depth
    path_stack = []   # list of (depth, name)
    tree = {}
    seen_ids = set()
    for item in raw:
        fid   = item['id']
        name  = item['name']
        depth = item['depth']
        if fid in seen_ids:
            continue
        seen_ids.add(fid)

        # Pop stack entries at same depth or deeper
        while path_stack and path_stack[-1][0] >= depth:
            path_stack.pop()
        path_stack.append((depth, name))

        path = '/'.join(n for _, n in path_stack)
        tree[fid] = {'name': name, 'path': path}

    log(f"Discovered {len(tree)} folder(s)")
    return tree

# ── document scraping ──────────────────────────────────────────────────────────

def scrape_folder_docs(driver, folder_id):
    """
    Click a folder and return {filename: doc_id} for the documents that appear.
    Ensures the folder's content has loaded before scraping.
    """
    try:
        trigger = driver.find_element(
            By.XPATH, f"//*[contains(@onclick,'GetDocumentFiles({folder_id})')]")
        driver.execute_script("arguments[0].click();", trigger)
        time.sleep(1)

        # Wait for document list to load/update (has onclick with GetDocumentFiles)
        # This ensures we're seeing the current folder's files, not stale ones from previous folder
        wait = WebDriverWait(driver, 10)
        wait.until(EC.presence_of_all_elements_located(
            (By.CSS_SELECTOR, "a.document-file-anchor-color")))
        time.sleep(1)  # Extra buffer after elements appear
    except (NoSuchElementException, TimeoutException):
        return {}

    docs = {}
    seen = set()
    for a in driver.find_elements(By.CSS_SELECTOR, "a.document-file-anchor-color"):
        href = a.get_attribute("href") or ""
        name = a.text.strip()
        if not href or not name:
            continue

        # Skip generic junk entries (size indicators, timestamps, etc.)
        # These appear to be rendering artifacts from the Keystone portal
        if re.match(r'^(\d+\s*(MB|KB|GB)|[\d/\-:]+\s*(AM|PM|UTC)?)$', name):
            continue

        m = re.search(r'/account/d/(\d+)', href)
        if not m:
            continue
        doc_id = m.group(1)
        if doc_id not in seen:
            seen.add(doc_id)
            docs[name] = doc_id
    return docs

def scrape_all_documents(driver, folder_tree):
    """
    Click every folder and collect documents.
    Returns {path: {filename: doc_id}}.
    """
    current = {}
    for fid, info in folder_tree.items():
        path = info['path']
        docs = scrape_folder_docs(driver, fid)
        if docs:
            current[path] = docs
            log(f"  {path}: {len(docs)} file(s)")
    return current

# ── download and upload ────────────────────────────────────────────────────────

def download_doc(session, doc_id, filename):
    """Download a document from the portal. Returns Path to local file."""
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    url = f"{KEYSTONE_URL}/account/d/{doc_id}"
    resp = session.get(url, allow_redirects=True, timeout=30)
    resp.raise_for_status()

    # Honour Content-Disposition filename if present
    cd = resp.headers.get("Content-Disposition", "")
    if 'filename=' in cd:
        m = re.search(r'filename=["\']?([^"\';\r\n]+)', cd)
        if m:
            actual = m.group(1).strip()
            if actual:
                filename = actual

    dest = WORK_DIR / filename
    dest.write_bytes(resp.content)
    log(f"    Downloaded: {dest.name} ({len(resp.content) // 1024} KB)")
    return dest

def init_drive():
    creds = service_account.Credentials.from_service_account_file(
        CREDS_PATH, scopes=['https://www.googleapis.com/auth/drive'])
    return build('drive', 'v3', credentials=creds.with_subject('admin@villasboulders.org'))

def upload_to_drive(drive, local_path, folder_id):
    """Upload a file to Drive. Returns the web view link."""
    mime = mimetypes.guess_type(local_path.name)[0] or 'application/octet-stream'
    media = MediaFileUpload(str(local_path), mimetype=mime, resumable=False)

    # Update in-place if a file with this name already exists (preserves link)
    existing = drive.files().list(
        q=f"name='{local_path.name}' and '{folder_id}' in parents and trashed=false",
        supportsAllDrives=True, includeItemsFromAllDrives=True,
        fields='files(id)'
    ).execute().get('files', [])

    if existing:
        result = drive.files().update(
            fileId=existing[0]['id'],
            body={'name': local_path.name},
            media_body=media,
            supportsAllDrives=True,
            fields='webViewLink'
        ).execute()
        log(f"    Drive updated: {result.get('webViewLink', '(no link)')}")
    else:
        result = drive.files().create(
            body={'name': local_path.name, 'parents': [folder_id]},
            media_body=media,
            supportsAllDrives=True,
            fields='webViewLink'
        ).execute()
        log(f"    Drive created: {result.get('webViewLink', '(no link)')}")

    return result.get('webViewLink', '')

# ── email ──────────────────────────────────────────────────────────────────────

def init_gmail():
    creds = service_account.Credentials.from_service_account_file(
        CREDS_PATH,
        scopes=['https://www.googleapis.com/auth/gmail.send'])
    return build('gmail', 'v1', credentials=creds.with_subject(GMAIL_SENDER))

def send_alert_email(gmail, unmapped_new):
    """Alert ALERT_EMAILS about new portal files with no mapping."""
    lines = [f"  {path}/{filename}" for path, filename in unmapped_new]
    body = (
        "New file(s) appeared in the Keystone portal Documents library "
        "that are not covered by any automatic sync mapping.\n\n"
        "Files:\n"
        + "\n".join(lines)
        + "\n\nPortal location:\n"
        "  https://kppm.cincwebaxis.com/p9060/documents/\n\n"
        "If these files should be copied to Google Drive automatically,\n"
        "update DOCUMENT_MAPPINGS in keystone-scraper/keystone_documents.py\n"
        "in the hoa-code repository."
    )
    msg = MIMEText(body, 'plain')
    msg['Subject'] = "New files in Keystone portal Documents — review needed"
    msg['From'] = GMAIL_SENDER
    msg['To'] = ', '.join(ALERT_EMAILS)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    gmail.users().messages().send(userId='me', body={'raw': raw}).execute()
    log(f"Alert email sent to: {', '.join(ALERT_EMAILS)}")

# ── main logic ─────────────────────────────────────────────────────────────────

def find_drive_folder_for_path(path, drive=None):
    """
    Return Drive folder ID if path matches a mapping, else None.

    Supports dynamic year-based routing with intermediate folders:
    - Path "Financials/2026/file.pdf" matches mapping "Financials"
    - Extracts year (2026)
    - If intermediate folder specified, finds: parent → intermediate → year
    - If no intermediate, finds: parent → year
    - Returns the year-specific subfolder ID
    """
    path_parts = path.split('/')

    # Try pattern matches with year extraction (order matters - longest patterns first)
    for mapped_pattern in sorted(DOCUMENT_MAPPINGS.keys(), key=len, reverse=True):
        mapping = DOCUMENT_MAPPINGS[mapped_pattern]
        pattern_parts = mapped_pattern.split('/')

        # Check if path starts with this pattern
        if len(path_parts) >= len(pattern_parts):
            if path_parts[:len(pattern_parts)] == pattern_parts:
                # Pattern matched!
                # Try to extract year from remaining path
                if len(path_parts) > len(pattern_parts):
                    potential_year = path_parts[len(pattern_parts)]
                    # Check if this looks like a year (4 digits, 19xx or 20xx or 21xx)
                    year_match = re.match(r'^(19|20|21)\d{2}$', potential_year)
                    if year_match and drive:
                        parent_id = mapping.get("parent")
                        intermediate = mapping.get("intermediate")

                        try:
                            shared_drive = mapping.get("shared_drive")

                            # Step 1: If intermediate folder exists, find it first
                            search_in = parent_id
                            if intermediate:
                                query = f"name='{intermediate}' and mimeType='application/vnd.google-apps.folder' and '{parent_id}' in parents and trashed=false"
                                results = drive.files().list(
                                    q=query,
                                    spaces='drive',
                                    pageSize=1,
                                    corpora='drive',
                                    driveId=shared_drive,
                                    includeItemsFromAllDrives=True,
                                    supportsAllDrives=True,
                                    fields='files(id)'
                                ).execute()
                                intermediate_folders = results.get('files', [])
                                if not intermediate_folders:
                                    log(f"WARNING: Intermediate folder '{intermediate}' not found in {parent_id}")
                                    return parent_id
                                search_in = intermediate_folders[0]['id']

                            # Step 2: Find the year folder inside parent (or intermediate)
                            query = f"name='{potential_year}' and mimeType='application/vnd.google-apps.folder' and '{search_in}' in parents and trashed=false"
                            results = drive.files().list(
                                q=query,
                                spaces='drive',
                                pageSize=1,
                                corpora='drive',
                                driveId=shared_drive,
                                includeItemsFromAllDrives=True,
                                supportsAllDrives=True,
                                fields='files(id)'
                            ).execute()
                            year_folders = results.get('files', [])
                            if year_folders:
                                year_folder_id = year_folders[0]['id']
                                return year_folder_id
                            else:
                                log(f"WARNING: Year folder '{potential_year}' not found in {search_in}")

                        except Exception as e:
                            log(f"WARNING: Error looking up year folder {potential_year}: {e}")

                    # If year lookup failed, return parent (fallback)
                    return mapping.get("parent")

    return None

def run(headless=True, dry_run=False, init_mode=False, explore_mode=False):
    load_env()
    manifest = load_manifest()

    driver = init_browser(headless)
    try:
        login(driver)

        folder_tree = discover_folder_tree(driver)

        if explore_mode:
            print("\n=== Folder tree ===")
            for fid, info in sorted(folder_tree.items(), key=lambda x: x[1]['path']):
                print(f"  [{fid:5}] {info['path']}")
            print(f"\n=== DOCUMENT_MAPPINGS keys that match ===")
            for mapped_path in DOCUMENT_MAPPINGS:
                matched = [info['path'] for info in folder_tree.values()
                           if info['path'] == mapped_path or info['path'].startswith(mapped_path + '/')]
                status = "MATCHED" if matched else "NOT FOUND"
                print(f"  {status}: {mapped_path}")
            return

        log("Scraping documents in each folder...")
        current_files = scrape_all_documents(driver, folder_tree)
        session = make_session(driver)

    finally:
        driver.quit()

    if init_mode:
        manifest['files'] = current_files
        save_manifest(manifest)
        log(f"Init complete. {sum(len(v) for v in current_files.values())} files recorded.")
        return

    # Compare against manifest
    known_files = manifest.get('files', {})

    # Initialize drive service early so we can do year lookups
    drive = init_drive()
    gmail = None
    unmapped_new = []  # (path, filename)
    synced = []        # (path, filename, drive_link)

    for path, files in current_files.items():
        known = known_files.get(path, {})
        for filename, doc_id in files.items():
            if filename in known:
                continue

            log(f"  NEW: {path}/{filename}")
            drive_folder_id = find_drive_folder_for_path(path, drive)

            if drive_folder_id:
                if not dry_run:
                    if drive is None:
                        drive = init_drive()
                    local_path = download_doc(session, doc_id, filename)
                    link = upload_to_drive(drive, local_path, drive_folder_id)
                    synced.append((path, filename, link))
                else:
                    log(f"    [DRY RUN] Would copy to Drive folder {drive_folder_id}")
                    synced.append((path, filename, None))
            else:
                unmapped_new.append((path, filename))

    # Send alert for unmapped new files
    if unmapped_new:
        log(f"{len(unmapped_new)} unmapped new file(s) — sending alert...")
        if not dry_run:
            if gmail is None:
                gmail = init_gmail()
            send_alert_email(gmail, unmapped_new)
        else:
            log("[DRY RUN] Would send alert email")
            for path, filename in unmapped_new:
                log(f"  {path}/{filename}")

    if synced:
        log(f"Synced {len(synced)} file(s) to Drive:")
        for path, filename, link in synced:
            log(f"  {path}/{filename}" + (f" → {link}" if link else ""))

    if not synced and not unmapped_new:
        log("No new files found.")

    # Update manifest with current state
    if not dry_run:
        manifest['files'] = current_files
        save_manifest(manifest)

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Keystone portal Documents monitor')
    parser.add_argument('--init',     action='store_true', help='Build manifest from current state (run once)')
    parser.add_argument('--explore',  action='store_true', help='Print folder tree and exit')
    parser.add_argument('--dry-run',  action='store_true', help='Detect changes without syncing or emailing')
    parser.add_argument('--headed',   action='store_true', help='Show browser window')
    args = parser.parse_args()

    log("=" * 55)
    log("Keystone Documents monitor")
    log("=" * 55)

    run(
        headless=not args.headed,
        dry_run=args.dry_run,
        init_mode=args.init,
        explore_mode=args.explore,
    )

if __name__ == '__main__':
    main()
