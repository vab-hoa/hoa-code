#!/usr/bin/env python3
"""
Match broken file IDs to replacement files on the shared drive by searching
for documents with matching names.
"""

from google.oauth2 import service_account
from googleapiclient.discovery import build

SA_FILE = "/home/dee/.config/openclaw/google-service-account.json"
SCOPES = ["https://www.googleapis.com/auth/drive"]
SUBJECT = "admin@villasboulders.org"
SHARED_DRIVE_ID = "0AExYZWmfRm9JUk9PVA"

# old_file_id -> (document_description, search_terms)
BROKEN_FILES = {
    "10AsxcnmTz8xn6Kcd1AOQjPOnQAc1bIiJ": ("Adoption and Amendment of Policies", "Adoption and Amendment"),
    "137z5ohOvd323lgDE3lOym-0NTbUxq2v-": ("Association Directors and Officers", "Directors and Officers"),
    "1533Hg-wnBYNWf8wRp3B2BI7-UDMUWOhx": ("Covenants (DCCRs)", "Declaration of Covenants"),
    "1DAxuOr2eWMGdcGlwzx_AsZ5JmkuxLfU6": ("Operating Budget (presentation)", "Budget"),
    "1DQ3VG7iip_lMTbXu2DVcCGWAt_eWaCWT": ("Budget Presentation", "Budget"),
    "1G_fxPeHVAHb3YUBVOGHLIRadDZRQ6HyT": ("Colorado Certificate (of incorporation)", "Certificate"),
    "1Hjgt5BOILNNsIBMeVCkXKRXNq3twsThx": ("Homeowner Paid Planting and Removal (form)", "Homeowner Paid Planting"),
    "1Pp7eJCERWW2L0o9J9fSsvYoMT80vzdiV": ("Investment of Reserve Funds policy", "Investment of Reserve"),
    "1QKeMQIWfV4Xzd6DNu6Ba-iMAaIofJfya": ("Alternative Dispute Resolution policy", "Alternative Dispute"),
    "1QcdQp6qubp-pZbZr3-Jz92tuK3CeMFjK": ("Collection of Unpaid Assessments policy", "Collection of Unpaid"),
    "1SD5QYSJFMCifWIe0upFKsbF1XOX3KpE9": ("Reserve Requirements policy", "Reserve Requirements"),
    "1TdeqabI_X6DYlrSi-Hitug9N2PCtQdqh": ("Snow Removal policy", "Snow Removal"),
    "1VzsXjgNzeWFFWfMaELgiAvbQZTz7hvD2": ("2006 Reserve Study", "Reserve Study"),
    "1WezdYQm3ogBGHJBjyx4vLAWeX27CKO-n": ("Roofing Major Project doc", "Roofing"),
    "1YXsZL9fGmBEnO-fwDMZqTeMUInP2EOJk": ("Roofing Finished doc", "Roofing"),
    "1_898PAnP58NishT6BEO0M-xHOzB046oB": ("Responsibility for Deductible Portion of Insurance Claim", "Deductible"),
    "1conXw8mimAJ9XwzivxL0V6WipB9_7pTW": ("2022 Reserve Study", "Reserve Study"),
    "1cwK8BsvqjCcxsdVoWaQ5km1qWrl_hDok": ("Director Conflict of Interest policy", "Conflict of Interest"),
    "1ePjUVQg6ocQZtUC6Skwjq6O2d5z1fbkM": ("The Original Plat", "Plat"),
    "1iTJ_6j8G7JF8a-A077t5GgogcAVmtmF2": ("2015 Reserve Study", "Reserve Study"),
    "1is8xWW3b_YhCIta2S6TndGxjKmAl4MIQ": ("Inspection and Copying of Association Records policy", "Inspection and Copying"),
    "1kpToMEM7ncSAY53fb-b6gb-SE66gYjag": ("Homeowner Paid Planting and Removal policy", "Homeowner Paid Planting"),
    "1mJZwynZim9MEnUjJnglPaVYBp9aQno_i": ("Covenant Enforcement policy", "Covenant Enforcement"),
    "1mf-N6D2SHWIA7u--zlVqR7l1Lldq9KaB": ("Articles of Incorporation", "Articles of Incorporation"),
    "1mu-_ltPczKFYj2IvPUTgi9NXDdzZOFmG": ("ARC Guidelines", "ARC Guidelines"),
    "1nAi8h5xjikw8g_T0oTcPJP8xGg-zTRJR": ("Amendment to the Covenants", "Amendment to"),
    "1p_IK70rLFbRfb0zXo0s2TouOzrmoGzQH": ("Current Directors and Officers List", "Directors"),
    "1ptp2EjRte57I_v10YPN_PEB6xakfet7r": ("Committee Authorities policy", "Committee Authorities"),
    "1rvvnS4AXM6Rksy9ygg_OqTzft0Pf-PqV": ("Roofing Conclusions and Recommendations", "Roofing"),
    "1udQFTvcA0Fg8tKHkXEu_an1qzFZLvLIN": ("Bylaws", "Bylaws"),
    "1v1v4qwqj3gWDWCV7n7iohaudFM9VcJnn": ("Conduct of Meetings policy", "Conduct of Meetings"),
    "1zVfswsEQHqcCcgtNUAE902qTXZTwtCIm": ("Map of the Villas at the Boulders", "Map"),
}


