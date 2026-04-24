#!/usr/bin/env python3
"""
Work order status report — excludes Closed, groups by status.
Usage: python3 work_order_report.py [--email]
"""

import sys
from googleapiclient.discovery import build
from google.oauth2 import service_account

SA_FILE = '/home/dee/.config/openclaw/google-service-account.json'
SCOPES = ['https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/gmail.send']
SPREADSHEET_ID = '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ'
REPORT_TO = 'admin@villasboulders.org'

STATUS_ORDER = [
    'Pending Board Review',
    'Awaiting Quote',
    'Open',
    'Service Request',
    'Scheduled',
    'On Hold',
]


def fetch_work_orders(sheets_service):
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range='WorkOrders!A:F'
    ).execute()
    rows = result.get('values', [])
    orders = []
    for row in rows[1:]:
        status = row[5].strip() if len(row) > 5 else ''
        if not status or status == 'Closed':
            continue
        orders.append({
            'address': row[0] if len(row) > 0 else '',
            'wo_number': row[1] if len(row) > 1 else '',
            'date': row[2] if len(row) > 2 else '',
            'description': row[3] if len(row) > 3 else '',
            'vendor': row[4] if len(row) > 4 else '',
            'status': status,
        })
    return orders


def format_report(orders):
    by_status = {}
    for wo in orders:
        by_status.setdefault(wo['status'], []).append(wo)

    lines = ['WORK ORDER STATUS REPORT', '=' * 60, '']

    all_statuses = STATUS_ORDER + [s for s in by_status if s not in STATUS_ORDER]
    total = sum(len(v) for v in by_status.values())
    lines.append(f"Open work orders: {total}  (Closed excluded)\n")

    for status in all_statuses:
        if status not in by_status:
            continue
        items = by_status[status]
        lines.append(f"{'=' * 60}")
        lines.append(f"  {status.upper()}  ({len(items)})")
        lines.append(f"{'=' * 60}")
        for wo in items:
            lines.append(f"  WO#{wo['wo_number']}  {wo['address']}  [{wo['date']}]")
            lines.append(f"    {wo['description']}")
            if wo['vendor']:
                lines.append(f"    Vendor: {wo['vendor']}")
        lines.append('')

    return '\n'.join(lines)


def send_email(gmail_service, subject, body):
    import base64
    from email.mime.text import MIMEText
    msg = MIMEText(body)
    msg['To'] = REPORT_TO
    msg['From'] = 'admin@villasboulders.org'
    msg['Subject'] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    gmail_service.users().messages().send(
        userId='me', body={'raw': raw}
    ).execute()


def main():
    send = '--email' in sys.argv

    creds = service_account.Credentials.from_service_account_file(SA_FILE, scopes=SCOPES)
    delegated = creds.with_subject('admin@villasboulders.org')
    sheets = build('sheets', 'v4', credentials=delegated)

    orders = fetch_work_orders(sheets)
    report = format_report(orders)
    print(report)

    if send:
        gmail = build('gmail', 'v1', credentials=delegated)
        send_email(gmail, 'HOA Work Order Status Report', report)
        print(f'Report emailed to {REPORT_TO}')


if __name__ == '__main__':
    main()
