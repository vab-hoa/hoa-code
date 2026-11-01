"""Turn CINC Connect API records into Keystone Cache sheet rows.

Pure functions only: no network, no Google calls, so everything here is unit-tested
(tests/test_keystone_extract.py). The sheet layout produced here is a contract with
downstream readers (work_order_report.py, hoa-tracker/keystone_reconcile.py,
HOALibrary/KeystoneIntegration.gs, the tracker dashboard): keep tab names, column order
and headers exactly as they are.
"""
import logging
import re
from datetime import date, datetime
from zoneinfo import ZoneInfo

DENVER = ZoneInfo("America/Denver")

logger = logging.getLogger(__name__)

HEADERS = {
    "WorkOrders": ["Address", "WO Number", "Date Created", "Description", "Vendor", "Status", "Type"],
    "Violations": ["Address", "Date", "Description", "Status"],
    "ArchReviews": ["Address", "Date", "Description", "Status"],
    "Profiles": ["Address", "AccountNumber", "AccountName", "Email", "Phone", "LastUpdated", "Source"],
    # Read by build_full_directory.py by position: Name is the owners' last name(s).
    "Directory": ["Street", "Street Number", "Unit", "Full Address", "Name", "Phone", "As Of"],
}

STREET_NAMES = {"BC": "Boulder Circle", "BP": "Boulder Point", "BL": "Broadlands Lane",
                "SC": "Stone Circle", "PP": "Plaster Point", "RP": "Rock Point"}


class SchemaError(ValueError):
    """The API's records no longer look the way this code expects."""


# ── Schema checks ─────────────────────────────────────────────────────────────

def require_fields(docs, fields, label):
    """Raise if any expected field is missing from every record (i.e. renamed or removed).

    Individual records may legitimately leave a field empty; a field that never appears at
    all means the API changed and the mapping below would silently produce blanks.
    """
    if not docs:
        return
    missing = [f for f in fields if not any(f in d for d in docs)]
    if missing:
        raise SchemaError(f"{label}: API records no longer have field(s) {missing}")


# ── Dates ─────────────────────────────────────────────────────────────────────

def normalize_date(value):
    """Return YYYY-MM-DD (Denver local date) for the date formats the API uses, else ''.

    Handles ISO timestamps ("2026-10-27T18:04:00.000Z" -> local date), plain ISO dates,
    and M/D/YYYY ("10/2/2026").
    """
    if not value:
        return ""
    value = str(value).strip()
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", value)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    if re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        return value
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("Unrecognized date format: %r", value)
        return ""
    if dt.tzinfo is not None:
        dt = dt.astimezone(DENVER)
    return dt.date().isoformat()


# ── Addresses ─────────────────────────────────────────────────────────────────

STREET_CODES = {
    'rock point': 'RP', 'rock pt': 'RP',
    'boulder point': 'BP', 'boulder pt': 'BP',
    'boulder circle': 'BC', 'boulder cir': 'BC',
    'broadlands': 'BL', 'broadlands lane': 'BL',
    'stone circle': 'SC', 'stone cir': 'SC',
    'plaster point': 'PP', 'plaster pt': 'PP',
}


def standardize_address(street_number, street_name, unit):
    if not street_number or not street_name:
        return None
    street_num = re.sub(r'\D', '', str(street_number))
    if not street_num:
        return None
    street_lower = street_name.lower().strip()
    street_code = None
    for street, code in STREET_CODES.items():
        if street in street_lower:
            street_code = code
            break
    if not street_code:
        return None
    unit_suffix = ''
    if unit:
        unit_clean = re.sub(r'[#\s]', '', str(unit))
        m = re.search(r'10([12])', unit_clean)
        if m:
            unit_suffix = m.group(1)
        elif re.search(r'^[12]$', unit_clean):
            unit_suffix = unit_clean
    return f"{street_num}{street_code}{unit_suffix}"


