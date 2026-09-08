#!/usr/bin/env python3
"""
Jane Inbound Email Handler for HOA Tracker

Processes emails forwarded to jane@wmbuck.net (IMAP on tarragon via Dovecot
master user auth), parses HOA-related content, links to existing work items
in Supabase, and optionally updates work item status based on keywords found.

This is a companion to email_processor.py which handles boardwork@ and
mcdonaldbuckhoa@ mailboxes. This handler is narrower: it does NOT create
new work items — it only links forwarded emails to existing ones and updates
status when clear status keywords + dates are found.

Usage:
    python3 jane_inbound_handler.py [--days N] [--dry-run] [--debug]

Options:
    --days N     Look back N days (default: 7)
    --dry-run    Process emails but don't write to Supabase
    --debug      Print debug info to stderr
"""

import sys
import os
import json
import re
import argparse
import ssl as ssl_module
import imaplib
import email as email_module
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

# psycopg2 for Supabase
try:
    import psycopg2
except ImportError:
    psycopg2 = None

# ============================================================
# Configuration
# ============================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# IMAP config for jane@wmbuck.net on tarragon
IMAP_CONFIG_FILE = os.path.join(SCRIPT_DIR, 'secrets', '.jane_imap_config.json')
JANE_EMAIL = 'jane@wmbuck.net'

# Supabase connection
SUPABASE_HOST = 'db.obveytoovkzjrpzrhrim.supabase.co'
SUPABASE_PORT = 5432
SUPABASE_DB = 'postgres'
SUPABASE_USER = 'postgres'
SUPABASE_PASSWORD_FILE = os.path.join(SCRIPT_DIR, 'secrets', '.supabase_db_password')

# Processed message tracking
PROCESSED_FILE = os.path.join(SCRIPT_DIR, '.jane_inbound_processed.json')

# Import address standardization
sys.path.insert(0, SCRIPT_DIR)
try:
    from address_standardization import standardize_address
except ImportError:
    def standardize_address(addr):
        return addr or ""

# ============================================================
# Known actors
# ============================================================

JOSH_EMAIL = 'hallj@keystonepacific.com'
BOARDWORK_EMAIL = 'boardwork@villasboulders.org'

# ============================================================
# Processed message tracking
# ============================================================

def load_processed():
    """Load the set of already-processed message IDs."""
    try:
        with open(PROCESSED_FILE, 'r') as f:
            data = json.load(f)
            return set(data.get('processed_ids', []))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()

def save_processed(processed_ids):
    """Save the set of processed message IDs."""
    try:
        with open(PROCESSED_FILE, 'w') as f:
            json.dump({'processed_ids': sorted(processed_ids)}, f, indent=2)
    except Exception as e:
        print(f"[WARN] Could not save processed file: {e}", file=sys.stderr)

# ============================================================
# IMAP connection (Dovecot master user)
# ============================================================

def get_imap_config():
    """Read IMAP config from the local secrets JSON file."""
    with open(IMAP_CONFIG_FILE, 'r') as f:
        config = json.load(f)
    return config

