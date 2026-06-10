#!/usr/bin/env python3
"""
Broadlands Master Association document sync.

Maintains a local manifest of Keystone document IDs. On each run:
  - Logs in and switches to the Broadlands portal account
  - Scrapes the current document list for each target folder
  - Compares against the saved manifest
  - Downloads any new or changed files
  - Updates the corresponding Google Drive files in-place (same file ID = same link)
  - Emails dee@wmbuck.net if anything changed
  - Updates the manifest

First-time setup:
  venv/bin/python broadlands_docs.py --init

Subsequent runs (cron):
  venv/bin/python broadlands_docs.py

Flags:
  --init      Build manifest from current portal state (run once after initial upload)
  --headed    Show browser window (useful for debugging)
  --dry-run   Report changes but don't download, upload, or update manifest
"""

import json
import mimetypes
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.common.exceptions import NoSuchElementException
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service

USE_CHROME = os.environ.get('USE_CHROME', '').lower() in ('1', 'true', 'yes')
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# ── configuration ─────────────────────────────────────────────────────────────

KEYSTONE_URL      = "https://kppm.cincwebaxis.com"
CREDS_PATH        = os.path.expanduser("~/.config/openclaw/google-service-account.json")
HOMEOWNER_DRIVE_ID = "0ALIbXXUEyG4GUk9PVA"
BRL_FOLDER_ID     = "1OmARhr1cvEyKYPYSfc1XNTHi0WK5x3ie"   # BRL Master Documents
MANIFEST_PATH     = Path(__file__).parent / "broadlands_manifest.json"
NOTIFY_EMAIL      = "dee@wmbuck.net"

# Folders to monitor: (keystone_folder_id, local_name, drive_subfolder_name)
TARGET_FOLDERS = [
    (489, "Architectural",       "Architectural"),
    (25,  "Governing Documents", "Governing Documents"),
]

# Drive subfolder IDs (created during initial upload)
DRIVE_SUBFOLDER_IDS = {
    "Architectural":       "16StU165ncThAnnEd-NCtUXMKYgcmIxYh",
    "Governing Documents": "1-w80QUYhD930EMvKujCuSHsreoBBi35C",
}

WORK_DIR = Path("/tmp/broadlands_docs")

# ── helpers ───────────────────────────────────────────────────────────────────

def load_env():
    if not os.environ.get('KEYSTONE_USERNAME'):
        env_file = Path(__file__).parent / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"[{ts}] {msg}", flush=True)

def load_manifest():
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {"last_checked": None, "folders": {}}

def save_manifest(manifest):
    manifest["last_checked"] = datetime.now().isoformat()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))

def send_email(subject, body):
    try:
        subprocess.run(
            ["mail", "-s", subject, NOTIFY_EMAIL],
            input=body.encode(),
            check=True,
            timeout=30,
        )
        log(f"Email sent: {subject}")
    except Exception as e:
        log(f"Email failed: {e}")

# ── browser setup ─────────────────────────────────────────────────────────────

def init_browser(headless):
    if USE_CHROME:
        options = ChromeOptions()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        driver = webdriver.Chrome(options=options)
    else:
        options = FirefoxOptions()
        if headless:
            options.add_argument("--headless")
        try:
            service = Service(GeckoDriverManager().install())
            driver = webdriver.Firefox(service=service, options=options)
        except Exception:
            driver = webdriver.Firefox(options=options)
    driver.set_page_load_timeout(30)
    driver.implicitly_wait(5)
    return driver

def login_and_switch(driver):
    wait = WebDriverWait(driver, 15)

    log("Logging in to Keystone portal...")
    driver.get(f"{KEYSTONE_URL}/Account/LoginModernThemes")
    time.sleep(2)
    wait.until(EC.presence_of_element_located((By.ID, "UserName"))).send_keys(
        os.environ['KEYSTONE_USERNAME'])
    driver.find_element(By.ID, "Password").send_keys(os.environ['KEYSTONE_PASSWORD'])
    driver.find_element(By.ID, "btnLogin").click()
    time.sleep(4)

    log("Switching to Broadlands account...")
    driver.get(f"{KEYSTONE_URL}/account/dashboard")
    time.sleep(3)

    trigger = driver.find_element(By.XPATH,
        "//a[contains(@href,'#') and (contains(@class,'dropdown') or contains(@class,'account'))]")
    driver.execute_script("arguments[0].click();", trigger)
    time.sleep(1)

    wait.until(EC.element_to_be_clickable(
        (By.XPATH, "//*[contains(text(),'Switch Account')]"))).click()
    time.sleep(2)

    radio = driver.find_element(By.XPATH,
        "//input[@type='radio'][following::*[contains(text(),'Broadlands')][1]]")
    driver.execute_script("arguments[0].click();", radio)
    time.sleep(0.5)

    driver.find_element(By.XPATH,
        "//input[@type='submit' or @type='button'][contains(@value,'Switch')]").click()
    time.sleep(5)

    if 'Broadlands' not in driver.title:
        raise RuntimeError(f"Account switch failed — title: {driver.title}")
    log(f"On Broadlands account: {driver.title}")

