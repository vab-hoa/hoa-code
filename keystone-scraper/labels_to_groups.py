#!/usr/bin/env python3
"""
Sync Gmail contact group labels to Google Google Groups (villasboulders.org).

Replaces the LabelsToGroups Apps Script. Runs daily via GitHub Actions and
can be triggered on demand with: python labels_to_groups.py

For each entry in SYNC_LIST, the script:
  - Creates the Google Group if it doesn't exist
  - Ensures admin@villasboulders.org is an OWNER
  - Adds anyone in the contact group but missing from the Google Group
  - Removes anyone in the Google Group who is no longer in the contact group

Note: Group settings (whoCanPost, etc.) are not managed here — they require
the apps.groups.settings scope which is not in the service account delegation.
Groups are created with default settings; adjust manually in the Admin console
if a new group needs non-default settings.
"""
import json
import os
import sys
import time
import argparse
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2 import service_account

DOMAIN      = "villasboulders.org"
ADMIN_EMAIL = "admin@villasboulders.org"
SA_FILE     = os.path.expanduser("~/.config/openclaw/google-service-account.json")

SCOPES = [
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/admin.directory.group",
]

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
    """Normalize Gmail addresses by removing dots from the local part.

    Gmail treats dots as insignificant (john.doe == johndoe), but the
    Directory API treats them as distinct strings, causing spurious
    add/remove churn when contacts and group members use different forms.
    """
    local, _, domain = email.partition('@')
    domain = domain.lower()
    if domain in ('gmail.com', 'googlemail.com'):
        local = local.replace('.', '')
    return f"{local.lower()}@{domain}"


def build_services():
    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        info = json.loads(sa_json)
        creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    else:
        creds = service_account.Credentials.from_service_account_file(SA_FILE, scopes=SCOPES)
    delegated = creds.with_subject(ADMIN_EMAIL)
    people    = build("people", "v1", credentials=delegated)
    directory = build("admin", "directory_v1", credentials=delegated)
    return people, directory


def get_contact_group_emails(people, label_name):
    """Return set of lowercase email addresses in the named contact group."""
    result = people.contactGroups().list(pageSize=200).execute()
    groups = result.get("contactGroups", [])
    target = next((g for g in groups if g["name"] == label_name), None)
    if not target:
        print(f"  Contact group '{label_name}' not found — skipping.")
        return set()

    detail = people.contactGroups().get(
        resourceName=target["resourceName"],
        maxMembers=1000,
    ).execute()

    resource_names = detail.get("memberResourceNames", [])
    if not resource_names:
        return set()

    emails = set()
    for i in range(0, len(resource_names), 50):
        batch = resource_names[i:i + 50]
        resp = people.people().getBatchGet(
            resourceNames=batch,
            personFields="emailAddresses",
        ).execute()
        for r in resp.get("responses", []):
            addrs = r.get("person", {}).get("emailAddresses", [])
            if addrs:
                emails.add(normalize_email(addrs[0]["value"].strip()))
        if i + 50 < len(resource_names):
            time.sleep(0.5)

    return emails


def get_group_members(directory, group_email):
    """Return set of lowercase member emails, or None if the group doesn't exist."""
    members = set()
    page_token = None
    while True:
        kwargs = {"groupKey": group_email, "maxResults": 200}
        if page_token:
            kwargs["pageToken"] = page_token
        try:
            result = directory.members().list(**kwargs).execute()
        except HttpError as e:
            if e.resp.status == 404:
                return None
            raise
        for m in result.get("members", []):
            members.add(normalize_email(m["email"]))
        page_token = result.get("nextPageToken")
        if not page_token:
            break
    return members


def ensure_group_exists(directory, group_email, label_name, dry_run):
    try:
        directory.groups().get(groupKey=group_email).execute()
        return True
    except HttpError as e:
        if e.resp.status != 404:
            raise
    if dry_run:
        print(f"  DRY RUN — would create group {group_email}")
        return False
    directory.groups().insert(body={"email": group_email, "name": label_name}).execute()
    print(f"  Created group {group_email}")
    return True


def ensure_admin_owner(directory, group_email, dry_run):
    if dry_run:
        return
    try:
        directory.members().insert(
            groupKey=group_email,
            body={"email": ADMIN_EMAIL, "role": "OWNER"},
        ).execute()
    except HttpError:
        pass  # already a member/owner


def sync_group(people, directory, label_name, group_email, dry_run):
    print(f"\n{label_name} ({group_email})")

    if not ensure_group_exists(directory, group_email, label_name, dry_run):
        return

    ensure_admin_owner(directory, group_email, dry_run)

    should_be = get_contact_group_emails(people, label_name)
    current   = get_group_members(directory, group_email) or set()
    current  -= {ADMIN_EMAIL.lower()}

    to_add    = should_be - current
    to_remove = current - should_be

    for email in sorted(to_add):
        if dry_run:
            print(f"  DRY RUN — would add: {email}")
        else:
            try:
                directory.members().insert(
                    groupKey=group_email,
                    body={"email": email, "role": "MEMBER"},
                ).execute()
                print(f"  Added: {email}")
            except HttpError as e:
                print(f"  ERROR adding {email}: {e}")

    for email in sorted(to_remove):
        if dry_run:
            print(f"  DRY RUN — would remove: {email}")
        else:
            try:
                directory.members().delete(groupKey=group_email, memberKey=email).execute()
                print(f"  Removed: {email}")
            except HttpError as e:
                print(f"  ERROR removing {email}: {e}")

    if not to_add and not to_remove:
        print(f"  No changes ({len(should_be)} members)")


def main():
    parser = argparse.ArgumentParser(description="Sync Gmail contact groups to Google Groups")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would change without making any modifications")
    args = parser.parse_args()

    if args.dry_run:
        print("=== DRY RUN — no changes will be made ===")

    people, directory = build_services()

    for item in SYNC_LIST:
        group_email = f"{item['prefix']}@{DOMAIN}"
        sync_group(people, directory, item["label"], group_email, args.dry_run)

    print("\nSync complete.")


if __name__ == "__main__":
    main()
