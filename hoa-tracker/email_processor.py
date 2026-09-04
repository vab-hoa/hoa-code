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
    python3 email_processor.py [--days N] [--dry-run] [--debug] [--notify]

Options:
    --days N     Look back N days (default: 1)
    --dry-run    Process emails but don't write to Supabase
    --debug      Print debug info to stderr
    --notify     Send email notification for each new work item created
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
MAILBOXES = [
    {'type': 'service_account', 'email': 'admin@villasboulders.org'},
    {'type': 'imap', 'email': 'mcdonaldbuckhoa@gmail.com',
     'host': 'imap.gmail.com', 'port': 993,
     'password_file': '/home/dee/hoa-code/hoa-tracker/secrets/.gmail_pw_mcdonaldbuckhoa'},
]
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

PROCESSED_FILE = '/home/dee/hoa-tracker/.processed_emails.json'

# Supabase connection (read from env or password file)
SUPABASE_HOST = 'db.obveytoovkzjrpzrhrim.supabase.co'
SUPABASE_PORT = 5432
SUPABASE_DB = 'postgres'
SUPABASE_USER = 'postgres'
SUPABASE_PASSWORD_FILE = '/home/dee/hoa-code/hoa-tracker/secrets/.supabase_db_password'

# Supabase Storage (for attachment uploads)
SUPABASE_URL = 'https://obveytoovkzjrpzrhrim.supabase.co'
SUPABASE_SERVICE_ROLE_KEY_FILE = '/tmp/hoa_processor/.supabase_service_role_key'
SUPABASE_STORAGE_BUCKET = 'work-item-documents'
MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024  # 10MB limit

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
ARCFORM_RECIPIENT = 'arcformrecipients@villasboulders.org'

# Classifications that create work items (trigger notifications when --notify is on)
WORK_ITEM_CLASSIFICATIONS = {'arc_form_submission', 'arc_form_forward', 'wo_form', 'hppr_form'}

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
    'strongroomsolutions.com',  # Invoice lockbox - classify separately
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

    # --- 2b. Invoice lockbox (Strongroom) ---
    if 'strongroomsolutions.com' in sender_lower or 'payableslockbox' in sender_lower:
        return ('invoice_pending', 0.95, False)

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
              'architectural review request' in subject_lower or
              'vab arc request' in subject_lower or
              re.search(r'\barc request\b', subject_lower) is not None)
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
        # Fallback — ARC-related but not a form submission
        # Only treat as form submission if actual form fields are present;
        # otherwise it's a discussion/reply in an ARC thread
        if 'unit address in the villas' in body_lower and 'description of improvements' in body_lower:
            return ('arc_form_submission', 0.60, False)
        return ('arc_process_discussion', 0.60, False)

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

    # --- 7b. ARC Google Form from admin@ (before homeowner/admin catch-all) ---
    if is_from_dee or 'admin@villasboulders.org' in sender_lower:
        if 'arc request' in subject_lower or 'architectural review' in subject_lower:
            # Google Form submission forwarded by the form notification system
            if 'unit address' in body_lower or 'description of improvements' in body_lower:
                return ('arc_form_submission', 0.85, False)
            # ARC request email without form fields (e.g. notification copy)
            return ('arc_form_forward', 0.75, False)

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
        # Strip email quoting artifacts (> >> >>> etc.)
        value = re.sub(r'^(>\s*)+', '', value).strip()

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
        return [desc], None

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
# WO form parser (Google Forms work order submission)
# ============================================================

WO_FIELD_LABELS = [
    'Name',
    'Unit Address',
    'Your\nEmail',
    'Briefly describe the work that needs to be done',
    'Upload photos or files',
    'Type of work\nneeded',
    'Priority you would assign this work (High=10, Low=1)',
]

# Simpler labels for matching (handle line wrapping)
WO_FIELD_MATCHES = [
    ('name', 'Name'),
    ('address', 'Unit Address'),
    ('email', 'Your'),  # followed by newline then Email
    ('description', 'Briefly describe the work'),
    ('attachments', 'Upload photos or files'),
    ('work_type', 'Type of work'),
    ('priority', 'Priority you would assign'),
]

