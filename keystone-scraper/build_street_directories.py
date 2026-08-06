#!/usr/bin/env python3
"""
Build per-street neighbor directory spreadsheets from the Full Directory tab.

For each of 6 streets, creates a Google Sheets spreadsheet in Board Documents/Member Lists/
with 3 tabs: "Last Name", "First Name", "Address" — sorted by that field.
Each row contains one person (couples/families get multiple rows per unit).
Columns: Last Name, First Name, Full Address, Phone 1, Phone 2, Email, Groups

Depends on: Full Directory tab in Keystone Cache spreadsheet (populated by build_full_directory.py).
Runs nightly via GitHub Actions after build_full_directory.py.
"""
import json
import os
import sys
import time
import argparse
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2 import service_account

# IDs and config
DOMAIN = "villasboulders.org"
ADMIN_EMAIL = "admin@villasboulders.org"
SA_FILE = os.path.expanduser("~/.config/openclaw/google-service-account.json")
KEYSTONE_CACHE_SHEET_ID = '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ'
MEMBER_LISTS_FOLDER_ID = '1SVWOn1NMmq4Sj846BEGJoeI85ttT0ETK'
SHARED_DRIVE_ID = '0AExYZWmfRm9JUk9PVA'

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/admin.directory.group',
]

# Street names in canonical order
STREET_ORDER = [
    'boulder circle',
    'stone circle',
    'broadlands lane',
    'boulder point',
    'plaster point',
    'rock point',
]

# Groups sync list (borrowed from labels_to_groups.py)
SYNC_LIST = [
    {"label": "Boulder Circle",      "prefix": "bouldercircle"},
    {"label": "Boulder Point",       "prefix": "boulderpoint"},
    {"label": "Broadlands Lane",     "prefix": "broadlandslane"},
    {"label": "Plaster Point",       "prefix": "plasterpoint"},
    {"label": "Rock Point",          "prefix": "rockpoint"},
    {"label": "Stone Circle",        "prefix": "stonecircle"},
    {"label": "LBC",                 "prefix": "lbc"},
    {"label": "lbc-workgroup",       "prefix": "lbc-workgroup"},
    {"label": "non-occupant owner",  "prefix": "nonoccupantowner"},
    {"label": "non-owner occupant",  "prefix": "nonowneroccupant"},
    {"label": "owner-occupant",      "prefix": "owneroccupant"},
    {"label": "volunteers",          "prefix": "volunteers"},
    {"label": "Snow Squad",          "prefix": "snowsquad"},
    {"label": "ARC",                 "prefix": "arc"},
]


def normalize_email(email):
    """Normalize Gmail addresses by removing dots from the local part."""
    local, _, domain = email.partition('@')
    domain = domain.lower()
    if domain in ('gmail.com', 'googlemail.com'):
        local = local.replace('.', '')
    return f"{local.lower()}@{domain}"


def build_services():
    """Build and return sheets, drive, and directory service clients."""
    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        info = json.loads(sa_json)
        creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    else:
        creds = service_account.Credentials.from_service_account_file(SA_FILE, scopes=SCOPES)
    delegated = creds.with_subject(ADMIN_EMAIL)
    sheets = build('sheets', 'v4', credentials=delegated)
    drive = build('drive', 'v3', credentials=delegated)
    directory = build('admin', 'directory_v1', credentials=delegated)
    return sheets, drive, directory


def norm_street(raw):
    """Normalize a street name to lowercase canonical form."""
    import re
    s = raw.lower().strip()
    words = s.split()
    words = [re.sub(r'[^a-z]', '', w) for w in words]
    street_map = {
        'cir': 'circle', 'circ': 'circle', 'pt': 'point', 'ln': 'lane',
        'blvd': 'boulevard', 'dr': 'drive', 'rd': 'road', 'st': 'street',
        'ave': 'avenue', 'ct': 'court',
    }
    words = [street_map.get(w, w) for w in words if w]
    return ' '.join(words)


def street_sort_key(street_name):
    """Return sort priority for a street name."""
    name_lc = street_name.lower()
    try:
        return STREET_ORDER.index(name_lc)
    except ValueError:
        return 99


def load_full_directory(sheets):
    """Load Full Directory tab from Keystone Cache spreadsheet."""
    result = sheets.spreadsheets().values().get(
        spreadsheetId=KEYSTONE_CACHE_SHEET_ID,
        range='Full Directory!A2:J500'
    ).execute()
    return result.get('values', [])


