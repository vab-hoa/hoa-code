#!/usr/bin/env python3
"""
For each broken Drive file ID from the website, try to:
1. Look up the old file (might be trashed or have metadata still)
2. Search the shared drive for a replacement by name
"""

from google.oauth2 import service_account
from googleapiclient.discovery import build

SA_FILE = "/home/dee/.config/openclaw/google-service-account.json"
SCOPES = ["https://www.googleapis.com/auth/drive"]
SUBJECT = "admin@villasboulders.org"
SHARED_DRIVE_ID = "0AExYZWmfRm9JUk9PVA"  # VaB Board Documents

BROKEN_IDS = [
    "10AsxcnmTz8xn6Kcd1AOQjPOnQAc1bIiJ",
    "137z5ohOvd323lgDE3lOym-0NTbUxq2v-",
    "1533Hg-wnBYNWf8wRp3B2BI7-UDMUWOhx",
    "1DAxuOr2eWMGdcGlwzx_AsZ5JmkuxLfU6",
    "1DQ3VG7iip_lMTbXu2DVcCGWAt_eWaCWT",
    "1G_fxPeHVAHb3YUBVOGHLIRadDZRQ6HyT",
    "1Hjgt5BOILNNsIBMeVCkXKRXNq3twsThx",
    "1Pp7eJCERWW2L0o9J9fSsvYoMT80vzdiV",
    "1QKeMQIWfV4Xzd6DNu6Ba-iMAaIofJfya",
    "1QcdQp6qubp-pZbZr3-Jz92tuK3CeMFjK",
    "1SD5QYSJFMCifWIe0upFKsbF1XOX3KpE9",
    "1TdeqabI_X6DYlrSi-Hitug9N2PCtQdqh",
    "1VzsXjgNzeWFFWfMaELgiAvbQZTz7hvD2",
    "1WezdYQm3ogBGHJBjyx4vLAWeX27CKO-n",
    "1YXsZL9fGmBEnO-fwDMZqTeMUInP2EOJk",
    "1_898PAnP58NishT6BEO0M-xHOzB046oB",
    "1conXw8mimAJ9XwzivxL0V6WipB9_7pTW",
    "1cwK8BsvqjCcxsdVoWaQ5km1qWrl_hDok",
    "1ePjUVQg6ocQZtUC6Skwjq6O2d5z1fbkM",
    "1iTJ_6j8G7JF8a-A077t5GgogcAVmtmF2",
    "1is8xWW3b_YhCIta2S6TndGxjKmAl4MIQ",
    "1kpToMEM7ncSAY53fb-b6gb-SE66gYjag",
    "1mJZwynZim9MEnUjJnglPaVYBp9aQno_i",
    "1mf-N6D2SHWIA7u--zlVqR7l1Lldq9KaB",
    "1mu-_ltPczKFYj2IvPUTgi9NXDdzZOFmG",
    "1nAi8h5xjikw8g_T0oTcPJP8xGg-zTRJR",
    "1p_IK70rLFbRfb0zXo0s2TouOzrmoGzQH",
    "1ptp2EjRte57I_v10YPN_PEB6xakfet7r",
    "1rvvnS4AXM6Rksy9ygg_OqTzft0Pf-PqV",
    "1udQFTvcA0Fg8tKHkXEu_an1qzFZLvLIN",
    "1v1v4qwqj3gWDWCV7n7iohaudFM9VcJnn",
    "1zVfswsEQHqcCcgtNUAE902qTXZTwtCIm",
    # The Google Doc (401)
    "14EOPsEeHZM85Uj2giGbjRf3biwmTaY4_",
]

# Pages where each broken ID was found (for context)
FOUND_ON = {
    "10AsxcnmTz8xn6Kcd1AOQjPOnQAc1bIiJ": "policies",
    "137z5ohOvd323lgDE3lOym-0NTbUxq2v-": "policies",
    "1533Hg-wnBYNWf8wRp3B2BI7-UDMUWOhx": "arc, governing-documents, faq, rules",
    "1DAxuOr2eWMGdcGlwzx_AsZ5JmkuxLfU6": "annual-budgetdues-process",
    "1DQ3VG7iip_lMTbXu2DVcCGWAt_eWaCWT": "annual-budgetdues-process",
    "1G_fxPeHVAHb3YUBVOGHLIRadDZRQ6HyT": "governing-documents, the-association",
    "1Hjgt5BOILNNsIBMeVCkXKRXNq3twsThx": "homeowner-paid-planting",
    "1Pp7eJCERWW2L0o9J9fSsvYoMT80vzdiV": "policies, budgets-costs-and-dues",
    "1QKeMQIWfV4Xzd6DNu6Ba-iMAaIofJfya": "policies",
    "1QcdQp6qubp-pZbZr3-Jz92tuK3CeMFjK": "policies",
    "1SD5QYSJFMCifWIe0upFKsbF1XOX3KpE9": "policies, budgets-costs-and-dues, reserve-studies",
    "1TdeqabI_X6DYlrSi-Hitug9N2PCtQdqh": "policies, snow-removal",
    "1VzsXjgNzeWFFWfMaELgiAvbQZTz7hvD2": "reserve-studies",
    "1WezdYQm3ogBGHJBjyx4vLAWeX27CKO-n": "the-roofing-loan",
    "1YXsZL9fGmBEnO-fwDMZqTeMUInP2EOJk": "the-roofing-loan",
    "1_898PAnP58NishT6BEO0M-xHOzB046oB": "policies",
    "1conXw8mimAJ9XwzivxL0V6WipB9_7pTW": "reserve-studies",
    "1cwK8BsvqjCcxsdVoWaQ5km1qWrl_hDok": "policies",
    "1ePjUVQg6ocQZtUC6Skwjq6O2d5z1fbkM": "villas-geography",
    "1iTJ_6j8G7JF8a-A077t5GgogcAVmtmF2": "reserve-studies",
    "1is8xWW3b_YhCIta2S6TndGxjKmAl4MIQ": "policies",
    "1kpToMEM7ncSAY53fb-b6gb-SE66gYjag": "policies",
    "1mJZwynZim9MEnUjJnglPaVYBp9aQno_i": "policies",
    "1mf-N6D2SHWIA7u--zlVqR7l1Lldq9KaB": "governing-documents, rules",
    "1mu-_ltPczKFYj2IvPUTgi9NXDdzZOFmG": "arc, arc-guidelines, rules, architectural-review-request",
    "1nAi8h5xjikw8g_T0oTcPJP8xGg-zTRJR": "governing-documents, rules, faq",
    "1p_IK70rLFbRfb0zXo0s2TouOzrmoGzQH": "board-of-directors, former-board-members, board-and-committees",
    "1ptp2EjRte57I_v10YPN_PEB6xakfet7r": "policies",
    "1rvvnS4AXM6Rksy9ygg_OqTzft0Pf-PqV": "the-roofing-loan",
    "1udQFTvcA0Fg8tKHkXEu_an1qzFZLvLIN": "governing-documents, annual-budgetdues-process, rules, faq",
    "1v1v4qwqj3gWDWCV7n7iohaudFM9VcJnn": "policies",
    "1zVfswsEQHqcCcgtNUAE902qTXZTwtCIm": "villas-geography",
    "14EOPsEeHZM85Uj2giGbjRf3biwmTaY4_": "homepage (401 - auth required)",
}


