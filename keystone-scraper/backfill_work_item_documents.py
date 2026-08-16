#!/usr/bin/env python3
"""
Keystone Document Backfill for Work Items
Retrieves supporting documents from Keystone portal for all existing work items
(ARC Requests, Work Orders, Landscaping Requests) and imports them into Supabase.

Usage:
    python backfill_work_item_documents.py --category work_order --dry-run
    python backfill_work_item_documents.py --category arc_request --dry-run
    python backfill_work_item_documents.py --category all --dry-run
    python backfill_work_item_documents.py --category arc_request --write

Flags:
    --category {work_order,arc_request,all}  Categories to backfill (default: all)
    --dry-run                                 Discover matches, don't download/write
    --write                                   Download and write to Supabase
    --headed                                  Show browser window for debugging
"""

import os
import sys
import json
import time
import logging
import argparse
import re
from datetime import datetime, timezone
from pathlib import Path

import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None

try:
    from supabase import create_client
except ImportError:
    create_client = None

USE_CHROME = os.environ.get('USE_CHROME', '').lower() in ('1', 'true', 'yes')

# ============================================================
# Configuration
# ============================================================

KEYSTONE_URL = "https://kppm.cincwebaxis.com"
KEYSTONE_USERNAME = os.environ.get('KEYSTONE_USERNAME')
KEYSTONE_PASSWORD = os.environ.get('KEYSTONE_PASSWORD')

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://obveytoovkzjrpzrhrim.supabase.co')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
SUPABASE_HOST = os.environ.get('SUPABASE_HOST', 'db.obveytoovkzjrpzrhrim.supabase.co')
SUPABASE_USER = os.environ.get('SUPABASE_USER', 'postgres')
SUPABASE_PASSWORD_FILE = '/tmp/.supabase_db_password'

SCRIPT_DIR = Path(__file__).parent
MANIFEST_PATH = SCRIPT_DIR / "keystone_backfill_manifest.json"
WORK_DIR = Path("/tmp/keystone_backfill_documents")

# For address standardization
sys.path.insert(0, str(SCRIPT_DIR.parent / "hoa-tracker"))
try:
    from address_standardization import standardize_address
except ImportError:
    def standardize_address(addr):
        return addr or ""

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================
# Manifest Management
# ============================================================

def load_manifest():
    """Load idempotency manifest (tracks imported Keystone doc IDs)."""
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {"last_checked": None, "imported_docs": {}}

def save_manifest(manifest):
    """Save manifest with current timestamp."""
    manifest["last_checked"] = datetime.now().isoformat()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))

def is_doc_imported(manifest, keystone_doc_id, work_item_id):
    """Check if a Keystone doc was already imported for this work item."""
    work_item_key = str(work_item_id)
    if work_item_key not in manifest["imported_docs"]:
        return False
    return str(keystone_doc_id) in manifest["imported_docs"][work_item_key]

def mark_doc_imported(manifest, keystone_doc_id, work_item_id):
    """Mark a Keystone doc as imported in the manifest."""
    work_item_key = str(work_item_id)
    if work_item_key not in manifest["imported_docs"]:
        manifest["imported_docs"][work_item_key] = []
    manifest["imported_docs"][work_item_key].append(str(keystone_doc_id))

# ============================================================
# Browser & Session
# ============================================================

def init_browser(headless=True, download_dir=None):
    """Initialize Selenium browser with optional download directory."""
    WORK_DIR.mkdir(parents=True, exist_ok=True)

    if USE_CHROME:
        options = ChromeOptions()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        if download_dir:
            prefs = {
                "download.default_directory": str(download_dir),
                "download.prompt_for_download": False,
            }
            options.add_experimental_option("prefs", prefs)
        driver = webdriver.Chrome(options=options)
    else:
        options = FirefoxOptions()
        if headless:
            options.add_argument('--headless')
        if download_dir:
            options.set_preference("browser.download.folderList", 2)  # Use custom folder
            options.set_preference("browser.download.manager.showWhenStarting", False)
            options.set_preference("browser.download.dir", str(download_dir))
            options.set_preference("browser.helperApps.neverAsk.saveToDisk",
                                 "application/pdf,application/x-pdf,image/jpeg,image/png")
        try:
            service = Service(GeckoDriverManager().install())
            driver = webdriver.Firefox(service=service, options=options)
        except Exception:
            driver = webdriver.Firefox(options=options)
    driver.set_page_load_timeout(30)
    driver.implicitly_wait(5)
    return driver

