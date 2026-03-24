#!/usr/bin/env python3
"""Compare Wood Trim Photos folder contents against the wood trim spreadsheet."""

import re
from google.oauth2 import service_account
from googleapiclient.discovery import build

SERVICE_ACCOUNT_FILE = "/home/dee/.config/openclaw/google-service-account.json"
DELEGATE_EMAIL = "admin@villasboulders.org"
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]

PHOTO_FOLDER_ID = "1P-Jsvh1yDD0dBISP4A5e_r0Bl8zBuBBw"
SPREADSHEET_ID = "1Eu0y6O8Uco6VZ1mYcB2ehDXwE_EV_NJHV_M5Ji6Mts0"

# Street name mappings
STREET_MAP = {
    "broadlands": "BL",
    "boulder point": "BP",
    "rock point": "RP",
    "stone circle": "SC",
    "boulder circle": "BC",
    "plaster point": "PP",
}

# Abbreviation expansions
ABBREV_MAP = {
    "pt": "point",
    "cir": "circle",
    "cr": "circle",
    "ln": "lane",
}


def get_credentials():
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    return creds.with_subject(DELEGATE_EMAIL)


def standardize_address(raw: str):
    """Return (building_key, full_key) or (None, None) if unparseable.

    building_key = number + street_code  (e.g. "13662BP")
    full_key     = number + street_code + unit_digit  (e.g. "13662BP1")
    """
    if not raw:
        return None, None

    text = raw.strip()

    # Extract leading street number (4-5 digits)
    m = re.match(r"(\d{4,5})\b", text)
    if not m:
        return None, None
    number = m.group(1)

    rest = text[m.end():].strip().lower()
    # Remove commas, extra whitespace
    rest = re.sub(r"[,]+", " ", rest)
    rest = re.sub(r"\s+", " ", rest).strip()

    # Expand abbreviations in rest before matching street names
    words = rest.split()
    expanded_words = [ABBREV_MAP.get(w, w) for w in words]
    rest_expanded = " ".join(expanded_words)

    # Find street code
    street_code = None
    for street_name, code in STREET_MAP.items():
        if street_name in rest_expanded:
            street_code = code
            break

    if street_code is None:
        return None, None

    # Extract unit number
    unit_digit = None
    # Look for patterns like #101, #102, Unit 101, 101, 102 at end, or "apt 1"
    unit_match = re.search(r"#\s*(\d+)", rest)
    if not unit_match:
        unit_match = re.search(r"(?:unit|apt|ste)\s*(\d+)", rest)
    if not unit_match:
        # Look for a standalone 3-digit number (101, 102, etc.) that's not the street number
        unit_match = re.search(r"\b(10[1-9]|1[1-9]\d|[2-9]\d{2})\b", rest)
    if not unit_match:
        # Look for a standalone 1-2 digit number at end
        unit_match = re.search(r"\b(\d{1,2})\s*$", rest)

    if unit_match:
        unit_num = unit_match.group(1)
        # 101->1, 102->2, 201->1, etc. Take last digit
        unit_digit = unit_num[-1]

    building_key = f"{number}{street_code}"
    full_key = f"{number}{street_code}{unit_digit}" if unit_digit else building_key

    return building_key, full_key


def list_all_subfolders(drive_service, parent_id):
    """List all subfolders in a Drive folder, handling pagination."""
    folders = []
    page_token = None
    while True:
        resp = drive_service.files().list(
            q=f"'{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="nextPageToken, files(id, name)",
            pageSize=1000,
            pageToken=page_token,
        ).execute()
        folders.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return folders


def count_files_in_folder(drive_service, folder_id):
    """Count non-folder files in a folder."""
    count = 0
    page_token = None
    while True:
        resp = drive_service.files().list(
            q=f"'{folder_id}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false",
            fields="nextPageToken, files(id)",
            pageSize=1000,
            pageToken=page_token,
        ).execute()
        count += len(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return count


def read_spreadsheet_column_a(sheets_service, spreadsheet_id):
    """Read all values from column A."""
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range="A:A",
    ).execute()
    values = result.get("values", [])
    # Flatten
    rows = [row[0] for row in values if row]
    return rows


