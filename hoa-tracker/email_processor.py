#!/usr/bin/env python3
"""
HOA Email Processor v2 for Villas at the Boulders

Runs on oregano. Reads boardwork@villasboulders.org via Google service account,
classifies and parses HOA-related emails, stores in Supabase, outputs JSON to stdout.

Classification pipeline (ordered):
  1. Noise filter
  2. Exact automation match (WO status report, property report, broken links)
  3. ARC family (form submission vs reply vs forward vs process discussion)
  4. HPPR/LBC forms
  5. WO form notifications
  6. Josh Hall residual
  7. Board governance
  8. Homeowner direct
  9. Default → unclassified

Usage:
    python3 email_processor.py [--days N] [--dry-run] [--debug] [--report-email]

Options:
    --days N        Look back N days (default: 1)
    --dry-run       Process emails but don't write to Supabase
    --debug         Print debug info to stderr
    --report-email  Send a summary email to Dee after processing
"""

import sys
import os
import json
import re
import argparse
import base64
import traceback
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

# Google API imports (only available on oregano)
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
except ImportError:
    service_account = None
    build = None

# Supabase / psycopg2 (only available on oregano)
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None
    psycopg2_extras = None

# ============================================================
# Configuration
# ============================================================

SERVICE_ACCOUNT_FILE = '/home/dee/.config/openclaw/google-service-account.json'
# Mailboxes to read — admin@ via service account, mcdonaldbuckhoa@ via IMAP
SECRETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'secrets')
MAILBOXES = [
    {'type': 'service_account', 'email': 'admin@villasboulders.org'},
    {'type': 'imap', 'email': 'mcdonaldbuckhoa@gmail.com',
     'host': 'imap.gmail.com', 'port': 993,
     'password_file': os.path.join(SECRETS_DIR, '.gmail_pw_mcdonaldbuckhoa')},
]
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

PROCESSED_FILE = '/home/dee/hoa-tracker/.processed_emails.json'

# Supabase connection (read from env or password file)
SUPABASE_HOST = 'db.obveytoovkzjrpzrhrim.supabase.co'
SUPABASE_PORT = 5432
SUPABASE_DB = 'postgres'
SUPABASE_USER = 'postgres'
SUPABASE_PASSWORD_FILE = os.path.join(SECRETS_DIR, '.supabase_db_password')

# Daily report email settings
REPORT_FROM = 'admin@villasboulders.org'
REPORT_TO = 'dee@wmbuck.net'
REPORT_SUBJECT = 'HOA Email Processor - Daily Summary'

# Import address standardization (same directory)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
try:
    from address_standardization import standardize_address, get_building_address
except ImportError:
    # Fallback if not in path
    def standardize_address(addr):
        return addr or ""
    def get_building_address(addr):
        return addr or ""

# ============================================================
# Known actors for classification
# ============================================================

JOSH_EMAIL = 'hallj@keystonepacific.com'
BOARD_EMAILS = {
    'lavenderdjbhoa@gmail.com',     # Deborah Lavender
    'olearyhoa@gmail.com',          # Tom O'Leary
    'brookeom@aol.com',             # Joe Newhouse
    'tlmitchell482332@gmail.com',   # Tom Mitchell
    'bigtlmusa@yahoo.com',          # Tom Mitchell alt
    'phasslacher@msn.com',          # Patty Hasslacher
    'kateandrewscouture@gmail.com', # Kate Couture
    'nancyabenoit@yahoo.com',       # Nancy Benoit
}
ADMIN_EMAIL = 'admin@villasboulders.org'
BOARDWORK_EMAIL = 'boardwork@villasboulders.org'
ARCFORM_RECIPIENT = 'arcformrecipients@villasbouders.org'

# Noise sender domains/patterns
NOISE_DOMAINS = {
    'noreply@google.com', 'drive-shares-dm-noreply@google.com',
    'mailer-daemon@googlemail.com',
}
NOISE_DOMAIN_PATTERNS = [
    'namecheap.com',
    'github.com',
    'supabase.co',
    'anthropic.com',
    'jotform.com',  # marketing, not form submissions
    'accounts.google.com',
    'notifications.google.com',
    'googlecloud@google.com',  # Google Cloud trial notices
    'gemini-notes@google.com',  # Gemini meeting notes
    'googlephotos.com',         # Google Photos shares
]

# ============================================================
# Email classification pipeline
# ============================================================