def login(driver):
    """Log in to Keystone portal."""
    logger.info("Logging in to Keystone portal...")
    wait = WebDriverWait(driver, 15)
    driver.get(f"{KEYSTONE_URL}/Account/LoginModernThemes")
    time.sleep(2)
    wait.until(EC.presence_of_element_located((By.ID, "UserName"))).send_keys(KEYSTONE_USERNAME)
    driver.find_element(By.ID, "Password").send_keys(KEYSTONE_PASSWORD)
    driver.find_element(By.ID, "btnLogin").click()
    time.sleep(4)
    if 'dashboard' not in driver.current_url.lower() and 'home' not in driver.current_url.lower():
        raise RuntimeError(f"Login failed — URL: {driver.current_url}")
    logger.info(f"Logged in: {driver.current_url}")

def make_session(driver):
    """Copy browser cookies into a requests.Session for file downloads."""
    session = requests.Session()
    for cookie in driver.get_cookies():
        session.cookies.set(cookie['name'], cookie['value'], domain=cookie.get('domain', ''))
    session.headers['User-Agent'] = driver.execute_script("return navigator.userAgent;")
    return session

# ============================================================
# Work Order Details (extend existing pattern)
# ============================================================

def get_work_order_documents(driver, wo_number):
    """
    Open Work Order details popup, extract document links.
    Returns {filename: doc_id} or empty dict if not found.

    Uses existing WO popup pattern from keystone_scraper_selenium.py.
    """
    try:
        # Navigate to Work Orders page if not already there
        if '/work-order/' not in driver.current_url.lower():
            driver.get(f"{KEYSTONE_URL}/p9060/work-order/")
            time.sleep(3)

        # Find and click the details button for this WO
        # Button pattern: btnWODetail{WO_RECORD_ID}_I (derived from existing code)
        wait = WebDriverWait(driver, 10)

        # First, find the table cell containing the WO number
        wo_cell = wait.until(EC.presence_of_element_located(
            (By.XPATH, f"//span[contains(text(),'{wo_number}')]")))

        # Find the row containing this cell, then locate the details button
        wo_row = wo_cell.find_element(By.XPATH, "ancestor::tr")

        # The Details button is typically the first button in the row
        details_button = wo_row.find_element(
            By.XPATH, ".//a[contains(@class,'btn') or @onclick]|.//button[contains(@id,'Detail')]")

        driver.execute_script("arguments[0].click();", details_button)
        time.sleep(2)

        # Wait for popup to appear
        popup = wait.until(EC.presence_of_element_located((By.ID, "WOdetailsPopUp_PWC-1")))
        time.sleep(1)

        # Extract document links from popup (same pattern as Documents library)
        docs = {}
        for link in popup.find_elements(By.CSS_SELECTOR, "a.document-file-anchor-color"):
            href = link.get_attribute("href") or ""
            name = link.text.strip()
            if not href or not name:
                continue
            m = re.search(r'/account/d/(\d+)', href)
            if m:
                doc_id = m.group(1)
                docs[name] = doc_id

        # Close popup
        try:
            close_button = driver.find_element(By.ID, "WOdetailsPopUp_HCB")
            close_button.click()
        except:
            driver.execute_script("arguments[0].style.display='none';", popup)

        time.sleep(1)
        return docs

    except (TimeoutException, NoSuchElementException) as e:
        logger.debug(f"Could not find WO details for {wo_number}: {e}")
        return {}

# ============================================================
# ARC Request Details (from Stage 0 recon)
# ============================================================