def get_service():
    creds = service_account.Credentials.from_service_account_file(SA_FILE, scopes=SCOPES)
    delegated = creds.with_subject(SUBJECT)
    return build("drive", "v3", credentials=delegated)


def search_drive(drive, search_term):
    """Search shared drive for files containing the search term in their name."""
    escaped = search_term.replace("'", "\\'")
    q = f"name contains '{escaped}' and trashed = false"
    results = drive.files().list(
        q=q,
        corpora="drive",
        driveId=SHARED_DRIVE_ID,
        includeItemsFromAllDrives=True,
        supportsAllDrives=True,
        fields="files(id, name, mimeType, parents, createdTime, modifiedTime)",
        pageSize=20,
    ).execute()
    return results.get("files", [])


def main():
    drive = get_service()

    print("=" * 120)
    print("REPLACEMENT FILE MATCHING REPORT")
    print("=" * 120)

    mappings = []

    for old_id, (desc, search) in sorted(BROKEN_FILES.items(), key=lambda x: x[1][0]):
        print(f"\n{'─' * 120}")
        print(f"  LOOKING FOR: {desc}")
        print(f"  OLD ID: {old_id}")
        print(f"  Search: '{search}'")

        matches = search_drive(drive, search)
        # Filter to non-folder results
        matches = [m for m in matches if m["mimeType"] != "application/vnd.google-apps.folder"]

        if matches:
            print(f"  CANDIDATES ({len(matches)}):")
            for m in matches:
                created = m.get("createdTime", "?")[:10]
                modified = m.get("modifiedTime", "?")[:10]
                mime_short = m["mimeType"].split(".")[-1] if "." in m["mimeType"] else m["mimeType"].split("/")[-1]
                print(f"    {m['id']}  {m['name']}")
                print(f"      type={mime_short}  created={created}  modified={modified}")
            # Best guess: most recent PDF or the first match
            pdfs = [m for m in matches if "pdf" in m["mimeType"]]
            best = pdfs[0] if pdfs else matches[0]
            mappings.append((old_id, desc, best["id"], best["name"]))
        else:
            print(f"  *** NO MATCHES FOUND ***")
            mappings.append((old_id, desc, None, None))

    # Print final mapping table
    print(f"\n\n{'=' * 120}")
    print("SUGGESTED REPLACEMENT MAPPING")
    print(f"{'=' * 120}\n")

    found = [(old, desc, new, name) for old, desc, new, name in mappings if new]
    missing = [(old, desc, new, name) for old, desc, new, name in mappings if not new]

    print(f"Found replacements: {len(found)}")
    print(f"Still missing: {len(missing)}")
    print()

    for old_id, desc, new_id, new_name in found:
        print(f"  {desc}")
        print(f"    OLD: https://drive.google.com/file/d/{old_id}/preview")
        print(f"    NEW: https://drive.google.com/file/d/{new_id}/preview")
        print(f"    File: {new_name}")
        print()

    if missing:
        print("\nSTILL MISSING:")
        for old_id, desc, _, _ in missing:
            print(f"  {desc} (old: {old_id})")


if __name__ == "__main__":
    main()
