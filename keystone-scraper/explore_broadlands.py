#!/usr/bin/env python3
"""
Broadlands portal exploration: switch account and map the document library.

Steps:
  1. Login with VaB credentials
  2. Drive the Switch Account dialog to land on Broadlands (P80061030137201)
  3. Verify the session shows Broadlands
  4. Walk every folder in /p8006/documents/ and capture file names + download URLs
  5. Write a report to /tmp/broadlands_explore/document_inventory.txt

Run: venv/bin/python explore_broadlands.py [--headed]
"""

import os
import sys
import time
import argparse
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.common.exceptions import TimeoutException, NoSuchElementException, StaleElementReferenceException
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service

KEYSTONE_URL = "https://kppm.cincwebaxis.com"
BROADLANDS_PREFIX = "/p8006"
OUT_DIR = Path("/tmp/broadlands_explore")

# ── helpers ──────────────────────────────────────────────────────────────────

def load_env():
    if not os.environ.get('KEYSTONE_USERNAME'):
        env_file = Path(__file__).parent / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

def screenshot(driver, name):
    path = OUT_DIR / f"{name}.png"
    driver.save_screenshot(str(path))
    print(f"  [screenshot] {path}")

def init_browser(headless):
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

# ── login ─────────────────────────────────────────────────────────────────────

def login(driver):
    print("\n=== Step 1: Login ===")
    driver.get(f"{KEYSTONE_URL}/Account/LoginModernThemes")
    time.sleep(2)
    wait = WebDriverWait(driver, 15)
    wait.until(EC.presence_of_element_located((By.ID, "UserName"))).send_keys(os.environ['KEYSTONE_USERNAME'])
    driver.find_element(By.ID, "Password").send_keys(os.environ['KEYSTONE_PASSWORD'])
    driver.find_element(By.ID, "btnLogin").click()
    time.sleep(4)
    print(f"  URL after login: {driver.current_url}")
    screenshot(driver, "01_logged_in")

# ── switch account ────────────────────────────────────────────────────────────