def get_arc_documents(driver, acct_record_id):
    """
    Open ARC Details popup (Stage 0 confirmed selectors), extract document links.
    Returns {filename: doc_id} or empty dict if not found.

    Based on ARC_RECON_REPORT.md findings:
    - Button: btnBACCDetail{ACCT_RECORD_ID}_I
    - Popup: #BoardACCPopUp_PWC-1
    - Document links: onclick="downloadBoardACCAttachment(attachmentId)"
    """
    try:
        wait = WebDriverWait(driver, 10)

        # Click the Details button using the confirmed pattern
        button_id = f"btnBACCDetail{acct_record_id}_I"
        try:
            button = driver.find_element(By.ID, button_id)
        except NoSuchElementException:
            logger.debug(f"ARC Details button not found: {button_id}")
            return {}

        driver.execute_script("arguments[0].click();", button)
        time.sleep(2)

        # Wait for popup
        popup = wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, "#BoardACCPopUp_PWC-1")))
        time.sleep(1)

        # Extract document links: fa-download icons with onclick handlers
        docs = {}
        attachment_links = popup.find_elements(By.CSS_SELECTOR, "i.fa.fa-download")

        for link in attachment_links:
            onclick = link.get_attribute("onclick") or ""
            m = re.search(r'downloadBoardACCAttachment\((\d+)\)', onclick)
            if not m:
                continue
            doc_id = m.group(1)

            # Try to extract filename from nearby table cell
            try:
                row = link.find_element(By.XPATH, "ancestor::tr")
                cells = row.find_elements(By.CSS_SELECTOR, "td")
                if cells:
                    filename = cells[0].text.strip() if cells else f"attachment_{doc_id}"
                else:
                    filename = f"attachment_{doc_id}"
            except:
                filename = f"attachment_{doc_id}"

            if filename:
                docs[filename] = doc_id

        # Close popup
        try:
            close_button = driver.find_element(By.ID, "buttonCloseACCRequestStatus_I")
            close_button.click()
        except:
            driver.execute_script("arguments[0].style.display='none';", popup)

        time.sleep(1)
        return docs

    except (TimeoutException, NoSuchElementException) as e:
        logger.debug(f"Could not find ARC details for account {acct_record_id}: {e}")
        return {}