def build_email_to_groups_map(directory):
    """Build a map of normalized email -> list of group labels (display names, not emails)."""
    email_to_groups = {}

    for item in SYNC_LIST:
        label = item["label"]
        prefix = item["prefix"]
        group_email = f"{prefix}@{DOMAIN}"

        try:
            page_token = None
            while True:
                kwargs = {"groupKey": group_email, "maxResults": 200}
                if page_token:
                    kwargs["pageToken"] = page_token
                try:
                    result = directory.members().list(**kwargs).execute()
                except HttpError as e:
                    if e.resp.status == 404:
                        # Group doesn't exist yet; skip
                        break
                    raise

                for member in result.get('members', []):
                    norm_email = normalize_email(member['email'])
                    if norm_email not in email_to_groups:
                        email_to_groups[norm_email] = []
                    email_to_groups[norm_email].append(label)

                page_token = result.get('nextPageToken')
                if not page_token:
                    break
        except Exception as e:
            print(f"  WARNING: Could not load members for group '{label}': {e}")

    return email_to_groups


def find_existing_spreadsheet(drive, spreadsheet_name):
    """Find an existing spreadsheet by name in Member Lists folder. Return file ID or None."""
    query = (
        f"name='{spreadsheet_name}' "
        f"and '{MEMBER_LISTS_FOLDER_ID}' in parents "
        f"and mimeType='application/vnd.google-apps.spreadsheet' "
        f"and trashed=false"
    )
    try:
        result = drive.files().list(
            q=query,
            corpora='allDrives',
            includeItemsFromAllDrives=True,
            supportsAllDrives=True,
            pageSize=1,
            fields='files(id)',
        ).execute()
        files = result.get('files', [])
        return files[0]['id'] if files else None
    except HttpError as e:
        print(f"  ERROR querying for existing '{spreadsheet_name}': {e}")
        return None


def create_spreadsheet(drive, sheets, spreadsheet_name):
    """Create a new spreadsheet and move it to Member Lists folder. Return spreadsheet ID."""
    # Create spreadsheet (empty, no sheets initially)
    try:
        result = sheets.spreadsheets().create(
            body={'properties': {'title': spreadsheet_name}}
        ).execute()
        spreadsheet_id = result['spreadsheetId']
    except HttpError as e:
        print(f"  ERROR creating spreadsheet '{spreadsheet_name}': {e}")
        return None

    # Move it to the Member Lists folder (add parent, remove from root)
    try:
        drive.files().update(
            fileId=spreadsheet_id,
            addParents=MEMBER_LISTS_FOLDER_ID,
            removeParents='root',
            supportsAllDrives=True,
            fields='id',
        ).execute()
    except HttpError as e:
        print(f"  ERROR moving spreadsheet to Member Lists: {e}")
        return None

    return spreadsheet_id


def ensure_sheets_exist(sheets, spreadsheet_id, sheet_names):
    """Ensure the specified sheet tabs exist, clearing any existing data. Return sheet IDs by name."""
    # Get current sheets
    meta = sheets.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    existing_sheets = {s['properties']['title']: s['properties']['sheetId']
                       for s in meta['sheets']}

    requests = []

    # Delete the default "Sheet1" if it exists and is not in our desired sheets
    if 'Sheet1' in existing_sheets and 'Sheet1' not in sheet_names:
        requests.append({'deleteSheet': {'sheetId': existing_sheets['Sheet1']}})

    # Create missing sheets
    for sheet_name in sheet_names:
        if sheet_name not in existing_sheets:
            requests.append({'addSheet': {'properties': {'title': sheet_name}}})

    if requests:
        sheets.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={'requests': requests}
        ).execute()
        # Refresh meta
        meta = sheets.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        existing_sheets = {s['properties']['title']: s['properties']['sheetId']
                           for s in meta['sheets']}

    return existing_sheets


def write_sheet_data(sheets, spreadsheet_id, sheet_name, headers, rows, dry_run=False):
    """Write data to a sheet (headers + rows). Format header row as bold + freeze."""
    sheet_data = [headers] + rows

    if dry_run:
        print(f"    DRY RUN — would write {len(rows)} rows to '{sheet_name}'")
        return

    # Clear the sheet first
    try:
        sheets.spreadsheets().values().clear(
            spreadsheetId=spreadsheet_id,
            range=f'{sheet_name}!A:Z',
        ).execute()
    except HttpError:
        pass  # Sheet might not exist yet; that's OK

    # Write data
    sheets.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=f'{sheet_name}!A1',
        valueInputOption='RAW',
        body={'values': sheet_data},
    ).execute()

    # Format header row (bold) + freeze
    meta = sheets.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheet_id = next((s['properties']['sheetId'] for s in meta['sheets']
                     if s['properties']['title'] == sheet_name), None)
    if sheet_id is not None:
        sheets.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={'requests': [
                {'updateSheetProperties': {
                    'properties': {'sheetId': sheet_id, 'gridProperties': {'frozenRowCount': 1}},
                    'fields': 'gridProperties.frozenRowCount',
                }},
                {'repeatCell': {
                    'range': {'sheetId': sheet_id, 'startRowIndex': 0, 'endRowIndex': 1},
                    'cell': {'userEnteredFormat': {'textFormat': {'bold': True}}},
                    'fields': 'userEnteredFormat.textFormat.bold',
                }},
            ]},
        ).execute()