def fetch_unread_emails(days=7, debug=False):
    """
    Fetch unread emails from jane@wmbuck.net via IMAP on tarragon.
    Uses Dovecot master user auth: user="jane@wmbuck.net*jane-master"
    """
    config = get_imap_config()
    host = config['host']
    port = config['port']
    master_password = config['master_password']
    master_user = config['master_user']

    # Dovecot master user auth: <actual_user>*<master_user>
    imap_user = f"{JANE_EMAIL}*{master_user}"

    ctx = ssl_module.create_default_context()
    imap = imaplib.IMAP4_SSL(host, port, ssl_context=ctx)
    imap.login(imap_user, master_password)

    imap.select('INBOX')

    # Search for recent unread messages (UNSEEN)
    # Use SINCE to limit date range
    since_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%d-%b-%Y')

    # First try UNSEEN + SINCE
    status, messages = imap.search(None, '(UNSEEN)', f'(SINCE {since_date})')
    msg_ids = messages[0].split()

    if debug:
        print(f"[DEBUG] IMAP {JANE_EMAIL}: {len(msg_ids)} unseen messages since {since_date}", file=sys.stderr)

    # If no unseen, fall back to ALL since date (for reprocessing)
    if not msg_ids:
        status, messages = imap.search(None, f'(SINCE {since_date})')
        msg_ids = messages[0].split()
        if debug:
            print(f"[DEBUG] IMAP {JANE_EMAIL}: falling back to {len(msg_ids)} total messages since {since_date}", file=sys.stderr)

    emails = []
    processed = load_processed()

    for mid in msg_ids:
        try:
            status, msg_data = imap.fetch(mid, '(RFC822)')
            if status != 'OK':
                continue
            raw_msg = msg_data[0][1]
            msg = email_module.message_from_bytes(raw_msg)

            headers = {}
            for h in ['Subject', 'From', 'To', 'Cc', 'Date', 'In-Reply-To', 'Message-ID']:
                headers[h.lower()] = msg.get(h, '')

            # Extract bodies
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

            # Parse addresses
            from_name, from_email = parse_email_address(headers.get('from', ''))
            to_list = extract_recipients(headers.get('to', ''))
            cc_list = extract_recipients(headers.get('cc', ''))

            try:
                received_date = parsedate_to_datetime(headers.get('date', '')) if headers.get('date') else None
            except Exception:
                received_date = None

            message_id = headers.get('message-id', '') or mid.decode()

            # Check if already processed
            if message_id in processed:
                if debug:
                    print(f"[DEBUG] Skipping already-processed: {message_id[:60]}", file=sys.stderr)
                continue

            # Build thread_id — use In-Reply-To if available, else synthesize from subject
            thread_id = headers.get('in-reply-to', '') or f"jane:{normalize_subject(headers.get('subject', ''))[:60]}"

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
            })

        except Exception as e:
            if debug:
                print(f"[DEBUG] IMAP error fetching message: {e}", file=sys.stderr)
            continue

    imap.logout()
    return emails

# ============================================================
# Email parsing helpers
# ============================================================

def parse_email_address(raw):
    """Parse 'Name <email@domain>' into (name, email)."""
    if not raw:
        return '', ''
    m = re.match(r'^(.*?)\s*<(.+?)>\s*$', raw)
    if m:
        return m.group(1).strip().strip('"\''), m.group(2).strip().lower()
    if '@' in raw:
        return '', raw.strip().lower()
    return raw.strip(), ''

def extract_recipients(header_value):
    """Extract list of email addresses from To/Cc header."""
    if not header_value:
        return []
    emails = re.findall(r'<(.+?)>', header_value)
    if not emails:
        parts = [p.strip().lower() for p in header_value.split(',')]
        emails = [p for p in parts if '@' in p]
    return [e.lower() for e in emails]

def normalize_subject(subject):
    """Strip Re:/Fwd: prefixes from subject."""
    if not subject:
        return ''
    s = subject.strip()
    while True:
        new_s = re.sub(r'^(re|fwd|fw):\s*', '', s, flags=re.IGNORECASE)
        if new_s == s:
            break
        s = new_s
    return s.strip()

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
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&')
    text = text.replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&quot;', '"')
    if not preserve_newlines:
        text = re.sub(r'\s+', ' ', text).strip()
    return text

def get_combined_body(email_data):
    """Get the best text body for analysis — prefer text, fall back to stripped HTML."""
    body = email_data.get('body_text', '')
    if not body and email_data.get('body_html'):
        body = strip_html(email_data['body_html'], preserve_newlines=True)
    return body

# ============================================================
# Content extraction — WO numbers, addresses, dates, status keywords
# ============================================================

def extract_wo_numbers(body):
    """
    Extract work order numbers from email body.
    Looks for WO#12345, WO 12345, Work Order #12345, etc.
    Returns list of WO number strings (without prefix).
    """
    patterns = [
        r'\bWO\s*#?\s*(\d{3,6})\b',
        r'\bwork\s*order\s*#?\s*(\d{3,6})\b',
        r'\bwork\s*order\s*number\s*[:\-]?\s*(\d{3,6})\b',
    ]
    found = set()
    for pattern in patterns:
        for m in re.finditer(pattern, body, re.IGNORECASE):
            found.add(m.group(1))
    return sorted(found)

