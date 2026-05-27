#!/usr/bin/env python3
"""
Merge Keystone Directory tab + Google Contacts into a Full Directory tab.

Matching strategy: parse contact address → normalize street name + extract
unit number → match against canonical directory entries (street number + unit).
One output row per person (not per unit), so couples each get their own row.

Output tab: "Full Directory" in the Keystone Cache spreadsheet.
Columns: Street, Street Number, Unit, Full Address, Last Name, First Name,
         Phone 1, Phone 2, Email, Source
"""

import re
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

SA_FILE  = '/home/dee/.config/openclaw/google-service-account.json'
SCOPES   = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/contacts.readonly',
]
SHEET_ID = '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ'

# Street name abbreviation → canonical
STREET_MAP = {
    'cir':    'circle',
    'circ':   'circle',
    'pt':     'point',
    'ln':     'lane',
    'blvd':   'boulevard',
    'dr':     'drive',
    'rd':     'road',
    'st':     'street',
    'ave':    'avenue',
    'ct':     'court',
}

# Canonical street order for sorting
STREET_ORDER = [
    'boulder circle',
    'stone circle',
    'broadlands lane',
    'boulder point',
    'plaster point',
    'rock point',
]


def norm_street(raw):
    """Normalize a street name to lowercase canonical form."""
    s = raw.lower().strip()
    # Strip each word of all non-alpha characters, then expand abbreviations
    words = s.split()
    words = [re.sub(r'[^a-z]', '', w) for w in words]
    words = [STREET_MAP.get(w, w) for w in words if w]
    return ' '.join(words)


def parse_contact_address(formatted):
    """
    Extract (street_number, unit, norm_street_name) from a contact address string.
    Handles forms like:
      13684 Stone Circle #101
      13673 Plaster Pt Unit 102
      13739 Rock Pt. #101
      13635 Boulder Cir Unit 101
    Returns None if no 5-digit street number found.
    """
    # Strip country line
    lines = [l.strip() for l in formatted.split('\n') if l.strip()]
    addr = lines[0] if lines else formatted

    # Extract street number (first 4-5 digit number)
    m = re.match(r'(\d{4,5})\s+(.*)', addr)
    if not m:
        return None
    street_num = m.group(1)
    rest = m.group(2)

    # Extract unit: #NNN or Unit NNN or Apt NNN
    unit_match = re.search(r'(?:#|[Uu]nit\s*#?|[Aa]pt\.?\s*#?)(\d+)', rest)
    unit = unit_match.group(1) if unit_match else ''

    # Street name is everything before the unit designator
    if unit_match:
        street_part = rest[:unit_match.start()].strip()
    else:
        street_part = rest.strip()

    return street_num, unit, norm_street(street_part)


def street_sort_key(street_name):
    name_lc = street_name.lower()
    try:
        return STREET_ORDER.index(name_lc)
    except ValueError:
        return 99