def discover_arc_requests(driver):
    """
    Scan the Keystone ARC grid to discover all ARC requests and their acct_record_ids.
    Returns [(acct_record_id, address, request_date), ...]
    """
    try:
        wait = WebDriverWait(driver, 10)

        # Ensure we're on the ARC page with grid loaded
        if '/architectural-review' not in driver.current_url.lower():
            driver.get(f"{KEYSTONE_URL}/p9060/architectural-review/")
            time.sleep(3)

        # Find all detail buttons in the grid to extract acct_record_ids
        # Pattern: btnBACCDetail{ID}_I
        # Try multiple selectors: could be <a>, <button>, <span>, etc.
        arcs = []
        seen_ids = set()

        try:
            # Try to find by ID pattern (more flexible than tag-specific)
            button_ids = driver.execute_script("""
                const results = [];
                document.querySelectorAll('[id*="btnBACCDetail"]').forEach(el => {
                    const id = el.getAttribute('id');
                    if (id && id.match(/btnBACCDetail\\d+_I/)) {
                        results.push(id);
                    }
                });
                return results;
            """)

            logger.info(f"Found {len(button_ids)} button IDs via JavaScript")

            if not button_ids:
                # Fallback: try simpler XPath
                buttons = wait.until(EC.presence_of_all_elements_located(
                    (By.XPATH, "//*[contains(@id,'btnBACCDetail')]")))
                button_ids = [b.get_attribute("id") for b in buttons if b.get_attribute("id")]
                logger.info(f"Found {len(button_ids)} buttons via XPath fallback")

            for button_id in button_ids:
                if not button_id:
                    continue

                m = re.search(r'btnBACCDetail(\d+)_I', button_id)
                if not m:
                    continue

                acct_record_id = m.group(1)
                if acct_record_id in seen_ids:
                    continue
                seen_ids.add(acct_record_id)

                # Find the button element and extract row data
                try:
                    button = driver.find_element(By.ID, button_id)

                    # Extract data using JavaScript to find the data in the table row
                    data = driver.execute_script("""
                        const btn = document.getElementById(arguments[0]);
                        if (!btn) return null;

                        // Find the table row containing the button
                        let row = btn.closest('tr');
                        if (!row) return null;

                        // Get all td cells in this row
                        const cells = Array.from(row.querySelectorAll('td'));

                        // Check if this looks like a header row
                        const cellTexts = cells.map(c => c.textContent.trim());
                        if (cellTexts.some(t => t.includes('Address'))) {
                            // This is the header row, skip
                            return { isHeader: true, cellCount: cells.length };
                        }

                        // Extract address from column 2 (0-indexed)
                        const address = cells[2] ? cells[2].textContent.trim() : '';

                        // Extract dates from columns 3+
                        let dateStr = '';
                        for (let i = 3; i < cells.length; i++) {
                            const text = cells[i].textContent.trim();
                            if (text && /\\d{1,2}\\/\\d{1,2}\\/\\d{4}/.test(text)) {
                                dateStr = text;
                                break;
                            }
                        }

                        return {
                            isHeader: false,
                            cellCount: cells.length,
                            address: address,
                            dateStr: dateStr,
                            cellTexts: cellTexts.map(t => t.substring(0, 30))
                        };
                    """, button_id)

                    if not data:
                        logger.warning(f"Could not extract data for {button_id}")
                        continue

                    if data.get('isHeader'):
                        logger.debug(f"Button {button_id} is in header row, skipping")
                        continue

                    address = data.get('address', '').strip()
                    date_str = data.get('dateStr', '')

                    logger.debug(f"Button {button_id}: cells={data.get('cellCount')}, address='{address}', dateStr='{date_str}'")

                    # Parse date from the extracted date string
                    request_date = None
                    date_patterns = [
                        r'(\d{1,2})/(\d{1,2})/(\d{4})',
                        r'(\d{4})-(\d{1,2})-(\d{1,2})',
                    ]

                    for pattern in date_patterns:
                        m = re.search(pattern, date_str)
                        if m:
                            parts = m.groups()
                            if len(parts) == 3:
                                try:
                                    if '/' in date_str:
                                        naive_dt = datetime.strptime(f"{parts[0]}/{parts[1]}/{parts[2]}", "%m/%d/%Y")
                                    else:
                                        naive_dt = datetime.strptime(f"{parts[0]}-{parts[1]}-{parts[2]}", "%Y-%m-%d")
                                    # Make timezone-aware (Keystone dates are in Mountain Time)
                                    request_date = naive_dt.replace(tzinfo=timezone.utc)
                                    break
                                except:
                                    pass

                    if address:
                        arcs.append((acct_record_id, address, request_date))
                        logger.debug(f"Extracted ARC: {acct_record_id} | {address} | {request_date}")

                except Exception as e:
                    logger.warning(f"Could not extract row data for button {button_id}: {e}")
                    import traceback
                    traceback.print_exc()
                    continue

            logger.info(f"Discovered {len(arcs)} ARC requests in Keystone portal")
            return arcs

        except TimeoutException:
            logger.warning("Timeout waiting for ARC grid elements to load")
            return []

    except Exception as e:
        logger.error(f"Failed to discover ARC requests: {e}")
        import traceback
        traceback.print_exc()
        return []

# ============================================================
# Database Connection & Queries
# ============================================================

def get_db_password():
    """Read Supabase DB password from file."""
    if Path(SUPABASE_PASSWORD_FILE).exists():
        return Path(SUPABASE_PASSWORD_FILE).read_text().strip()
    raise RuntimeError(f"Supabase password file not found: {SUPABASE_PASSWORD_FILE}")