def extract_addresses(body):
    """
    Extract Villas at the Boulders addresses from email body.
    Looks for patterns like:
      13737 Rock Point #102
      13626 Boulder Circle
      13708 Boulder Pt 102
    Returns list of standardized parcel codes.
    """
    # Street names in the Villas at the Boulders
    street_names = [
        'rock point', 'boulder point', 'boulder circle',
        'broadlands', 'stone circle', 'plaster point',
        'rock pt', 'boulder pt', 'boulder cir',
        'stone cir', 'plaster pt',
    ]
    name_pattern = '|'.join(re.escape(n) for n in sorted(street_names, key=len, reverse=True))

    # Match: 4-5 digit number + street name + optional unit
    pattern = (
        r'\b(\d{4,5})\s+(' + name_pattern + r')\s*[#]?\s*(?:unit\s+)?(\d{1,3})?\b'
    )

    found = set()
    for m in re.finditer(pattern, body, re.IGNORECASE):
        addr_text = m.group(0)
        parcel = standardize_address(addr_text)
        if parcel:
            found.add(parcel)

    return sorted(found)

def extract_dates(body):
    """
    Extract dates mentioned near status keywords.
    Returns dict of {status_keyword: date_string} where date_string is ISO format.
    """
    # Date patterns to look for
    date_patterns = [
        # "September 5, 2026" or "Sept 5" or "Sep 5"
        r'(\w+\s+\d{1,2}(?:,\s*\d{4})?)',
        # "5-Sep-2026" or "09/05/2026" or "09/05/26"
        r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
        # "2026-09-05"
        r'(\d{4}-\d{2}-\d{2})',
    ]

    # Status keywords with nearby date context
    status_date_patterns = [
        (r'(?:scheduled\s+for|will\s+(?:be|start)\s+(?:on|approximately\s+)?|to\s+start\s+(?:on|approximately\s+)?)\s*[:\-]?\s*(.+?)(?:\.|$)', 'scheduled'),
        (r'(?:completed\s+(?:on|approximately\s+)?|finished\s+(?:on|approximately\s+)?|done\s+(?:on|approximately\s+)?)\s*[:\-]?\s*(.+?)(?:\.|$)', 'completed'),
    ]

    # Simpler approach: find status keywords, then look for dates in surrounding text
    status_keywords = {
        'scheduled': r'\b(?:scheduled|will\s+be\s+(?:done|completed|installed)|start(?:ing)?\s+(?:on|around|approximately))\b',
        'completed': r'\b(?:completed|finished|done|installed|wrapped\s+up)\b',
        'in_progress': r'\b(?:in\s+progress|under\s+way|work\s+(?:has\s+)?started|on\s+site|crew\s+(?:is|was)\s+on\s+site)\b',
        'delayed': r'\b(?:delayed|postponed|pushed\s+back|rescheduled)\b',
        'cancelled': r'\b(?:cancelled|canceled|called\s+off|scrubbed)\b',
        'denied': r'\b(?:denied|rejected)\b',
        'approved': r'\b(?:approved)\b',
    }

    results = {}

    for status, pattern in status_keywords.items():
        for m in re.finditer(pattern, body, re.IGNORECASE):
            # Look for a date within 100 chars after the keyword
            after_text = body[m.end():m.end() + 200]
            date_match = None
            for dp in [
                r'(\w+\s+\d{1,2}(?:,\s*\d{4})?)',
                r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
                r'(\d{4}-\d{2}-\d{2})',
            ]:
                date_match = re.search(dp, after_text)
                if date_match:
                    break

            if status not in results:  # First match wins
                if date_match:
                    raw_date = date_match.group(1)
                    parsed = try_parse_date(raw_date)
                    if parsed:
                        results[status] = parsed
                else:
                    # Status keyword found but no date
                    if status not in results:
                        results[status] = None

    return results

