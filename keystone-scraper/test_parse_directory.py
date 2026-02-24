#!/usr/bin/env python3
"""Test parsing the homeowner directory table"""

import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service

KEYSTONE_URL = "https://kppm.cincwebaxis.com"
KEYSTONE_USERNAME = "REDACTED_EMAIL"
KEYSTONE_PASSWORD = "REDACTED_PASSWORD"

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
    print("Logged in")

    # Navigate to directory
    driver.get(f"{KEYSTONE_URL}/p9060/homeowner-directory/")
    time.sleep(3)
    print("On directory page")

    # Save page source
    with open('/tmp/directory_full.html', 'w') as f:
        f.write(driver.page_source)
    print("Saved page source")

    # Find all tables
    tables = driver.find_elements(By.TAG_NAME, "table")
    print(f"\nFound {len(tables)} tables")

    # Look for the data table (usually has id or class with 'grid', 'data', etc.)
    for i, table in enumerate(tables):
        table_id = table.get_attribute('id')
        table_class = table.get_attribute('class')
        rows = table.find_elements(By.TAG_NAME, "tr")
        print(f"\nTable {i}: id='{table_id}', class='{table_class}', {len(rows)} rows")

        # Show first few rows of tables with significant data
        if len(rows) > 5 and len(rows) < 100:
            print(f"  Showing first 5 rows:")
            for j, row in enumerate(rows[:5]):
                cells = row.find_elements(By.TAG_NAME, "td")
                if not cells:
                    cells = row.find_elements(By.TAG_NAME, "th")

                if cells:
                    cell_texts = [cell.text.strip()[:50] for cell in cells]
                    print(f"    Row {j}: {len(cells)} cells - {cell_texts}")

    # Try to find rows with actual owner data
    print("\n=== Looking for owner data ===")
    # Look for text patterns that indicate owner data
    all_tds = driver.find_elements(By.TAG_NAME, "td")
    for td in all_tds[:100]:  # Check first 100 cells
        text = td.text.strip()
        # Look for cells with email addresses or phone numbers
        if '@' in text or '(' in text and ')' in text and len(text) < 100:
            print(f"Found data cell: {text[:80]}")
            # Get the parent row
            parent_row = td.find_element(By.XPATH, "./ancestor::tr")
            cells_in_row = parent_row.find_elements(By.TAG_NAME, "td")
            print(f"  Row has {len(cells_in_row)} cells")
            if len(cells_in_row) >= 5:
                print(f"  Cell 0: {cells_in_row[0].text.strip()[:50]}")
                print(f"  Cell 1: {cells_in_row[1].text.strip()[:50]}")
                print(f"  Cell 2: {cells_in_row[2].text.strip()[:50]}")
                print(f"  Cell 3: {cells_in_row[3].text.strip()[:50]}")
                print(f"  Cell 4: {cells_in_row[4].text.strip()[:50]}")
                break  # Just show one example

except Exception as e:
    print(f"\nError: {e}")
    import traceback
    traceback.print_exc()

finally:
    driver.quit()
    print("\nDone")
