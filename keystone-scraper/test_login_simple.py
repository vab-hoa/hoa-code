#!/usr/bin/env python3
"""Simple login test to debug the issue"""

import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service

print("Starting browser...")
options = FirefoxOptions()
options.add_argument('--headless')
options.set_preference('http.response.timeout', 10)
options.set_preference('dom.max_script_run_time', 10)

try:
    service = Service(GeckoDriverManager().install())
    driver = webdriver.Firefox(service=service, options=options)
    driver.set_page_load_timeout(20)

    print("Browser started")

    url = "https://kppm.cincwebaxis.com/Account/LoginModernThemes"
    print(f"Loading {url}...")

    try:
        driver.get(url)
        print(f"Page loaded, current URL: {driver.current_url}")
    except Exception as e:
        print(f"Page load timeout or error: {e}")
        print(f"Current URL after error: {driver.current_url}")

    time.sleep(2)

    # Save page source for inspection
    with open('/tmp/login_source.html', 'w') as f:
        f.write(driver.page_source)
    print("Saved page source to /tmp/login_source.html")

    # Take screenshot
    driver.save_screenshot('/tmp/login_screenshot.png')
    print("Saved screenshot to /tmp/login_screenshot.png")

    # Look for login fields
    print("\nLooking for login elements...")

    try:
        # Try to find username field
        username_selectors = [
            "input[name='LoginNameTB']",
            "input[id*='LoginName']",
            "input[id*='Username']",
            "input[type='text']",
            "input[type='email']"
        ]

        for selector in username_selectors:
            try:
                elem = driver.find_element(By.CSS_SELECTOR, selector)
                print(f"Found element with selector '{selector}': {elem.get_attribute('outerHTML')[:100]}")
            except:
                pass

        # Try to find password field
        try:
            password = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
            print(f"Found password field: {password.get_attribute('outerHTML')[:100]}")
        except:
            print("No password field found")

    except Exception as e:
        print(f"Error finding elements: {e}")

    print("\nTest complete!")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

finally:
    try:
        driver.quit()
        print("Browser closed")
    except:
        pass
