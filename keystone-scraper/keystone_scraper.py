#!/usr/bin/env python3
"""
Keystone Pacific Property Management Portal Scraper
Scrapes homeowner data, violations, work orders, and architectural reviews
and caches them in Google Sheets for use by Property Report system.
"""

import os
import sys
import logging
import time
import argparse
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


# Configuration
KEYSTONE_URL = "https://kppm.cincwebaxis.com"
KEYSTONE_USERNAME = "REDACTED_EMAIL"
KEYSTONE_PASSWORD = "REDACTED_PASSWORD"

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


class KeystoneScraper:
    """Main scraper class for Keystone Pacific portal."""

    def __init__(self, headless=True, dry_run=False):
        """
        Initialize the scraper.

        Args:
            headless: Run browser in headless mode (default: True)
            dry_run: Don't write to Google Sheets, just log data (default: False)
        """
        self.headless = headless
        self.dry_run = dry_run
        self.playwright = None
        self.browser = None
        self.page = None
        self.sheets_service = None

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - cleanup resources."""
        self.cleanup()

    def cleanup(self):
        """Clean up browser and playwright resources."""
        if self.page:
            self.page.close()
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()

    def init_browser(self):
        """Initialize Playwright browser."""
        logger.info(f"Initializing browser (headless={self.headless})...")
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=self.headless)
        self.page = self.browser.new_page()
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
            # Navigate to login page
            self.page.goto(KEYSTONE_URL, timeout=30000)

            # Wait for login form
            self.page.wait_for_selector('input[name="username"], input[type="email"], input#username', timeout=10000)

            # Fill in credentials - try multiple possible selectors
            try:
                self.page.fill('input[name="username"]', KEYSTONE_USERNAME)
            except:
                try:
                    self.page.fill('input[type="email"]', KEYSTONE_USERNAME)
                except:
                    self.page.fill('input#username', KEYSTONE_USERNAME)

            time.sleep(0.5)

            try:
                self.page.fill('input[name="password"]', KEYSTONE_PASSWORD)
            except:
                try:
                    self.page.fill('input[type="password"]', KEYSTONE_PASSWORD)
                except:
                    self.page.fill('input#password', KEYSTONE_PASSWORD)

            time.sleep(0.5)

            # Click login button
            try:
                self.page.click('button[type="submit"]')
            except:
                try:
                    self.page.click('input[type="submit"]')
                except:
                    self.page.click('button:has-text("Login"), button:has-text("Sign In")')

            # Wait for navigation after login
            self.page.wait_for_load_state('networkidle', timeout=30000)

            # Check if login was successful by looking for logout button or dashboard
            try:
                self.page.wait_for_selector('a:has-text("Logout"), a:has-text("Sign Out"), a:has-text("Dashboard")', timeout=5000)
                logger.info("Login successful")
                return True
            except PlaywrightTimeout:
                logger.error("Login may have failed - couldn't find expected post-login elements")
                # Take screenshot for debugging
                if not self.headless:
                    self.page.screenshot(path='/tmp/keystone_login_failed.png')
                    logger.info("Screenshot saved to /tmp/keystone_login_failed.png")
                return False

        except Exception as e:
            logger.error(f"Login failed: {e}")
            if not self.headless:
                self.page.screenshot(path='/tmp/keystone_error.png')
            raise

    def scrape_homeowner_directory(self):
        """
        Scrape the Homeowner Directory.

        Returns:
            List of dicts with keys: name, address, phone, email, account_number
        """
        logger.info("Scraping Homeowner Directory...")
        try:
            # Navigate to Community Information → Homeowner Directory
            # These selectors will need to be adjusted based on actual portal structure
            self.page.click('text=Community Information', timeout=10000)
            time.sleep(1)
            self.page.click('text=Homeowner Directory', timeout=10000)
            self.page.wait_for_load_state('networkidle', timeout=30000)

            # Extract table data
            # This is a generic implementation - adjust selectors based on actual HTML
            profiles = []

            # Try to find the table
            table = self.page.locator('table').first
            rows = table.locator('tbody tr').all()

            for row in rows:
                cells = row.locator('td').all()
                if len(cells) >= 4:
                    profile = {
                        'name': cells[0].inner_text().strip(),
                        'address': cells[1].inner_text().strip(),
                        'phone': cells[2].inner_text().strip() if len(cells) > 2 else '',
                        'email': cells[3].inner_text().strip() if len(cells) > 3 else '',
                        'account_number': cells[4].inner_text().strip() if len(cells) > 4 else ''
                    }
                    profiles.append(profile)

            logger.info(f"Found {len(profiles)} homeowner profiles")
            return profiles

        except Exception as e:
            logger.error(f"Error scraping homeowner directory: {e}")
            if not self.headless:
                self.page.screenshot(path='/tmp/keystone_directory_error.png')
            return []

    def scrape_violations(self):
        """
        Scrape the Violations list.

        Returns:
            List of dicts with keys: address, date, description, status
        """
        logger.info("Scraping Violations...")
        try:
            # Navigate to Board Overview → Violations
            self.page.click('text=Board Overview', timeout=10000)
            time.sleep(1)
            self.page.click('text=Violations', timeout=10000)
            self.page.wait_for_load_state('networkidle', timeout=30000)

            violations = []

            # Try to find the table
            table = self.page.locator('table').first
            rows = table.locator('tbody tr').all()

            for row in rows:
                cells = row.locator('td').all()
                if len(cells) >= 3:
                    violation = {
                        'address': cells[0].inner_text().strip(),
                        'date': cells[1].inner_text().strip() if len(cells) > 1 else '',
                        'description': cells[2].inner_text().strip() if len(cells) > 2 else '',
                        'status': cells[3].inner_text().strip() if len(cells) > 3 else ''
                    }
                    violations.append(violation)

            logger.info(f"Found {len(violations)} violations")
            return violations

        except Exception as e:
            logger.error(f"Error scraping violations: {e}")
            if not self.headless:
                self.page.screenshot(path='/tmp/keystone_violations_error.png')
            return []

    def scrape_work_orders(self):
        """
        Scrape the Work Orders list.

        Returns:
            List of dicts with keys: address, date, description, status, type
        """
        logger.info("Scraping Work Orders...")
        try:
            # Navigate to Board Overview → Work Orders
            self.page.click('text=Board Overview', timeout=10000)
            time.sleep(1)
            self.page.click('text=Work Orders', timeout=10000)
            self.page.wait_for_load_state('networkidle', timeout=30000)

            work_orders = []

            # Try to find the table
            table = self.page.locator('table').first
            rows = table.locator('tbody tr').all()

            for row in rows:
                cells = row.locator('td').all()
                if len(cells) >= 4:
                    work_order = {
                        'address': cells[0].inner_text().strip(),
                        'date': cells[1].inner_text().strip() if len(cells) > 1 else '',
                        'description': cells[2].inner_text().strip() if len(cells) > 2 else '',
                        'status': cells[3].inner_text().strip() if len(cells) > 3 else '',
                        'type': cells[4].inner_text().strip() if len(cells) > 4 else ''
                    }
                    work_orders.append(work_order)

            logger.info(f"Found {len(work_orders)} work orders")
            return work_orders

        except Exception as e:
            logger.error(f"Error scraping work orders: {e}")
            if not self.headless:
                self.page.screenshot(path='/tmp/keystone_workorders_error.png')
            return []

    def scrape_arch_reviews(self):
        """
        Scrape the Architectural Review requests.

        Returns:
            List of dicts with keys: address, date, description, status
        """
        logger.info("Scraping Architectural Reviews...")
        try:
            # Navigate to Board Overview → Architectural Review
            self.page.click('text=Board Overview', timeout=10000)
            time.sleep(1)
            self.page.click('text=Architectural Review', timeout=10000)
            self.page.wait_for_load_state('networkidle', timeout=30000)

            arch_reviews = []

            # Try to find the table
            table = self.page.locator('table').first
            rows = table.locator('tbody tr').all()

            for row in rows:
                cells = row.locator('td').all()
                if len(cells) >= 3:
                    review = {
                        'address': cells[0].inner_text().strip(),
                        'date': cells[1].inner_text().strip() if len(cells) > 1 else '',
                        'description': cells[2].inner_text().strip() if len(cells) > 2 else '',
                        'status': cells[3].inner_text().strip() if len(cells) > 3 else ''
                    }
                    arch_reviews.append(review)

            logger.info(f"Found {len(arch_reviews)} architectural reviews")
            return arch_reviews

        except Exception as e:
            logger.error(f"Error scraping architectural reviews: {e}")
            if not self.headless:
                self.page.screenshot(path='/tmp/keystone_archreviews_error.png')
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
                row = [item.get(key, '') for key in [h.lower().replace(' ', '_') for h in headers]]
                rows.append(row)

            # Add timestamp row
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            rows.append([])
            rows.append(['Last Updated:', timestamp])

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
            profiles = self.scrape_homeowner_directory()
            violations = self.scrape_violations()
            work_orders = self.scrape_work_orders()
            arch_reviews = self.scrape_arch_reviews()

            # Write to Google Sheets
            self.write_to_sheet(
                PROFILES_SHEET,
                ['Name', 'Address', 'Phone', 'Email', 'Account Number'],
                profiles
            )

            self.write_to_sheet(
                VIOLATIONS_SHEET,
                ['Address', 'Date', 'Description', 'Status'],
                violations
            )

            self.write_to_sheet(
                WORKORDERS_SHEET,
                ['Address', 'Date', 'Description', 'Status', 'Type'],
                work_orders
            )

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
    logger.info("Keystone Pacific Scraper")
    logger.info("=" * 60)

    with KeystoneScraper(headless=not args.headed, dry_run=args.dry_run) as scraper:
        success = scraper.run()

    if success:
        logger.info("✓ Scraping completed successfully")
        sys.exit(0)
    else:
        logger.error("✗ Scraping failed")
        sys.exit(1)


if __name__ == '__main__':
    main()
