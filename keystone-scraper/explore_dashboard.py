#!/usr/bin/env python3
"""Explore the dashboard to find menu structure"""

import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service

KEYSTONE_URL = "https://kppm.cincwebaxis.com"
KEYSTONE_USERNAME = os.environ['KEYSTONE_USERNAME']
KEYSTONE_PASSWORD = os.environ['KEYSTONE_PASSWORD']

print("Starting browser...")
options = FirefoxOptions()
# options.add_argument('--headless')  # Run headed to see

service = Service(GeckoDriverManager().install())
driver = webdriver.Firefox(service=service, options=options)
driver.set_page_load_timeout(30)

try:
    # Login
    login_url = f"{KEYSTONE_URL}/Account/LoginModernThemes"
    print(f"Loading {login_url}...")
    driver.get(login_url)
    time.sleep(2)

    # Login
    driver.find_element(By.ID, "UserName").send_keys(KEYSTONE_USERNAME)
    driver.find_element(By.ID, "Password").send_keys(KEYSTONE_PASSWORD)
    driver.find_element(By.ID, "btnLogin").click()
    time.sleep(5)

    print(f"Logged in, URL: {driver.current_url}")

    # Save page source
    with open('/tmp/dashboard.html', 'w') as f:
        f.write(driver.page_source)
    print("Saved dashboard HTML to /tmp/dashboard.html")

    # Find all menu/navigation links
    print("\n=== Navigation links ===")
    links = driver.find_elements(By.TAG_NAME, "a")
    menu_links = []
    for link in links:
        text = link.text.strip()
        href = link.get_attribute('href') or ''
        if text and len(text) < 50:  # Menu items are usually short
            menu_links.append((text, href))

    # Filter to unique
    seen = set()
    for text, href in menu_links:
        key = (text.lower(), href)
        if key not in seen and text:
            seen.add(key)
            print(f"  {text}: {href}")

    # Look for specific items
    print("\n=== Looking for data sections ===")
    keywords = ['directory', 'homeowner', 'violation', 'work order', 'architectural', 'board', 'community']
    for keyword in keywords:
        matching = [link for link in links if keyword.lower() in link.text.lower()]
        if matching:
            print(f"\n{keyword.upper()}:")
            for link in matching[:5]:  # Limit to 5
                print(f"  Text: '{link.text.strip()}' | href: {link.get_attribute('href')}")

    print("\n\nKeeping browser open for 30 seconds so you can inspect...")
    time.sleep(30)

except Exception as e:
    print(f"\nError: {e}")
    import traceback
    traceback.print_exc()

finally:
    driver.quit()
    print("\nBrowser closed")
