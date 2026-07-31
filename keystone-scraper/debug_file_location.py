#!/usr/bin/env python3
"""
Debug: Track where each file is found across ALL folders.
This will show if a file appears in multiple locations or with wrong paths.
"""

import os
import time
import re
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service

KEYSTONE_URL = "https://kppm.cincwebaxis.com"

def load_env():
    if not os.environ.get('KEYSTONE_USERNAME'):
        env_file = Path(__file__).parent / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

def init_browser():
    options = FirefoxOptions()
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
    print("[*] Logging in...")
    wait = WebDriverWait(driver, 15)
    driver.get(f"{KEYSTONE_URL}/Account/LoginModernThemes")
    time.sleep(2)
    wait.until(EC.presence_of_element_located((By.ID, "UserName"))).send_keys(
        os.environ['KEYSTONE_USERNAME'])
    driver.find_element(By.ID, "Password").send_keys(os.environ['KEYSTONE_PASSWORD'])
    driver.find_element(By.ID, "btnLogin").click()
    time.sleep(4)

def discover_folders(driver):
    """Get all folders with correct paths."""
    print("[*] Loading Documents page...")
    driver.get(f"{KEYSTONE_URL}/p9060/documents/")
    time.sleep(5)

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

    # Build paths
    path_stack = []
    tree = {}
    for item in raw:
        fid = item['id']
        name = item['name']
        depth = item['depth']

        while path_stack and path_stack[-1][0] >= depth:
            path_stack.pop()
        path_stack.append((depth, name))
        path = '/'.join(n for _, n in path_stack)
        tree[fid] = {'name': name, 'path': path}

    return tree

def scrape_all_folders(driver, folder_tree):
    """Scrape ALL folders and track where each file is found."""
    file_locations = {}  # {filename: [(path, folder_id), ...]}

    for fid, info in sorted(folder_tree.items(), key=lambda x: x[1]['path']):
        path = info['path']

        try:
            trigger = driver.find_element(
                By.XPATH, f"//*[contains(@onclick,'GetDocumentFiles({fid})')]")
            driver.execute_script("arguments[0].click();", trigger)
            time.sleep(1)
        except:
            continue

        for a in driver.find_elements(By.CSS_SELECTOR, "a.document-file-anchor-color"):
            name = a.text.strip()
            if not name:
                continue

            if name not in file_locations:
                file_locations[name] = []
            file_locations[name].append((path, fid))

    return file_locations

def main():
    load_env()
    driver = init_browser()

    try:
        login(driver)
        tree = discover_folders(driver)
        print(f"[*] Found {len(tree)} folders\n")

        print("[*] Scraping all folders for files...")
        file_locations = scrape_all_folders(driver, tree)

        print(f"\n[*] Found {len(file_locations)} unique filenames\n")

        # Find files that appear in multiple locations (these are the culprits!)
        print("="*70)
        print("FILES APPEARING IN MULTIPLE LOCATIONS (DUPLICATES):")
        print("="*70)

        duplicates_found = False
        for filename in sorted(file_locations.keys()):
            locations = file_locations[filename]
            if len(locations) > 1:
                duplicates_found = True
                print(f"\n'{filename}' appears in {len(locations)} locations:")
                for path, fid in locations:
                    print(f"  - {path} (folder ID {fid})")

        if not duplicates_found:
            print("(None found)")

        # Look for the problematic files specifically
        print("\n" + "="*70)
        print("LOOKING FOR SPECIFIC PROBLEM FILES:")
        print("="*70)

        problem_files = [
            "Aurora - Owners Monthly Report 0126",
            "Aurora - Owners Monthly Report 0226",
            "Aurora - Owners Monthly Report 0626",
            "012025 VBDR Minutes.pdf",
            "021725 VBDR Minutes.pdf",
        ]

        for fname in problem_files:
            if fname in file_locations:
                locations = file_locations[fname]
                print(f"\n'{fname}':")
                for path, fid in locations:
                    print(f"  Found at: {path}")
            else:
                print(f"\n'{fname}': NOT FOUND")

    finally:
        driver.quit()

if __name__ == '__main__':
    main()