def make_session(driver):
    session = requests.Session()
    for cookie in driver.get_cookies():
        session.cookies.set(cookie['name'], cookie['value'],
                            domain=cookie.get('domain', ''))
    session.headers['User-Agent'] = driver.execute_script("return navigator.userAgent;")
    return session

# ── portal scraping ───────────────────────────────────────────────────────────

def scrape_folder(driver, folder_id):
    """
    Click a folder in the document library.
    Returns list of (display_name, keystone_doc_id) tuples.
    """
    try:
        trigger = driver.find_element(By.XPATH,
            f"//div[contains(@onclick,'GetDocumentFiles({folder_id})')]")
    except NoSuchElementException:
        log(f"  WARNING: folder id={folder_id} not found in DOM")
        return []

    driver.execute_script("arguments[0].click();", trigger)
    time.sleep(3)

    docs = []
    seen = set()
    for a in driver.find_elements(By.CSS_SELECTOR, "a.document-file-anchor-color"):
        href = a.get_attribute("href") or ""
        name = a.text.strip()
        if not href or not name or "/account/d/" not in href:
            continue
        m = re.search(r'/account/d/(\d+)', href)
        if not m:
            continue
        doc_id = m.group(1)
        if doc_id not in seen:
            seen.add(doc_id)
            docs.append((name, doc_id))

    return docs

# ── download ──────────────────────────────────────────────────────────────────

def download_doc(session, doc_id, dest_path):
    """Download a document by its Keystone doc ID. Returns (actual_path, size_kb)."""
    url = f"{KEYSTONE_URL}/account/d/{doc_id}"
    resp = session.get(url, allow_redirects=True, timeout=30)
    resp.raise_for_status()

    # Honour Content-Disposition filename if present
    cd = resp.headers.get("Content-Disposition", "")
    if 'filename=' in cd:
        m = re.search(r'filename=["\']?([^"\';\r\n]+)', cd)
        if m:
            better = m.group(1).strip()
            if better:
                dest_path = dest_path.parent / better

    dest_path.write_bytes(resp.content)
    return dest_path, len(resp.content) // 1024

# ── Google Drive ──────────────────────────────────────────────────────────────

def init_drive():
    creds = service_account.Credentials.from_service_account_file(
        CREDS_PATH, scopes=['https://www.googleapis.com/auth/drive'])
    return build('drive', 'v3', credentials=creds.with_subject('admin@villasboulders.org'))

def find_drive_file(drive, name, folder_id):
    """Return file ID if a file with this name exists in the Drive folder, else None."""
    results = drive.files().list(
        q=f"name='{name}' and '{folder_id}' in parents and trashed=false",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        fields='files(id,name)'
    ).execute()
    files = results.get('files', [])
    return files[0]['id'] if files else None

def upload_to_drive(drive, local_path, folder_id, existing_file_id=None):
    """
    Upload a file to Drive. If existing_file_id is given, update in-place
    (preserving the file ID and thus all existing links).
    Returns the Drive file ID.
    """
    mime = mimetypes.guess_type(local_path.name)[0] or 'application/octet-stream'
    media = MediaFileUpload(str(local_path), mimetype=mime, resumable=False)

    if existing_file_id:
        result = drive.files().update(
            fileId=existing_file_id,
            body={'name': local_path.name},
            media_body=media,
            supportsAllDrives=True,
            fields='id,name,webViewLink'
        ).execute()
        return result['id'], result.get('webViewLink', ''), 'updated'
    else:
        result = drive.files().create(
            body={'name': local_path.name, 'parents': [folder_id]},
            media_body=media,
            supportsAllDrives=True,
            fields='id,name,webViewLink'
        ).execute()
        return result['id'], result.get('webViewLink', ''), 'new'