def switch_to_broadlands(driver):
    """Drive the Switch Account dialog and land on the Broadlands session."""
    print("\n=== Step 2: Switch Account to Broadlands ===")

    # Navigate somewhere with the account dropdown visible
    driver.get(f"{KEYSTONE_URL}/account/dashboard")
    time.sleep(3)
    screenshot(driver, "02_dashboard")

    wait = WebDriverWait(driver, 15)

    # The top-right dropdown trigger — try several selectors
    print("  Looking for account dropdown trigger...")
    trigger = None
    for xpath in [
        # link whose text contains the account name or 'Switch'
        "//a[contains(@href,'#') and (contains(@class,'dropdown') or contains(@class,'account'))]",
        # any element with onclick containing 'switch' or 'account'
        "//*[contains(@onclick,'switch') or contains(@onclick,'Switch')]",
        # the WB avatar/initials circle
        "//*[contains(@class,'user-avatar') or contains(@class,'initials')]",
        # fallback: any link in the nav bar area with href="#"
        "//nav//a[@href='#'] | //header//a[@href='#']",
    ]:
        try:
            els = driver.find_elements(By.XPATH, xpath)
            if els:
                trigger = els[0]
                print(f"  Found trigger via: {xpath}")
                break
        except Exception:
            pass

    if not trigger:
        # Last resort: look for the element that contains the account number text
        print("  Trying account number text search...")
        try:
            trigger = driver.find_element(By.XPATH,
                "//*[contains(text(),'P9060') or contains(text(),'William Buck')]")
        except NoSuchElementException:
            pass

    if not trigger:
        # Dump page source excerpt to help debug
        print("  ERROR: could not find account dropdown trigger")
        print("  Page title:", driver.title)
        # Try to find any element with 'switch' in text
        all_text_els = driver.find_elements(By.XPATH, "//*[contains(translate(text(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'switch')]")
        print(f"  Elements with 'switch' in text: {len(all_text_els)}")
        for el in all_text_els[:5]:
            print(f"    tag={el.tag_name} text='{el.text[:60]}' id='{el.get_attribute('id')}'")
        screenshot(driver, "02b_trigger_not_found")
        return False

    # Click the trigger to open the dropdown
    driver.execute_script("arguments[0].click();", trigger)
    time.sleep(1)
    screenshot(driver, "03_dropdown_open")

    # Find and click "Switch Account"
    print("  Looking for 'Switch Account' link...")
    try:
        switch_link = wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//*[contains(text(),'Switch Account') or contains(text(),'switch account')]")
        ))
        print(f"  Found: tag={switch_link.tag_name} text='{switch_link.text}'")
        driver.execute_script("arguments[0].click();", switch_link)
        time.sleep(2)
        screenshot(driver, "04_switch_dialog")
    except TimeoutException:
        print("  ERROR: 'Switch Account' option not found after clicking trigger")
        # Dump visible links
        for a in driver.find_elements(By.TAG_NAME, 'a')[:20]:
            print(f"    [{a.text[:40]}] {a.get_attribute('href') or ''}")
        screenshot(driver, "04_switch_not_found")
        return False

    # Dump the dialog HTML for debugging
    try:
        dialog_html = driver.find_element(By.TAG_NAME, 'body').get_attribute('innerHTML')
        Path("/tmp/broadlands_explore/switch_dialog.html").write_text(dialog_html[:20000])
        print("  Saved dialog HTML to /tmp/broadlands_explore/switch_dialog.html")
    except Exception:
        pass

    # Find the Broadlands radio button
    print("  Looking for Broadlands radio button...")
    broadlands_radio = None
    for xpath in [
        # radio adjacent to a label/span containing 'Broadlands'
        "//input[@type='radio'][following::*[contains(text(),'Broadlands')][1]]",
        "//input[@type='radio'][preceding::*[contains(text(),'Broadlands')][1]]",
        # label that wraps or follows a radio
        "//label[contains(text(),'Broadlands')]//input[@type='radio']",
        "//label[contains(text(),'Broadlands')]/preceding-sibling::input[@type='radio']",
        # by value matching the account number
        "//input[@type='radio' and @value='P80061030137201']",
        "//input[@type='radio'][contains(@value,'8006')]",
    ]:
        try:
            els = driver.find_elements(By.XPATH, xpath)
            if els:
                broadlands_radio = els[0]
                print(f"  Found radio via: {xpath}")
                break
        except Exception:
            pass

    if not broadlands_radio:
        # Show all radio buttons to debug
        radios = driver.find_elements(By.XPATH, "//input[@type='radio']")
        print(f"  Found {len(radios)} radio buttons on page:")
        for r in radios:
            print(f"    value='{r.get_attribute('value')}' id='{r.get_attribute('id')}' "
                  f"name='{r.get_attribute('name')}'")
        screenshot(driver, "05_radio_not_found")
        return False

    driver.execute_script("arguments[0].click();", broadlands_radio)
    time.sleep(0.5)
    screenshot(driver, "05_broadlands_selected")
    print(f"  Selected Broadlands radio: value='{broadlands_radio.get_attribute('value')}'")

    # Click the Switch Account confirm button
    print("  Looking for Switch Account confirm button...")
    switch_btn = None
    for xpath in [
        "//input[@type='submit' or @type='button'][contains(@value,'Switch')]",
        "//button[contains(text(),'Switch')]",
        "//input[@type='button'][contains(@value,'Switch')]",
        "//a[contains(text(),'Switch') and not(contains(text(),'Account'))]",
    ]:
        try:
            els = driver.find_elements(By.XPATH, xpath)
            if els:
                switch_btn = els[0]
                print(f"  Found button via: {xpath}")
                break
        except Exception:
            pass

    if not switch_btn:
        print("  ERROR: Switch confirm button not found")
        screenshot(driver, "06_button_not_found")
        return False

    driver.execute_script("arguments[0].click();", switch_btn)
    time.sleep(5)
    screenshot(driver, "06_after_switch")
    print(f"  URL after switch: {driver.current_url}")
    print(f"  Page title: {driver.title}")

    # Verify we're on Broadlands
    if 'Broadlands' in driver.title or 'broadlands' in driver.current_url.lower() or 'p8006' in driver.current_url.lower():
        print("  SUCCESS: Broadlands session confirmed via URL/title")
        return True

    # Check the account number shown in the nav
    try:
        nav_text = driver.find_element(By.XPATH,
            "//*[contains(text(),'P8006') or contains(text(),'Broadlands')]")
        print(f"  SUCCESS: Found Broadlands reference in page: '{nav_text.text[:80]}'")
        return True
    except NoSuchElementException:
        pass

    print("  WARNING: Could not confirm Broadlands session — proceeding anyway")
    return True