def parse_wo_form(body):
    """Parse a Google Forms work order submission email body."""
    text = strip_html(body)
    
    result = {}
    for field_name, label in WO_FIELD_MATCHES:
        # Find the label and extract text until the next label
        idx = text.find(label)
        if idx == -1:
            idx = text.lower().find(label.lower())
        if idx == -1:
            continue
        
        value_start = idx + len(label)
        # Find the next label after this one
        value_end = len(text)
        for _, next_label in WO_FIELD_MATCHES:
            if next_label == label:
                continue
            next_idx = text.find(next_label, value_start)
            if next_idx != -1 and next_idx < value_end:
                value_end = next_idx
        
        value = text[value_start:value_end].strip()
        # Strip email quoting artifacts (> >> >>> etc.)
        value = re.sub(r'^(>\s*)+', '', value).strip()
        # Clean up newlines and extra whitespace
        value = ' '.join(value.split())
        
        if field_name == 'address':
            result['address'] = value
            result['parcel_code'] = standardize_address(value)
        elif field_name == 'email':
            # Extract email - may have "Email" prefix
            value = value.replace('Email', '').strip()
            result['email'] = value
        elif field_name == 'description':
            result['description'] = value
        elif field_name == 'attachments':
            result['attachments'] = value if value else 'none'
        elif field_name == 'work_type':
            # Label in form is "Type of work\nneeded" — "needed" is part of the label,
            # not the value. Strip it if present.
            value = re.sub(r'^needed\s*', '', value, flags=re.IGNORECASE)
            result['work_type'] = value
        elif field_name == 'name':
            result['homeowner_name'] = value
        elif field_name == 'priority':
            result['priority'] = value
    
    return result


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
    query = f'after:{after_date} -subject:"[HOA Tracker]"'

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

            # Extract attachment metadata from Gmail payload
            attachments = extract_gmail_attachments(msg.get('payload', {}))

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
                'raw_headers': header_dict,
                'attachments': attachments
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

            # Extract attachments (IMAP - data already decoded)
            attachments = extract_imap_attachments(msg)

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
                'raw_headers': headers,
                'attachments': attachments
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

def lookup_property_by_parcel(conn, parcel_code):
    """Look up a property by parcel code, return UUID or None."""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM properties WHERE parcel_code = %s", (parcel_code,))
            row = cur.fetchone()
            return row[0] if row else None
    except Exception:
        return None