def try_parse_date(raw):
    """Try to parse a date string into ISO format (YYYY-MM-DD)."""
    raw = raw.strip().rstrip(',.')

    # Try several formats
    formats = [
        '%B %d, %Y',      # September 5, 2026
        '%B %d',           # September 5
        '%b %d, %Y',      # Sep 5, 2026
        '%b %d',           # Sep 5
        '%m/%d/%Y',       # 09/05/2026
        '%m/%d/%y',       # 09/05/26
        '%Y-%m-%d',       # 2026-09-05
        '%d-%b-%Y',       # 5-Sep-2026
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(raw, fmt)
            # If no year, assume current year
            if '%Y' not in fmt and '%y' not in fmt:
                dt = dt.replace(year=datetime.now().year)
            return dt.strftime('%Y-%m-%d')
        except (ValueError, TypeError):
            continue

    return None

def extract_status_keywords(body):
    """
    Detect status keywords in the email body.
    Returns a list of status strings found.
    """
    body_lower = body.lower()
    statuses = []

    keyword_map = {
        'scheduled': [r'\bscheduled\b', r'\bschedule\s+for\b'],
        'completed': [r'\bcompleted\b', r'\bfinished\b', r'\bwork\s+is\s+done\b'],
        'in_progress': [r'\bin\s+progress\b', r'\bunder\s+way\b', r'\bwork\s+started\b',
                        r'\bon\s+site\b', r'\bcrew\s+(?:is|was)\s+on\s+site\b'],
        'delayed': [r'\bdelayed\b', r'\bpostponed\b', r'\bpushed\s+back\b', r'\brescheduled\b'],
        'cancelled': [r'\bcancel(?:led|ed)\b', r'\bcalled\s+off\b'],
        'denied': [r'\bdenied\b', r'\brejected\b'],
        'approved': [r'\bapproved\b'],
    }

    for status, patterns in keyword_map.items():
        for pattern in patterns:
            if re.search(pattern, body_lower):
                if status not in statuses:
                    statuses.append(status)
                break

    return statuses

# ============================================================
# Supabase connection
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

# ============================================================
# Work item matching
# ============================================================

def match_by_wo_number(conn, wo_numbers, debug=False):
    """
    Match work items by Keystone WO number.
    Returns (work_item_id, match_confidence) or (None, 0).
    """
    if not wo_numbers:
        return None, 0.0
    with conn.cursor() as cur:
        for wo in wo_numbers:
            cur.execute("""
                SELECT id, title, status FROM work_items
                WHERE keystone_wo_number = %s
                  AND excluded_at IS NULL
                LIMIT 1
            """, (wo,))
            row = cur.fetchone()
            if row:
                if debug:
                    print(f"[DEBUG] Matched by WO number {wo}: {row[1][:50]} (status={row[2]})", file=sys.stderr)
                return row[0], 1.0
    return None, 0.0

def match_by_parcel_code(conn, parcel_codes, debug=False):
    """
    Match work items by parcel code → property_id → work_items.
    Returns (work_item_id, match_confidence) or (None, 0).
    Prefers open items, falls back to any.
    """
    if not parcel_codes:
        return None, 0.0
    with conn.cursor() as cur:
        for parcel in parcel_codes:
            # Look up property_id
            cur.execute("SELECT id FROM properties WHERE parcel_code = %s", (parcel,))
            prop_row = cur.fetchone()
            if not prop_row:
                continue
            property_id = prop_row[0]

            # Find open work items for this property (most recent first)
            cur.execute("""
                SELECT id, title, status FROM work_items
                WHERE property_id = %s
                  AND excluded_at IS NULL
                  AND status NOT IN ('closed', 'cancelled', 'denied')
                ORDER BY updated_date DESC NULLS LAST, created_date DESC
                LIMIT 1
            """, (property_id,))
            row = cur.fetchone()
            if row:
                if debug:
                    print(f"[DEBUG] Matched by parcel {parcel}: {row[1][:50]} (status={row[2]})", file=sys.stderr)
                return row[0], 0.75

            # Fall back to any work item for this property
            cur.execute("""
                SELECT id, title, status FROM work_items
                WHERE property_id = %s
                  AND excluded_at IS NULL
                ORDER BY created_date DESC
                LIMIT 1
            """, (property_id,))
            row = cur.fetchone()
            if row:
                if debug:
                    print(f"[DEBUG] Matched by parcel {parcel} (any): {row[1][:50]} (status={row[2]})", file=sys.stderr)
                return row[0], 0.60
    return None, 0.0

def match_by_homeowner_name(conn, body, subject, debug=False):
    """
    Try to match by homeowner name found in the email against work item titles.
    Returns (work_item_id, match_confidence) or (None, 0).
    """
    # Look for patterns like "Lastname -" or "Firstname Lastname" in subject
    # that match work item titles
    title_patterns = []
    # "ARC - O'Leary - 13717RP2" → look for "O'Leary"
    subject_match = re.search(r'ARC\s*-\s*(.+?)\s*-\s*\d', subject or '', re.IGNORECASE)
    if subject_match:
        name = subject_match.group(1).strip()
        title_patterns.append(name)

    # Also try common HOA email name patterns
    body_text = body[:2000]
    # "Dear Mr. Smith" / "Dear Ms. Smith" / "Dear Dr. Smith"
    dear_match = re.search(r'Dear\s+(?:Mr\.|Ms\.|Mrs\.|Dr\.?)\s+(\w+)', body_text, re.IGNORECASE)
    if dear_match:
        title_patterns.append(dear_match.group(1))

    if not title_patterns:
        return None, 0.0

    with conn.cursor() as cur:
        for name in title_patterns:
            # Search in work_items titles
            cur.execute("""
                SELECT id, title, status FROM work_items
                WHERE title ILIKE %s
                  AND excluded_at IS NULL
                ORDER BY
                    CASE WHEN status NOT IN ('closed', 'cancelled', 'denied') THEN 0 ELSE 1 END,
                    created_date DESC
                LIMIT 1
            """, (f'%{name}%',))
            row = cur.fetchone()
            if row:
                if debug:
                    print(f"[DEBUG] Matched by name '{name}': {row[1][:50]} (status={row[2]})", file=sys.stderr)
                return row[0], 0.50
    return None, 0.0

def match_by_thread(conn, thread_id, debug=False):
    """
    Check if this email is a reply in a thread that already has a work item.
    Returns (work_item_id, match_confidence) or (None, 0).
    """
    if not thread_id:
        return None, 0.0
    with conn.cursor() as cur:
        # Check email_message table for other messages in the same thread
        cur.execute("""
            SELECT iel.work_item_id
            FROM issue_email_link iel
            JOIN email_message em ON em.id = iel.email_message_id
            WHERE em.gmail_thread_id = %s
            LIMIT 1
        """, (thread_id,))
        row = cur.fetchone()
        if row:
            if debug:
                print(f"[DEBUG] Matched by thread {thread_id[:40]}: work_item={row[0]}", file=sys.stderr)
            return row[0], 0.85
    return None, 0.0

def match_work_item(conn, email_data, body, debug=False):
    """
    Try to match an email to an existing work item.
    Returns (work_item_id, match_method, match_confidence) or (None, None, 0).
    """
    # 1. Strongest: WO number
    wo_numbers = extract_wo_numbers(body)
    if wo_numbers:
        wi_id, conf = match_by_wo_number(conn, wo_numbers, debug)
        if wi_id:
            return wi_id, 'wo_number', conf

    # 2. Thread match
    wi_id, conf = match_by_thread(conn, email_data.get('thread_id'), debug)
    if wi_id:
        return wi_id, 'thread', conf

    # 3. Parcel code / address
    parcel_codes = extract_addresses(body)
    if parcel_codes:
        wi_id, conf = match_by_parcel_code(conn, parcel_codes, debug)
        if wi_id:
            return wi_id, 'manual', conf  # 'manual' because it's address-based inference

    # 4. Homeowner name in subject
    wi_id, conf = match_by_homeowner_name(conn, body, email_data.get('subject', ''), debug)
    if wi_id:
        return wi_id, 'manual', conf

    return None, None, 0.0

# ============================================================
# Supabase persistence
# ============================================================

def determine_direction(email_data):
    """Determine if email is inbound, outbound, or internal."""
    from_email = (email_data.get('from_email') or '').lower()
    to_list = email_data.get('to_recipients', [])
    cc_list = email_data.get('cc_recipients', [])
    all_recipients = (to_list or []) + (cc_list or [])

    is_from_vab = 'villasboulders.org' in from_email
    is_to_vab = any('villasboulders.org' in (r or '').lower() for r in all_recipients)
    is_from_jane = 'wmbuck.net' in from_email

    if is_from_vab and is_to_vab:
        return 'internal'
    elif is_from_vab or is_from_jane:
        return 'outbound'
    else:
        return 'inbound'

def upsert_email_message(conn, email_data, classification, confidence, is_noise):
    """Insert an email_message record. Returns UUID or None."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO email_message (
                    gmail_message_id, gmail_thread_id, in_reply_to, direction,
                    from_name, from_email, to_recipients, cc_recipients,
                    subject, body_text, body_html, received_date,
                    classification, classification_confidence, is_noise,
                    raw_headers
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (gmail_message_id) DO UPDATE SET
                    classification = EXCLUDED.classification,
                    classification_confidence = EXCLUDED.classification_confidence
                RETURNING id
            """, (
                email_data['gmail_message_id'],
                email_data['thread_id'],
                email_data.get('in_reply_to') or None,
                determine_direction(email_data),
                email_data.get('from_name'),
                email_data.get('from_email'),
                email_data.get('to_recipients'),
                email_data.get('cc_recipients'),
                email_data.get('subject'),
                (email_data.get('body_text') or '')[:50000],
                (email_data.get('body_html') or '')[:50000] if email_data.get('body_html') else None,
                email_data.get('received_date'),
                classification,
                confidence,
                is_noise,
                json.dumps(email_data.get('raw_headers', {})),
            ))
            row = cur.fetchone()
            return row[0] if row else None
    except Exception as e:
        print(f"[ERROR] upsert_email_message failed: {e}", file=sys.stderr)
        return None