# ── document library explorer ─────────────────────────────────────────────────

def explore_documents(driver):
    """Walk every folder in /p8006/documents/ and record all file download links."""
    print("\n=== Step 3: Explore Document Library ===")

    docs_url = f"{KEYSTONE_URL}{BROADLANDS_PREFIX}/documents/"
    print(f"  Navigating to {docs_url}")
    driver.get(docs_url)
    time.sleep(3)
    print(f"  Title: {driver.title}")
    screenshot(driver, "07_documents_page")

    inventory = {}   # folder_name -> list of (filename, url)

    # Get all folder items in the left-side tree
    # The doc library uses a folder tree on the left; typical selectors vary by portal version
    folder_selectors = [
        "li.folder-item",
        ".folder-list li",
        ".document-folders li",
        ".tree-node",
        "ul.jstree-container-ul li",       # jstree plugin
        ".document-library-folders a",
        "#documentFolders li",
        ".folder a",
    ]

    folders = []
    for sel in folder_selectors:
        els = driver.find_elements(By.CSS_SELECTOR, sel)
        if els:
            folders = els
            print(f"  Found {len(els)} folder items via '{sel}'")
            break

    if not folders:
        # Try by link text pattern in left panel
        print("  Trying fallback: all links in left column")
        try:
            left_panel = driver.find_element(By.CSS_SELECTOR,
                ".col-sm-3, .col-md-3, .sidebar, #folderPane, .folder-pane, .left-panel")
            folders = left_panel.find_elements(By.TAG_NAME, "a")
            print(f"  Found {len(folders)} links in left panel")
        except NoSuchElementException:
            pass

    if not folders:
        print("  ERROR: No folder elements found. Dumping page structure...")
        screenshot(driver, "07b_no_folders")
        # Dump all links to help diagnose
        for a in driver.find_elements(By.TAG_NAME, 'a')[:30]:
            print(f"    [{a.text[:50]}] {a.get_attribute('href') or ''}")
        # Save page source
        Path("/tmp/broadlands_explore/documents_page.html").write_text(
            driver.page_source[:50000])
        print("  Saved page source to /tmp/broadlands_explore/documents_page.html")
        return inventory

    # Click each folder and collect documents
    folder_names = []
    for f in folders:
        try:
            name = f.text.strip()
            if name:
                folder_names.append(name)
        except StaleElementReferenceException:
            pass

    print(f"\n  Folders found: {folder_names}\n")

    for i, folder_name in enumerate(folder_names):
        print(f"  [{i+1}/{len(folder_names)}] Opening folder: {folder_name}")
        inventory[folder_name] = []

        # Re-find the folder element (DOM may have changed)
        try:
            folder_el = None
            for sel in folder_selectors:
                els = driver.find_elements(By.CSS_SELECTOR, sel)
                for el in els:
                    if el.text.strip() == folder_name:
                        folder_el = el
                        break
                if folder_el:
                    break

            if not folder_el:
                # Try by link text
                folder_el = driver.find_element(By.XPATH,
                    f"//a[normalize-space(text())='{folder_name}']")

            driver.execute_script("arguments[0].click();", folder_el)
            time.sleep(2)

        except Exception as e:
            print(f"    Could not click folder: {e}")
            continue

        screenshot(driver, f"folder_{i:02d}_{folder_name[:30].replace(' ','_')}")

        # Collect document links from the right panel
        doc_links = _collect_doc_links(driver)
        inventory[folder_name] = doc_links

        if doc_links:
            print(f"    {len(doc_links)} document(s):")
            for fname, url in doc_links:
                print(f"      {fname}  →  {url}")
        else:
            print(f"    (empty or could not read)")

    return inventory