def get_work_item(conn, category, identifier):
    """
    Find a work item by category and identifier.
    - For work_order: identifier is keystone_wo_number
    - For arc_request: identifier is (address_from_keystone, created_date)
    Returns (work_item_id, property_id, address, title) or (None, None, None, None)
    """
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if category == 'work_order':
        wo_number = identifier
        cur.execute("""
            SELECT id, property_id, title
            FROM work_items
            WHERE category = 'work_order'
            AND keystone_wo_number = %s
            AND excluded_at IS NULL
            LIMIT 1
        """, (wo_number,))
        row = cur.fetchone()
        if row:
            # Get address from property
            prop_id = row['property_id']
            if prop_id:
                cur.execute("SELECT address FROM properties WHERE id = %s", (prop_id,))
                prop = cur.fetchone()
                address = prop['address'] if prop else None
            else:
                address = None
            cur.close()
            return (str(row['id']), prop_id, address, row['title'])

    elif category == 'arc_request':
        # ARC matching: by parcel_code (via address standardization) + created_date proximity
        ks_address, target_date = identifier
        if not ks_address:
            cur.close()
            return (None, None, None, None)

        # Standardize the Keystone address to parcel code format
        std_addr = standardize_address(ks_address)
        if not std_addr:
            cur.close()
            return (None, None, None, None)

        # Find matching property by parcel_code
        cur.execute("""
            SELECT id, address FROM properties
            WHERE parcel_code = %s
            LIMIT 1
        """, (std_addr,))
        prop = cur.fetchone()

        if not prop:
            logger.debug(f"No property found for parcel_code: {std_addr} (from address: {ks_address})")
            cur.close()
            return (None, None, None, None)

        prop_id = str(prop['id'])
        prop_address = prop['address']

        # Find ARC requests for this property, prefer one closest to target_date
        cur.execute("""
            SELECT id, created_date, title
            FROM work_items
            WHERE property_id = %s
            AND category = 'arc_request'
            AND excluded_at IS NULL
            ORDER BY ABS(EXTRACT(EPOCH FROM (created_date - %s))) ASC
            LIMIT 5
        """, (prop_id, target_date))
        rows = cur.fetchall()

        if not rows:
            logger.debug(f"No ARC work_items found for property {prop_id} ({std_addr})")
            cur.close()
            return (None, None, None, None)

        # Use date proximity to pick the best match
        # If there's only 1, or the closest is significantly nearer than the second-closest, use it
        if len(rows) == 1:
            cur.close()
            return (str(rows[0]['id']), prop_id, prop_address, rows[0]['title'])

        # Multiple ARCs: use the closest one if it's clearly closest (within 7 days of target)
        closest = rows[0]
        if target_date:
            closest_date_diff = abs((closest['created_date'] - target_date).total_seconds()) if closest['created_date'] else float('inf')
            # If the closest is within 7 days of the Keystone date, consider it a good match
            if closest_date_diff <= 7 * 86400:  # 7 days in seconds
                logger.info(f"Matched {ks_address} to closest ARC ({closest['title']}) among {len(rows)} candidates")
                cur.close()
                return (str(closest['id']), prop_id, prop_address, closest['title'])

        # Still ambiguous, skip
        logger.warning(f"Ambiguous ARC match for {ks_address}: {len(rows)} items on same property, closest is {closest_date_diff / 86400:.0f} days away, skipping")
        cur.close()
        return (None, None, None, None)

    cur.close()
    return (None, None, None, None)

def insert_work_item_document(conn, work_item_id, filename, storage_path, content_type, file_size):
    """Insert a work_item_documents row."""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO work_item_documents
        (work_item_id, title, file_name, storage_path, content_type, file_size_bytes, uploaded_by)
        VALUES (%s, NULL, %s, %s, %s, %s, %s)
    """, (work_item_id, filename, storage_path, content_type, file_size, "keystone-backfill"))
    conn.commit()
    cur.close()

def get_all_work_items(conn, category):
    """Get all work items for a category that need backfilling."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    if category == 'work_order':
        cur.execute("""
            SELECT id, keystone_wo_number, property_id, title, created_date
            FROM work_items
            WHERE category = 'work_order'
            AND keystone_wo_number IS NOT NULL
            AND excluded_at IS NULL
            ORDER BY created_date DESC
        """)
    elif category == 'arc_request':
        cur.execute("""
            SELECT w.id, w.property_id, w.title, w.created_date, p.address
            FROM work_items w
            LEFT JOIN properties p ON w.property_id = p.id
            WHERE w.category = 'arc_request'
            AND w.excluded_at IS NULL
            ORDER BY w.created_date DESC
        """)
    else:
        cur.close()
        return []

    items = cur.fetchall()
    cur.close()
    return items