def classify_email(subject, sender, recipients, body, headers=None):
    """
    Ordered classification pipeline.
    Returns (classification, confidence, is_noise).
    """
    subject_lower = (subject or '').lower()
    sender_lower = (sender or '').lower()
    recipients_lower = (recipients or '').lower()
    body_lower = (body or '').lower()[:2000]  # First 2k for classification only

    # --- 1. Noise filter ---
    for nd in NOISE_DOMAINS:
        if nd in sender_lower:
            return ('noise', 1.0, True)
    for pattern in NOISE_DOMAIN_PATTERNS:
        if pattern in sender_lower:
            return ('noise', 0.95, True)
    # Empty-from link monitor
    if not sender or sender.strip() == '' or 'link monitor report' in body_lower:
        return ('noise', 0.90, True)
    # Mailer-daemon DSN
    if 'mailer-daemon' in sender_lower:
        return ('noise', 1.0, True)

    # --- 2. Exact automation match ---
    # WO status report
    if 'work order status report' in subject_lower and 'villasboulders.org' in sender_lower:
        return ('wo_status_report', 1.0, False)
    # Property report
    if 'your property report' in subject_lower or 'copy: your property report' in subject_lower:
        return ('property_report', 1.0, False)
    # Board report request alert
    if subject_lower.startswith('board report request:'):
        return ('property_report', 0.90, False)
    # Google Docs/Sheets comment notifications
    if 'docs.google.com' in sender_lower or 'comments-noreply' in sender_lower:
        if 'was edited recently' in subject_lower or 'shared' in subject_lower:
            return ('ops_alert', 0.80, False)
    # Keystone docs alert
    if 'new files in keystone portal' in subject_lower:
        return ('ops_alert', 0.95, False)
    # Broken links
    if 'broken link' in subject_lower:
        return ('ops_alert', 0.95, False)
    # Form notification stubs
    if 'form submissions detected' in subject_lower:
        # Distinguish WO vs HPPR vs generic
        if 'work order' in subject_lower:
            return ('wo_form', 0.95, False)
        elif 'planting' in subject_lower or 'removal' in subject_lower:
            return ('hppr_form', 0.95, False)
        return ('wo_form', 0.80, False)
    if 'work order received' in subject_lower or 'work order request' in subject_lower:
        return ('wo_form', 0.90, False)

    # --- 3. ARC family ---
    is_arc = (ARCFORM_RECIPIENT in recipients_lower or
              'architectural review request' in subject_lower)
    is_from_josh = JOSH_EMAIL in sender_lower
    is_from_dee = 'admin@villasboulders.org' in sender_lower or 'wmbuck' in sender_lower
    is_board_member = any(be in sender_lower for be in BOARD_EMAILS)

    if is_arc:
        # Check sender type FIRST — Josh's replies contain quoted form text
        if is_from_josh:
            return ('arc_manager_reply', 0.90, False)
        # Form submission: has the structured fields AND comes via Jotform relay
        # (not from a human reply that quotes the form)
        is_via_jotform = 'arcformrecipients' in sender_lower or 'jotform' in sender_lower
        if is_via_jotform and 'unit address in the villas' in body_lower and 'description of improvements' in body_lower:
            return ('arc_form_submission', 0.98, False)
        # Also check: body has form fields and comes from a non-human sender
        if 'unit address in the villas' in body_lower and 'description of improvements' in body_lower:
            # Could be a forward with the form embedded
            if is_from_dee and ('fwd' in subject_lower or 'forward' in subject_lower.lower()):
                if 'unit address' in body_lower or 'description of improvements' in body_lower:
                    return ('arc_form_forward', 0.85, False)
                return ('arc_process_discussion', 0.75, False)
            # Original form via Jotform (sender might be the homeowner via arcformrecipients)
            if ARCFORM_RECIPIENT in sender_lower or 'via arcformrecipients' in sender_lower:
                return ('arc_form_submission', 0.95, False)
        # Dee forward with nested form
        if is_from_dee and ('fwd' in subject_lower or 'forward' in subject_lower.lower()):
            if 'unit address' in body_lower or 'description of improvements' in body_lower:
                return ('arc_form_forward', 0.85, False)
            return ('arc_process_discussion', 0.75, False)
        # Board members discussing ARC form language
        if is_board_member:
            return ('arc_process_discussion', 0.75, False)
        # Fallback — still ARC-related
        return ('arc_form_submission', 0.60, False)

    # --- 4. HPPR/LBC forms ---
    if ('homeowner paid planting' in subject_lower or
        'planting and removal' in subject_lower or
        'lbcformrecipients' in recipients_lower or
        'landscape' in subject_lower and 'form' in subject_lower):
        return ('hppr_form', 0.90, False)
    # HPPR auto-reply "Thank you for filling out our form!"
    if 'thank you for filling out our form' in subject_lower and 'villasboulders.org' in sender_lower:
        return ('hppr_form', 0.80, False)

    # --- 5. WO form (individual) ---
    if 'workorders@villasboulders.org' in sender_lower:
        return ('wo_form', 0.90, False)
    # ARC Google Form notification (not Jotform, but Google Forms)
    if 'form notifications' in sender_lower and 'architectural review' in subject_lower:
        return ('arc_form_submission', 0.80, False)

    # --- 6. Josh Hall residual (non-ARC) ---
    if is_from_josh:
        return ('josh_direct', 0.85, False)

    # --- 7. Board governance ---
    if is_board_member or 'board@villasboulders.org' in recipients_lower:
        # Check for governance topics
        if any(kw in subject_lower for kw in ['insurance', 'guidelines', 'meeting',
               'bylaw', 'budget', 'reserve', 'design review', 'election',
               'design guidelines', 'broadlands vs']):
            return ('governance', 0.85, False)
        return ('board_email', 0.70, False)
    # Governance from admin/dee (design guidelines, etc.)
    if is_from_dee and any(kw in subject_lower for kw in ['design guidelines', 'broadlands vs',
                                                          'meeting notes', 'community outreach']):
        return ('governance', 0.75, False)

    # --- 8. Homeowner direct ---
    # Not from known system/board/josh — likely homeowner
    if not any(d in sender_lower for d in ['villasboulders.org', 'keystonepacific.com',
                                           'google.com', 'namecheap.com']):
        return ('homeowner_direct', 0.60, False)

    # --- 8b. Admin internal emails (from admin@ to non-board) ---
    if is_from_dee or 'admin@villasboulders.org' in sender_lower:
        # Classify admin internal by topic
        if 'insurance' in subject_lower or 'insurance document' in subject_lower:
            return ('governance', 0.70, False)
        if 'access' in subject_lower:
            return ('homeowner_direct', 0.65, False)
        if 'share request' in subject_lower or 'shared photos' in subject_lower:
            return ('ops_alert', 0.70, False)
        if 'session transcript' in subject_lower:
            return ('ops_alert', 0.70, False)
        if 'work order status' in subject_lower and 'report' not in subject_lower:
            return ('board_email', 0.65, False)
        if 'board report request' in subject_lower:
            return ('ops_alert', 0.70, False)
        if 'delivery status' in subject_lower or 'mailer-daemon' in subject_lower:
            return ('noise', 0.80, True)
        # Everything else from admin@ is internal ops
        return ('ops_alert', 0.60, False)

    # --- 9. Default ---
    return ('unclassified', 0.50, False)


# ============================================================
# ARC form parser
# ============================================================

ARC_FIELD_LABELS = [
    'Name',
    'Unit Address in the Villas',
    'Phone Number',
    'Email',
    'Description of Improvements',
    'Supporting Documentation',
    'Planned (approximate) Completion Date',
    'Homeowner Signature',
    'Submission Date',
]