def parse_work_location(work_location):
    """Parse free-text address ("WO: 13704 Stone Circle #102") -> (parcel code, street name)."""
    if not work_location:
        return None, None
    match = re.search(r'\d', work_location)
    if not match:
        return None, None
    address_text = work_location[match.start():].strip()
    street_num_match = re.match(r'^(\d{4,5})', address_text)
    if not street_num_match:
        return None, None
    street_number = street_num_match.group(1)
    remainder = address_text[len(street_number):].strip()
    parts = re.split(r'\s+(?:Unit|#|Apt|Apartment)\s*', remainder, flags=re.IGNORECASE)
    street_name = parts[0].strip()
    unit = ''
    if len(parts) > 1:
        unit_match = re.search(r'(10[12])', parts[1])
        if unit_match:
            unit = unit_match.group(1)
    if not unit:
        trailing = re.search(r'\s+(10[12])\s*$', remainder)
        if trailing:
            unit = trailing.group(1)
            street_name = re.sub(r'\s+10[12]\s*$', '', street_name).strip()
    return standardize_address(street_number, street_name, unit), street_name


def validate_address(standardized_address, street_name):
    """True for a full Villas parcel code with unit (e.g. 13713BP2, 3510BL1)."""
    if not standardized_address:
        return False
    m = re.match(r'^(\d{4,5})', standardized_address)
    if not m:
        return False
    street_num = int(m.group(1))
    if standardized_address[-1] not in ('1', '2'):
        return False
    if street_name and 'broadlands' in street_name.lower():
        return 3500 <= street_num <= 3599
    return 13600 <= street_num <= 13799


def unit_address(unit_name):
    """Parcel code for an API unit name like "3510 Broadlands Lane #101  Broomfield CO 80023".

    City/state/ZIP follow a double space; only the street part is parsed.
    """
    street_part = unit_name.split("  ")[0].strip() if unit_name else ""
    standardized, street_name = parse_work_location(street_part)
    if standardized and validate_address(standardized, street_name):
        return standardized
    return None


def _unit_name(record):
    unit = record.get("unit") or {}
    return unit.get("name", "") if isinstance(unit, dict) else ""


# ── Record types ──────────────────────────────────────────────────────────────

def work_order_rows(docs):
    """WorkOrders rows. Work orders without a unit address (e.g. common areas) are counted
    and logged as skipped, as the cache has always held unit work orders only."""
    require_fields(docs, ["_id", "workLocation", "createdDate", "description", "status", "category"],
                   "work orders")
    rows, skipped = [], 0
    for wo in docs:
        wo_number = str(wo.get("_id", "")).strip()
        if not re.fullmatch(r"\d+", wo_number):
            raise SchemaError(f"work orders: WO number is no longer numeric ({wo_number[:20]!r})")
        standardized, street_name = parse_work_location(wo.get("workLocation", ""))
        if not standardized or not validate_address(standardized, street_name):
            skipped += 1
            continue
        vendor = wo.get("vendor") or {}
        rows.append([
            standardized,
            wo_number,
            normalize_date(wo.get("createdDate")),
            wo.get("description", "") or "",
            (vendor.get("name") or "") if isinstance(vendor, dict) else "",  # null until assigned
            wo.get("status", "") or "",
            wo.get("category", "") or "",
        ])
    logger.info("Work orders: %d rows, %d skipped (no unit address)", len(rows), skipped)
    return rows


def violation_rows(docs):
    require_fields(docs, ["unit", "violationDate", "violationStatus"], "violations")
    rows = []
    for v in docs:
        name = _unit_name(v)
        rows.append([
            unit_address(name) or name.split("  ")[0].strip(),
            normalize_date(v.get("violationDate")),
            v.get("violationDescription") or v.get("violationTypeDescription") or "",
            v.get("violationStatus", "") or "",
        ])
    logger.info("Violations: %d rows", len(rows))
    return rows


