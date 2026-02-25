#!/usr/bin/env python3
"""Explore Community Information and Board Overview pages"""

import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service

KEYSTONE_URL = "https://kppm.cincwebaxis.com"
KEYSTONE_USERNAME = os.environ['KEYSTONE_USERNAME']
KEYSTONE_PASSWORD = os.environ['KEYSTONE_PASSWORD']

print("Starting browser...")
options = FirefoxOptions()
options.add_argument('--headless')

service = Service(GeckoDriverManager().install())
driver = webdriver.Firefox(service=service, options=options)
driver.set_page_load_timeout(30)

try:
    # Login
    login_url = f"{KEYSTONE_URL}/Account/LoginModernThemes"
    driver.get(login_url)
    time.sleep(2)
    driver.find_element(By.ID, "UserName").send_keys(KEYSTONE_USERNAME)
    driver.find_element(By.ID, "Password").send_keys(KEYSTONE_PASSWORD)
    driver.find_element(By.ID, "btnLogin").click()
    time.sleep(5)
    print(f"Logged in")

    # Explore Community Information
    print("\n=== Exploring Community Information ===")
    driver.get("https://kppm.cincwebaxis.com/p9060/community-information/")
    time.sleep(3)
    print(f"URL: {driver.current_url}")

    links = driver.find_elements(By.TAG_NAME, "a")
    print("Links on Community Information page:")
    for link in links:
        text = link.text.strip()
        href = link.get_attribute('href') or ''
        if text and len(text) < 60 and 'p9060' in href:
            print(f"  {text}: {href}")

    # Check for tables
    tables = driver.find_elements(By.TAG_NAME, "table")
    print(f"\nFound {len(tables)} table(s) on Community Information page")

    # Explore Board Overview
    print("\n=== Exploring Board Overview ===")
    driver.get("https://kppm.cincwebaxis.com/p9060/board-overview/")
    time.sleep(3)
    print(f"URL: {driver.current_url}")

    links = driver.find_elements(By.TAG_NAME, "a")
    print("Links on Board Overview page:")
    for link in links:
        text = link.text.strip()
        href = link.get_attribute('href') or ''
        if text and len(text) < 60 and 'p9060' in href:
            print(f"  {text}: {href}")

    # Check for tables
    tables = driver.find_elements(By.TAG_NAME, "table")
    print(f"\nFound {len(tables)} table(s) on Board Overview page")

    # Try specific pages that might exist
    print("\n=== Trying specific URLs ===")
    test_urls = [
        "https://kppm.cincwebaxis.com/p9060/homeowner-directory/",
        "https://kppm.cincwebaxis.com/p9060/directory/",
        "https://kppm.cincwebaxis.com/p9060/violations/",
        "https://kppm.cincwebaxis.com/p9060/work-orders/",
        "https://kppm.cincwebaxis.com/p9060/architectural-review/",
        "https://kppm.cincwebaxis.com/p9060/arch-review/",
    ]

    for url in test_urls:
        try:
            driver.get(url)
            time.sleep(2)
            # Check if page exists (not 404)
            body_text = driver.find_element(By.TAG_NAME, "body").text.lower()
            if '404' not in body_text and 'not found' not in body_text:
                tables = driver.find_elements(By.TAG_NAME, "table")
                print(f"  {url}: EXISTS - {len(tables)} table(s)")

                # If tables found, show table data
                if tables:
                    for i, table in enumerate(tables[:2]):  # First 2 tables
                        rows = table.find_elements(By.TAG_NAME, "tr")
                        print(f"    Table {i+1}: {len(rows)} rows")
                        # Show first row
                        if rows:
                            cells = rows[0].find_elements(By.TAG_NAME, "th")
                            if not cells:
                                cells = rows[0].find_elements(By.TAG_NAME, "td")
                            headers = [cell.text.strip() for cell in cells]
                            if any(headers):
                                print(f"      Headers: {headers}")
            else:
                print(f"  {url}: 404")
        except Exception as e:
            print(f"  {url}: Error - {e}")

except Exception as e:
    print(f"\nError: {e}")
    import traceback
    traceback.print_exc()

finally:
    driver.quit()
    print("\nDone")