def create_issue_email_link(conn, work_item_id, email_message_id, role, match_method, confidence):
    """Create an issue_email_link record. Returns True on success."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO issue_email_link (work_item_id, email_message_id, role, match_method, match_confidence)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (work_item_id, email_message_id) DO UPDATE SET
                    role = EXCLUDED.role,
                    match_method = EXCLUDED.match_method,
                    match_confidence = EXCLUDED.match_confidence
            """, (work_item_id, email_message_id, role, match_method, confidence))
        return True
    except Exception as e:
        print(f"[ERROR] create_issue_email_link failed: {e}", file=sys.stderr)
        return False

def update_work_item_status(conn, work_item_id, status, scheduled_date=None, completed_date=None, debug=False):
    """
    Update a work item's status based on status keywords found in the email.
    Only updates if the new status is a valid progression (won't reopen closed items).
    """
    # Valid statuses in the work_items table
    # Don't downgrade from closed/cancelled/denied
    with conn.cursor() as cur:
        cur.execute("SELECT status FROM work_items WHERE id = %s", (work_item_id,))
        row = cur.fetchone()
        if not row:
            return False
        current_status = row[0]

        # Don't update if already in a terminal state
        if current_status in ('closed', 'cancelled', 'denied') and status not in ('closed', 'cancelled', 'denied'):
            if debug:
                print(f"[DEBUG] Skipping status update — {current_status} → {status} would be a downgrade", file=sys.stderr)
            return False

        # Build update query
        updates = ["status = %s", "updated_date = NOW()"]
        params = [status]

        if status == 'scheduled' and scheduled_date:
            updates.append("scheduled_date = %s")
            params.append(scheduled_date)

        if status == 'closed' and completed_date:
            updates.append("completed_date = %s")
            params.append(completed_date)
        elif status == 'closed':
            updates.append("completed_date = NOW()")

        # For denied/approved, also set decision fields
        if status == 'denied':
            updates.append("decision = 'denied'")
            updates.append("decision_at = NOW()")
        elif status == 'approved':
            updates.append("decision = 'approved'")
            updates.append("decision_at = NOW()")

        params.append(work_item_id)
        query = f"UPDATE work_items SET {', '.join(updates)} WHERE id = %s"

        if debug:
            print(f"[DEBUG] Updating work_item {work_item_id}: {current_status} → {status}", file=sys.stderr)

        cur.execute(query, params)
        return True