def parse_arc_form(body):
    """
    Parse the concatenated ARC form email body.
    Uses label-based extraction.
    """
    text = strip_html(body)

    # Find positions of each label sequentially
    positions = []
    for i, label in enumerate(ARC_FIELD_LABELS):
        search_start = positions[-1]['pos'] + len(positions[-1]['label']) if positions else 0
        idx = text.find(label, search_start)
        if idx == -1:
            idx = text.lower().find(label.lower(), search_start)
        if idx != -1:
            positions.append({'label': label, 'pos': idx})

    result = {}
    for i, p in enumerate(positions):
        value_start = p['pos'] + len(p['label'])
        value_end = positions[i + 1]['pos'] if i + 1 < len(positions) else len(text)
        value = text[value_start:value_end].strip()

        label = p['label']
        if label == 'Name':
            result['homeowner_name'] = value
        elif label == 'Unit Address in the Villas':
            result['address'] = value
            result['parcel_code'] = standardize_address(value)
        elif label == 'Phone Number':
            result['phone'] = value
        elif label == 'Email':
            # Truncate at next field marker if concatenated
            result['email'] = value
        elif label == 'Description of Improvements':
            result['description'] = value
        elif label == 'Supporting Documentation':
            result['supporting_docs'] = value
        elif label == 'Planned (approximate) Completion Date':
            value = re.split(r'\s*I understand\s', value)[0].strip()
            result['planned_completion_date'] = value
        elif label == 'Homeowner Signature':
            result['signature'] = value
        elif label == 'Submission Date':
            result['submission_date'] = value

    return result


def detect_multiple_work_items(parsed):
    """
    Detect if an ARC form submission contains multiple distinct work items.
    Returns list of work item descriptions, or [description] if single.
    """
    desc = parsed.get('description', '')
    if not desc:
        return [desc]

    # Keywords that suggest distinct asset types
    asset_keywords = [
        ('window', 'window'),
        ('glass', 'glass'),
        ('door', 'door'),
        ('fence', 'fence'),
        ('railing', 'railing'),
        ('condenser', 'AC condenser'),
        ('ac ', 'AC unit'),
        ('patio', 'patio'),
        ('deck', 'deck'),
        ('roof', 'roof'),
        ('gutter', 'gutter'),
        ('siding', 'siding'),
        ('paint', 'painting'),
        ('lighting', 'lighting'),
        ('awning', 'awning'),
        ('step', 'step'),
        ('concrete', 'concrete'),
    ]

    found_types = []
    desc_lower = desc.lower()
    for keyword, label in asset_keywords:
        if keyword in desc_lower and label not in found_types:
            # Check it's not a substring of another word (e.g. "door" in "doorbell")
            # Simple heuristic: word boundary check
            if re.search(r'\b' + re.escape(keyword) + r'\b', desc_lower):
                found_types.append(label)

    # If 2+ distinct asset types, split into separate items
    if len(found_types) >= 2:
        # Return the original description as single item — splitting is heuristic
        # and better done by a human. But flag it.
        return [desc], found_types

    return [desc], None


# ============================================================
# ARC manager reply parser (Josh Hall decisions)
# ============================================================

def parse_arc_manager_reply(body, subject):
    """
    Detect decision type from Josh Hall's reply.
    """
    text = strip_html(body).lower()

    decision = None
    rationale = None

    if 'do not need approval' in text or 'like for like' in text or 'like-for-like' in text:
        decision = 'no_approval_needed'
        # Extract the sentence with the rationale
        for sentence in re.split(r'[.!?]', text):
            if 'no approval' in sentence or 'like for like' in sentence or 'like-for-like' in sentence:
                rationale = sentence.strip().capitalize()
                break

    elif 'entering this into the system' in text or "enter this into the system" in text:
        decision = 'pending'
        rationale = 'Entered into Keystone system'

    elif "can't open" in text or 'cannot open' in text or 'need' in text or 'is there information' in text:
        decision = 'info_requested'
        # Extract what's needed
        for sentence in re.split(r'[.!?]', text):
            if "can't open" in sentence or 'cannot open' in sentence or 'need' in sentence or 'is there information' in sentence:
                rationale = sentence.strip().capitalize()
                break

    return {
        'decision': decision,
        'rationale': rationale,
        'body_preview': text[:500],
    }


# ============================================================
# WO status report parser
# ============================================================

WO_STATUS_SECTIONS = [
    'PENDING BOARD REVIEW',
    'AWAITING QUOTE',
    'OPEN',
    'SERVICE REQUEST',
    'SCHEDULED',
    'ON HOLD',
    'MONITORED',
]

def parse_wo_status_report(body):
    """
    Parse the Keystone work order status report.
    Returns structured data with sections and WO entries.
    """
    text = strip_html(body, preserve_newlines=True)

    lines = text.split('\n')
    result = {
        'report_type': 'wo_status_report',
        'summary': {},
        'sections': []
    }

    # Parse summary line
    for line in lines:
        m = re.match(r'Open work orders:\s*(\d+)', line.strip(), re.IGNORECASE)
        if m:
            result['summary']['open_work_orders'] = int(m.group(1))
            break

    # Detect scrape failure (open_count == 0 when likely >10)
    open_count = result['summary'].get('open_work_orders', -1)
    result['summary']['scrape_failure_suspected'] = (open_count == 0)

    current_section = None
    current_count = 0
    current_entries = []

    for line in lines:
        stripped = line.strip()

        # Check for section header
        for sec in WO_STATUS_SECTIONS:
            pattern = re.compile(rf'^{re.escape(sec)}\s*\((\d+)\)', re.IGNORECASE)
            m = pattern.match(stripped)
            if m:
                if current_section:
                    result['sections'].append({
                        'status': current_section,
                        'count': current_count,
                        'entries': current_entries
                    })
                current_section = sec
                current_count = int(m.group(1))
                current_entries = []
                break
        else:
            # WO entry line: "WO#99326  13668BP1  Kim Gilbert  [7/20/2026]"
            wo_match = re.match(
                r'WO#(\d+)\s+(\S+)\s+(.+?)\s+\[(\d+/\d+/\d+)\]',
                stripped
            )
            if wo_match and current_section:
                entry = {
                    'wo_number': wo_match.group(1),
                    'parcel_code': wo_match.group(2),
                    'homeowner_name': wo_match.group(3).strip(),
                    'date': wo_match.group(4),
                    'description': None,
                    'vendor': None
                }
                current_entries.append(entry)
                continue

            # Description or vendor line
            if stripped and current_section and current_entries and not stripped.startswith('='):
                vendor_match = re.match(r'Vendor:\s*(.+)', stripped, re.IGNORECASE)
                if vendor_match:
                    current_entries[-1]['vendor'] = vendor_match.group(1).strip()
                elif not current_entries[-1]['description']:
                    current_entries[-1]['description'] = stripped
                else:
                    current_entries[-1]['description'] += ' ' + stripped

    # Save last section
    if current_section:
        result['sections'].append({
            'status': current_section,
            'count': current_count,
            'entries': current_entries
        })

    return result


