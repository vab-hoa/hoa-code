#!/usr/bin/env python3
"""Simple test to see if we can launch a browser"""

import sys
from playwright.sync_api import sync_playwright

print("Testing Playwright browser launch...")

try:
    with sync_playwright() as p:
        print("Playwright started, launching browser...")
        browser = p.chromium.launch(headless=True)
        print("Browser launched successfully!")
        page = browser.new_page()
        print("New page created")
        page.goto("https://www.example.com")
        print(f"Navigated to example.com, title: {page.title()}")
        browser.close()
        print("Test passed!")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
