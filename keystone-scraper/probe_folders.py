#!/usr/bin/env python3
"""
Probe the Broadlands document library to find the correct CSS selectors
for the folder tree and document list. Run after explore_broadlands.py
confirms the switch-account flow works.

Run: venv/bin/python probe_folders.py [--headed]
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
OUT_DIR = Path("/tmp/broadlands_explore")

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
    print(f"  [ss] {path}")

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

def login_and_switch(driver):
    # Login
    driver.get(f"{KEYSTONE_URL}/Account/LoginModernThemes")
    time.sleep(2)
    wait = WebDriverWait(driver, 15)
    wait.until(EC.presence_of_element_located((By.ID, "UserName"))).send_keys(os.environ['KEYSTONE_USERNAME'])
    driver.find_element(By.ID, "Password").send_keys(os.environ['KEYSTONE_PASSWORD'])
    driver.find_element(By.ID, "btnLogin").click()
    time.sleep(4)
    print(f"Logged in: {driver.current_url}")

    # Switch to Broadlands
    driver.get(f"{KEYSTONE_URL}/account/dashboard")
    time.sleep(3)

    # Open account dropdown
    trigger = driver.find_element(By.XPATH,
        "//a[contains(@href,'#') and (contains(@class,'dropdown') or contains(@class,'account'))]")
    driver.execute_script("arguments[0].click();", trigger)
    time.sleep(1)

    # Click Switch Account
    wait.until(EC.element_to_be_clickable(
        (By.XPATH, "//*[contains(text(),'Switch Account')]"))).click()
    time.sleep(2)

    # Select Broadlands radio
    radio = driver.find_element(By.XPATH,
        "//input[@type='radio'][following::*[contains(text(),'Broadlands')][1]]")
    driver.execute_script("arguments[0].click();", radio)
    time.sleep(0.5)

    # Click confirm
    btn = driver.find_element(By.XPATH,
        "//input[@type='submit' or @type='button'][contains(@value,'Switch')]")
    driver.execute_script("arguments[0].click();", btn)
    time.sleep(5)
    print(f"Switched: {driver.title}")

def probe_documents_page(driver):
    driver.get(f"{KEYSTONE_URL}/p8006/documents/")
    time.sleep(5)  # extra wait for JS to load
    screenshot(driver, "probe_01_docs_loaded")

    # Save full page source (no truncation)
    src = driver.page_source
    src_path = OUT_DIR / "documents_full.html"
    src_path.write_text(src)
    print(f"Full page source ({len(src)} bytes) → {src_path}")

    # Check for folder names in live DOM
    print("\n--- Searching live DOM for 'Agendas' ---")
    els = driver.find_elements(By.XPATH, "//*[contains(text(),'Agendas')]")
    for el in els:
        print(f"  tag={el.tag_name}  class='{el.get_attribute('class')}'  "
              f"id='{el.get_attribute('id')}'  text='{el.text[:60]}'")

    # Dump the full element tree of the left panel (first ~400px)
    print("\n--- All elements containing folder names ---")
    folder_names = ["Agendas", "Architectural", "Archived", "Governing",
                    "Newsletters", "Budgets", "Financials", "Rules", "Forms"]
    for name in folder_names:
        try:
            el = driver.find_element(By.XPATH, f"//*[contains(text(),'{name}')]")
            print(f"  '{name}': tag={el.tag_name}  class='{el.get_attribute('class')}'  "
                  f"id='{el.get_attribute('id')}'  parent_class='{_parent_class(driver, el)}'")
        except NoSuchElementException:
            print(f"  '{name}': NOT FOUND in DOM")

    # Dump everything inside the left column box
    print("\n--- Children of the left panel box ---")
    try:
        # The document library has a 2-column layout; left is roughly 1/4 width
        box = driver.find_element(By.CSS_SELECTOR, ".document-library, #DocumentLibrary, .doc-library")
        print(f"  Found container: {box.tag_name} class='{box.get_attribute('class')}'")
    except NoSuchElementException:
        # Try the main content area
        try:
            box = driver.find_element(By.CSS_SELECTOR, ".container .row, main, #main, #content")
            print(f"  Using fallback container: {box.tag_name} class='{box.get_attribute('class')}'")
        except NoSuchElementException:
            box = driver.find_element(By.TAG_NAME, "body")
            print("  Using body as container")

    # Walk top-level children looking for the folder div
    children = box.find_elements(By.XPATH, ".//*")
    print(f"  Total descendants: {len(children)}")

    # Find any element whose text matches a known folder name
    print("\n--- Unique (tag, class) combos that contain folder names ---")
    combos = set()
    for name in folder_names:
        for el in driver.find_elements(By.XPATH, f"//*[normalize-space(text())='{name}']"):
            combo = (el.tag_name, el.get_attribute("class") or "")
            if combo not in combos:
                combos.add(combo)
                print(f"  tag={el.tag_name}  class='{el.get_attribute('class')}'")

    # Now try clicking the first folder and see what happens
    print("\n--- Attempting to click 'Agendas' folder ---")
    try:
        agendas = driver.find_element(By.XPATH, "//*[normalize-space(text())='Agendas']")
        print(f"  Clicking: tag={agendas.tag_name} class='{agendas.get_attribute('class')}'")
        driver.execute_script("arguments[0].click();", agendas)
        time.sleep(3)
        screenshot(driver, "probe_02_agendas_clicked")

        # Now find document links in the right panel
        print("\n--- Links after clicking Agendas ---")
        seen = set()
        for a in driver.find_elements(By.TAG_NAME, "a"):
            href = a.get_attribute("href") or ""
            text = a.text.strip()
            if href in seen or not href or href.endswith("#") or "javascript:" in href:
                continue
            if any(nav in href for nav in ['/home/', '/payments/', '/account-info/',
                                           '/community-information/', '/contact-page/',
                                           '/dashboard', 'google.com', 'cincsystems.com',
                                           'play.google.com']):
                continue
            seen.add(href)
            print(f"  [{text[:60]}]  {href}")

        # Save right-panel HTML
        right_src = driver.page_source
        (OUT_DIR / "after_agendas_click.html").write_text(right_src[:100000])
        print(f"\n  Saved page after Agendas click ({len(right_src)} bytes)")

    except NoSuchElementException:
        print("  Could not find Agendas element")
        screenshot(driver, "probe_02_no_agendas")

def _parent_class(driver, el):
    try:
        parent = driver.execute_script("return arguments[0].parentElement;", el)
        return parent.get_attribute("class") or ""
    except Exception:
        return ""

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--headed", action="store_true")
    args = parser.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    load_env()

    driver = init_browser(not args.headed)
    try:
        login_and_switch(driver)
        probe_documents_page(driver)
        print(f"\nDone. Output in {OUT_DIR}")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