# ============================================================
# Utility functions
# ============================================================

def strip_html(text, preserve_newlines=False):
    """Remove HTML tags and normalize whitespace."""
    if not text:
        return ''
    if preserve_newlines:
        text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</p>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'<[^>]+>', '', text)
    else:
        text = re.sub(r'<[^>]+>', ' ', text)
    text = text.replace('&nbsp;', ' ').replace('&', '&')
    text = re.sub(r'<', '<', text)
    text = re.sub(r'>', '>', text)
    text = re.sub(r'"', '"', text)
    text = re.sub(r'\s+', ' ', text).strip() if not preserve_newlines else text
    return text


def parse_email_address(raw):
    """Parse 'Name <email@domain>' into (name, email)."""
    if not raw:
        return '', ''
    m = re.match(r'^(.*?)\s*<(.+?)>\s*$', raw)
    if m:
        return m.group(1).strip().strip('"\''), m.group(2).strip().lower()
    # Just an email
    if '@' in raw:
        return '', raw.strip().lower()
    return raw.strip(), ''


def extract_recipients(header_value):
    """Extract list of email addresses from To/Cc header."""
    if not header_value:
        return []
    emails = re.findall(r'<(.+?)>', header_value)
    if not emails:
        # No angle brackets — split by comma
        parts = [p.strip().lower() for p in header_value.split(',')]
        emails = [p for p in parts if '@' in p]
    return [e.lower() for e in emails]


def normalize_subject(subject):
    """Strip Re:/Fwd: prefixes from subject."""
    if not subject:
        return ''
    s = subject.strip()
    while True:
        s = re.sub(r'^(re|fwd|fw):\s*', '', s, flags=re.IGNORECASE)
        if s == subject.strip():
            break
        subject = s
    return s.strip()


# ============================================================
# Processed email tracking
# ============================================================

def load_processed():
    """Load the set of already-processed Gmail message IDs."""
    try:
        with open(PROCESSED_FILE, 'r') as f:
            data = json.load(f)
            return set(data.get('processed_ids', []))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()

def save_processed(processed_ids):
    """Save the set of processed message IDs."""
    os.makedirs(os.path.dirname(PROCESSED_FILE), exist_ok=True)
    with open(PROCESSED_FILE, 'w') as f:
        json.dump({
            'processed_ids': sorted(list(processed_ids)),
            'last_updated': datetime.now(timezone.utc).isoformat()
        }, f, indent=2)

# ============================================================
# Gmail access
# ============================================================

def get_gmail_service(delegated_email='admin@villasboulders.org'):
    """Create Gmail service using service account impersonation."""
    if service_account is None:
        raise ImportError("google-api-python-client not available on this host")
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=SCOPES,
        subject=delegated_email
    )
    return build('gmail', 'v1', credentials=credentials)

def get_recent_emails(service, days=1, debug=False, max_results=500, mailbox_email=None):
    """Fetch emails from the last N days."""
    after_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%Y/%m/%d')
    query = f'after:{after_date}'

    if debug:
        print(f"[DEBUG] Gmail query: {query}", file=sys.stderr)

    all_messages = []
    page_token = None

    while True:
        params = {
            'userId': 'me',
            'q': query,
            'maxResults': min(100, max_results)
        }
        if page_token:
            params['pageToken'] = page_token

        results = service.users().messages().list(**params).execute()
        messages = results.get('messages', [])
        all_messages.extend(messages)

        if debug:
            print(f"[DEBUG] Fetched page: {len(messages)} messages (total: {len(all_messages)})", file=sys.stderr)

        page_token = results.get('nextPageToken')
        if not page_token or len(all_messages) >= max_results:
            break

    if debug:
        print(f"[DEBUG] Total messages to process: {len(all_messages)}", file=sys.stderr)

    emails = []
    for msg_ref in all_messages:
        try:
            msg = service.users().messages().get(
                userId='me',
                id=msg_ref['id'],
                format='full'
            ).execute()

            headers = msg.get('payload', {}).get('headers', [])
            header_dict = {h['name'].lower(): h['value'] for h in headers}

            subject = header_dict.get('subject', '')
            sender = header_dict.get('from', '')
            to = header_dict.get('to', '')
            cc = header_dict.get('cc', '')
            date_str = header_dict.get('date', '')
            in_reply_to = header_dict.get('in-reply-to', '')
            message_id_header = header_dict.get('message-id', '')

            body_text, body_html = extract_bodies(msg.get('payload', {}))

            # Parse date
            try:
                received_date = parsedate_to_datetime(date_str) if date_str else None
            except Exception:
                received_date = None

            from_name, from_email = parse_email_address(sender)
            to_list = extract_recipients(to)
            cc_list = extract_recipients(cc)

            emails.append({
                'gmail_id': msg['id'],
                'gmail_message_id': message_id_header or msg['id'],
                'thread_id': msg.get('threadId', ''),
                'in_reply_to': in_reply_to,
                'subject': subject,
                'from_name': from_name,
                'from_email': from_email,
                'to_recipients': to_list,
                'cc_recipients': cc_list,
                'received_date': received_date,
                'body_text': body_text,
                'body_html': body_html,
                'raw_headers': header_dict
            })
        except Exception as e:
            if debug:
                print(f"[DEBUG] Error fetching message {msg_ref['id']}: {e}", file=sys.stderr)
            continue

    return emails

