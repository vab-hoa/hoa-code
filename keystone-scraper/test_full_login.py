#!/usr/bin/env python3
"""Test the full login process"""

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
options.add_argument('--headless')

service = Service(GeckoDriverManager().install())
driver = webdriver.Firefox(service=service, options=options)
driver.set_page_load_timeout(30)

try:
    # Navigate to login page
    login_url = f"{KEYSTONE_URL}/Account/LoginModernThemes"
    print(f"Loading {login_url}...")
    driver.get(login_url)
    print(f"Page loaded")
    time.sleep(2)

    # Find all input fields to determine correct names
    inputs = driver.find_elements(By.TAG_NAME, "input")
    print("\nAll input fields:")
    for inp in inputs:
        inp_type = inp.get_attribute('type')
        inp_name = inp.get_attribute('name')
        inp_id = inp.get_attribute('id')
        print(f"  Type: {inp_type}, Name: {inp_name}, ID: {inp_id}")

    # Try to login
    print("\nAttempting login...")

    # Find username field
    wait = WebDriverWait(driver, 10)
    username_field = wait.until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='text'], input[type='email']"))
    )
    print(f"Found username field: id={username_field.get_attribute('id')}, name={username_field.get_attribute('name')}")

    username_field.clear()
    username_field.send_keys(KEYSTONE_USERNAME)
    print(f"Entered username: {KEYSTONE_USERNAME}")
    time.sleep(0.5)

    # Find password field
    password_field = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
    print(f"Found password field: id={password_field.get_attribute('id')}, name={password_field.get_attribute('name')}")

    password_field.clear()
    password_field.send_keys(KEYSTONE_PASSWORD)
    print("Entered password")
    time.sleep(0.5)

    # Find submit button
    submit_buttons = driver.find_elements(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")
    print(f"\nFound {len(submit_buttons)} submit button(s)")
    for btn in submit_buttons:
        print(f"  Button: {btn.get_attribute('outerHTML')[:100]}")

    if submit_buttons:
        print("\nClicking submit button...")
        submit_buttons[0].click()
        time.sleep(5)

        print(f"After login, URL: {driver.current_url}")

        # Check if login was successful
        page_text = driver.find_element(By.TAG_NAME, "body").text
        if 'logout' in page_text.lower() or 'sign out' in page_text.lower() or 'dashboard' in page_text.lower():
            print("LOGIN SUCCESSFUL!")
        else:
            print("Login may have failed")
            # Check for error messages
            try:
                errors = driver.find_elements(By.CSS_SELECTOR, ".error, .alert, .alert-danger, .validation-summary-errors")
                for err in errors:
                    if err.text.strip():
                        print(f"Error message: {err.text}")
            except:
                pass

        # Save screenshot
        driver.save_screenshot('/tmp/after_login.png')
        print("Screenshot saved to /tmp/after_login.png")

except Exception as e:
    print(f"\nError: {e}")
    import traceback
    traceback.print_exc()
    driver.save_screenshot('/tmp/login_error.png')
    print("Screenshot saved to /tmp/login_error.png")

finally:
    driver.quit()
    print("\nBrowser closed")