def _collect_doc_links(driver):
    """Extract document file names and download URLs from the right panel."""
    results = []

    # Typical right-panel selectors for CINC doc library
    right_panel_selectors = [
        ".document-list",
        "#documentList",
        ".col-sm-9 table",
        ".col-md-9",
        ".right-panel",
        "#docPane",
        ".documents-panel",
    ]

    panel = None
    for sel in right_panel_selectors:
        try:
            panel = driver.find_element(By.CSS_SELECTOR, sel)
            break
        except NoSuchElementException:
            pass

    search_root = panel if panel else driver

    # Look for download links — CINC typically uses .pdf/.doc links or explicit "Download" buttons
    for a in search_root.find_elements(By.TAG_NAME, "a"):
        try:
            href = a.get_attribute("href") or ""
            text = a.text.strip()

            # Skip navigation/UI links
            if not href or href.endswith("#") or "javascript:" in href:
                continue
            if not text and not any(ext in href.lower() for ext in
                                    ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg']):
                continue
            # Skip if it looks like a folder link we already have
            if href.endswith("/") and "download" not in href.lower():
                continue

            # Only include links that look like document downloads
            if (any(ext in href.lower() for ext in ['.pdf', '.doc', '.docx', '.xls', '.xlsx'])
                    or "download" in href.lower()
                    or "document" in href.lower()
                    or text):
                label = text or href.split("/")[-1]
                results.append((label, href))
        except StaleElementReferenceException:
            pass

    # Also look for rows in a table (Name | Date | Size columns)
    if not results:
        for row in search_root.find_elements(By.CSS_SELECTOR, "table tbody tr"):
            try:
                cells = row.find_elements(By.CSS_SELECTOR, "td")
                if not cells:
                    continue
                link = None
                try:
                    link = cells[0].find_element(By.TAG_NAME, "a")
                except NoSuchElementException:
                    pass
                if link:
                    fname = link.text.strip() or cells[0].text.strip()
                    href = link.get_attribute("href") or ""
                    if fname and href and not href.endswith("#"):
                        results.append((fname, href))
            except StaleElementReferenceException:
                pass

    return results

# ── report writer ─────────────────────────────────────────────────────────────

def write_report(inventory):
    report_path = OUT_DIR / "document_inventory.txt"
    lines = ["Broadlands Master Association — Document Library Inventory",
             "=" * 60, ""]

    total = 0
    for folder, docs in inventory.items():
        lines.append(f"FOLDER: {folder}  ({len(docs)} file(s))")
        if docs:
            for fname, url in docs:
                lines.append(f"  {fname}")
                lines.append(f"    {url}")
            total += len(docs)
        else:
            lines.append("  (empty)")
        lines.append("")

    lines.append(f"Total: {total} documents across {len(inventory)} folders")
    report_path.write_text("\n".join(lines))
    print(f"\n  Report written to {report_path}")
    return report_path

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--headed", action="store_true", help="Show browser window")
    parser.add_argument("--skip-switch", action="store_true",
                        help="Skip account switch (use if already on Broadlands)")
    args = parser.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    load_env()

    driver = init_browser(not args.headed)
    try:
        login(driver)

        if not args.skip_switch:
            ok = switch_to_broadlands(driver)
            if not ok:
                print("\nSwitch Account failed — see screenshots in", OUT_DIR)
                sys.exit(1)

        inventory = explore_documents(driver)

        if inventory:
            write_report(inventory)
        else:
            print("\nNo documents found — check screenshots and page source in", OUT_DIR)

        print(f"\nDone. All output in {OUT_DIR}")

    finally:
        driver.quit()

if __name__ == "__main__":
    main()