# ============================================================
# Main processing
# ============================================================

def classify_jane_email(email_data, body):
    """
    Classify an email forwarded to Jane.
    Since these are manually forwarded by Dee, most will be HOA-related.
    Returns (classification, confidence, is_noise).
    """
    subject = (email_data.get('subject') or '').lower()
    sender = (email_data.get('from_email') or '').lower()
    body_lower = body.lower()[:3000]

    # Noise: obvious non-HOA stuff
    noise_senders = ['noreply@google.com', 'drive-shares-dm-noreply@google.com',
                     'mailer-daemon@googlemail.com', 'accounts.google.com',
                     'notifications.google.com', 'googlecloud@google.com',
                     'gemini-notes@google.com', 'googlephotos.com']
    for ns in noise_senders:
        if ns in sender:
            return ('noise', 1.0, True)

    # From Josh Hall → arc_manager_reply or josh_direct
    if sender == JOSH_EMAIL:
        if 'arc' in subject or 'architectural' in subject or 'approval' in subject:
            return ('arc_manager_reply', 0.90, False)
        return ('josh_direct', 0.85, False)

    # From boardwork@ → this is a forwarded HOA email
    if BOARDWORK_EMAIL in sender:
        if 'work order status' in subject:
            return ('wo_status_report', 0.95, False)
        if 'arc' in subject or 'architectural' in subject:
            return ('arc_process_discussion', 0.70, False)
        return ('board_email', 0.70, False)

    # If it has work order status report content
    if 'work order status report' in subject:
        return ('wo_status_report', 0.90, False)

    # If it has ARC-related content
    if 'arc' in subject or 'architectural review' in subject:
        if 'unit address' in body_lower and 'description of improvements' in body_lower:
            return ('arc_form_forward', 0.80, False)
        return ('arc_process_discussion', 0.65, False)

    # Homeowner direct — if not from known HOA senders
    if not any(d in sender for d in ['villasboulders.org', 'keystonepacific.com', 'wmbuck.net']):
        return ('homeowner_direct', 0.55, False)

    # Default: unclassified (Dee forwarded it, so it's probably HOA-related)
    return ('unclassified', 0.50, False)

