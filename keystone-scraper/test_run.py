#!/usr/bin/env python3
"""
Test script to verify the updated scraper works correctly.
Runs in dry-run mode to avoid writing to sheets.
"""
import sys
import logging
from keystone_scraper_selenium import KeystoneScraperSelenium

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def main():
    """Test the scraper in dry-run mode."""
    logger.info("=" * 80)
    logger.info("Testing Keystone Scraper - Dry Run Mode")
    logger.info("=" * 80)

    # Run in headed mode for manual verification if needed
    # Set headless=True for automated testing
    with KeystoneScraperSelenium(headless=True, dry_run=True) as scraper:
        # Initialize
        scraper.init_browser()

        # Login
        if not scraper.login():
            logger.error("Login failed!")
            return False

        logger.info("Login successful!")

        # Test the new Accounts Receivable scraper
        logger.info("\n" + "=" * 80)
        logger.info("Testing Accounts Receivable scraping...")
        logger.info("=" * 80)
        profiles = scraper.scrape_accounts_receivable()

        if profiles:
            logger.info(f"\nSuccessfully scraped {len(profiles)} profiles!")
            logger.info("\nFirst 5 profiles:")
            for i, profile in enumerate(profiles[:5], 1):
                logger.info(f"\n  {i}. Address: {profile.get('address')}")
                logger.info(f"     Account Number: {profile.get('account_number')}")
                logger.info(f"     Account Name: {profile.get('account_name')}")
                logger.info(f"     Last Updated: {profile.get('last_updated')}")
                logger.info(f"     Source: {profile.get('source')}")
        else:
            logger.error("No profiles scraped!")
            return False

        logger.info("\n" + "=" * 80)
        logger.info("Test completed successfully!")
        logger.info("=" * 80)
        return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
