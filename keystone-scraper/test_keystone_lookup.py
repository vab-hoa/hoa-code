#!/usr/bin/env python3
"""
Test Keystone cache lookup to verify data format matches what Apps Script expects
"""
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDENTIALS_PATH = os.path.expanduser("~/.config/openclaw/google-service-account.json")
SPREADSHEET_ID = "1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ"

# Simulate Apps Script address standardization
def standardize_address(address):
    """Simple standardization for testing"""
    import re

    # Extract street number
    match = re.search(r'(\d{4,5})', address)
    if not match:
        return None

    street_num = match.group(1)

    # Extract street name and convert to code
    street_codes = {
        'rock point': 'RP',
        'boulder point': 'BP',
        'broadlands': 'BL',
        'stone circle': 'SC',
        'plaster point': 'PP'
    }

    addr_lower = address.lower()
    street_code = None
    for street, code in street_codes.items():
        if street in addr_lower:
            street_code = code
            break

    if not street_code:
        return None

    # Extract unit
    unit_match = re.search(r'#?(\d0[12])', address)
    unit = ''
    if unit_match:
        unit_num = unit_match.group(1)
        if unit_num.endswith('01'):
            unit = '1'
        elif unit_num.endswith('02'):
            unit = '2'

    return f"{street_num}{street_code}{unit}"

def test_lookup(test_address):
    """Test looking up an address in the Keystone cache"""
    print(f"\n=== Testing lookup for: {test_address} ===")

    # Standardize
    standardized = standardize_address(test_address)
    print(f"Standardized to: {standardized}")

    if not standardized:
        print("❌ Could not standardize address")
        return

    # Connect to sheets
    credentials = service_account.Credentials.from_service_account_file(
        CREDENTIALS_PATH,
        scopes=['https://www.googleapis.com/auth/spreadsheets']
    )
    delegated = credentials.with_subject('admin@villasboulders.org')
    service = build('sheets', 'v4', credentials=delegated)

    # Read Profiles sheet
    result = service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range="Profiles!A:E"
    ).execute()
    values = result.get('values', [])

    print(f"Total rows in Profiles: {len(values)}")

    if len(values) < 2:
        print("❌ No data in sheet")
        return

    headers = values[0]
    print(f"Headers: {headers}")

    # Search for match
    found = False
    for i, row in enumerate(values[1:], start=1):
        if len(row) < 2:
            continue

        row_address = row[1]  # Address column
        row_std = standardize_address(row_address)

        if row_std == standardized:
            print(f"\n✅ FOUND MATCH at row {i}!")
            print(f"  Name: {row[0] if len(row) > 0 else ''}")
            print(f"  Address: {row[1] if len(row) > 1 else ''}")
            print(f"  Phone: {row[2] if len(row) > 2 else ''}")
            print(f"  Email: {row[3] if len(row) > 3 else ''}")
            print(f"  Raw address: {row_address}")
            print(f"  Standardized: {row_std}")
            found = True
            break

    if not found:
        print(f"\n❌ No match found for {standardized}")
        print("\nAvailable addresses:")
        for i, row in enumerate(values[1:6], start=1):  # Show first 5
            if len(row) >= 2:
                addr_std = standardize_address(row[1])
                print(f"  Row {i}: {row[1]} → {addr_std}")

if __name__ == '__main__':
    # Test with the address we're using
    test_lookup("13738 Rock Point Unit 101")

    # Also test one we know is there
    test_lookup("13747 Rock Point #102")