def get_service():
    creds = service_account.Credentials.from_service_account_file(SA_FILE, scopes=SCOPES)
    delegated = creds.with_subject(SUBJECT)
    return build("drive", "v3", credentials=delegated)


def lookup_file(drive, file_id):
    """Try to get metadata for a file ID, including trashed files."""
    try:
        f = drive.files().get(
            fileId=file_id,
            fields="id,name,mimeType,trashed,parents,driveId",
            supportsAllDrives=True,
        ).execute()
        return f
    except Exception as e:
        return {"error": str(e)}


def search_by_name(drive, name):
    """Search shared drive for files matching this name."""
    # Escape single quotes in name
    escaped = name.replace("'", "\\'")
    q = f"name = '{escaped}' and trashed = false"
    try:
        results = drive.files().list(
            q=q,
            fields="files(id,name,mimeType,parents,driveId,createdTime,modifiedTime)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            corpora="allDrives",
            pageSize=10,
        ).execute()
        return results.get("files", [])
    except Exception as e:
        return [{"error": str(e)}]


def main():
    drive = get_service()

    print("=" * 100)
    print("BROKEN FILE ID LOOKUP & REPLACEMENT SEARCH")
    print("=" * 100)

    found_count = 0
    not_found_count = 0
    trashed_count = 0
    replacements = []

    for file_id in BROKEN_IDS:
        context = FOUND_ON.get(file_id, "unknown")
        print(f"\n{'─' * 100}")
        print(f"OLD ID: {file_id}")
        print(f"  Used on: {context}")

        # Step 1: Look up old file
        info = lookup_file(drive, file_id)

        if "error" in info:
            print(f"  Status: NOT FOUND — {info['error'][:120]}")
            not_found_count += 1
            continue

        name = info.get("name", "???")
        mime = info.get("mimeType", "???")
        trashed = info.get("trashed", False)
        print(f"  Name: {name}")
        print(f"  Type: {mime}")
        print(f"  Trashed: {trashed}")

        if trashed:
            trashed_count += 1
        else:
            found_count += 1
            print(f"  *** FILE STILL EXISTS (not trashed) — may be a permissions issue ***")
            continue

        # Step 2: Search for replacement
        matches = search_by_name(drive, name)
        if matches and "error" not in matches[0]:
            print(f"  POTENTIAL REPLACEMENTS ({len(matches)} found):")
            for m in matches:
                new_id = m["id"]
                created = m.get("createdTime", "?")
                modified = m.get("modifiedTime", "?")
                drive_id = m.get("driveId", "?")
                print(f"    NEW ID: {new_id}")
                print(f"      Created: {created}  Modified: {modified}")
                print(f"      DriveId: {drive_id}")
                replacements.append({
                    "old_id": file_id,
                    "old_name": name,
                    "new_id": new_id,
                    "context": context,
                    "created": created,
                })
        else:
            print(f"  NO REPLACEMENT FOUND by name search")

    # Summary
    print(f"\n{'=' * 100}")
    print("SUMMARY")
    print(f"{'=' * 100}")
    print(f"  Total broken IDs checked: {len(BROKEN_IDS)}")
    print(f"  Still exist (not trashed): {found_count}")
    print(f"  Trashed: {trashed_count}")
    print(f"  Completely gone (no metadata): {not_found_count}")
    print()

    if replacements:
        print(f"REPLACEMENT MAPPING ({len(replacements)} found):")
        print(f"{'─' * 100}")
        for r in replacements:
            print(f"  {r['old_name']}")
            print(f"    OLD: {r['old_id']}")
            print(f"    NEW: {r['new_id']}")
            print(f"    Created: {r['created']}")
            print(f"    Pages: {r['context']}")
            print()


if __name__ == "__main__":
    main()