def main():
    dry_run = '--dry-run' in sys.argv

    creds    = service_account.Credentials.from_service_account_file(SA_FILE, scopes=SCOPES)
    delegated = creds.with_subject('admin@villasboulders.org')
    sheets   = build('sheets',  'v4', credentials=delegated)
    people   = build('people',  'v1', credentials=delegated)

    # ── Load Directory tab ────────────────────────────────────────────────────
    result = sheets.spreadsheets().values().get(
        spreadsheetId=SHEET_ID,
        range='Directory!A2:G200'
    ).execute()
    dir_rows = result.get('values', [])

    # Index by (street_number, unit, norm_street) — street name needed because
    # some street numbers appear on both Boulder Point and Rock Point.
    dir_index = {}
    for row in dir_rows:
        if len(row) < 3:
            continue
        street     = row[0]
        street_num = row[1]
        unit       = row[2]
        full_addr  = row[3] if len(row) > 3 else ''
        last_name  = row[4] if len(row) > 4 else ''
        ks_phone   = row[5] if len(row) > 5 else ''
        key = (street_num, unit, norm_street(street))
        dir_index[key] = {
            'street': street,
            'street_num': street_num,
            'unit': unit,
            'full_addr': full_addr,
            'last_name': last_name,
            'ks_phone': ks_phone,
        }

    print(f"Directory entries: {len(dir_index)}")

    # ── Load Google Contacts ──────────────────────────────────────────────────
    all_contacts = []
    page_token = None
    while True:
        kwargs = dict(
            resourceName='people/me',
            pageSize=1000,
            personFields='names,phoneNumbers,emailAddresses,addresses',
        )
        if page_token:
            kwargs['pageToken'] = page_token
        resp = people.people().connections().list(**kwargs).execute()
        all_contacts.extend(resp.get('connections', []))
        page_token = resp.get('nextPageToken')
        if not page_token:
            break

    print(f"Google Contacts: {len(all_contacts)}")

    # ── Build output rows ─────────────────────────────────────────────────────
    # Track which directory entries got matched (for "Keystone only" entries)
    matched_dir_keys = set()

    output = []  # list of dicts

    for contact in all_contacts:
        names   = contact.get('names', [{}])
        phones  = [p.get('canonicalForm') or p.get('value', '') for p in contact.get('phoneNumbers', [])]
        emails  = [e.get('value', '') for e in contact.get('emailAddresses', [])]
        addrs   = contact.get('addresses', [])

        display  = names[0].get('displayName', '') if names else ''
        family   = names[0].get('familyName', '') if names else ''
        given    = names[0].get('givenName', '') if names else ''

        # Deduplicate phones and emails
        phones = list(dict.fromkeys(p for p in phones if p))
        emails = list(dict.fromkeys(e for e in emails if e))

        # Try to match an address to a directory entry
        dir_entry = None
        for addr_obj in addrs:
            fmt = addr_obj.get('formattedValue', '')
            parsed = parse_contact_address(fmt)
            if not parsed:
                continue
            snum, unit, norm_st = parsed
            # Try exact unit match first
            key = (snum, unit, norm_st)
            if key in dir_index:
                dir_entry = dir_index[key]
                matched_dir_keys.add((dir_entry['street_num'], dir_entry['unit'], norm_street(dir_entry['street'])))
                break
            # Try without unit (some contacts may omit it)
            if not unit:
                # Look for any entry with this street_num and norm street
                for (dn, du, ds), de in dir_index.items():
                    if dn == snum and ds == norm_st:
                        dir_entry = de
                        matched_dir_keys.add((de['street_num'], de['unit']))
                        break

        if dir_entry:
            row = {
                'street':     dir_entry['street'],
                'street_num': dir_entry['street_num'],
                'unit':       dir_entry['unit'],
                'full_addr':  dir_entry['full_addr'],
                'last_name':  family or dir_entry['last_name'],
                'first_name': given,
                'phone1':     phones[0] if phones else dir_entry['ks_phone'],
                'phone2':     phones[1] if len(phones) > 1 else '',
                'email':      emails[0] if emails else '',
                'source':     'Both',
            }
        else:
            # Contact has no matching directory entry — include with contact address
            addr_str = addrs[0].get('formattedValue', '').split('\n')[0] if addrs else ''
            row = {
                'street':     '',
                'street_num': '',
                'unit':       '',
                'full_addr':  addr_str,
                'last_name':  family,
                'first_name': given,
                'phone1':     phones[0] if phones else '',
                'phone2':     phones[1] if len(phones) > 1 else '',
                'email':      emails[0] if emails else '',
                'source':     'Contacts only',
            }

        output.append(row)

    # ── Add unmatched directory entries (Keystone only) ───────────────────────
    # Build set of (street_num, unit, norm_street) already covered by 'Both' rows
    both_addr_keys = {
        (r['street_num'], r['unit'], norm_street(r['street']))
        for r in output if r['source'] == 'Both'
    }
    for key, d in dir_index.items():
        if key not in matched_dir_keys:
            # Skip if a 'Both' row already covers this address (duplicate guard)
            if key in both_addr_keys:
                continue
            output.append({
                'street':     d['street'],
                'street_num': d['street_num'],
                'unit':       d['unit'],
                'full_addr':  d['full_addr'],
                'last_name':  d['last_name'],
                'first_name': '',
                'phone1':     d['ks_phone'],
                'phone2':     '',
                'email':      '',
                'source':     'Keystone only',
            })

    # ── Sort: by street order, then street number, then unit, then last name ──
    def sort_key(r):
        return (
            street_sort_key(r['street']),
            r['street_num'].zfill(6),
            r['unit'].zfill(4),
            r['last_name'].lower(),
            r['first_name'].lower(),
        )

    output.sort(key=sort_key)

    # Stats
    both   = sum(1 for r in output if r['source'] == 'Both')
    ks     = sum(1 for r in output if r['source'] == 'Keystone only')
    co     = sum(1 for r in output if r['source'] == 'Contacts only')
    print(f"Output rows: {len(output)} (Both={both}, Keystone-only={ks}, Contacts-only={co})")

    if dry_run:
        for r in output[:20]:
            print(f"  {r['street']:<18} #{r['unit']} | {r['last_name']:<15} {r['first_name']:<15} | {r['phone1']:<16} | {r['email']:<30} | {r['source']}")
        return

    # ── Write to Full Directory tab ───────────────────────────────────────────
    header = ['Street', 'Street Number', 'Unit', 'Full Address',
              'Last Name', 'First Name', 'Phone 1', 'Phone 2', 'Email', 'Source']
    rows = [header]
    for r in output:
        rows.append([
            r['street'], r['street_num'], r['unit'], r['full_addr'],
            r['last_name'], r['first_name'],
            r['phone1'], r['phone2'], r['email'], r['source'],
        ])

    # Ensure the tab exists; create it if not
    sheet_meta = sheets.spreadsheets().get(spreadsheetId=SHEET_ID).execute()
    existing   = [s['properties']['title'] for s in sheet_meta['sheets']]
    if 'Full Directory' not in existing:
        sheets.spreadsheets().batchUpdate(
            spreadsheetId=SHEET_ID,
            body={'requests': [{'addSheet': {'properties': {'title': 'Full Directory'}}}]},
        ).execute()
        sheet_meta = sheets.spreadsheets().get(spreadsheetId=SHEET_ID).execute()
    else:
        sheets.spreadsheets().values().clear(
            spreadsheetId=SHEET_ID,
            range='Full Directory!A:Z',
        ).execute()

    sheets.spreadsheets().values().update(
        spreadsheetId=SHEET_ID,
        range='Full Directory!A1',
        valueInputOption='RAW',
        body={'values': rows},
    ).execute()

    # Bold + freeze header row
    tab = next((s for s in sheet_meta['sheets']
                if s['properties']['title'] == 'Full Directory'), None)
    if tab:
        sid = tab['properties']['sheetId']
        sheets.spreadsheets().batchUpdate(
            spreadsheetId=SHEET_ID,
            body={'requests': [
                {'updateSheetProperties': {
                    'properties': {'sheetId': sid, 'gridProperties': {'frozenRowCount': 1}},
                    'fields': 'gridProperties.frozenRowCount',
                }},
                {'repeatCell': {
                    'range': {'sheetId': sid, 'startRowIndex': 0, 'endRowIndex': 1},
                    'cell': {'userEnteredFormat': {'textFormat': {'bold': True}}},
                    'fields': 'userEnteredFormat.textFormat.bold',
                }},
            ]},
        ).execute()

    print(f"Written {len(rows)-1} rows to 'Full Directory' tab.")


if __name__ == '__main__':
    main()