def arch_review_rows(docs):
    require_fields(docs, ["unit", "postedDate", "requestType", "status"], "ACC reviews")
    rows = []
    for r in docs:
        name = _unit_name(r)
        rows.append([
            unit_address(name) or name.split("  ")[0].strip(),
            normalize_date(r.get("postedDate")),
            r.get("requestType", "") or "",
            r.get("status", "") or "",
        ])
    logger.info("ACC reviews: %d rows", len(rows))
    return rows


def _join_unique(values, sep):
    seen = []
    for v in values:
        v = (v or "").strip()
        if v and v not in seen:
            seen.append(v)
    return sep.join(seen)


def profile_rows(docs, today=None):
    """One Profiles row per unit.

    The API returns one record per owner contact, so a unit with two owners appears twice;
    rows are merged by parcel code (names joined " & ", emails/phones "; ").
    """
    require_fields(docs, ["name", "accountNumber", "owner"], "home-owner profiles")
    today = today or date.today().isoformat()
    units, unparsed = {}, 0
    for d in docs:
        name = d.get("name", "") or ""
        owner = d.get("owner") or {}
        address = unit_address(name)
        if not address:
            unparsed += 1
            address = name.split("  ")[0].strip()
        if not address:
            continue
        u = units.setdefault(address, {"accounts": [], "names": [], "emails": [], "phones": []})
        u["accounts"].append(str(d.get("accountNumber", "") or ""))
        u["names"].append(" ".join(p for p in ((owner.get("names") or "").strip(),
                                               (owner.get("lastNames") or "").strip()) if p))
        u["emails"].append(owner.get("email", "") or "")
        u["phones"].append(owner.get("phoneNumber", "") or "")
    rows = [[address,
             _join_unique(u["accounts"], "; "),
             _join_unique(u["names"], " & "),
             _join_unique(u["emails"], "; "),
             _join_unique(u["phones"], "; "),
             today,
             "Keystone"]
            for address, u in sorted(units.items())]
    logger.info("Profiles: %d contacts merged into %d units (%d unparsed addresses)",
                len(docs), len(rows), unparsed)
    return rows


def format_phone(value):
    """(303) 555-1234 for 10-digit US numbers (a leading 1 is dropped); anything else as given."""
    digits = re.sub(r"\D", "", value or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return (value or "").strip()


def _name_words(name):
    return set(re.findall(r"[a-z]+", (name or "").lower()))


def directory_rows(docs, as_of, previous=None):
    """Directory tab rows (one per unit) from the home-owner/grouping records.

    Name holds the owners' last name(s), joined " & " when a unit has several owners with
    different last names; Phone is the first owner phone. Units whose address can't be
    parsed are left out (the Directory is keyed by street, number and unit).

    previous: the tab's current rows. Keystone has no phone on file for some owners, so
    when it has none, the phone already in the tab is kept, but only if the name still
    shares a word with the previous name (same family): a new owner never inherits the
    last owner's number.
    """
    prev = {(r[1], r[2]): r + [""] * (7 - len(r)) for r in (previous or []) if len(r) >= 3}
    units = {}
    for d in docs:
        address = unit_address(d.get("name", "") or "")
        if not address:
            continue
        owner = d.get("owner") or {}
        u = units.setdefault(address, {"last": [], "phones": []})
        u["last"].append((owner.get("lastNames") or "").strip())
        u["phones"].append(owner.get("phoneNumber") or "")
    rows = []
    for address, u in sorted(units.items()):
        m = re.match(r"^(\d{4,5})([A-Z]{2})([12])$", address)
        number, code, unit = m.group(1), m.group(2), "10" + m.group(3)
        street = STREET_NAMES[code]
        name = _join_unique(u["last"], " & ")
        phone = next((format_phone(p) for p in u["phones"] if (p or "").strip()), "")
        old = prev.get((number, unit))
        if not phone and old and old[5] and _name_words(old[4]) & _name_words(name):
            phone = old[5]
        rows.append([street, number, unit, f"{number} {street} #{unit}", name, phone, as_of])
    logger.info("Directory: %d units", len(rows))
    return rows