# ── main logic ────────────────────────────────────────────────────────────────

def run(headless=True, dry_run=False, init_mode=False):
    load_env()
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    drive = init_drive()

    driver = init_browser(headless)
    try:
        login_and_switch(driver)

        log("Navigating to document library...")
        driver.get(f"{KEYSTONE_URL}/p8006/documents/")
        time.sleep(4)

        session = make_session(driver)
        changes = []   # list of strings for the email

        for folder_id, folder_name, drive_subname in TARGET_FOLDERS:
            log(f"\nChecking folder: {folder_name} (id={folder_id})")
            current_docs = scrape_folder(driver, folder_id)
            log(f"  Portal shows {len(current_docs)} document(s)")

            if not current_docs:
                continue

            saved = manifest.get("folders", {}).get(folder_name, {})
            # saved is { display_name: keystone_doc_id }

            drive_folder_id = DRIVE_SUBFOLDER_IDS[drive_subname]
            folder_work_dir = WORK_DIR / folder_name
            folder_work_dir.mkdir(parents=True, exist_ok=True)

            new_saved = {}
            for display_name, doc_id in current_docs:
                new_saved[display_name] = doc_id
                old_id = saved.get(display_name)

                if init_mode:
                    # Just record — don't download or upload
                    continue

                if old_id == doc_id:
                    log(f"  [unchanged] {display_name}")
                    continue

                action = "NEW" if old_id is None else "UPDATED"
                log(f"  [{action}] {display_name}  (doc_id: {old_id} → {doc_id})")

                if dry_run:
                    changes.append(f"  {action}: {folder_name}/{display_name}")
                    continue

                # Download
                dest = folder_work_dir / display_name
                actual_path, size_kb = download_doc(session, doc_id, dest)
                log(f"    Downloaded: {actual_path.name} ({size_kb} KB)")

                # Upload to Drive (update in-place if already there, else create)
                existing_id = find_drive_file(drive, actual_path.name, drive_folder_id)
                file_id, link, op = upload_to_drive(drive, actual_path, drive_folder_id, existing_id)
                log(f"    Drive {op}: {link}")

                changes.append(
                    f"  {action}: {folder_name}/{actual_path.name}\n"
                    f"    Drive link: {link}"
                )

            # Check for removed documents
            for old_name in saved:
                if old_name not in new_saved:
                    log(f"  [REMOVED from portal] {old_name}")
                    changes.append(
                        f"  REMOVED from portal: {folder_name}/{old_name}\n"
                        f"    (Drive copy retained — review manually)"
                    )

            if not init_mode:
                manifest.setdefault("folders", {})[folder_name] = new_saved
            else:
                manifest.setdefault("folders", {})[folder_name] = new_saved

    finally:
        driver.quit()

    if init_mode:
        log("\nInit mode: manifest built from current portal state.")
        save_manifest(manifest)
        log(f"Manifest saved to {MANIFEST_PATH}")
        return

    if not dry_run:
        save_manifest(manifest)

    if changes:
        body = (
            f"Broadlands Master Association documents changed as of "
            f"{datetime.now().strftime('%Y-%m-%d %H:%M')}:\n\n"
            + "\n".join(changes)
            + "\n\nDrive folder: https://drive.google.com/drive/folders/"
            + BRL_FOLDER_ID
            + "\n\nReminders:\n"
            + "  - Update website links if file URLs changed (new files only)\n"
            + "  - Updated files keep the same Drive link — no link changes needed\n"
            + "  - Review Policy Directory for any needed updates\n"
            + "  - Consider notifying homeowners if governing docs changed\n"
        )
        if not dry_run:
            send_email("Broadlands documents updated", body)
        else:
            log("\n[dry-run] Email that would be sent:")
            print(body)
    else:
        log("\nNo changes detected.")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--init",     action="store_true", help="Build manifest from current portal state")
    parser.add_argument("--headed",   action="store_true", help="Show browser window")
    parser.add_argument("--dry-run",  action="store_true", help="Report changes without downloading/uploading")
    args = parser.parse_args()

    log("=" * 55)
    log("Broadlands document sync")
    log("=" * 55)

    run(headless=not args.headed, dry_run=args.dry_run, init_mode=args.init)


if __name__ == "__main__":
    main()