def get_recent_emails_imap(mailbox, days=1, debug=False, max_results=500):
    """Fetch emails from an IMAP mailbox (e.g. mcdonaldbuckhoa@gmail.com)."""
    import imaplib
    import ssl as ssl_module
    from email.utils import parsedate_to_datetime

    host = mailbox['host']
    port = mailbox['port']
    email_addr = mailbox['email']
    with open(mailbox['password_file']) as f:
        pw = f.read().strip()

    ctx = ssl_module.create_default_context()
    imap = imaplib.IMAP4_SSL(host, port, ssl_context=ctx)
    imap.login(email_addr, pw)

    # Use All Mail to get everything, not just INBOX
    imap.select('"[Gmail]/All Mail"')

    after_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%d-%b-%Y')
    status, messages = imap.search(None, f'(SINCE {after_date})')
    msg_ids = messages[0].split()
    if debug:
        print(f"[DEBUG] IMAP {email_addr}: {len(msg_ids)} messages since {after_date}", file=sys.stderr)

    # Limit
    msg_ids = msg_ids[-max_results:]

    emails = []
    for mid in msg_ids:
        try:
            status, msg_data = imap.fetch(mid, '(RFC822)')
            if status != 'OK':
                continue
            import email as email_module
            msg = email_module.message_from_bytes(msg_data[0][1])

            headers = {h.lower(): msg.get(h, '') for h in ['Subject', 'From', 'To', 'Cc', 'Date', 'In-Reply-To', 'Message-ID']}

            body_text = ''
            body_html = ''
            if msg.is_multipart():
                for part in msg.walk():
                    ct = part.get_content_type()
                    if ct == 'text/plain' and not body_text:
                        payload = part.get_payload(decode=True)
                        if payload:
                            body_text = payload.decode(part.get_content_charset() or 'utf-8', errors='replace')
                    elif ct == 'text/html' and not body_html:
                        payload = part.get_payload(decode=True)
                        if payload:
                            body_html = payload.decode(part.get_content_charset() or 'utf-8', errors='replace')
            else:
                payload = msg.get_payload(decode=True)
                if payload:
                    body_text = payload.decode(msg.get_content_charset() or 'utf-8', errors='replace')

            try:
                received_date = parsedate_to_datetime(headers.get('date', '')) if headers.get('date') else None
            except Exception:
                received_date = None

            from_name, from_email = parse_email_address(headers.get('from', ''))
            to_list = extract_recipients(headers.get('to', ''))
            cc_list = extract_recipients(headers.get('cc', ''))

            # Use Message-ID header as unique ID, fall back to IMAP UID
            message_id = headers.get('message-id', '') or mid.decode()
            # Build a synthetic thread_id from subject normalization (IMAP doesn't have thread IDs)
            thread_id = f"imap:{normalize_subject(headers.get('subject', ''))[:50]}"

            emails.append({
                'gmail_id': mid.decode(),
                'gmail_message_id': message_id,
                'thread_id': thread_id,
                'in_reply_to': headers.get('in-reply-to', ''),
                'subject': headers.get('subject', ''),
                'from_name': from_name,
                'from_email': from_email,
                'to_recipients': to_list,
                'cc_recipients': cc_list,
                'received_date': received_date,
                'body_text': body_text,
                'body_html': body_html,
                'raw_headers': headers
            })
        except Exception as e:
            if debug:
                print(f"[DEBUG] IMAP error fetching message: {e}", file=sys.stderr)
            continue

    imap.logout()
    return emails


def extract_bodies(payload):
    """Extract text/plain and text/html bodies from Gmail message payload."""
    body_text = ''
    body_html = ''

    def decode_body_data(data):
        if not data:
            return ''
        data = data.replace('-', '+').replace('_', '/')
        padding = 4 - len(data) % 4
        if padding < 4:
            data += '=' * padding
        try:
            return base64.b64decode(data).decode('utf-8', errors='replace')
        except Exception:
            return base64.b64decode(data).decode('latin-1', errors='replace')

    def walk(part):
        nonlocal body_text, body_html
        mime_type = part.get('mimeType', '')
        if 'body' in part and part['body'].get('data'):
            content = decode_body_data(part['body']['data'])
            if mime_type == 'text/plain' and not body_text:
                body_text = content
            elif mime_type == 'text/html' and not body_html:
                body_html = content
        if 'parts' in part:
            for p in part['parts']:
                walk(p)

    walk(payload)
    return body_text, body_html

# ============================================================
# Supabase persistence
# ============================================================

def get_db_connection():
    """Get psycopg2 connection to Supabase."""
    if psycopg2 is None:
        raise ImportError("psycopg2 not available on this host")
    with open(SUPABASE_PASSWORD_FILE, 'r') as f:
        password = f.read().strip()
    return psycopg2.connect(
        host=SUPABASE_HOST,
        port=SUPABASE_PORT,
        dbname=SUPABASE_DB,
        user=SUPABASE_USER,
        password=password
    )

def upsert_email_message(conn, email_data, classification, confidence, is_noise, parse_payload):
    """Insert or update an email_message record."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO email_message (
                gmail_message_id, gmail_thread_id, in_reply_to, direction,
                from_name, from_email, to_recipients, cc_recipients,
                subject, body_text, body_html, received_date,
                classification, classification_confidence, is_noise,
                parse_payload, raw_headers
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (gmail_message_id) DO UPDATE SET
                classification = EXCLUDED.classification,
                classification_confidence = EXCLUDED.classification_confidence,
                is_noise = EXCLUDED.is_noise,
                parse_payload = EXCLUDED.parse_payload
            RETURNING id
        """, (
            email_data['gmail_message_id'],
            email_data['thread_id'],
            email_data['in_reply_to'] or None,
            determine_direction(email_data),
            email_data['from_name'],
            email_data['from_email'],
            email_data['to_recipients'],
            email_data['cc_recipients'],
            email_data['subject'],
            email_data['body_text'][:50000],
            email_data['body_html'][:50000] if email_data['body_html'] else None,
            email_data['received_date'],
            classification,
            confidence,
            is_noise,
            json.dumps(parse_payload) if parse_payload else None,
            json.dumps(email_data.get('raw_headers', {}))
        ))
        result = cur.fetchone()
        email_uuid = result[0] if result else None
    return email_uuid

def determine_direction(email_data):
    """Determine if email is inbound, outbound, or internal."""
    from_email = (email_data.get('from_email') or '').lower()
    to_list = email_data.get('to_recipients', [])
    cc_list = email_data.get('cc_recipients', [])
    all_recipients = to_list + cc_list

    is_from_admin = 'villasboulders.org' in from_email
    is_to_admin = any('villasboulders.org' in r for r in all_recipients)

    if is_from_admin and is_to_admin:
        return 'internal'
    elif is_from_admin:
        return 'outbound'
    else:
        return 'inbound'

