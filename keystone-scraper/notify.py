#!/usr/bin/env python3
"""Email an alert from admin@villasboulders.org via the Gmail API.

Used by the Keystone jobs and their GitHub workflows. Sends to role addresses, not to a
person, so alerts keep reaching whoever holds the IT Officer role after a handover.
(Shell `mail` doesn't work on GitHub's runners, which is why this exists.)

Command line, e.g. from a workflow `if: failure()` step:
  python notify.py "Keystone sync FAILED" "See https://github.com/.../actions/runs/123"
"""
import base64
import os
import sys
from email.mime.text import MIMEText

SENDER = "admin@villasboulders.org"
ALERT_RECIPIENTS = ["itofficer@villasboulders.org", "admin@villasboulders.org"]
CREDS_PATH = os.path.expanduser("~/.config/openclaw/google-service-account.json")


def send_alert(subject, body, recipients=None):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    creds = service_account.Credentials.from_service_account_file(
        CREDS_PATH, scopes=["https://www.googleapis.com/auth/gmail.send"])
    gmail = build("gmail", "v1", credentials=creds.with_subject(SENDER), cache_discovery=False)
    msg = MIMEText(body, "plain")
    msg["to"] = ", ".join(recipients or ALERT_RECIPIENTS)
    msg["from"] = SENDER
    msg["subject"] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    gmail.users().messages().send(userId="me", body={"raw": raw}).execute()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit("usage: notify.py SUBJECT BODY")
    send_alert(sys.argv[1], sys.argv[2])
    print("Alert sent")
