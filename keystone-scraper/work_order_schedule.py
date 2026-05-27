#!/usr/bin/env python3
"""
Work order report scheduler — run daily via cron.

Sends the work order report before board meetings:
  - Monthly meeting (Worksession/Quarterly/Annual) is exactly 2 days away
    → send to board@ + manager@
  - Today is Wednesday, no monthly meeting this week, Thursday check-in is
    still on the calendar (not called off)
    → send to board@ only

Calendar event name matching:
  Monthly meetings : contain "Worksession", "Quarterly", or "Annual"
  Check-ins        : contain "Check-In"
"""

import sys
from datetime import date, timedelta, datetime, timezone
from googleapiclient.discovery import build
from google.oauth2 import service_account

from work_order_report import (
    fetch_work_orders, format_text, format_html,
    generate_pdf, send_email
)

SA_FILE   = '/home/dee/.config/openclaw/google-service-account.json'
SCOPES    = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar',
]
CAL_ID    = ('c_ef1cd4b77ba7d1b4549f254aa0c8aa12ce4c98847b73db8c11cd92c164245c81'
             '@group.calendar.google.com')

BOARD     = 'board@villasboulders.org'
MANAGER   = 'manager@villasboulders.org'
LOG_FILE  = '/home/dee/hoa-code/keystone-scraper/schedule.log'

MONTHLY_KEYWORDS  = ('worksession', 'quarterly', 'annual')
CHECKIN_KEYWORD   = 'check-in'


def log(msg, quiet=False):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M')
    line = f'[{ts}] {msg}'
    if not quiet:
        print(line)
    with open(LOG_FILE, 'a') as f:
        f.write(line + '\n')


def get_events(cal_service, start, end):
    """Return events on the Board Calendar between start and end dates."""
    result = cal_service.events().list(
        calendarId=CAL_ID,
        timeMin=datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc).isoformat(),
        timeMax=datetime.combine(end,   datetime.max.time()).replace(tzinfo=timezone.utc).isoformat(),
        singleEvents=True,
        orderBy='startTime',
    ).execute()
    return result.get('items', [])


def is_monthly(event):
    name = event.get('summary', '').lower()
    return any(k in name for k in MONTHLY_KEYWORDS)


def is_checkin(event):
    return CHECKIN_KEYWORD in event.get('summary', '').lower()


def event_date(event):
    dt = event['start'].get('dateTime', event['start'].get('date', ''))
    return datetime.fromisoformat(dt).date()


def send_report(gmail, sheets, subject_suffix, recipients):
    today_str = date.today().strftime('%Y-%m-%d')
    orders = fetch_work_orders(sheets)
    text   = format_text(orders)
    html   = format_html(orders)
    pdf    = generate_pdf(html)
    fname  = f'work-orders-{today_str}.pdf'
    subject = f'HOA Work Order Status Report — {today_str}{subject_suffix}'
    send_email(gmail, subject, html, text, pdf, fname, to=recipients)
    log(f'Sent to {", ".join(recipients)} — {fname}')


def main():
    today    = date.today()
    dry_run  = '--dry-run' in sys.argv
    weekday  = today.weekday()   # 0=Mon … 6=Sun

    creds    = service_account.Credentials.from_service_account_file(SA_FILE, scopes=SCOPES)
    delegated = creds.with_subject('admin@villasboulders.org')
    cal      = build('calendar', 'v3', credentials=delegated)
    sheets   = build('sheets',   'v4', credentials=delegated)
    gmail    = build('gmail',    'v1', credentials=delegated)

    # ── Check 1: monthly meeting exactly 2 days away ──────────────────────────
    target = today + timedelta(days=2)
    events = get_events(cal, target, target)
    monthly_in_2 = [e for e in events if is_monthly(e)]

    if monthly_in_2:
        names = ', '.join(e['summary'] for e in monthly_in_2)
        log(f'Monthly meeting in 2 days ({target}): {names}')
        if not dry_run:
            send_report(gmail, sheets,
                        subject_suffix=f' (before {target})',
                        recipients=[BOARD, MANAGER])
        else:
            log(f'DRY RUN — would send to {BOARD}, {MANAGER}')
        return

    # ── Check 2: Wednesday + no monthly meeting this week + check-in tomorrow ─
    if weekday == 2:   # Wednesday
        # Look for monthly meetings Mon–Sun this week
        monday   = today - timedelta(days=weekday)
        sunday   = monday + timedelta(days=6)
        week_events = get_events(cal, monday, sunday)
        monthly_this_week = [e for e in week_events if is_monthly(e)]

        if monthly_this_week:
            log(f'Wednesday but monthly meeting already this week — skipping check-in check')
            return

        # Check for a check-in tomorrow (Thursday)
        thursday = today + timedelta(days=1)
        thu_events = get_events(cal, thursday, thursday)
        checkins = [e for e in thu_events if is_checkin(e)]

        if checkins:
            names = ', '.join(e['summary'] for e in checkins)
            log(f'Check-in on {thursday}: {names}')
            if not dry_run:
                send_report(gmail, sheets,
                            subject_suffix=' (before check-in)',
                            recipients=[BOARD])
            else:
                log(f'DRY RUN — would send to {BOARD}')
        else:
            log(f'Wednesday: no check-in found for {thursday} — no report sent')
        return

    log(f'No send condition met today ({today}, weekday={weekday})', quiet=True)


if __name__ == '__main__':
    main()