def upsert_email_thread(conn, thread_id, subject, received_date, classification, parcel_code=None):
    """Insert or update an email_thread record."""
    if not thread_id:
        return
    normalized = normalize_subject(subject)

    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO email_thread (
                gmail_thread_id, subject_normalized,
                first_message_at, last_message_at,
                message_count, primary_classification, primary_parcel_code
            ) VALUES (
                %s, %s, %s, %s, 1, %s, %s
            )
            ON CONFLICT (gmail_thread_id) DO UPDATE SET
                last_message_at = GREATEST(email_thread.last_message_at, EXCLUDED.last_message_at),
                first_message_at = LEAST(email_thread.first_message_at, EXCLUDED.first_message_at),
                message_count = email_thread.message_count + 1,
                primary_classification = COALESCE(EXCLUDED.primary_classification, email_thread.primary_classification),
                primary_parcel_code = COALESCE(EXCLUDED.primary_parcel_code, email_thread.primary_parcel_code)
        """, (
            thread_id, normalized, received_date, received_date,
            classification, parcel_code
        ))
    conn.commit()

def insert_wo_snapshots(conn, email_uuid, parsed_report, snapshot_date):
    """Insert WO status snapshot records from a parsed WO status report."""
    if not email_uuid or not parsed_report:
        return 0

    count = 0
    with conn.cursor() as cur:
        for section in parsed_report.get('sections', []):
            for entry in section.get('entries', []):
                cur.execute("""
                    INSERT INTO wo_status_snapshot (
                        source_email_id, snapshot_date, wo_number, parcel_code,
                        homeowner_name, status_raw, description, vendor, created_date_raw
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    email_uuid, snapshot_date,
                    entry.get('wo_number'), entry.get('parcel_code'),
                    entry.get('homeowner_name'), section.get('status'),
                    entry.get('description'), entry.get('vendor'),
                    entry.get('date')
                ))
                count += 1
    conn.commit()
    return count

# ============================================================
# Main processing pipeline
# ============================================================

def process_email(email_data, debug=False, dry_run=False, conn=None):
    """
    Process a single email: classify, parse, and optionally persist.
    Returns structured dict with results.
    """
    subject = email_data['subject']
    sender = email_data['from_email']
    sender_full = f"{email_data['from_name']} <{email_data['from_email']}>"
    recipients = ', '.join(email_data['to_recipients'])
    body = email_data['body_text'] or email_data['body_html'] or ''

    classification, confidence, is_noise = classify_email(
        subject, sender_full, recipients, body
    )

    if debug:
        print(f"[DEBUG] {email_data['gmail_message_id'][:20]}... → {classification} ({confidence:.2f}) | {subject[:60]}", file=sys.stderr)

    result = {
        'gmail_message_id': email_data['gmail_message_id'],
        'thread_id': email_data['thread_id'],
        'classification': classification,
        'confidence': confidence,
        'is_noise': is_noise,
        'subject': subject,
        'from': sender_full,
        'received_date': email_data['received_date'].isoformat() if email_data['received_date'] else None,
        'parsed_data': None,
        'actions': []
    }

    parse_payload = {}

    # --- Per-type handlers ---

    if classification == 'noise':
        result['actions'].append('skipped: noise')
        # Still record in email_message for tracking
        if not dry_run and conn:
            email_uuid = upsert_email_message(conn, email_data, classification, confidence, is_noise, parse_payload)
            result['db_id'] = str(email_uuid) if email_uuid else None
        return result

    if classification == 'arc_form_submission':
        parsed = parse_arc_form(body)
        parse_payload = parsed
        result['parsed_data'] = parsed

        if parsed.get('address'):
            parcel = standardize_address(parsed['address'])
            result['parcel_code'] = parcel
            result['actions'].append(f'address_match: {parsed["address"]} → {parcel}')

        items, multi_types = detect_multiple_work_items(parsed)
        if multi_types:
            result['actions'].append(f'multi_item_detected: {multi_types}')
            result['multi_item_types'] = multi_types
        result['actions'].append(f'would_create_work_item: arc_request for {parsed.get("homeowner_name", "?")}')

        if not dry_run and conn:
            email_uuid = upsert_email_message(conn, email_data, classification, confidence, is_noise, parse_payload)
            result['db_id'] = str(email_uuid) if email_uuid else None
            # Update thread
            upsert_email_thread(conn, email_data['thread_id'], subject,
                               email_data['received_date'], classification,
                               result.get('parcel_code'))

    elif classification == 'arc_manager_reply':
        parsed = parse_arc_manager_reply(body, subject)
        parse_payload = parsed
        result['parsed_data'] = parsed
        result['actions'].append(f'detected_decision: {parsed.get("decision", "none")}')

        if not dry_run and conn:
            email_uuid = upsert_email_message(conn, email_data, classification, confidence, is_noise, parse_payload)
            result['db_id'] = str(email_uuid) if email_uuid else None
            upsert_email_thread(conn, email_data['thread_id'], subject,
                               email_data['received_date'], classification)

    elif classification == 'wo_status_report':
        parsed = parse_wo_status_report(body)
        parse_payload = parsed
        result['parsed_data'] = parsed

        wo_count = sum(len(s.get('entries', [])) for s in parsed.get('sections', []))
        result['actions'].append(f'parsed {wo_count} WO entries across {len(parsed.get("sections", []))} sections')

        if parsed.get('summary', {}).get('scrape_failure_suspected'):
            result['actions'].append('WARNING: scrape failure suspected (open_count=0)')

        if not dry_run and conn:
            email_uuid = upsert_email_message(conn, email_data, classification, confidence, is_noise, parse_payload)
            result['db_id'] = str(email_uuid) if email_uuid else None
            if email_uuid and email_data['received_date']:
                snap_count = insert_wo_snapshots(conn, email_uuid, parsed, email_data['received_date'])
                result['actions'].append(f'inserted {snap_count} WO snapshots')
            upsert_email_thread(conn, email_data['thread_id'], subject,
                               email_data['received_date'], classification)

    elif classification == 'arc_form_forward':
        # Forwarded ARC form — parse the nested form fields
        parsed = parse_arc_form(body)
        parse_payload = parsed
        result['parsed_data'] = parsed
        if parsed.get('address'):
            parcel = standardize_address(parsed['address'])
            result['parcel_code'] = parcel
            result['actions'].append(f'address_match: {parsed["address"]} → {parcel}')
        result['actions'].append(f'logged_as_arc_form_forward for {parsed.get("homeowner_name", "?")}')

        if not dry_run and conn:
            email_uuid = upsert_email_message(conn, email_data, classification, confidence, is_noise, parse_payload)
            result['db_id'] = str(email_uuid) if email_uuid else None
            upsert_email_thread(conn, email_data['thread_id'], subject,
                               email_data['received_date'], classification,
                               result.get('parcel_code'))

    elif classification == 'arc_process_discussion':
        parse_payload = {'body_preview': body[:1000]}
        result['parsed_data'] = parse_payload
        result['actions'].append('logged_as_arc_process')

        if not dry_run and conn:
            email_uuid = upsert_email_message(conn, email_data, classification, confidence, is_noise, parse_payload)
            result['db_id'] = str(email_uuid) if email_uuid else None
            upsert_email_thread(conn, email_data['thread_id'], subject,
                               email_data['received_date'], classification)

    elif classification in ('board_email', 'governance', 'josh_direct', 'homeowner_direct'):
        parse_payload = {'body_preview': body[:1000]}
        result['parsed_data'] = parse_payload

        # Attempt address extraction for homeowner direct
        if classification == 'homeowner_direct':
            # Try to find an address in the body
            addr_match = re.search(r'\b(\d{5}\s+(?:Rock Point|Stone Circle|Boulder Point|Plaster Point|Broadlands|Boulder Circle)[^,\n]*(?:#|Unit|unit)?\s*\d*)\b', body)
            if addr_match:
                parcel = standardize_address(addr_match.group(0))
                result['parcel_code'] = parcel
                result['actions'].append(f'address_extracted: {parcel}')
            result['actions'].append('logged_as_homeowner_direct')

        if not dry_run and conn:
            email_uuid = upsert_email_message(conn, email_data, classification, confidence, is_noise, parse_payload)
            result['db_id'] = str(email_uuid) if email_uuid else None
            upsert_email_thread(conn, email_data['thread_id'], subject,
                               email_data['received_date'], classification)

    elif classification in ('wo_form', 'hppr_form', 'property_report', 'ops_alert'):
        parse_payload = {'body_preview': body[:1000]}
        result['parsed_data'] = parse_payload
        result['actions'].append(f'logged_as_{classification}')

        if not dry_run and conn:
            email_uuid = upsert_email_message(conn, email_data, classification, confidence, is_noise, parse_payload)
            result['db_id'] = str(email_uuid) if email_uuid else None
            upsert_email_thread(conn, email_data['thread_id'], subject,
                               email_data['received_date'], classification)

    elif classification == 'unclassified':
        parse_payload = {'body_preview': body[:1000]}
        result['parsed_data'] = parse_payload
        result['actions'].append('needs_manual_review')

        if not dry_run and conn:
            email_uuid = upsert_email_message(conn, email_data, classification, confidence, is_noise, parse_payload)
            result['db_id'] = str(email_uuid) if email_uuid else None
            upsert_email_thread(conn, email_data['thread_id'], subject,
                               email_data['received_date'], classification)

    return result


