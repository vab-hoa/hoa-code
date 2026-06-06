#!/usr/bin/env python3
"""
Keystone Pacific Property Management Portal Scraper (Selenium version)
Scrapes homeowner data, violations, work orders, and architectural reviews
and caches them in Google Sheets for use by Property Report system.

Updated to use Accounts Receivable Detail page for cleaner data:
- Scrapes from Board Overview → Accounts Receivable Detail
- Extracts: Street Number, Street Name, Unit, Account Number, Owner Name
- Standardizes addresses to HOA format (e.g., "13738RP1")
- Writes to Profiles sheet: Address | AccountNumber | AccountName | LastUpdated | Source
"""

import os
import sys
import logging
import time
import argparse
from datetime import datetime
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.firefox import GeckoDriverManager
from selenium.webdriver.firefox.service import Service

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


# Configuration
KEYSTONE_URL = "https://kppm.cincwebaxis.com"
KEYSTONE_USERNAME = os.environ['KEYSTONE_USERNAME']
KEYSTONE_PASSWORD = os.environ['KEYSTONE_PASSWORD']

CREDENTIALS_PATH = os.path.expanduser("~/.config/openclaw/google-service-account.json")
SPREADSHEET_ID = "1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ"

# Sheet names
PROFILES_SHEET = "Profiles"
VIOLATIONS_SHEET = "Violations"
WORKORDERS_SHEET = "WorkOrders"
ARCHREVIEWS_SHEET = "ArchReviews"

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class KeystoneScraperSelenium:
    """Main scraper class for Keystone Pacific portal using Selenium."""

    def __init__(self, headless=True, dry_run=False):
        """
        Initialize the scraper.

        Args:
            headless: Run browser in headless mode (default: True)
            dry_run: Don't write to Google Sheets, just log data (default: False)
        """
        self.headless = headless
        self.dry_run = dry_run
        self.driver = None
        self.sheets_service = None

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - cleanup resources."""
        self.cleanup()

    def cleanup(self):
        """Clean up browser resources."""
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass

    def init_browser(self):
        """Initialize Selenium browser with Firefox."""
        logger.info(f"Initializing Firefox browser (headless={self.headless})...")

        options = FirefoxOptions()
        if self.headless:
            options.add_argument('--headless')

        # Try to use webdriver-manager to get geckodriver
        try:
            service = Service(GeckoDriverManager().install())
            self.driver = webdriver.Firefox(service=service, options=options)
        except Exception as e:
            logger.warning(f"webdriver-manager failed: {e}, trying system Firefox...")
            # Fallback to system Firefox without geckodriver management
            self.driver = webdriver.Firefox(options=options)

        self.driver.set_page_load_timeout(30)
        self.driver.implicitly_wait(10)
        logger.info("Browser initialized")

    def init_sheets(self):
        """Initialize Google Sheets API connection."""
        if self.dry_run:
            logger.info("Dry run mode - skipping Google Sheets initialization")
            return

        logger.info("Initializing Google Sheets API...")
        try:
            credentials = service_account.Credentials.from_service_account_file(
                CREDENTIALS_PATH,
                scopes=['https://www.googleapis.com/auth/spreadsheets']
            )
            self.sheets_service = build('sheets', 'v4', credentials=credentials)
            logger.info("Google Sheets API initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Google Sheets: {e}")
            raise

    def login(self):
        """Login to Keystone portal."""
        logger.info("Logging into Keystone portal...")
        try:
            # Navigate directly to login page
            login_url = f"{KEYSTONE_URL}/Account/LoginModernThemes"
            logger.info(f"Navigating to {login_url}")
            self.driver.get(login_url)
            time.sleep(2)

            # Wait for login form
            wait = WebDriverWait(self.driver, 15)

            # Find username field (name='UserName')
            username_field = wait.until(
                EC.presence_of_element_located((By.ID, "UserName"))
            )
            logger.info("Found username field")

            # Fill username
            username_field.clear()
            username_field.send_keys(KEYSTONE_USERNAME)
            time.sleep(0.5)

            # Find password field (name='Password')
            password_field = self.driver.find_element(By.ID, "Password")
            logger.info("Found password field")

            # Fill password
            password_field.clear()
            password_field.send_keys(KEYSTONE_PASSWORD)
            time.sleep(0.5)

            # Find and click login button (id='btnLogin')
            login_btn = self.driver.find_element(By.ID, "btnLogin")
            logger.info("Found login button, clicking...")
            login_btn.click()

            # Wait for page to load after login
            time.sleep(5)

            # Check if login was successful by checking the URL
            current_url = self.driver.current_url.lower()
            if 'dashboard' in current_url or 'home' in current_url:
                logger.info(f"Login successful - redirected to {self.driver.current_url}")
                return True
            else:
                logger.error(f"Login may have failed - current URL: {self.driver.current_url}")
                # Check for error messages
                try:
                    error_elem = self.driver.find_element(By.CSS_SELECTOR,
                        ".error, .alert, .validation-summary-errors, .alert-danger")
                    if error_elem.text.strip():
                        logger.error(f"Login error: {error_elem.text}")
                except:
                    pass

                self.driver.save_screenshot('/tmp/keystone_login_failed.png')
                logger.info("Screenshot saved to /tmp/keystone_login_failed.png")
                return False

        except Exception as e:
            logger.error(f"Login failed: {e}")
            import traceback
            traceback.print_exc()
            if self.driver:
                self.driver.save_screenshot('/tmp/keystone_error.png')
            return False

    def standardize_address(self, street_number, street_name, unit):
        """
        Standardize address to HOA format.

        Examples:
            "13738", "Rock Point", "101" -> "13738RP1"
            "13747", "Boulder Point", "202" -> "13747BP2"

        Args:
            street_number: Street number (e.g., "13738")
            street_name: Street name (e.g., "Rock Point")
            unit: Unit number (e.g., "101", "#101", or "")

        Returns:
            Standardized address string or None if cannot parse
        """
        import re

        if not street_number or not street_name:
            return None

        # Clean street number (remove non-digits)
        street_num = re.sub(r'\D', '', str(street_number))
        if not street_num:
            return None

        # Street name to code mapping (full names and common abbreviations)
        # Must match HOALibrary/AddressStandardization.gs STREET_CODES exactly
        street_codes = {
            'rock point': 'RP',
            'rock pt': 'RP',
            'boulder point': 'BP',
            'boulder pt': 'BP',
            'boulder circle': 'BC',  # separate street, not Boulder Point
            'broadlands': 'BL',
            'stone circle': 'SC',
            'stone cir': 'SC',
            'plaster point': 'PP',
            'plaster pt': 'PP',
        }

        # Find matching street code
        street_lower = street_name.lower().strip()
        street_code = None
        for street, code in street_codes.items():
            if street in street_lower:
                street_code = code
                break

        if not street_code:
            logger.warning(f"Unknown street name: {street_name}")
            return None

        # Extract and standardize unit number
        unit_suffix = ''
        if unit:
            # Remove # and spaces
            unit_clean = re.sub(r'[#\s]', '', str(unit))
            # Extract unit suffix: 101 -> '1', 102 -> '2'
            unit_match = re.search(r'10([12])', unit_clean)
            if unit_match:
                unit_suffix = unit_match.group(1)
            elif re.search(r'^[12]$', unit_clean):
                # Already just '1' or '2'
                unit_suffix = unit_clean

        return f"{street_num}{street_code}{unit_suffix}"

    def scrape_accounts_receivable(self):
        """
        Scrape the Accounts Receivable Detail page for homeowner profile data.

        Selects "All Homeowners" in the filter dropdown to get all units,
        not just delinquent accounts. Table structure:
        - Street Number (separate column)
        - Street Name
        - Unit
        - Account Number

        Returns:
            List of dicts with keys: address, account_number, account_name
        """
        logger.info("Scraping Accounts Receivable Detail...")
        try:
            # Navigate to Board Overview first
            board_url = f"{KEYSTONE_URL}/p9060/board-overview/"
            logger.info(f"Navigating to {board_url}")
            self.driver.get(board_url)
            time.sleep(3)

            # Look for "Accounts Receivable Detail" link
            try:
                wait = WebDriverWait(self.driver, 10)
                ar_link = wait.until(
                    EC.presence_of_element_located((By.LINK_TEXT, "Accounts Receivable Detail"))
                )
                logger.info("Found Accounts Receivable Detail link, clicking...")
                ar_link.click()
                time.sleep(3)
            except TimeoutException:
                # Try direct URL navigation
                ar_url = f"{KEYSTONE_URL}/p9060/accounts-receivable-detail/"
                logger.info(f"Link not found, trying direct URL: {ar_url}")
                self.driver.get(ar_url)
                time.sleep(3)

            # Set "Collection Level" dropdown to "All Homeowners" then click Refresh
            try:
                from selenium.webdriver.support.ui import Select as SeleniumSelect
                collection_dd = self.driver.find_element(By.ID, "CollectionLevelId")
                SeleniumSelect(collection_dd).select_by_visible_text("All Homeowners")
                logger.info("Selected 'All Homeowners' in CollectionLevelId dropdown")
                time.sleep(1)
                refresh_btn = self.driver.find_element(By.ID, "txtbtnSearch")
                self.driver.execute_script("arguments[0].click();", refresh_btn)
                logger.info("Clicked 'Refresh Display' button")
                time.sleep(4)
            except Exception as e:
                logger.warning(f"Error selecting 'All Homeowners' or clicking Refresh: {e}")

            # Extract profile data using DevExpress grid rows with pagination
            # Grid: BoardAccountReceivableGrid
            # Column mapping:
            #   Cell[0]: Owner name
            #   Cell[1]: Street number ("13622")
            #   Cell[2]: Street + unit ("Boulder Circle #102")
            #   Cell[4]: Account number ("P906013622102B")
            profiles = []
            import re as _re

            grid_prefix = 'BoardAccountReceivableGrid'
            page_num = 1

            while True:
                data_rows = self.driver.find_elements(
                    By.CSS_SELECTOR, f"tr[id^='{grid_prefix}_DXDataRow']"
                )
                logger.info(f"AR page {page_num}: {len(data_rows)} rows")

                for idx, row in enumerate(data_rows):
                    try:
                        cells = row.find_elements(By.CSS_SELECTOR, "td")
                        if len(cells) < 5:
                            continue

                        owner_name = cells[0].text.strip()
                        street_number = cells[1].text.strip()
                        street_and_unit = cells[2].text.strip()
                        account_number = cells[4].text.strip()

                        if not street_number or not account_number:
                            continue

                        # Parse "Boulder Circle #102" -> street_name="Boulder Circle", unit="102"
                        unit = ''
                        street_name = street_and_unit
                        unit_match = _re.search(r'#\s*(\d+)\s*$', street_and_unit)
                        if unit_match:
                            unit = unit_match.group(1)
                            street_name = street_and_unit[:unit_match.start()].strip()

                        standardized_addr = self.standardize_address(street_number, street_name, unit)
                        if not standardized_addr:
                            logger.warning(f"AR row {idx}: could not standardize {street_number} {street_name} {unit}")
                            continue

                        profile = {
                            'address': standardized_addr,
                            'account_number': account_number,
                            'account_name': owner_name,
                            'last_updated': datetime.now().strftime('%Y-%m-%d'),
                            'source': 'Keystone'
                        }
                        profiles.append(profile)
                        logger.info(f"Profile: {standardized_addr} -> {account_number} ({owner_name})")

                    except Exception as e:
                        logger.debug(f"Error parsing AR row {idx}: {e}")
                        continue

                # Advance to next page if available
                try:
                    pager = self.driver.find_element(By.ID, f"{grid_prefix}_DXPagerBottom")
                    btn_elements = pager.find_elements(
                        By.XPATH, ".//*[self::a or self::b][contains(@class,'dxp-button')]"
                    )
                    if not btn_elements or btn_elements[-1].tag_name.lower() == 'b':
                        break  # Last page
                    self.driver.execute_script("arguments[0].click();", btn_elements[-1])
                    time.sleep(3)
                    page_num += 1
                except NoSuchElementException:
                    break  # No pager = single page

            logger.info(f"Found {len(profiles)} homeowner profiles across {page_num} page(s)")
            return profiles

        except Exception as e:
            logger.error(f"Error scraping accounts receivable: {e}")
            import traceback
            traceback.print_exc()
            self.driver.save_screenshot('/tmp/keystone_ar_error.png')
            return []

    def scrape_violations(self):
        """
        Scrape the Violations list.

        Returns:
            List of dicts with keys: address, date, description, status
        """
        logger.info("Scraping Violations...")
        try:
            # Navigate directly to violations URL
            violations_url = f"{KEYSTONE_URL}/p9060/violations/"
            logger.info(f"Navigating to {violations_url}")
            self.driver.get(violations_url)
            time.sleep(3)

            # Save page source and screenshot for column-mapping inspection
            with open('/tmp/keystone_violations_source.html', 'w', encoding='utf-8') as f:
                f.write(self.driver.page_source)
            self.driver.save_screenshot('/tmp/keystone_violations_loaded.png')
            logger.info(f"Violations page source saved to /tmp/keystone_violations_source.html")

            violations = []

            # Try to find the violations table
            try:
                rows = self.driver.find_elements(By.CSS_SELECTOR, "table tbody tr")

                for row_idx, row in enumerate(rows):
                    try:
                        cells = row.find_elements(By.CSS_SELECTOR, "td")

                        # Skip if not enough cells or is a "No data" message
                        if len(cells) < 3:
                            continue

                        # Check if it's a "no data" row
                        row_text = row.text.strip().lower()
                        if 'no data' in row_text or not cells[0].text.strip():
                            continue

                        # Log all cell contents for first few rows so we can confirm
                        # date/status column indices from tonight's log
                        if row_idx < 5:
                            cell_texts = [f"[{i}]={repr(c.text.strip()[:40])}" for i, c in enumerate(cells)]
                            logger.info(f"Violation row {row_idx} ({len(cells)} cells): {', '.join(cell_texts)}")

                        # Known column layout (confirmed by portal inspection):
                        #   [0] Account
                        #   [1] Homeowner (name)
                        #   [2] Address  e.g. "13685 Stone Circle #101"
                        #   [3] Violation Detail (description text)
                        #   [4] Details button (popup) — not a text field, skip
                        if len(cells) < 4:
                            continue

                        raw_address = cells[2].text.strip()
                        standardized_addr, _ = self._parse_work_location(raw_address) if raw_address else (None, None)
                        if not standardized_addr:
                            standardized_addr = raw_address

                        violation = {
                            'address': standardized_addr,
                            'date': '',
                            'description': cells[3].text.strip(),
                            'status': ''
                        }

                        # Only add if we have at least a description
                        if violation['description']:
                            logger.info(f"Violation: addr='{violation['address']}' date='{violation['date']}' desc='{violation['description'][:40]}' status='{violation['status']}'")
                            violations.append(violation)

                    except Exception as e:
                        logger.debug(f"Error parsing violation row: {e}")
                        continue

                logger.info(f"Found {len(violations)} violations")

            except Exception as e:
                logger.warning(f"Could not find violations table: {e}")
                self.driver.save_screenshot('/tmp/keystone_violations_notfound.png')

            return violations

        except Exception as e:
            logger.error(f"Error scraping violations: {e}")
            import traceback
            traceback.print_exc()
            self.driver.save_screenshot('/tmp/keystone_violations_error.png')
            return []

    def scrape_work_orders(self):
        """
        Scrape the Work Orders list from the board-level work order review page.

        URL: /p9060/work-order-review/
        Grid: BoardWorkOrdersGrid (DevExpress ASPxGridView, 10 rows per page)

        Column mapping (0-indexed):
          Cell 0: Work Order Number
          Cell 1: Date Created
          Cell 2: Date Printed/Emailed (skip)
          Cell 3: Due Date (skip)
          Cell 4: Type/Description (two lines: "Type\nDescription")
          Cell 5: Vendor
          Cell 6: Work Location ("Name Address" format, first digit = start of address)
          Cell 7: Status
          Cell 8: Details button (skip)
          Cell 9: Empty (skip)

        Returns:
            List of dicts with keys: address, wo_number, date, description, vendor, status
        """
        logger.info("Scraping Work Orders (board review view)...")
        try:
            # Navigate directly to board-level work order review page
            work_orders_url = f"{KEYSTONE_URL}/p9060/work-order-review/"
            logger.info(f"Navigating to {work_orders_url}")
            self.driver.get(work_orders_url)
            time.sleep(5)

            # Save page source for debugging
            with open('/tmp/keystone_workorders_source.html', 'w', encoding='utf-8') as f:
                f.write(self.driver.page_source)
            self.driver.save_screenshot('/tmp/keystone_workorders_loaded.png')
            logger.info(f"Current URL: {self.driver.current_url}")

            work_orders = []
            discarded_count = 0
            grid_prefix = 'BoardWorkOrdersGrid'

            try:
                page_num = 0
                while True:
                    page_num += 1
                    logger.info(f"Processing work orders page {page_num}...")

                    data_rows = self.driver.find_elements(
                        By.CSS_SELECTOR, f"tr[id^='{grid_prefix}_DXDataRow']"
                    )
                    logger.info(f"Found {len(data_rows)} rows on page {page_num}")

                    if not data_rows:
                        logger.info("No data rows found, stopping")
                        break

                    for idx, row in enumerate(data_rows):
                        try:
                            cells = row.find_elements(By.CSS_SELECTOR, "td")

                            if idx < 2:
                                logger.info(
                                    f"  Row {idx}: {len(cells)} cells, "
                                    f"WO#={cells[0].text.strip() if cells else '?'}, "
                                    f"Location={cells[6].text.strip()[:50] if len(cells) > 6 else '?'}"
                                )

                            if len(cells) < 8:
                                logger.debug(f"Row {idx}: Skipping - only {len(cells)} cells (need 8)")
                                continue

                            wo_number = cells[0].text.strip()
                            date_created = cells[1].text.strip()
                            # cells[2]=Date Printed, cells[3]=Due Date (both skipped)
                            type_desc_raw = cells[4].text.strip()
                            vendor = cells[5].text.strip()
                            work_location = cells[6].text.strip()
                            status = cells[7].text.strip()

                            # Format description: "Type\nDescription" -> "Type - Description"
                            if '\n' in type_desc_raw:
                                parts = type_desc_raw.split('\n', 1)
                                description = ' - '.join(p.strip() for p in parts if p.strip())
                            else:
                                description = type_desc_raw

                            if not wo_number:
                                discarded_count += 1
                                continue

                            if not work_location:
                                logger.info(f"Discarding WO#{wo_number} - empty Work Location")
                                discarded_count += 1
                                continue

                            standardized_address, street_name = self._parse_work_location(
                                work_location
                            )

                            if not standardized_address:
                                logger.warning(
                                    f"Discarding WO#{wo_number} - cannot parse location: "
                                    f"'{work_location}'"
                                )
                                discarded_count += 1
                                continue

                            if not self._validate_address(standardized_address, street_name):
                                logger.warning(
                                    f"Discarding WO#{wo_number} - invalid address: "
                                    f"{standardized_address} (location: '{work_location}')"
                                )
                                discarded_count += 1
                                continue

                            work_orders.append({
                                'address': standardized_address,
                                'wo_number': wo_number,
                                'date': date_created,
                                'description': description,
                                'vendor': vendor,
                                'status': status
                            })
                            logger.info(
                                f"Added WO#{wo_number} - {standardized_address} "
                                f"[{status}] vendor='{vendor}'"
                            )

                        except Exception as e:
                            logger.debug(f"Error on work order row {idx}: {e}")
                            discarded_count += 1
                            continue

                    # Advance to next page (or stop if last page)
                    if not self._go_to_next_work_orders_page(grid_prefix):
                        logger.info("No more pages")
                        break

                logger.info(
                    f"Work orders complete: {len(work_orders)} extracted, "
                    f"{discarded_count} discarded"
                )

            except Exception as e:
                logger.warning(f"Could not scrape work orders table: {e}")
                self.driver.save_screenshot('/tmp/keystone_workorders_notfound.png')

            return work_orders

        except Exception as e:
            logger.error(f"Error scraping work orders: {e}")
            import traceback
            traceback.print_exc()
            self.driver.save_screenshot('/tmp/keystone_workorders_error.png')
            return []

    def _detect_work_orders_grid_prefix(self):
        """
        Detect the grid ID prefix for the work orders DevExpress grid.
        Returns 'BoardWorkOrdersGrid' if the board view loaded, else 'WorkOrdersGrid'.
        """
        page_source = self.driver.page_source
        if 'BoardWorkOrdersGrid_DXDataRow' in page_source or 'BoardWorkOrdersGrid_DXMainTable' in page_source:
            return 'BoardWorkOrdersGrid'
        return 'WorkOrdersGrid'

    def _go_to_next_work_orders_page(self, grid_prefix):
        """
        Click the Next Page button in the DevExpress work orders grid pager.

        DevExpress renders a pager at the bottom of the grid with a "next" button.
        Typical IDs: {grid_prefix}_DXPagerBottom_Next or similar.

        Args:
            grid_prefix: The grid ID prefix (e.g., 'BoardWorkOrdersGrid')

        Returns:
            True if successfully navigated to next page, False if no next page exists
        """
        try:
            # DevExpress pager: active buttons are <a class="dxp-button dxp-bi">,
            # disabled buttons are <b class="dxp-button dxp-bi dxp-disabledButton">.
            # The Next button is the last dxp-button element in the pager.
            # Look inside the pager div at the bottom.
            pager_id = f"{grid_prefix}_DXPagerBottom"
            try:
                pager = self.driver.find_element(By.ID, pager_id)
            except NoSuchElementException:
                logger.info(f"Pager '{pager_id}' not found - assuming single page")
                return False

            # Find the Next button: the last <a> or <b> with class dxp-button in the pager
            # Active = <a>, Disabled = <b>
            btn_elements = pager.find_elements(
                By.XPATH, ".//*[self::a or self::b][contains(@class,'dxp-button')]"
            )
            if not btn_elements:
                logger.info("No pager buttons found - assuming single page")
                return False

            # The last button is Next (first is Prev)
            next_btn = btn_elements[-1]
            tag_name = next_btn.tag_name.lower()

            if tag_name == 'b':
                # Disabled button (next page not available)
                logger.info("Next page button is disabled - last page reached")
                return False

            # Active <a> button - click it (uses onclick, not href)
            logger.info("Clicking DevExpress Next page button")
            self.driver.execute_script("arguments[0].click();", next_btn)
            time.sleep(3)  # Wait for AJAX grid reload
            return True

        except Exception as e:
            logger.warning(f"Error navigating to next page: {e}")
            return False

    def _get_work_order_details(self, wo_number):
        """
        Click the Details button for a work order and extract Work Location and Vendor
        from the popup.

        Args:
            wo_number: The work order number string

        Returns:
            Tuple (work_location, vendor) - either may be empty string on failure
        """
        work_location = ''
        vendor = ''

        try:
            # Find and click the Details button (id pattern: btnWOD{wo_number})
            btn_id = f"btnWOD{wo_number}"
            try:
                details_btn = self.driver.find_element(By.ID, btn_id)
            except NoSuchElementException:
                # Try finding by partial text
                details_btn = self.driver.find_element(
                    By.XPATH,
                    f"//input[@value='Details' and contains(@id, '{wo_number}')]"
                )

            details_btn.click()
            time.sleep(2)  # Wait for AJAX popup to load

            # Save popup HTML for debugging
            try:
                popup_elem = self.driver.find_element(
                    By.CSS_SELECTOR, "#WOdetailsPopUp_PWC-1"
                )
                popup_html = popup_elem.get_attribute('innerHTML')
                with open(f'/tmp/keystone_wo_popup_{wo_number}.html', 'w') as f:
                    f.write(popup_html)
                logger.info(f"Saved popup HTML to /tmp/keystone_wo_popup_{wo_number}.html")

                # Try to extract Work Location from popup text
                popup_text = popup_elem.text
                logger.info(f"Popup text for WO#{wo_number}: {popup_text[:200]}")

                # Parse popup text for Work Location
                work_location, vendor = self._parse_popup_text(popup_text)

            except NoSuchElementException:
                logger.warning(f"Popup not found for WO#{wo_number}")

            # Close the popup
            try:
                close_btn = self.driver.find_element(
                    By.CSS_SELECTOR, "#WOdetailsPopUp_HCB"
                )
                close_btn.click()
                time.sleep(1)
            except Exception:
                # Try pressing Escape to close
                from selenium.webdriver.common.keys import Keys
                self.driver.find_element(By.TAG_NAME, 'body').send_keys(Keys.ESCAPE)
                time.sleep(1)

        except Exception as e:
            logger.warning(f"Could not get details for WO#{wo_number}: {e}")

        return work_location, vendor

    def _parse_popup_text(self, popup_text):
        """
        Parse the Details popup text to extract the address and contact.

        The popup has inline label:value pairs on the same line, e.g.:
            "Address : 13737 Rock Point #102 Phone :"
            "Contact : William McDonald Buck Follow-Up Date :"

        Args:
            popup_text: Full text content of the popup element

        Returns:
            Tuple (work_location, contact) where work_location is the raw address string
        """
        import re

        work_location = ''
        contact = ''

        if not popup_text:
            return work_location, contact

        # Normalize whitespace in the full text
        text = ' '.join(popup_text.split())

        # Extract Address value: "Address : <value> <NextLabel> :"
        # Matches everything between "Address :" and the next label (word(s) followed by " :")
        addr_match = re.search(
            r'Address\s*:\s*(.+?)(?=\s+\w[\w\s]*\s*:|$)',
            text, re.IGNORECASE
        )
        if addr_match:
            work_location = addr_match.group(1).strip()
            logger.debug(f"Found address in popup: '{work_location}'")

        # Extract Contact value (closest thing to Vendor in the popup)
        contact_match = re.search(
            r'Contact\s*:\s*(.+?)(?=\s+\w[\w\s]*\s*:|$)',
            text, re.IGNORECASE
        )
        if contact_match:
            contact = contact_match.group(1).strip()
            logger.debug(f"Found contact in popup: '{contact}'")

        return work_location, contact

    def _parse_work_location(self, work_location):
        """
        Parse the Work Location field to extract and standardize the address.

        Work Location format: "name address"
        - First numeric character signals the start of the address
        - Everything before the first digit is the property name (discarded)

        Examples:
            "John Smith 13738 Rock Point Unit 101" -> ("13738RP1", "Rock Point")
            "Jane Doe 3555 Broadlands Lane #102"   -> ("3555BL2", "Broadlands Lane")
            "13747 Boulder Point 101"              -> ("13747BP1", "Boulder Point")
            ""                                     -> (None, None)

        Args:
            work_location: Text from the Work Location column

        Returns:
            Tuple (standardized_address, street_name) or (None, None) on failure
        """
        import re

        if not work_location:
            return None, None

        # Find the first digit - that's where the address starts
        match = re.search(r'\d', work_location)
        if not match:
            logger.warning(f"No numeric characters in work location: '{work_location}'")
            return None, None

        # Everything from first digit onward is the address
        address_text = work_location[match.start():].strip()

        # Extract street number (4 or 5 digits: 35xx or 136xx/137xx)
        street_num_match = re.match(r'^(\d{4,5})', address_text)
        if not street_num_match:
            logger.warning(f"Could not extract street number from: '{address_text}'")
            return None, None
        street_number = street_num_match.group(1)

        # Everything after street number
        remainder = address_text[len(street_number):].strip()

        # Split on unit indicators to separate street name from unit
        parts = re.split(r'\s+(?:Unit|#|Apt|Apartment)\s*', remainder, flags=re.IGNORECASE)
        street_name = parts[0].strip()

        # Extract unit number (must be 101 or 102)
        unit = ''
        if len(parts) > 1:
            unit_match = re.search(r'(10[12])', parts[1])
            if unit_match:
                unit = unit_match.group(1)

        # If no explicit unit indicator, check for trailing 101/102
        if not unit:
            trailing = re.search(r'\s+(10[12])\s*$', remainder)
            if trailing:
                unit = trailing.group(1)
                street_name = re.sub(r'\s+10[12]\s*$', '', street_name).strip()

        standardized = self.standardize_address(street_number, street_name, unit)
        return standardized, street_name

    def _validate_address(self, standardized_address, street_name):
        """
        Validate that the address conforms to community address rules:
        - Broadlands Lane: street numbers must be 35xx (3500-3599)
        - All other streets: street numbers must be 136xx or 137xx (13600-13799)
        - Unit numbers must be 101 or 102 (standardized last digit is 1 or 2)

        Args:
            standardized_address: HOA format address (e.g., "13738RP1", "3555BL2")
            street_name: Original street name text for Broadlands detection

        Returns:
            True if valid, False otherwise (with error logged)
        """
        import re

        if not standardized_address:
            return False

        # Extract street number from standardized address (4 or 5 leading digits)
        street_num_match = re.match(r'^(\d{4,5})', standardized_address)
        if not street_num_match:
            logger.error(f"Cannot extract street number from: '{standardized_address}'")
            return False
        street_num = int(street_num_match.group(1))

        # Unit digit must be 1 or 2 (for units 101 or 102)
        if not standardized_address or standardized_address[-1] not in ('1', '2'):
            logger.error(
                f"Invalid unit in '{standardized_address}' - "
                f"last digit must be 1 or 2 (for units 101 or 102)"
            )
            return False

        # Validate street number range based on street name
        if street_name and 'broadlands' in street_name.lower():
            # Broadlands Lane: must be 35xx (4-digit)
            if not (3500 <= street_num <= 3599):
                logger.error(
                    f"Invalid Broadlands Lane address '{standardized_address}' - "
                    f"street number must be 35xx (got {street_num})"
                )
                return False
        else:
            # All other streets: must be 136xx or 137xx (5-digit)
            if not (13600 <= street_num <= 13799):
                logger.error(
                    f"Invalid address '{standardized_address}' on '{street_name}' - "
                    f"street number must be 136xx or 137xx (got {street_num})"
                )
                return False

        return True

    def scrape_arch_reviews(self):
        """
        Scrape the Architectural Review requests from GridBoardACCList (DevExpress).

        Column mapping (11 cells, 0-indexed):
          Cell[0]: empty (checkbox)
          Cell[1]: Owner name
          Cell[2]: Address "13659 Boulder Point #102"
          Cell[3]: Type/Description
          Cell[4]: Status
          Cell[5]: Date submitted

        Returns:
            List of dicts with keys: address, date, description, status
        """
        logger.info("Scraping Architectural Reviews...")
        try:
            arch_review_url = f"{KEYSTONE_URL}/p9060/architectural-review/"
            logger.info(f"Navigating to {arch_review_url}")
            self.driver.get(arch_review_url)
            time.sleep(4)

            # Click "All" radio button (default is "Open/Pending")
            try:
                all_radio = self.driver.find_element(
                    By.XPATH, "//input[@type='radio' and @name='RadioGroup1' and @value='1']"
                )
                self.driver.execute_script("arguments[0].click();", all_radio)
                logger.info("Clicked 'All' radio button")
                time.sleep(1)

                # Click Refresh to reload the grid with all records
                refresh_btn = self.driver.find_element(
                    By.XPATH, "//input[@type='button' and @value='Refresh']"
                )
                self.driver.execute_script("arguments[0].click();", refresh_btn)
                logger.info("Clicked Refresh button")
                time.sleep(4)
            except Exception as e:
                logger.warning(f"Could not click All/Refresh: {e}")

            arch_reviews = []
            grid_prefix = 'GridBoardACCList'

            try:
                page_num = 0
                while True:
                    page_num += 1
                    data_rows = self.driver.find_elements(
                        By.CSS_SELECTOR, f"tr[id^='{grid_prefix}_DXDataRow']"
                    )
                    logger.info(f"Found {len(data_rows)} architectural review rows on page {page_num}")

                    if not data_rows:
                        break

                    for idx, row in enumerate(data_rows):
                        try:
                            cells = row.find_elements(By.CSS_SELECTOR, "td")

                            if len(cells) < 6:
                                logger.debug(f"ARC row {idx}: only {len(cells)} cells, skipping")
                                continue

                            # Cell[2] = "13659 Boulder Point #102"
                            raw_address = cells[2].text.strip()
                            description = cells[3].text.strip()
                            status = cells[4].text.strip()
                            date = cells[5].text.strip()

                            if not raw_address and not description:
                                continue

                            # Parse to standardized HOA address
                            standardized_addr, _ = self._parse_work_location(raw_address)
                            if not standardized_addr:
                                logger.warning(f"ARC row {idx}: could not parse address '{raw_address}'")
                                standardized_addr = raw_address  # fall back to raw

                            review = {
                                'address': standardized_addr,
                                'date': date,
                                'description': description,
                                'status': status
                            }
                            arch_reviews.append(review)
                            logger.info(f"ARC: {standardized_addr} | {date} | {description[:40]} | {status}")

                        except Exception as e:
                            logger.debug(f"Error parsing ARC row {idx}: {e}")
                            continue

                    # Advance to next page or stop
                    try:
                        pager = self.driver.find_element(By.ID, f"{grid_prefix}_DXPagerBottom")
                        btn_elements = pager.find_elements(
                            By.XPATH, ".//*[self::a or self::b][contains(@class,'dxp-button')]"
                        )
                        if not btn_elements or btn_elements[-1].tag_name.lower() == 'b':
                            logger.info("ARC: last page reached")
                            break
                        self.driver.execute_script("arguments[0].click();", btn_elements[-1])
                        time.sleep(3)
                    except NoSuchElementException:
                        break  # No pager = single page

                logger.info(f"Found {len(arch_reviews)} architectural reviews total")

            except Exception as e:
                logger.warning(f"Could not find arch reviews grid: {e}")
                self.driver.save_screenshot('/tmp/keystone_archreviews_notfound.png')

            return arch_reviews

        except Exception as e:
            logger.error(f"Error scraping architectural reviews: {e}")
            import traceback
            traceback.print_exc()
            self.driver.save_screenshot('/tmp/keystone_archreviews_error.png')
            return []

    def write_to_sheet(self, sheet_name, headers, data):
        """
        Write data to a Google Sheet.

        Args:
            sheet_name: Name of the sheet tab
            headers: List of column headers
            data: List of dicts to write
        """
        if self.dry_run:
            logger.info(f"[DRY RUN] Would write {len(data)} rows to {sheet_name}")
            if data:
                logger.info(f"[DRY RUN] Sample row: {data[0]}")
            return

        try:
            logger.info(f"Writing {len(data)} rows to {sheet_name}...")

            # Check if sheet exists, create if not
            try:
                spreadsheet = self.sheets_service.spreadsheets().get(
                    spreadsheetId=SPREADSHEET_ID
                ).execute()

                sheet_exists = any(
                    sheet['properties']['title'] == sheet_name
                    for sheet in spreadsheet['sheets']
                )

                if not sheet_exists:
                    logger.info(f"Creating sheet {sheet_name}...")
                    request = {
                        'addSheet': {
                            'properties': {
                                'title': sheet_name
                            }
                        }
                    }
                    self.sheets_service.spreadsheets().batchUpdate(
                        spreadsheetId=SPREADSHEET_ID,
                        body={'requests': [request]}
                    ).execute()
            except HttpError as e:
                logger.error(f"Error checking/creating sheet: {e}")
                raise

            # Prepare data rows
            rows = [headers]
            for item in data:
                # Convert header to dict key format (lowercase with underscores)
                row = []
                for header in headers:
                    # Convert "AccountNumber" -> "account_number", "LastUpdated" -> "last_updated"
                    key = ''.join(['_' + c.lower() if c.isupper() else c for c in header]).lstrip('_')
                    row.append(item.get(key, ''))
                rows.append(row)

            # Don't add timestamp rows - they confuse the parser in Apps Script

            # Clear and write
            range_name = f"{sheet_name}!A1:Z{len(rows)}"

            # Clear existing data
            self.sheets_service.spreadsheets().values().clear(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{sheet_name}!A:Z"
            ).execute()

            # Write new data
            self.sheets_service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=range_name,
                valueInputOption='RAW',
                body={'values': rows}
            ).execute()

            logger.info(f"Successfully wrote {len(data)} rows to {sheet_name}")

        except Exception as e:
            logger.error(f"Error writing to {sheet_name}: {e}")
            raise

    def _write_rows_to_sheet(self, sheet_name, rows):
        """
        Write pre-built rows (header + data) directly to a sheet.
        Used when column headers don't follow the camelCase→snake_case convention.

        Args:
            sheet_name: Name of the sheet tab
            rows: List of lists (first row is headers)
        """
        if self.dry_run:
            logger.info(f"[DRY RUN] Would write {len(rows)-1} rows to {sheet_name}")
            if rows:
                logger.info(f"[DRY RUN] Headers: {rows[0]}")
            if len(rows) > 1:
                logger.info(f"[DRY RUN] Sample row: {rows[1]}")
            return

        try:
            logger.info(f"Writing {len(rows)-1} rows to {sheet_name}...")

            # Ensure sheet exists
            spreadsheet = self.sheets_service.spreadsheets().get(
                spreadsheetId=SPREADSHEET_ID
            ).execute()
            sheet_exists = any(
                sheet['properties']['title'] == sheet_name
                for sheet in spreadsheet['sheets']
            )
            if not sheet_exists:
                logger.info(f"Creating sheet {sheet_name}...")
                self.sheets_service.spreadsheets().batchUpdate(
                    spreadsheetId=SPREADSHEET_ID,
                    body={'requests': [{'addSheet': {'properties': {'title': sheet_name}}}]}
                ).execute()

            range_name = f"{sheet_name}!A1:Z{len(rows)}"

            # Clear existing data
            self.sheets_service.spreadsheets().values().clear(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{sheet_name}!A:Z"
            ).execute()

            # Write rows
            self.sheets_service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=range_name,
                valueInputOption='RAW',
                body={'values': rows}
            ).execute()

            logger.info(f"Successfully wrote {len(rows)-1} rows to {sheet_name}")

        except Exception as e:
            logger.error(f"Error writing rows to {sheet_name}: {e}")
            raise

    def run(self):
        """Main execution method."""
        try:
            # Initialize
            self.init_browser()
            self.init_sheets()

            # Login
            if not self.login():
                logger.error("Login failed, aborting")
                return False

            # Scrape all data sources
            # Use new Accounts Receivable scraper for cleaner data
            profiles = self.scrape_accounts_receivable()
            violations = self.scrape_violations()
            work_orders = self.scrape_work_orders()
            arch_reviews = self.scrape_arch_reviews()

            # Write to Google Sheets with new format
            # Profiles: Address | AccountNumber | AccountName | LastUpdated | Source
            self.write_to_sheet(
                PROFILES_SHEET,
                ['Address', 'AccountNumber', 'AccountName', 'LastUpdated', 'Source'],
                profiles
            )

            self.write_to_sheet(
                VIOLATIONS_SHEET,
                ['Address', 'Date', 'Description', 'Status'],
                violations
            )

            # Work orders use direct row writing (columns don't map via camelCase convention)
            wo_rows = [['Address', 'WO Number', 'Date Created', 'Type/Description', 'Vendor', 'Status']]
            for wo in work_orders:
                wo_rows.append([
                    wo.get('address', ''),
                    wo.get('wo_number', ''),
                    wo.get('date', ''),
                    wo.get('description', ''),
                    wo.get('vendor', ''),
                    wo.get('status', '')
                ])
            self._write_rows_to_sheet(WORKORDERS_SHEET, wo_rows)

            self.write_to_sheet(
                ARCHREVIEWS_SHEET,
                ['Address', 'Date', 'Description', 'Status'],
                arch_reviews
            )

            logger.info("Scraping completed successfully")
            return True

        except Exception as e:
            logger.error(f"Scraping failed: {e}")
            import traceback
            traceback.print_exc()
            return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Scrape Keystone Pacific portal and cache to Google Sheets'
    )
    parser.add_argument(
        '--headed',
        action='store_true',
        help='Run browser in headed mode (visible, for debugging)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Run scraper but do not write to Google Sheets'
    )

    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Keystone Pacific Scraper (Selenium)")
    logger.info("=" * 60)

    with KeystoneScraperSelenium(headless=not args.headed, dry_run=args.dry_run) as scraper:
        success = scraper.run()

    if success:
        logger.info("Scraping completed successfully")
        sys.exit(0)
    else:
        logger.error("Scraping failed")
        sys.exit(1)


if __name__ == '__main__':
    main()