def create_work_item(conn, item_data):
    """Create a work item in Supabase. Return the new UUID or None."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO work_items
                    (source_document_id, property_id, title, description, category, status, priority)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                item_data.get('source_document_id'),
                item_data.get('property_id'),
                item_data.get('title', ''),
                item_data.get('description', ''),
                item_data.get('category', 'work_order'),
                item_data.get('status', 'new'),
                item_data.get('priority', 'normal'),
            ))
            row = cur.fetchone()
            conn.commit()
            return row[0] if row else None
    except Exception as e:
        print(f"[ERROR] create_work_item failed: {e}", file=sys.stderr)
        conn.rollback()
        return None

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
# Attachment extraction (Gmail API and IMAP)
# ============================================================

def extract_gmail_attachments(payload):
    """Extract attachment metadata from a Gmail API message payload."""
    attachments = []
    def walk(part):
        if part.get('filename') and part.get('body', {}).get('attachmentId'):
            attachments.append({
                'filename': part['filename'],
                'content_type': part.get('mimeType', 'application/octet-stream'),
                'size': part['body'].get('size', 0),
                'attachment_id': part['body']['attachmentId']
            })
        if 'parts' in part:
            for p in part['parts']:
                walk(p)
    walk(payload)
    return attachments


def download_gmail_attachment(service, message_id, attachment_id):
    """Download an attachment from Gmail API. Returns raw bytes."""
    result = service.users().messages().attachments().get(
        userId='me', messageId=message_id, id=attachment_id
    ).execute()
    data = result.get('data', '')
    # Gmail returns base64url encoded data
    data = data.replace('-', '+').replace('_', '/')
    padding = 4 - len(data) % 4
    if padding < 4:
        data += '=' * padding
    return base64.b64decode(data)


def extract_imap_attachments(msg):
    """Extract attachments from an IMAP email.message.Message object.
    Returns list of dicts with filename, content_type, size, and decoded data."""
    attachments = []
    if msg.is_multipart():
        for part in msg.walk():
            fn = part.get_filename()
            if fn:
                payload = part.get_payload(decode=True)
                if payload:
                    attachments.append({
                        'filename': fn,
                        'content_type': part.get_content_type(),
                        'size': len(payload),
                        'data': payload  # already decoded bytes
                    })
    return attachments


def load_service_role_key():
    """Load the Supabase service role key from file."""
    try:
        with open(SUPABASE_SERVICE_ROLE_KEY_FILE, 'r') as f:
            return f.read().strip()
    except FileNotFoundError:
        return None


def upload_to_supabase_storage(file_path, file_data, content_type, service_role_key):
    """Upload a file to Supabase Storage bucket via REST API.
    Returns the storage path on success, raises on failure."""
    import urllib.request
    import urllib.error

    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{file_path}"
    headers = {
        'Authorization': f'Bearer {service_role_key}',
        'Content-Type': content_type or 'application/octet-stream',
        'x-upsert': 'true'
    }
    req = urllib.request.Request(url, data=file_data, method='POST', headers=headers)
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        body = json.loads(resp.read())
        return file_path  # success
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='replace') if e.fp else ''
        raise RuntimeError(f"Supabase Storage upload failed: HTTP {e.code} - {error_body}")
    except Exception as e:
        raise RuntimeError(f"Supabase Storage upload error: {str(e)}")


def insert_work_item_document(conn, work_item_id, filename, storage_path, content_type, file_size):
    """Insert a work_item_documents row via psycopg2."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO work_item_documents (work_item_id, title, file_name, storage_path, content_type, file_size_bytes, uploaded_by)
            VALUES (%s, NULL, %s, %s, %s, %s, 'email_processor')
            RETURNING id
        """, (work_item_id, filename, storage_path, content_type, file_size))
        result = cur.fetchone()
        conn.commit()
        return str(result[0]) if result else None


def process_attachments_for_email(email_data, work_item_id, conn, service=None, debug=False, dry_run=False):
    """Extract, download, and upload attachments for an ARC form email.

    Args:
        email_data: The email dict (must include 'attachments' metadata)
        work_item_id: UUID of the associated work item (or None if not created yet)
        conn: psycopg2 connection for inserting work_item_documents
        service: Gmail service object (required for Gmail attachments, not needed for IMAP)
        debug: Print debug info
        dry_run: Skip actual uploads/inserts

    Returns list of attachment result dicts.
    """
    attachments = email_data.get('attachments', [])
    if not attachments:
        if debug:
            print(f"[DEBUG] No attachments found for {email_data.get('gmail_message_id', '?')[:20]}...", file=sys.stderr)
        return []

    if debug:
        print(f"[DEBUG] Found {len(attachments)} attachment(s) for {email_data.get('gmail_message_id', '?')[:20]}...", file=sys.stderr)
        for a in attachments:
            print(f"[DEBUG]   - {a['filename']} ({a.get('content_type', '?')}, {a.get('size', 0)} bytes)", file=sys.stderr)

    service_role_key = load_service_role_key()
    if not service_role_key and not dry_run:
        if debug:
            print(f"[DEBUG] No service role key found at {SUPABASE_SERVICE_ROLE_KEY_FILE} - will insert doc rows with intended path", file=sys.stderr)

    results = []
    for att in attachments:
        filename = att['filename']
        content_type = att.get('content_type', 'application/octet-stream')
        size = att.get('size', 0)

        # Skip attachments larger than 10MB
        if size > MAX_ATTACHMENT_SIZE:
            if debug:
                print(f"[DEBUG] Skipping {filename}: too large ({size} bytes > {MAX_ATTACHMENT_SIZE})", file=sys.stderr)
            results.append({
                'filename': filename,
                'status': 'skipped_too_large',
                'size': size
            })
            continue

        # Download attachment data
        file_data = None
        try:
            if 'data' in att:
                # IMAP - data already decoded
                file_data = att['data']
            elif 'attachment_id' in att and service:
                # Gmail API - need to download
                file_data = download_gmail_attachment(service, email_data['gmail_id'], att['attachment_id'])
            else:
                if debug:
                    print(f"[DEBUG] Cannot download {filename}: no data or attachment_id", file=sys.stderr)
                results.append({'filename': filename, 'status': 'download_failed'})
                continue
        except Exception as e:
            if debug:
                print(f"[DEBUG] Error downloading {filename}: {e}", file=sys.stderr)
            results.append({'filename': filename, 'status': 'download_failed', 'error': str(e)})
            continue

        if not file_data:
            results.append({'filename': filename, 'status': 'no_data'})
            continue

        actual_size = len(file_data)
        storage_path = None
        upload_error = None

        if not dry_run:
            # Upload to Supabase Storage
            storage_file_path = f"{work_item_id}/{filename}" if work_item_id else f"unlinked/{filename}"
            if service_role_key:
                try:
                    storage_path = upload_to_supabase_storage(storage_file_path, file_data, content_type, service_role_key)
                    if debug:
                        print(f"[DEBUG] Uploaded {filename} to Supabase Storage at {storage_path}", file=sys.stderr)
                except Exception as e:
                    upload_error = str(e)
                    if debug:
                        print(f"[DEBUG] Upload failed for {filename}: {e}", file=sys.stderr)
            else:
                if debug:
                    print(f"[DEBUG] No service role key - skipping storage upload for {filename}", file=sys.stderr)

            # Insert work_item_documents row (even if upload failed, with intended storage_path)
            if work_item_id:
                try:
                    doc_id = insert_work_item_document(
                        conn, work_item_id, filename,
                        storage_path or storage_file_path,
                        content_type, actual_size
                    )
                    results.append({
                        'filename': filename,
                        'status': 'uploaded' if storage_path else 'doc_row_only',
                        'storage_path': storage_path or storage_file_path,
                        'doc_id': doc_id,
                        'size': actual_size,
                        'upload_error': upload_error
                    })
                except Exception as e:
                    if debug:
                        print(f"[DEBUG] Error inserting work_item_documents for {filename}: {e}", file=sys.stderr)
                    results.append({'filename': filename, 'status': 'db_insert_failed', 'error': str(e), 'size': actual_size})
            else:
                results.append({
                    'filename': filename,
                    'status': 'no_work_item',
                    'size': actual_size
                })
        else:
            results.append({
                'filename': filename,
                'status': 'dry_run',
                'size': actual_size,
                'would_upload_to': f"{work_item_id}/{filename}" if work_item_id else f"unlinked/{filename}"
            })

    return results


# ============================================================
# Notification email
# ============================================================

def send_notification_email(classification, email_data, result, mailbox_email=None, dry_run=False, debug=False):
    """
    Send (or print, in dry-run) a notification email for a newly created work item.
    Sends via admin@villasboulders.org to dee@wmbuck.net using the Google service account.
    """
    from email.mime.text import MIMEText

    type_map = {
        'arc_form_submission': 'ARC Request',
        'arc_form_forward': 'ARC Request (Forwarded)',
        'wo_form': 'Work Order Form',
        'hppr_form': 'HPPR Form',
    }
    type_name = type_map.get(classification, classification)

    parsed = result.get('parsed_data') or {}

    # Build title: short description + parcel code, or fall back to subject
    title_parts = []
    desc = parsed.get('description', '')
    if desc:
        title_parts.append(desc[:60])
    parcel = result.get('parcel_code')
    if parcel:
        title_parts.append(parcel)
    title = ' - '.join(title_parts) if title_parts else (email_data.get('subject', '')[:80] or 'Untitled')

    # Determine status
    has_error = 'error' in result
    status_str = 'ERROR' if has_error else 'SUCCESS'

    subject_line = f"[HOA Tracker] New {type_name}: {title}"

    # Build plain-text body
    lines = []
    lines.append("HOA Issue Tracker — New Work Item Created")
    lines.append("")
    lines.append(f"Type: {type_name} ({classification})")
    lines.append(f"Status: {status_str}")
    lines.append("")
    lines.append("=== SOURCE EMAIL ===")
    lines.append(f"From: {email_data.get('from_name', '')} <{email_data.get('from_email', '')}>")
    lines.append(f"To: {', '.join(email_data.get('to_recipients', []))}")
    rd = email_data.get('received_date')
    lines.append(f"Date: {rd.isoformat() if rd else 'N/A'}")
    lines.append(f"Subject: {email_data.get('subject', '')}")
    lines.append(f"Mailbox: {mailbox_email or result.get('mailbox', 'unknown')}")
    lines.append("")
    lines.append("=== PARSED DATA ===")
    lines.append(f"Homeowner Name: {parsed.get('homeowner_name', 'N/A')}")
    lines.append(f"Address: {parsed.get('address', 'N/A')}")
    lines.append(f"Parcel Code: {parcel or 'N/A'}")
    lines.append(f"Phone: {parsed.get('phone', 'N/A')}")
    lines.append(f"Email: {parsed.get('email', 'N/A')}")
    lines.append(f"Description: {parsed.get('description', 'N/A')}")
    lines.append(f"Supporting Documentation: {parsed.get('supporting_docs', 'none')}")
    lines.append(f"Planned Completion Date: {parsed.get('planned_completion_date', 'N/A')}")
    lines.append(f"Submission Date: {parsed.get('submission_date', 'N/A')}")
    lines.append("")
    lines.append("=== WORK ITEM CREATED ===")
    lines.append(f"Work Item ID: {result.get('db_id', 'N/A (dry run)')}")
    lines.append(f"Title: {title}")
    lines.append(f"Category: {classification}")
    lines.append(f"Status: {status_str}")
    lines.append(f"Property ID: {parcel or 'UNMATCHED - no property found for this address'}")
    lines.append("")
    lines.append("=== ATTACHMENTS ===")

    attachments = result.get('attachments', [])
    if attachments:
        for att in attachments:
            fn = att.get('filename', '?')
            ct = att.get('content_type', att.get('content_type', '?'))
            sz = att.get('size', 0)
            st = att.get('status', '?')
            sp = att.get('storage_path') or att.get('would_upload_to', '')
            line = f"  - {fn} ({ct}, {sz} bytes) → {st}"
            if sp:
                line += f" [path: {sp}]"
            if att.get('upload_error'):
                line += f" [error: {att['upload_error']}]"
            lines.append(line)
    else:
        lines.append("No attachments")

    lines.append("")
    lines.append("=== PROCESSING NOTES ===")
    notes = result.get('actions', [])
    if notes:
        for note in notes:
            lines.append(f"  - {note}")
    else:
        lines.append("  None")

    if has_error:
        lines.append("")
        lines.append(f"ERROR: {result.get('error', 'Unknown error')}")

    body = "\n".join(lines)

    if dry_run:
        print(file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        print("NOTIFICATION EMAIL (dry-run — not sent)", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        print(f"To: dee@wmbuck.net", file=sys.stderr)
        print(f"From: admin@villasboulders.org", file=sys.stderr)
        print(f"Subject: {subject_line}", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        print(body, file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        print(file=sys.stderr)
        return

    # Actually send the email via service account
    try:
        if service_account is None or build is None:
            if debug:
                print(f"[DEBUG] Cannot send notification: google-api-python-client not available", file=sys.stderr)
            return

        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE,
            scopes=['https://www.googleapis.com/auth/gmail.send'],
            subject='admin@villasboulders.org'
        )
        gmail = build('gmail', 'v1', credentials=creds)

        msg = MIMEText(body)
        msg['to'] = 'dee@wmbuck.net'
        msg['from'] = 'admin@villasboulders.org'
        msg['subject'] = subject_line

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        gmail.users().messages().send(userId='me', body={'raw': raw}).execute()

        if debug:
            print(f"[DEBUG] Notification email sent: {subject_line}", file=sys.stderr)
    except Exception as e:
        if debug:
            print(f"[DEBUG] Failed to send notification email: {e}", file=sys.stderr)
        # Don't fail processing — just log


# ============================================================
# Main processing pipeline
# ============================================================

def check_thread_has_work_item(conn, thread_id):
    """Check if a work item already exists for this email thread."""
    if not thread_id:
        return False
    with conn.cursor() as cur:
        cur.execute("""
            SELECT wi.id FROM work_items wi
            JOIN issue_email_link iel ON iel.work_item_id = wi.id
            JOIN email_message em ON em.id = iel.email_message_id
            WHERE em.gmail_thread_id = %s
            LIMIT 1
        """, (thread_id,))
        return cur.fetchone() is not None


def process_email(email_data, debug=False, dry_run=False, conn=None, gmail_service=None, notify=False, mailbox_email=None):
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
        'actions': [],
        'attachments': []
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

            # Look up property
            property_id = None
            if result.get('parcel_code'):
                property_id = lookup_property_by_parcel(conn, result['parcel_code'])

            # Create source document
            source_doc_id = None
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO source_documents
                            (property_id, doc_type, source_ref, subject, body_text, from_name, from_email, received_date, gmail_thread_id)
                        VALUES (%s, 'email', %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        property_id,
                        email_data.get('gmail_message_id', ''),
                        subject,
                        body[:5000],
                        email_data.get('from_name', ''),
                        email_data.get('from_email', ''),
                        email_data.get('received_date'),
                        email_data.get('thread_id', ''),
                    ))
                    row = cur.fetchone()
                    source_doc_id = row[0] if row else None
                    conn.commit()
            except Exception as e:
                print(f"[ERROR] source_document creation failed: {e}", file=sys.stderr)
                conn.rollback()

            # Create work item
            # Title format: "Name - Unit" (+ " (serial)" if available)
            arc_name = parsed.get('homeowner_name', '?')
            work_title = arc_name
            if result.get('parcel_code'):
                work_title += f' - {result["parcel_code"]}'
            if parsed.get('arc_request_serial'):
                work_title += f' ({parsed["arc_request_serial"]})'
            desc = parsed.get('description', '')
            if parsed.get('planned_completion_date'):
                desc += f'\nPlanned completion: {parsed["planned_completion_date"]}'

            # Check if a work item already exists for this thread (avoid duplicates from replies)
            if check_thread_has_work_item(conn, email_data.get('thread_id')):
                result['actions'].append('skipped_work_item_creation: thread already has a work item')
            else:
                work_item_id = create_work_item(conn, {
                    'source_document_id': source_doc_id,
                    'property_id': property_id,
                    'title': work_title,
                    'description': desc,
                    'category': 'arc_request',
                    'status': 'new',
                    'priority': 'normal',
                })
                if work_item_id:
                    result['work_item_id'] = str(work_item_id)
                    result['actions'].append(f'created_work_item: {work_title}')

                    # Create issue_email_link connecting email to work item
                    if email_uuid:
                        try:
                            with conn.cursor() as cur:
                                cur.execute("""
                                    INSERT INTO issue_email_link (work_item_id, email_message_id, role, match_method, match_confidence)
                                    VALUES (%s, %s, 'origin', 'parcel_date', 0.95)
                                    ON CONFLICT DO NOTHING
                                """, (work_item_id, email_uuid))
                                conn.commit()
                                result['actions'].append(f'created_issue_email_link: {email_uuid} -> {work_item_id}')
                        except Exception as e:
                            print(f"[ERROR] issue_email_link creation failed: {e}", file=sys.stderr)
                            conn.rollback()
                else:
                    result['actions'].append('ERROR: failed to create work item')

            # Process attachments (upload to Supabase Storage, insert work_item_documents)
            att_results = process_attachments_for_email(
                email_data, work_item_id or email_uuid, conn, service=gmail_service,
                debug=debug, dry_run=dry_run
            )
            if att_results:
                result['attachments'] = att_results
                result['actions'].append(f'processed {len(att_results)} attachment(s)')
        else:
            # Dry run - still check attachments for reporting
            att_results = process_attachments_for_email(
                email_data, None, conn, service=gmail_service,
                debug=debug, dry_run=True
            )
            if att_results:
                result['attachments'] = att_results
                result['actions'].append(f'found {len(att_results)} attachment(s) (dry run)')

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

            # Look up property
            property_id = None
            if result.get('parcel_code'):
                property_id = lookup_property_by_parcel(conn, result['parcel_code'])

            # Create source document
            source_doc_id = None
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO source_documents
                            (property_id, doc_type, source_ref, subject, body_text, from_name, from_email, received_date, gmail_thread_id)
                        VALUES (%s, 'email', %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        property_id,
                        email_data.get('gmail_message_id', ''),
                        subject,
                        body[:5000],
                        email_data.get('from_name', ''),
                        email_data.get('from_email', ''),
                        email_data.get('received_date'),
                        email_data.get('thread_id', ''),
                    ))
                    row = cur.fetchone()
                    source_doc_id = row[0] if row else None
                    conn.commit()
            except Exception as e:
                print(f"[ERROR] source_document creation failed: {e}", file=sys.stderr)
                conn.rollback()

            # Create work item
            # Title format: "Name - Unit" (+ " (serial)" if available)
            arc_name = parsed.get('homeowner_name', '?')
            work_title = arc_name
            if result.get('parcel_code'):
                work_title += f' - {result["parcel_code"]}'
            if parsed.get('arc_request_serial'):
                work_title += f' ({parsed["arc_request_serial"]})'
            desc = parsed.get('description', '')
            if parsed.get('planned_completion_date'):
                desc += f'\nPlanned completion: {parsed["planned_completion_date"]}'

            # Check if a work item already exists for this thread (avoid duplicates from replies)
            if check_thread_has_work_item(conn, email_data.get('thread_id')):
                result['actions'].append('skipped_work_item_creation: thread already has a work item')
            else:
                work_item_id = create_work_item(conn, {
                    'source_document_id': source_doc_id,
                    'property_id': property_id,
                    'title': work_title,
                    'description': desc,
                    'category': 'arc_request',
                    'status': 'new',
                    'priority': 'normal',
                })
                if work_item_id:
                    result['work_item_id'] = str(work_item_id)
                    result['actions'].append(f'created_work_item: {work_title}')

                    # Create issue_email_link connecting email to work item
                    if email_uuid:
                        try:
                            with conn.cursor() as cur:
                                cur.execute("""
                                    INSERT INTO issue_email_link (work_item_id, email_message_id, role, match_method, match_confidence)
                                    VALUES (%s, %s, 'origin', 'parcel_date', 0.95)
                                    ON CONFLICT DO NOTHING
                                """, (work_item_id, email_uuid))
                                conn.commit()
                                result['actions'].append(f'created_issue_email_link: {email_uuid} -> {work_item_id}')
                        except Exception as e:
                            print(f"[ERROR] issue_email_link creation failed: {e}", file=sys.stderr)
                            conn.rollback()
                else:
                    result['actions'].append('ERROR: failed to create work item')

            # Process attachments
            att_results = process_attachments_for_email(
                email_data, work_item_id or email_uuid, conn, service=gmail_service,
                debug=debug, dry_run=dry_run
            )
            if att_results:
                result['attachments'] = att_results
                result['actions'].append(f'processed {len(att_results)} attachment(s)')
        else:
            att_results = process_attachments_for_email(
                email_data, None, conn, service=gmail_service,
                debug=debug, dry_run=True
            )
            if att_results:
                result['attachments'] = att_results
                result['actions'].append(f'found {len(att_results)} attachment(s) (dry run)')

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

            # Auto-create work item if we found a property address
            if result.get('parcel_code') and not dry_run and conn:
                # Determine category from subject/body keywords
                subj_lower = (subject or '').lower()
                body_lower_check = (body or '').lower()[:2000]
                if any(kw in subj_lower or kw in body_lower_check for kw in
                       ['roof', 'leak', 'water', 'flood', 'pipe', 'burst']):
                    wi_category = 'maintenance_request'
                elif any(kw in subj_lower or kw in body_lower_check for kw in
                         ['arc', 'architectural', 'paint', 'fence', 'window', 'door', 'deck', 'patio', 'landscape']):
                    wi_category = 'arc_request'
                else:
                    wi_category = 'homeowner_inquiry'

                # Check thread dedup
                if not check_thread_has_work_item(conn, email_data.get('thread_id')):
                    work_title = f'{email_data.get("from_name", "Homeowner") or "Homeowner"} - {result["parcel_code"]}'
                    try:
                        work_item_id = create_work_item(conn, {
                            'property_id': None,  # Will be linked if property found
                            'title': work_title,
                            'description': body[:2000],
                            'category': wi_category,
                            'status': 'new',
                            'priority': 'normal',
                        })
                        if work_item_id:
                            result['work_item_id'] = str(work_item_id)
                            result['actions'].append(f'created_work_item: {work_title} ({wi_category})')
                    except Exception as e:
                        print(f"[ERROR] homeowner_direct work item creation failed: {e}", file=sys.stderr)
                        result['actions'].append(f'error_creating_work_item: {e}')
                else:
                    result['actions'].append('skipped_work_item_creation: thread already has a work item')

        if not dry_run and conn:
            email_uuid = upsert_email_message(conn, email_data, classification, confidence, is_noise, parse_payload)
            result['db_id'] = str(email_uuid) if email_uuid else None
            upsert_email_thread(conn, email_data['thread_id'], subject,
                               email_data['received_date'], classification)

    elif classification == 'wo_form':
        # Parse work order form submission
        parsed = parse_wo_form(body)
        parse_payload = parsed
        result['parsed_data'] = parsed

        if parsed.get('address'):
            parcel = standardize_address(parsed.get('address', ''))
            if parcel:
                result['parcel_code'] = parcel
                result['actions'].append(f'address_match: {parsed["address"]} -> {parcel}')

        result['actions'].append(f'would_create_work_item: work_order for {parsed.get("homeowner_name", "?")}')

        if not dry_run and conn:
            email_uuid = upsert_email_message(conn, email_data, classification, confidence, is_noise, parse_payload)
            result['db_id'] = str(email_uuid) if email_uuid else None

            # Create work item
            property_id = None
            if result.get('parcel_code'):
                property_id = lookup_property_by_parcel(conn, result['parcel_code'])
            
            # Create source document first
            source_doc_id = None
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO source_documents
                            (property_id, doc_type, source_ref, subject, body_text, from_name, from_email, received_date, gmail_thread_id)
                        VALUES (%s, 'email', %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        property_id,
                        email_data.get('gmail_message_id', ''),
                        subject,
                        body[:5000],
                        email_data.get('from_name', ''),
                        email_data.get('from_email', ''),
                        email_data.get('received_date'),
                        email_data.get('thread_id', ''),
                    ))
                    row = cur.fetchone()
                    source_doc_id = row[0] if row else None
                    conn.commit()
            except Exception as e:
                print(f"[ERROR] source_document creation failed: {e}", file=sys.stderr)
                conn.rollback()
            
            # Title format: "Name - Unit" (+ " (WO number)" if available)
            wo_name = parsed.get('homeowner_name') or email_data.get('from_name', '?')
            work_title = wo_name
            if result.get('parcel_code'):
                work_title += f' - {result["parcel_code"]}'
            if parsed.get('keystone_wo_number'):
                work_title += f' ({parsed["keystone_wo_number"]})'
            
            work_item_id = create_work_item(conn, {
                'source_document_id': source_doc_id,
                'property_id': property_id,
                'title': work_title,
                'description': parsed.get('description', ''),
                'category': 'work_order',
                'status': 'new',
                'priority': 'high' if parsed.get('priority', '0') in ('10', '9', '8') else 'normal',
            })
            if work_item_id:
                result['work_item_id'] = str(work_item_id)
                result['actions'].append(f'created_work_item: {work_title}')
                
                # Create issue_email_link connecting email to work item
                if email_uuid:
                    try:
                        with conn.cursor() as cur:
                            cur.execute("""
                                INSERT INTO issue_email_link (work_item_id, email_message_id, role, match_method, match_confidence)
                                VALUES (%s, %s, 'origin', 'parcel_date', 0.95)
                                ON CONFLICT DO NOTHING
                            """, (work_item_id, email_uuid))
                            conn.commit()
                            result['actions'].append(f'created_issue_email_link: {email_uuid} -> {work_item_id}')
                    except Exception as e:
                        print(f"[ERROR] issue_email_link creation failed: {e}", file=sys.stderr)
                        conn.rollback()
            else:
                result['actions'].append('ERROR: failed to create work item')
            
            upsert_email_thread(conn, email_data['thread_id'], subject,
                               email_data['received_date'], classification,
                               result.get('parcel_code'))

    elif classification in ('hppr_form', 'property_report', 'ops_alert', 'invoice_pending'):
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

    # Send notification for work-item-creating classifications
    if notify and classification in WORK_ITEM_CLASSIFICATIONS:
        try:
            send_notification_email(
                classification, email_data, result,
                mailbox_email=mailbox_email,
                dry_run=dry_run, debug=debug
            )
        except Exception as e:
            if debug:
                print(f"[DEBUG] Notification error: {e}", file=sys.stderr)
            result['actions'].append(f'notification_failed: {e}')

    return result


# ============================================================
# Entry point
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='HOA Email Processor v2')
    parser.add_argument('--days', type=int, default=1, help='Look back N days (default: 1)')
    parser.add_argument('--dry-run', action='store_true', help='Process but do not write to Supabase')
    parser.add_argument('--debug', action='store_true', help='Print debug info to stderr')
    parser.add_argument('--notify', action='store_true', help='Send email notification for each new work item created')
    parser.add_argument('--reprocess', action='store_true', help='Reprocess already-processed emails to create missing work_items/source_documents/issue_email_links (does not duplicate email_message rows)')
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
            if full_id in processed_ids and not args.reprocess:
                if args.debug:
                    print(f"[DEBUG] Skipping already-processed: {full_id[:40]}...", file=sys.stderr)
                continue

            try:
                result = process_email(email_data, debug=args.debug, dry_run=args.dry_run, conn=conn, gmail_service=service if mailbox['type'] == 'service_account' else None, notify=args.notify, mailbox_email=mb_email)
                result['mailbox'] = mb_email
                results.append(result)
                if full_id not in processed_ids:
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
        'reprocess': getattr(args, 'reprocess', False),
        'processed_count': len(all_results),
        'total_checked': total_checked,
        'skipped_already_processed': total_checked - len(all_results) - sum(1 for r in all_results if 'error' in r),
        'lookback_days': args.days,
        'run_at': datetime.now(timezone.utc).isoformat(),
        'classification_counts': all_classification_counts,
        'emails': all_results
    }

    print(json.dumps(output, indent=2, default=str))

if __name__ == '__main__':
    main()