def build_street_directory(directory_rows, email_to_groups, street_name):
    """
    Filter directory rows to a single street and build 3 sorted views.
    Returns a dict: {'Last Name': rows, 'First Name': rows, 'Address': rows}
    """
    # Filter to this street
    street_rows = []
    for row in directory_rows:
        if len(row) < 6:
            continue
        row_street = row[0]  # Street column
        if norm_street(row_street).lower() == norm_street(street_name).lower():
            street_rows.append(row)

    if not street_rows:
        return {'Last Name': [], 'First Name': [], 'Address': []}

    # Build output rows with Groups column appended
    output_rows = []
    for row in street_rows:
        last_name = row[4] if len(row) > 4 else ''
        first_name = row[5] if len(row) > 5 else ''
        full_addr = row[3] if len(row) > 3 else ''
        phone1 = row[6] if len(row) > 6 else ''
        phone2 = row[7] if len(row) > 7 else ''
        email = row[8] if len(row) > 8 else ''

        # Look up groups for this email
        norm_email = normalize_email(email) if email else ''
        groups = email_to_groups.get(norm_email, [])
        groups_str = ', '.join(sorted(groups))

        output_rows.append({
            'last_name': last_name,
            'first_name': first_name,
            'full_addr': full_addr,
            'phone1': phone1,
            'phone2': phone2,
            'email': email,
            'groups': groups_str,
        })

    # Build 3 sorted views
    def row_to_list(r):
        return [r['last_name'], r['first_name'], r['full_addr'],
                r['phone1'], r['phone2'], r['email'], r['groups']]

    by_last_name = sorted(output_rows,
                          key=lambda r: (r['last_name'].lower(), r['first_name'].lower()))
    by_first_name = sorted(output_rows,
                           key=lambda r: (r['first_name'].lower(), r['last_name'].lower()))
    by_address = sorted(output_rows,
                        key=lambda r: r['full_addr'].lower())

    return {
        'Last Name': [row_to_list(r) for r in by_last_name],
        'First Name': [row_to_list(r) for r in by_first_name],
        'Address': [row_to_list(r) for r in by_address],
    }


def sync_street_directory(sheets, drive, directory, street_name,
                          directory_rows, email_to_groups, dry_run=False):
    """Create or update the spreadsheet for one street."""
    spreadsheet_name = f"{street_name} Neighbors"
    print(f"\n{spreadsheet_name}")

    # Find or create spreadsheet
    spreadsheet_id = find_existing_spreadsheet(drive, spreadsheet_name)
    if not spreadsheet_id:
        print(f"  Creating spreadsheet...")
        spreadsheet_id = create_spreadsheet(drive, sheets, spreadsheet_name)
        if not spreadsheet_id:
            return
    else:
        print(f"  Updating existing spreadsheet...")

    # Build the 3 sorted views
    views = build_street_directory(directory_rows, email_to_groups, street_name)

    # Ensure the 3 sheets exist
    sheet_ids = ensure_sheets_exist(sheets, spreadsheet_id,
                                    ['Last Name', 'First Name', 'Address'])

    # Headers: Last Name, First Name, Full Address, Phone 1, Phone 2, Email, Groups
    headers = ['Last Name', 'First Name', 'Full Address', 'Phone 1', 'Phone 2', 'Email', 'Groups']

    # Write each sheet
    for sheet_name in ['Last Name', 'First Name', 'Address']:
        rows = views[sheet_name]
        write_sheet_data(sheets, spreadsheet_id, sheet_name, headers, rows, dry_run)
        if not dry_run:
            print(f"  {sheet_name}: {len(rows)} people")
        else:
            print(f"  DRY RUN — {sheet_name}: {len(rows)} people")


def main():
    parser = argparse.ArgumentParser(description="Build per-street neighbor directory spreadsheets")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would change without making modifications")
    args = parser.parse_args()

    if args.dry_run:
        print("=== DRY RUN — no changes will be made ===")

    sheets, drive, directory = build_services()

    # Load Full Directory
    print("Loading Full Directory...")
    directory_rows = load_full_directory(sheets)
    print(f"  {len(directory_rows)} people loaded")

    # Build email -> groups map
    print("Building email-to-groups map...")
    email_to_groups = build_email_to_groups_map(directory)
    print(f"  {len(email_to_groups)} people have group memberships")

    # Process each street
    for i, street_name in enumerate(STREET_ORDER):
        sync_street_directory(sheets, drive, directory, street_name,
                              directory_rows, email_to_groups, args.dry_run)
        # Rate limiting: pause between streets to avoid hitting API quota
        if i < len(STREET_ORDER) - 1:
            time.sleep(1)

    print("\nDone.")


if __name__ == '__main__':
    main()