# ============================================================
# Entry point
# ============================================================

def send_report_email(output):
    """Send a daily summary email to Dee via sendmail."""
    import subprocess

    emails = output.get('emails', [])
    # Categorize for the report
    new_items = []  # ARC forms, WO forms, HPPR forms — things that need tracking
    status_reports = []  # WO status reports — snapshots, not new items
    board_emails = []
    homeowner_emails = []
    noise_count = 0
    other_emails = []

    for e in emails:
        cls = e.get('classification', '')
        if cls == 'noise':
            noise_count += 1
        elif cls == 'wo_status_report':
            status_reports.append(e)
        elif cls in ('arc_form_submission', 'arc_form_forward', 'wo_form', 'hppr_form'):
            new_items.append(e)
        elif cls in ('board_email', 'governance', 'josh_direct', 'arc_manager_reply', 'arc_process_discussion'):
            board_emails.append(e)
        elif cls == 'homeowner_direct':
            homeowner_emails.append(e)
        else:
            other_emails.append(e)

    # Build the email body
    lines = []
    lines.append(f"HOA Email Processor - Daily Summary")
    lines.append(f"Run at: {output.get('run_at', '?')}")
    lines.append(f"Lookback: {output.get('lookback_days', 1)} day(s)")
    lines.append(f"Total checked: {output.get('total_checked', 0)}")
    lines.append(f"Newly processed: {output.get('processed_count', 0)}")
    lines.append(f"Classification breakdown: {output.get('classification_counts', {})}")
    lines.append(f"Skipped (already processed): {output.get('skipped_already_processed', 0)}")
    lines.append("")
    lines.append(f"--- SUMMARY ---")
    lines.append(f"  New trackable items (ARC/WO/HPPR forms): {len(new_items)}")
    lines.append(f"  WO status reports (snapshots only, not new items): {len(status_reports)}")
    lines.append(f"  Board/governance emails: {len(board_emails)}")
    lines.append(f"  Homeowner direct emails: {len(homeowner_emails)}")
    lines.append(f"  Noise filtered: {noise_count}")
    lines.append(f"  Other: {len(other_emails)}")
    lines.append("")

    if new_items:
        lines.append("=== NEW TRACKABLE ITEMS ===")
        for e in new_items:
            lines.append(f"  [{e.get('classification', '?')}] {e.get('subject', '?')[:80]}")
            lines.append(f"    From: {e.get('from', '?')[:80]}")
            lines.append(f"    Date: {e.get('received_date', '?')}")
            parsed = e.get('parsed_data', {})
            if parsed:
                if parsed.get('homeowner_name'):
                    lines.append(f"    Homeowner: {parsed.get('homeowner_name')}")
                if parsed.get('address'):
                    lines.append(f"    Address: {parsed.get('address')}")
                if parsed.get('description'):
                    lines.append(f"    Description: {parsed.get('description', '')[:120]}")
            actions = e.get('actions', [])
            if actions:
                lines.append(f"    Actions: {'; '.join(actions)}")
            if e.get('db_id'):
                lines.append(f"    DB ID: {e.get('db_id')}")
            lines.append("")

    if status_reports:
        lines.append("=== WO STATUS REPORTS (snapshots only — NOT new work items) ===")
        for e in status_reports:
            lines.append(f"  Subject: {e.get('subject', '?')[:80]}")
            lines.append(f"    Date: {e.get('received_date', '?')}")
            parsed = e.get('parsed_data', {})
            if parsed:
                summary = parsed.get('summary', {})
                lines.append(f"    Open WOs: {summary.get('open_work_orders', '?')}")
                if summary.get('scrape_failure_suspected'):
                    lines.append(f"    WARNING: Scrape failure suspected!")
                for sec in parsed.get('sections', []):
                    lines.append(f"    {sec.get('status')}: {sec.get('count')} entries")
            actions = e.get('actions', [])
            if actions:
                lines.append(f"    Actions: {'; '.join(actions)}")
            lines.append("")

    if board_emails:
        lines.append("=== BOARD / GOVERNANCE EMAILS ===")
        for e in board_emails:
            lines.append(f"  [{e.get('classification', '?')}] {e.get('subject', '?')[:80]}")
            lines.append(f"    From: {e.get('from', '?')[:60]}")
            lines.append("")

    if homeowner_emails:
        lines.append("=== HOMEOWNER DIRECT EMAILS ===")
        for e in homeowner_emails:
            lines.append(f"  {e.get('subject', '?')[:80]}")
            lines.append(f"    From: {e.get('from', '?')[:60]}")
            if e.get('parcel_code'):
                lines.append(f"    Parcel: {e.get('parcel_code')}")
            lines.append("")

    if other_emails:
        lines.append("=== OTHER ===")
        for e in other_emails:
            lines.append(f"  [{e.get('classification', '?')}] {e.get('subject', '?')[:80]}")
            lines.append("")

    if not emails:
        lines.append("(No new emails processed)")

    body = '\n'.join(lines)

    # Send via sendmail
    msg = f"From: {REPORT_FROM}\nTo: {REPORT_TO}\nSubject: {REPORT_SUBJECT} - {datetime.now().strftime('%Y-%m-%d')}\nContent-Type: text/plain; charset=utf-8\n\n{body}"

    try:
        proc = subprocess.run(['/usr/sbin/sendmail', '-t'], input=msg.encode('utf-8'),
                            capture_output=True, timeout=30)
        if proc.returncode != 0:
            print(f"[WARNING] sendmail returned {proc.returncode}: {proc.stderr.decode()}", file=sys.stderr)
        else:
            print(f"[INFO] Report email sent to {REPORT_TO}", file=sys.stderr)
    except Exception as e:
        print(f"[WARNING] Failed to send report email: {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description='HOA Email Processor v2')
    parser.add_argument('--days', type=int, default=1, help='Look back N days (default: 1)')
    parser.add_argument('--dry-run', action='store_true', help='Process but do not write to Supabase')
    parser.add_argument('--debug', action='store_true', help='Print debug info to stderr')
    parser.add_argument('--report-email', action='store_true', help='Send daily summary email to Dee')
    args = parser.parse_args()

    # Load processed IDs for dedup
    processed_ids = load_processed()
    if args.debug:
        print(f"[DEBUG] Already processed: {len(processed_ids)} emails", file=sys.stderr)

    # Connect to Supabase (unless dry-run)
    conn = None
    if not args.dry_run:
        try:
            conn = get_db_connection()
            if args.debug:
                print("[DEBUG] Connected to Supabase", file=sys.stderr)
        except Exception as e:
            print(json.dumps({
                'status': 'error',
                'error': f'Supabase connection failed: {str(e)}',
                'hint': 'Run with --dry-run to skip database writes'
            }, indent=2))
            sys.exit(1)

    # Process emails from all configured mailboxes
    all_results = []
    all_new_processed = set()
    all_classification_counts = {}
    total_checked = 0

    for mailbox in MAILBOXES:
        mb_email = mailbox['email']
        if args.debug:
            print(f"[DEBUG] Processing mailbox: {mb_email}", file=sys.stderr)

        # Connect to this mailbox
        try:
            if mailbox['type'] == 'service_account':
                service = get_gmail_service(mb_email)
                emails = get_recent_emails(service, days=args.days, debug=args.debug, mailbox_email=mb_email)
            elif mailbox['type'] == 'imap':
                emails = get_recent_emails_imap(mailbox, days=args.days, debug=args.debug)
            else:
                continue
        except Exception as e:
            if args.debug:
                print(f"[DEBUG] Error connecting to {mb_email}: {e}", file=sys.stderr)
            continue

        # Process each email from this mailbox
        results = []
        new_processed = set()
        classification_counts = {}

        for email_data in emails:
            msg_id = email_data['gmail_message_id']

            # Skip already-processed emails (dedup across mailboxes)
            full_id = f"{mb_email}:{msg_id}"
            if full_id in processed_ids:
                if args.debug:
                    print(f"[DEBUG] Skipping already-processed: {full_id[:40]}...", file=sys.stderr)
                continue

            try:
                result = process_email(email_data, debug=args.debug, dry_run=args.dry_run, conn=conn)
                result['mailbox'] = mb_email
                results.append(result)
                new_processed.add(full_id)

                cls = result['classification']
                classification_counts[cls] = classification_counts.get(cls, 0) + 1

            except Exception as e:
                if args.debug:
                    print(f"[DEBUG] Error processing {full_id[:40]}...: {e}", file=sys.stderr)
                    traceback.print_exc(file=sys.stderr)
                results.append({
                    'gmail_message_id': msg_id,
                    'mailbox': mb_email,
                    'error': str(e),
                    'subject': email_data['subject'],
                    'from': email_data['from_email'],
                })

        all_results.extend(results)
        all_new_processed |= new_processed
        for cls, count in classification_counts.items():
            all_classification_counts[cls] = all_classification_counts.get(cls, 0) + count
        total_checked += len(emails)

        if args.debug:
            print(f"[DEBUG] {mb_email}: processed {len(results)} emails", file=sys.stderr)

    # Save updated processed IDs
    all_processed = processed_ids | all_new_processed
    save_processed(all_processed)

    # Close DB connection
    if conn:
        conn.close()

    # Output results
    output = {
        'status': 'success',
        'dry_run': args.dry_run,
        'processed_count': len(all_results),
        'total_checked': total_checked,
        'skipped_already_processed': total_checked - len(all_results) - sum(1 for r in all_results if 'error' in r),
        'lookback_days': args.days,
        'run_at': datetime.now(timezone.utc).isoformat(),
        'classification_counts': all_classification_counts,
        'emails': all_results
    }

    # Send report email if requested
    if args.report_email:
        send_report_email(output)

    print(json.dumps(output, indent=2, default=str))

if __name__ == '__main__':
    main()