def main():
    creds = get_credentials()
    drive_service = build("drive", "v3", credentials=creds)
    sheets_service = build("sheets", "v4", credentials=creds)

    # 1. List photo subfolders
    print("Fetching photo subfolders...")
    photo_folders = list_all_subfolders(drive_service, PHOTO_FOLDER_ID)
    print(f"  Found {len(photo_folders)} photo subfolders.\n")

    # 2. Read spreadsheet
    print("Reading spreadsheet column A...")
    ss_rows = read_spreadsheet_column_a(sheets_service, SPREADSHEET_ID)
    print(f"  Found {len(ss_rows)} rows (including header).\n")

    # Separate header
    header = ss_rows[0] if ss_rows else ""
    data_rows = ss_rows[1:] if len(ss_rows) > 1 else []
    print(f"  Header: '{header}'")
    print(f"  Data rows: {len(data_rows)}\n")

    # 3. Standardize photo folder names
    folder_buildings = {}  # building_key -> list of (folder_name, folder_id, full_key)
    folder_parse_failures = []
    for f in photo_folders:
        bldg, full = standardize_address(f["name"])
        if bldg:
            folder_buildings.setdefault(bldg, []).append((f["name"], f["id"], full))
        else:
            folder_parse_failures.append(f)

    # 4. Standardize spreadsheet rows
    ss_buildings = {}  # building_key -> list of (raw_address, full_key)
    ss_parse_failures = []
    for addr in data_rows:
        bldg, full = standardize_address(addr)
        if bldg:
            ss_buildings.setdefault(bldg, []).append((addr, full))
        else:
            ss_parse_failures.append(addr)

    print(f"Photo folders parsed: {len(folder_buildings)} buildings ({sum(len(v) for v in folder_buildings.values())} units)")
    print(f"Spreadsheet parsed:   {len(ss_buildings)} buildings ({sum(len(v) for v in ss_buildings.values())} units)")
    print()

    if folder_parse_failures:
        print(f"WARNING: {len(folder_parse_failures)} photo folder(s) could not be parsed:")
        for f in folder_parse_failures:
            print(f"  - '{f['name']}'")
        print()

    if ss_parse_failures:
        print(f"WARNING: {len(ss_parse_failures)} spreadsheet row(s) could not be parsed:")
        for a in ss_parse_failures:
            print(f"  - '{a}'")
        print()

    # 5. Compare at building level
    photo_bldg_set = set(folder_buildings.keys())
    ss_bldg_set = set(ss_buildings.keys())

    matched = photo_bldg_set & ss_bldg_set
    photos_only = photo_bldg_set - ss_bldg_set
    ss_only = ss_bldg_set - photo_bldg_set

    print("=" * 70)
    print("RESULTS")
    print("=" * 70)

    print(f"\n(c) MATCHED buildings: {len(matched)}")

    # (a) Photo folders with NO matching spreadsheet row
    print(f"\n(a) PHOTO FOLDERS WITH NO SPREADSHEET MATCH: {len(photos_only)}")
    print("    (These are errors -- photos exist but no data in spreadsheet)")
    if photos_only:
        # Count photos in each orphaned folder
        print(f"\n    {'Building Key':<14} {'Folder Name':<45} {'Photos':>6}")
        print(f"    {'-'*14} {'-'*45} {'-'*6}")
        total_orphan_photos = 0
        for bldg_key in sorted(photos_only):
            for folder_name, folder_id, full_key in folder_buildings[bldg_key]:
                photo_count = count_files_in_folder(drive_service, folder_id)
                total_orphan_photos += photo_count
                print(f"    {bldg_key:<14} {folder_name:<45} {photo_count:>6}")
        print(f"\n    Total orphaned photos: {total_orphan_photos}")

    # (b) Spreadsheet rows with NO matching photo folder
    print(f"\n(b) SPREADSHEET ROWS WITH NO PHOTO FOLDER: {len(ss_only)}")
    print("    (Less critical -- data exists but no photos)")
    if ss_only:
        print(f"\n    {'Building Key':<14} {'Spreadsheet Address'}")
        print(f"    {'-'*14} {'-'*45}")
        for bldg_key in sorted(ss_only):
            for raw_addr, full_key in ss_buildings[bldg_key]:
                print(f"    {bldg_key:<14} {raw_addr}")

    print()


if __name__ == "__main__":
    main()
