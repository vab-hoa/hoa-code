#!/usr/bin/env python3
"""
Work order status report — excludes Closed, groups by status.
Usage: python3 work_order_report.py [--email]
"""

import os
import sys
from datetime import date
from googleapiclient.discovery import build
from google.oauth2 import service_account

SA_FILE = os.path.expanduser('~/.config/openclaw/google-service-account.json')
SCOPES = ['https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/gmail.send']
SPREADSHEET_ID = '1TBC1B2V_yzZaost6r7IGWWqiEebEcQwMp5DknahwYuQ'
REPORT_TO_DEFAULT = 'admin@villasboulders.org'

STATUS_ORDER = [
    'Pending Board Review',
    'Awaiting Quote',
    'Open',
    'Service Request',
    'Scheduled',
    'On Hold',
]

STATUS_COLORS = {
    'Pending Board Review': '#c0392b',
    'Awaiting Quote':       '#e67e22',
    'Open':                 '#2980b9',
    'Service Request':      '#27ae60',
    'Scheduled':            '#8e44ad',
    'On Hold':              '#7f8c8d',
}


def fetch_profiles(sheets_service):
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID,
        range='Profiles!A:C'
    ).execute()
    rows = result.get('values', [])
    return {row[0]: row[2] for row in rows[1:] if len(row) >= 3}


def fetch_work_orders(sheets_service):
    profiles = fetch_profiles(sheets_service)
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
        address = row[0] if len(row) > 0 else ''
        orders.append({
            'address':     address,
            'owner':       profiles.get(address, ''),
            'wo_number':   row[1] if len(row) > 1 else '',
            'date':        row[2] if len(row) > 2 else '',
            'description': row[3] if len(row) > 3 else '',
            'vendor':      row[4] if len(row) > 4 else '',
            'status':      status,
        })
    return orders


def format_text(orders):
    by_status = {}
    for wo in orders:
        by_status.setdefault(wo['status'], []).append(wo)

    lines = ['WORK ORDER STATUS REPORT', '=' * 60, '']
    total = sum(len(v) for v in by_status.values())
    lines.append(f"Open work orders: {total}  (Closed excluded)\n")

    all_statuses = STATUS_ORDER + [s for s in by_status if s not in STATUS_ORDER]
    for status in all_statuses:
        if status not in by_status:
            continue
        items = by_status[status]
        lines.append('=' * 60)
        lines.append(f"  {status.upper()}  ({len(items)})")
        lines.append('=' * 60)
        for wo in items:
            owner = f"  {wo['owner']}" if wo['owner'] else ''
            lines.append(f"  WO#{wo['wo_number']}  {wo['address']}{owner}  [{wo['date']}]")
            lines.append(f"    {wo['description']}")
            if wo['vendor']:
                lines.append(f"    Vendor: {wo['vendor']}")
        lines.append('')

    return '\n'.join(lines)


def format_html(orders):
    by_status = {}
    for wo in orders:
        by_status.setdefault(wo['status'], []).append(wo)

    total = sum(len(v) for v in by_status.values())
    today = date.today().strftime('%B %d, %Y')
    all_statuses = STATUS_ORDER + [s for s in by_status if s not in STATUS_ORDER]

    sections = []
    for status in all_statuses:
        if status not in by_status:
            continue
        items = by_status[status]
        color = STATUS_COLORS.get(status, '#555')
        rows = []
        for wo in items:
            vendor_html = f'<br><span style="color:#555;font-size:13px;">Vendor: {wo["vendor"]}</span>' if wo['vendor'] else ''
            owner_html  = f'<br><span style="color:#555;font-size:12px;">{wo["owner"]}</span>' if wo['owner'] else ''
            rows.append(f'''
            <tr>
              <td style="padding:8px 12px;font-weight:bold;white-space:nowrap;">WO#{wo['wo_number']}</td>
              <td style="padding:8px 12px;font-weight:bold;white-space:nowrap;">{wo['address']}{owner_html}</td>
              <td style="padding:8px 12px;color:#555;">{wo['date']}</td>
              <td style="padding:8px 12px;">{wo['description']}{vendor_html}</td>
            </tr>''')

        sections.append(f'''
        <div style="margin-bottom:28px;">
          <div style="background:{color};color:white;padding:8px 14px;border-radius:4px 4px 0 0;font-size:14px;font-weight:bold;letter-spacing:0.05em;">
            {status.upper()} &nbsp;·&nbsp; {len(items)}
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;border-top:none;">
            <thead>
              <tr style="background:#f5f5f5;color:#777;font-size:12px;text-transform:uppercase;">
                <th style="padding:6px 12px;text-align:left;">WO #</th>
                <th style="padding:6px 12px;text-align:left;">Address / Owner</th>
                <th style="padding:6px 12px;text-align:left;">Date</th>
                <th style="padding:6px 12px;text-align:left;">Description</th>
              </tr>
            </thead>
            <tbody>{''.join(rows)}
            </tbody>
          </table>
        </div>''')

    return f'''<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:750px;margin:0 auto;padding:20px;">
  <h2 style="margin-bottom:4px;">HOA Work Order Status Report</h2>
  <p style="color:#777;margin-top:0;margin-bottom:20px;">{today} &nbsp;·&nbsp; {total} open work orders (Closed excluded)</p>
  {''.join(sections)}
  <p style="color:#aaa;font-size:12px;margin-top:30px;">Generated automatically from Keystone cache · villasboulders.org</p>
</body>
</html>'''


def generate_pdf(html_body):
    import subprocess, tempfile, os
    with tempfile.NamedTemporaryFile(suffix='.html', delete=False, mode='w') as f:
        f.write(html_body)
        html_file = f.name
    pdf_file = html_file.replace('.html', '.pdf')
    try:
        subprocess.run(
            ['/usr/bin/python3', '-c',
             f'from weasyprint import HTML; HTML(filename="{html_file}").write_pdf("{pdf_file}")'],
            check=True
        )
        with open(pdf_file, 'rb') as f:
            return f.read()
    finally:
        os.unlink(html_file)
        if os.path.exists(pdf_file):
            os.unlink(pdf_file)


def send_email(gmail_service, subject, html_body, text_body, pdf_bytes, pdf_filename,
               to=None):
    import base64
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.application import MIMEApplication

    recipients = to or [REPORT_TO_DEFAULT]
    if isinstance(recipients, str):
        recipients = [recipients]

    msg = MIMEMultipart('mixed')
    msg['To'] = ', '.join(recipients)
    msg['From'] = 'admin@villasboulders.org'
    msg['Subject'] = subject

    # HTML + plain text body
    body = MIMEMultipart('alternative')
    body.attach(MIMEText(text_body, 'plain'))
    body.attach(MIMEText(html_body, 'html'))
    msg.attach(body)

    # PDF attachment
    pdf_part = MIMEApplication(pdf_bytes, _subtype='pdf')
    pdf_part.add_header('Content-Disposition', 'attachment', filename=pdf_filename)
    msg.attach(pdf_part)

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
    text_report = format_text(orders)
    html_report = format_html(orders)

    print(text_report)

    if send:
        gmail = build('gmail', 'v1', credentials=delegated)
        today = date.today().strftime('%Y-%m-%d')
        print('Generating PDF...')
        pdf_bytes = generate_pdf(html_report)
        pdf_filename = f'work-orders-{today}.pdf'
        send_email(gmail, f'HOA Work Order Status Report — {today}',
                   html_report, text_report, pdf_bytes, pdf_filename)
        print(f'Report emailed to {REPORT_TO_DEFAULT} with {pdf_filename} attached')


if __name__ == '__main__':
    main()
