#!/usr/bin/env python3
"""
Debug script to diagnose path-building issues in keystone_documents.py.

Shows the DOM structure for each folder and the documents found in it,
so we can see where paths are being built incorrectly.
"""

import os
import time
import json
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service
import re

KEYSTONE_URL  = "https://kppm.cincwebaxis.com"

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

def discover_with_debug(driver):
    """Same as discover_folder_tree, but with detailed debug output."""
    print("[*] Loading Documents page...")
    driver.get(f"{KEYSTONE_URL}/p9060/documents/")
    time.sleep(5)

    # Extract all GetDocumentFiles elements with their DOM nesting depth
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

    print(f"[*] Found {len(raw)} elements with GetDocumentFiles()\n")
    print("=== Raw Elements (with depth) ===")
    for item in raw:
        print(f"  Depth {item['depth']}: [{item['id']}] {item['name']}")

    # Build paths using a stack keyed by depth
    print("\n=== Path Building Process ===")
    path_stack = []
    tree = {}
    for i, item in enumerate(raw):
        fid   = item['id']
        name  = item['name']
        depth = item['depth']

        # Pop stack entries at same depth or deeper
        while path_stack and path_stack[-1][0] >= depth:
            removed = path_stack.pop()
            print(f"  Pop: {removed[1]} (was at depth {removed[0]})")

        path_stack.append((depth, name))
        path = '/'.join(n for _, n in path_stack)
        tree[fid] = {'name': name, 'path': path}

        print(f"  Item {i}: depth={depth}, name='{name}'")
        print(f"    Stack after: {[n for _, n in path_stack]}")
        print(f"    Result path: {path}")

    return tree

def scrape_folder_with_debug(driver, folder_id, folder_name, path):
    """Click a folder and show documents found."""
    print(f"\n=== Scraping [{folder_id}] {folder_name} ===")
    print(f"Path: {path}")

    try:
        trigger = driver.find_element(
            By.XPATH, f"//*[contains(@onclick,'GetDocumentFiles({folder_id})')]")
        driver.execute_script("arguments[0].click();", trigger)
        time.sleep(2)
    except Exception as e:
        print(f"  ERROR: Could not click folder: {e}")
        return {}

    docs = {}
    for a in driver.find_elements(By.CSS_SELECTOR, "a.document-file-anchor-color"):
        href = a.get_attribute("href") or ""
        name = a.text.strip()
        if not href or not name:
            continue
        m = re.search(r'/account/d/(\d+)', href)
        if not m:
            continue
        doc_id = m.group(1)
        docs[name] = doc_id

    if docs:
        print(f"  Found {len(docs)} document(s):")
        for name in sorted(docs.keys()):
            print(f"    - {name}")
    else:
        print(f"  No documents found")

    return docs

def main():
    load_env()
    driver = init_browser()

    try:
        login(driver)
        tree = discover_with_debug(driver)

        # Now scrape documents from specific folders we care about
        print("\n" + "="*60)
        print("SCRAPING SPECIFIC FOLDERS FOR DEBUGGING")
        print("="*60)

        for fid, info in sorted(tree.items(), key=lambda x: x[1]['path']):
            path = info['path']
            # Focus on financials and minutes
            if 'Financials' in path or 'Minutes' in path:
                docs = scrape_folder_with_debug(driver, fid, info['name'], path)

    finally:
        driver.quit()

if __name__ == '__main__':
    main()