# ============================================================
# File Download & Upload
# ============================================================

def download_doc(session, doc_id, filename):
    """Download a document from Keystone (non-ARC). Returns (local_path, content_type) or (None, None)."""
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    url = f"{KEYSTONE_URL}/account/d/{doc_id}"

    try:
        resp = session.get(url, allow_redirects=True, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        logger.error(f"Download failed for doc {doc_id}: {e}")
        return None, None

    # Honor Content-Disposition filename
    cd = resp.headers.get("Content-Disposition", "")
    if 'filename=' in cd:
        m = re.search(r'filename=["\']?([^"\';\r\n]+)', cd)
        if m:
            filename = m.group(1).strip()

    dest = WORK_DIR / filename
    dest.write_bytes(resp.content)
    logger.info(f"  Downloaded: {filename} ({len(resp.content) // 1024} KB)")

    content_type = resp.headers.get('Content-Type', 'application/octet-stream')
    return dest, content_type

def download_arc_doc_selenium(driver, doc_id, download_dir):
    """
    Download an ARC document by clicking the download button via Selenium.
    Returns (local_path, content_type) or (None, None).
    """
    try:
        # Find the download button for this specific attachment
        # The onclick attribute contains the attachment ID
        wait = WebDriverWait(driver, 10)
        download_btn = wait.until(EC.presence_of_element_located(
            (By.XPATH, f"//i[@class='fa fa-download' and contains(@onclick,'downloadBoardACCAttachment({doc_id})')]")
        ))

        # Clear any existing files in download dir (to detect new file)
        existing_files = set(download_dir.glob('*'))

        # Click the download button
        driver.execute_script("arguments[0].click();", download_btn)
        time.sleep(2)

        # Wait for new file to appear in download directory
        max_wait = 30
        start_time = time.time()
        new_file = None

        while time.time() - start_time < max_wait:
            current_files = set(download_dir.glob('*'))
            new_files = current_files - existing_files

            if new_files:
                new_file = list(new_files)[0]
                # Wait a bit more to ensure file is complete
                time.sleep(1)
                # Check if file is still being written (growing)
                file_size = new_file.stat().st_size
                time.sleep(0.5)
                if new_file.stat().st_size == file_size:
                    # File is stable
                    logger.info(f"  Downloaded: {new_file.name} ({file_size // 1024} KB)")
                    content_type = "application/octet-stream"
                    # Try to guess content type from extension
                    if new_file.suffix.lower() == '.pdf':
                        content_type = "application/pdf"
                    elif new_file.suffix.lower() in ['.jpg', '.jpeg']:
                        content_type = "image/jpeg"
                    elif new_file.suffix.lower() == '.png':
                        content_type = "image/png"
                    return new_file, content_type

            time.sleep(0.5)

        if not new_file:
            logger.error(f"Download timeout for attachment {doc_id}")
            return None, None

        return new_file, "application/octet-stream"

    except (TimeoutException, NoSuchElementException) as e:
        logger.debug(f"Could not find download button for attachment {doc_id}: {e}")
        return None, None
    except Exception as e:
        logger.error(f"Error downloading ARC document {doc_id}: {e}")
        return None, None

def upload_to_storage(supabase_client, file_path, storage_path):
    """Upload file to Supabase Storage using supabase-py SDK. Returns public URL or None."""
    try:
        with open(file_path, 'rb') as f:
            file_bytes = f.read()

        # Upload using supabase-py SDK
        response = supabase_client.storage.from_('work-item-documents').upload(
            path=storage_path,
            file=file_bytes
        )
        logger.info(f"  Uploaded to Storage: {storage_path}")

        # Return public URL
        SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://obveytoovkzjrpzrhrim.supabase.co')
        return f"{SUPABASE_URL}/storage/v1/object/public/work-item-documents/{storage_path}"
    except Exception as e:
        logger.error(f"Storage upload failed for {storage_path}: {e}")
        import traceback
        traceback.print_exc()
        return None

# ============================================================
# Main Backfill Logic
# ============================================================

def backfill_category(category, dry_run=True):
    """
    Backfill documents for a category.
    Returns (total_processed, total_documents_found, errors)
    """
    if not KEYSTONE_USERNAME or not KEYSTONE_PASSWORD:
        raise RuntimeError("KEYSTONE_USERNAME and KEYSTONE_PASSWORD not set in environment")

    if not dry_run and (not SUPABASE_ANON_KEY or not SUPABASE_URL):
        raise RuntimeError("SUPABASE_ANON_KEY and SUPABASE_URL required for --write mode")

    if not dry_run and not psycopg2:
        raise RuntimeError("psycopg2 required for --write mode")

    if not dry_run and not create_client:
        raise RuntimeError("supabase-py required for --write mode (pip install supabase)")

    manifest = load_manifest()
    driver = None
    conn = None

    try:
        # Initialize browser with download directory for ARC documents
        driver = init_browser(headless=True, download_dir=WORK_DIR)
        login(driver)
        session = make_session(driver)

        # Connect to database (needed for both dry-run and write to match work items)
        db_password = get_db_password()
        conn = psycopg2.connect(
            host=SUPABASE_HOST,
            port=5432,
            database="postgres",
            user=SUPABASE_USER,
            password=db_password
        )

        # Initialize Supabase client for Storage (only needed for write mode)
        supabase_client = None
        if not dry_run:
            # Use service role key for write access (bypasses RLS), fall back to anon key
            api_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
            if not api_key:
                raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY required for write mode")
            supabase_client = create_client(SUPABASE_URL, api_key)

        # Process by category
        total_docs_found = 0
        errors = []
        total_items = 0

        if category == 'work_order':
            driver.get(f"{KEYSTONE_URL}/p9060/work-order/")
            time.sleep(3)

            items = get_all_work_items(conn, 'work_order')
            total_items = len(items)
            logger.info(f"Processing {total_items} work order items...")

            for i, item in enumerate(items, 1):
                try:
                    wo_number = item['keystone_wo_number']
                    logger.info(f"[{i}/{len(items)}] WO {wo_number}...")

                    docs = get_work_order_documents(driver, wo_number)
                    if not docs:
                        logger.info(f"  → No documents found")
                        continue

                    logger.info(f"  → Found {len(docs)} document(s)")
                    total_docs_found += len(docs)

                    if dry_run:
                        logger.info(f"  [DRY-RUN] Would import: {list(docs.keys())}")
                    else:
                        matched_id = str(item['id'])
                        for filename, doc_id in docs.items():
                            if is_doc_imported(manifest, doc_id, matched_id):
                                logger.info(f"  ↷ Already imported: {filename}")
                                continue

                            local_path, content_type = download_doc(session, doc_id, filename)
                            if not local_path:
                                errors.append((wo_number, f"download_failed:{filename}"))
                                continue

                            storage_path = f"{matched_id}/{doc_id}-{filename}"
                            pub_url = upload_to_storage(supabase_client, local_path, storage_path)
                            if not pub_url:
                                errors.append((wo_number, f"upload_failed:{filename}"))
                                continue

                            insert_work_item_document(
                                conn, matched_id, filename, storage_path,
                                content_type, local_path.stat().st_size
                            )
                            mark_doc_imported(manifest, doc_id, matched_id)
                            logger.info(f"  ✓ Imported: {filename}")

                except Exception as e:
                    logger.error(f"Error processing WO {i}: {e}")
                    errors.append((str(item.get('keystone_wo_number', '?')), str(e)))
                    continue

                time.sleep(2)

        elif category == 'arc_request':
            # For ARC, scan Keystone portal first to discover acct_record_ids
            arc_requests = discover_arc_requests(driver)
            total_items = len(arc_requests)
            logger.info(f"Processing {total_items} ARC requests from Keystone...")

            for i, (acct_id, ks_address, ks_date) in enumerate(arc_requests, 1):
                try:
                    logger.info(f"[{i}/{len(arc_requests)}] ARC {ks_address}...")

                    # Match to work_item using address + date
                    matched_id, prop_id, address, title = get_work_item(conn, 'arc_request', (ks_address, ks_date))
                    if not matched_id:
                        logger.warning(f"  → Could not match to work item, skipping")
                        errors.append((f"{ks_address}#{acct_id}", "no_match"))
                        continue

                    # Get documents using the acct_record_id we discovered from Keystone
                    docs = get_arc_documents(driver, acct_id)
                    if not docs:
                        logger.info(f"  → No documents found")
                        continue

                    logger.info(f"  → Found {len(docs)} document(s)")
                    total_docs_found += len(docs)

                    if dry_run:
                        logger.info(f"  [DRY-RUN] Would import: {list(docs.keys())}")
                    else:
                        for filename, doc_id in docs.items():
                            if is_doc_imported(manifest, doc_id, matched_id):
                                logger.info(f"  ↷ Already imported: {filename}")
                                continue

                            # For ARC documents, use Selenium to download via button click
                            local_path, content_type = download_arc_doc_selenium(driver, doc_id, WORK_DIR)
                            if not local_path:
                                errors.append((f"{address}#{acct_id}", f"download_failed:{filename}"))
                                continue

                            # Use actual downloaded filename
                            actual_filename = local_path.name
                            storage_path = f"{matched_id}/{doc_id}-{actual_filename}"
                            pub_url = upload_to_storage(supabase_client, local_path, storage_path)
                            if not pub_url:
                                errors.append((f"{address}#{acct_id}", f"upload_failed:{actual_filename}"))
                                continue

                            insert_work_item_document(
                                conn, matched_id, actual_filename, storage_path,
                                content_type, local_path.stat().st_size
                            )
                            mark_doc_imported(manifest, doc_id, matched_id)
                            logger.info(f"  ✓ Imported: {actual_filename}")

                except Exception as e:
                    logger.error(f"Error processing ARC {i}: {e}")
                    errors.append((f"{ks_address}#{acct_id}", str(e)))
                    continue

                time.sleep(2)

        if not dry_run:
            save_manifest(manifest)

        return (total_items, total_docs_found, errors)

    finally:
        if driver:
            driver.quit()
        if conn:
            conn.close()

# ============================================================
# CLI
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Backfill work item documents from Keystone portal")
    parser.add_argument('--category', default='all',
                        choices=['work_order', 'arc_request', 'all'],
                        help='Category to backfill (default: all)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Discover matches, don\'t download/write')
    parser.add_argument('--write', action='store_true',
                        help='Download and write to Supabase')
    parser.add_argument('--headed', action='store_true',
                        help='Show browser window for debugging')

    args = parser.parse_args()

    categories = ['work_order', 'arc_request'] if args.category == 'all' else [args.category]

    if not args.dry_run and not args.write:
        logger.error("Must specify --dry-run or --write")
        sys.exit(1)

    dry_run = args.dry_run

    for cat in categories:
        logger.info(f"\n{'='*60}")
        logger.info(f"Backfilling {cat.upper()} {'(DRY-RUN)' if dry_run else '(WRITE)'}")
        logger.info(f"{'='*60}")

        try:
            total, docs_found, errors = backfill_category(cat, dry_run=dry_run)
            logger.info(f"\nSummary for {cat}:")
            logger.info(f"  Items processed: {total}")
            logger.info(f"  Documents found: {docs_found}")
            if errors:
                logger.info(f"  Errors: {len(errors)}")
                for item, error in errors[:5]:
                    logger.info(f"    - {item}: {error}")
                if len(errors) > 5:
                    logger.info(f"    ... and {len(errors) - 5} more")
        except Exception as e:
            logger.error(f"Fatal error for {cat}: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

if __name__ == '__main__':
    main()