def process_email(email_data, debug=False, dry_run=False, conn=None):
    """
    Process a single email: classify, parse, match to work item, persist.
    Returns structured dict with results.
    """
    body = get_combined_body(email_data)
    subject = email_data.get('subject', '')

    # Classify
    classification, confidence, is_noise = classify_jane_email(email_data, body)
    if debug:
        print(f"[DEBUG] {email_data['gmail_message_id'][:40]}... → {classification} ({confidence:.2f})", file=sys.stderr)

    result = {
        'message_id': email_data['gmail_message_id'],
        'subject': subject,
        'from': email_data.get('from_email'),
        'classification': classification,
        'confidence': confidence,
        'is_noise': is_noise,
        'actions': [],
        'work_item_id': None,
        'match_method': None,
        'match_confidence': 0.0,
        'status_update': None,
    }

    # Extract content
    wo_numbers = extract_wo_numbers(body)
    parcel_codes = extract_addresses(body)
    status_keywords = extract_status_keywords(body)
    dates = extract_dates(body)

    if debug:
        if wo_numbers:
            print(f"[DEBUG]   WO numbers: {wo_numbers}", file=sys.stderr)
        if parcel_codes:
            print(f"[DEBUG]   Parcel codes: {parcel_codes}", file=sys.stderr)
        if status_keywords:
            print(f"[DEBUG]   Status keywords: {status_keywords}", file=sys.stderr)
        if dates:
            print(f"[DEBUG]   Dates: {dates}", file=sys.stderr)

    # Skip noise — don't even insert
    if is_noise:
        result['actions'].append('skipped_noise')
        return result

    # Match to work item
    if conn:
        work_item_id, match_method, match_conf = match_work_item(conn, email_data, body, debug)
    else:
        work_item_id, match_method, match_conf = None, None, 0.0

    result['work_item_id'] = str(work_item_id) if work_item_id else None
    result['match_method'] = match_method
    result['match_confidence'] = match_conf

    # Determine link role
    has_status_info = len(status_keywords) > 0
    link_role = 'update' if has_status_info else 'related'

    # Persist
    if not dry_run and conn:
        # Insert email_message
        email_uuid = upsert_email_message(conn, email_data, classification, confidence, is_noise)
        if email_uuid:
            result['email_message_id'] = str(email_uuid)
            result['actions'].append(f'inserted_email_message: {classification}')

            # Create issue_email_link if matched
            if work_item_id:
                link_ok = create_issue_email_link(
                    conn, work_item_id, email_uuid,
                    role=link_role,
                    match_method=match_method or 'manual',
                    confidence=match_conf
                )
                if link_ok:
                    result['actions'].append(f'created_issue_email_link: {link_role} via {match_method}')

                # Update work item status if keywords + dates found
                if status_keywords:
                    for status in status_keywords:
                        scheduled_date = dates.get('scheduled') if status == 'scheduled' else None
                        completed_date = dates.get('completed') if status == 'completed' else None

                        updated = update_work_item_status(
                            conn, work_item_id, status,
                            scheduled_date=scheduled_date,
                            completed_date=completed_date,
                            debug=debug
                        )
                        if updated:
                            result['status_update'] = status
                            result['actions'].append(f'updated_work_item_status: {status}')
                            break  # Only apply first status update
        else:
            result['actions'].append('error_inserting_email_message')
    else:
        # Dry run — don't persist
        result['actions'].append(f'would_insert_email_message: {classification}')
        if work_item_id:
            result['actions'].append(f'would_create_issue_email_link: {link_role} via {match_method}')
            if status_keywords:
                result['actions'].append(f'would_update_work_item_status: {status_keywords[0]}')

    if not work_item_id and not is_noise:
        result['actions'].append('no_matching_work_item_found')

    return result

# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='Jane inbound email handler for HOA Tracker')
    parser.add_argument('--days', type=int, default=7, help='Look back N days (default: 7)')
    parser.add_argument('--dry-run', action='store_true', help='Process but don\'t write to Supabase')
    parser.add_argument('--debug', action='store_true', help='Print debug info to stderr')
    args = parser.parse_args()

    if debug_enabled := args.debug:
        print(f"[DEBUG] Jane Inbound Handler starting — days={args.days}, dry_run={args.dry_run}", file=sys.stderr)

    # Fetch emails
    try:
        emails = fetch_unread_emails(days=args.days, debug=args.debug)
    except Exception as e:
        print(json.dumps({
            'status': 'error',
            'error': f'IMAP fetch failed: {e}',
            'processed_count': 0,
        }, indent=2))
        sys.exit(1)

    if args.debug:
        print(f"[DEBUG] Fetched {len(emails)} new emails", file=sys.stderr)

    if not emails:
        print(json.dumps({
            'status': 'ok',
            'processed_count': 0,
            'matches': [],
            'updates': [],
            'message': 'No new emails to process'
        }, indent=2))
        return

    # Connect to Supabase
    conn = None
    if not args.dry_run:
        try:
            conn = get_db_connection()
        except Exception as e:
            print(f"[ERROR] Supabase connection failed: {e}", file=sys.stderr)
            # Continue in dry-run mode
            args.dry_run = True

    # Process each email
    results = []
    processed_ids = load_processed()
    new_processed = []

    for email_data in emails:
        try:
            result = process_email(email_data, debug=args.debug, dry_run=args.dry_run, conn=conn)
            results.append(result)
            new_processed.append(email_data['gmail_message_id'])
        except Exception as e:
            if args.debug:
                print(f"[ERROR] Processing failed for {email_data.get('gmail_message_id', '?')}: {e}", file=sys.stderr)
                traceback.print_exc(file=sys.stderr)
            results.append({
                'message_id': email_data.get('gmail_message_id', ''),
                'subject': email_data.get('subject', ''),
                'error': str(e),
            })

    # Commit DB changes
    if conn:
        try:
            conn.commit()
        except Exception as e:
            print(f"[ERROR] Commit failed: {e}", file=sys.stderr)
            conn.rollback()
        conn.close()

    # Update processed file
    if new_processed and not args.dry_run:
        processed_ids.update(new_processed)
        save_processed(processed_ids)

    # Build summary output
    matches = [r for r in results if r.get('work_item_id')]
    updates = [r for r in results if r.get('status_update')]
    no_match = [r for r in results if 'no_matching_work_item_found' in r.get('actions', [])]

    output = {
        'status': 'ok',
        'processed_count': len(results),
        'matched_count': len(matches),
        'updated_count': len(updates),
        'unmatched_count': len(no_match),
        'matches': [
            {
                'message_id': r.get('message_id', ''),
                'subject': r.get('subject', ''),
                'work_item_id': r['work_item_id'],
                'match_method': r.get('match_method'),
                'match_confidence': r.get('match_confidence', 0),
                'classification': r.get('classification'),
            }
            for r in matches
        ],
        'updates': [
            {
                'message_id': r.get('message_id', ''),
                'subject': r.get('subject', ''),
                'work_item_id': r['work_item_id'],
                'status_update': r['status_update'],
            }
            for r in updates
        ],
        'unmatched': [
            {
                'message_id': r.get('message_id', ''),
                'subject': r.get('subject', ''),
                'classification': r.get('classification'),
            }
            for r in no_match
        ],
        'all_results': results,
    }

    print(json.dumps(output, indent=2, default=str))

if __name__ == '__main__':
    import traceback
    main()
