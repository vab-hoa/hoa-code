"""
Address Standardization Functions for HOA
Port from JavaScript (Apps Script) to Python.

Convert addresses to compact HOA format:
  street_number (4-5 digits) + street_code (2 letters) + optional unit_digit (1 or 2)

Example: "13737 Rock Point #102" → "13737RP2"
"""

import re
import sys

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

STREET_CODES = {
    "broadlands": "BL",
    "boulder point": "BP",
    "rock point": "RP",
    "stone circle": "SC",
    "boulder circle": "BC",
    "plaster point": "PP",
}

# Reverse mapping for display conversion
STREET_NAMES = {
    "BL": "Broadlands",
    "BP": "Boulder Point",
    "RP": "Rock Point",
    "SC": "Stone Circle",
    "BC": "Boulder Circle",
    "PP": "Plaster Point",
}

# Abbreviations for street types
ABBREVIATIONS = {
    "circle": ["circle", "cir", "cr", "c"],
    "point": ["point", "pt", "p"],
    "lane": ["lane", "ln", "l"],
}


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------

def standardize_address(address: str) -> str:
    """
    Convert any HOA address into compact standardized form.

    Accepts full addresses ("13737 Rock Point #102, Broomfield, CO 80023"),
    partial addresses ("13737 Rock Pt #102"), or already-standardized
    addresses ("13737RP2").

    Returns a string like "13737RP2", or the street number alone if the
    street name can't be matched.  Returns "" if no valid street number
    is found or the input is empty.
    """
    if not address:
        return ""

    text = str(address).strip()

    # Already standardized? (e.g. "3555BL1", "13737RP")
    if re.match(r"^\d{4,5}[A-Z]{2}[12]?$", text):
        return text.upper()

    normalized = text.lower().strip()

    # --- Extract street number (4-5 digits at start) ---
    street_num_match = re.match(r"^(\d{4,5})\b", normalized)
    if not street_num_match:
        print(f"No valid street number found in: {address}", file=sys.stderr)
        return ""

    street_number = street_num_match.group(1)

    # --- Extract unit number (101 or 102) ---
    unit_digit = ""

    # Format: #101, Unit 101, Apt 101, Apartment 101
    unit_match = re.search(r"(?:#|unit|apt|apartment)\s*(\d{3})", normalized)
    if unit_match and unit_match.group(1) in ("101", "102"):
        unit_digit = unit_match.group(1)[-1]  # last digit → "1" or "2"
    else:
        # Standalone 101/102 not part of a 5-digit zip code
        standalone_match = re.search(r"\b(10[12])(?!\d)", normalized)
        if standalone_match:
            unit_digit = standalone_match.group(1)[-1]

    # --- Find the street code ---
    # Remove unit info for cleaner street matching
    street_search = re.sub(r"(?:#|unit|apt|apartment)\s*\d+", "", normalized)
    # Remove standalone unit numbers (101, 102) but not zip codes
    street_search = re.sub(r"\b(10[12])(?!\d)", "", street_search)

    street_code = ""
    for street_name, code in STREET_CODES.items():
        parts = street_name.split()
        all_parts_found = True

        for part in parts:
            part_found = False
            abbrev_list = ABBREVIATIONS.get(part)

            if abbrev_list:
                for abbrev in abbrev_list:
                    if re.search(r"\b" + abbrev + r"\b", street_search):
                        part_found = True
                        break
            else:
                if re.search(r"\b" + part + r"\b", street_search):
                    part_found = True

            if not part_found:
                all_parts_found = False
                break

        if all_parts_found:
            street_code = code
            break

    if not street_code:
        print(f"Could not match street name in: {address}", file=sys.stderr)
        return street_number  # Return at least the street number

    return street_number + street_code + unit_digit


def get_building_address(address: str) -> str:
    """
    Extract building address (no unit digit) from any address format.

    Examples:
        "13737RP2"              → "13737RP"
        "13737RP"               → "13737RP"
        "13737 Rock Point #102" → "13737RP"
    """
    standardized = standardize_address(address)
    return re.sub(r"[12]$", "", standardized)


def get_unit_from_address(address: str) -> str | None:
    """
    Extract unit number ('1' or '2') from an address.

    Returns '1', '2', or None if the address has no unit (building-only).
    """
    standardized = standardize_address(address)
    match = re.search(r"([12])$", standardized)
    return match.group(1) if match else None


def get_display_address(standardized: str) -> str:
    """
    Convert a standardized address back to human-readable display form.

    Examples:
        "13737RP2"  → "13737 Rock Point Unit 102"
        "13664SC1"  → "13664 Stone Circle Unit 101"
        "13650BC"   → "13650 Boulder Circle"
    """
    if not standardized:
        return ""

    # Extract street number
    street_num_match = re.match(r"^(\d{4,5})", standardized)
    if not street_num_match:
        return standardized

    street_number = street_num_match.group(1)
    remainder = standardized[len(street_number):]

    # Extract street code + optional unit digit
    code_match = re.match(r"^([A-Z]{2})([12]?)$", remainder)
    if not code_match:
        return standardized

    street_code = code_match.group(1)
    unit_digit = code_match.group(2)

    street_name = STREET_NAMES.get(street_code)
    if not street_name:
        return standardized

    display = f"{street_number} {street_name}"
    if unit_digit:
        display += f" Unit 10{unit_digit}"

    return display


# ---------------------------------------------------------------------------
# Test suite
# ---------------------------------------------------------------------------

def _run_tests() -> None:
    """Run comprehensive tests and report results."""

    tests = [
        # (description, function, args, expected)
        # --- standardize_address ---
        ("Full address with # and city/state/zip",
         standardize_address,
         ["13738 Rock Point #101, Broomfield, CO 80023"],
         "13738RP1"),

        ("Abbreviated 'Pt' with #",
         standardize_address,
         ["13737 Rock Pt #102"],
         "13737RP2"),

        ("Broadlands Lane with #",
         standardize_address,
         ["3522 Broadlands Lane #102, Broomfield, CO 80023"],
         "3522BL2"),

        ("Already standardized with unit",
         standardize_address,
         ["13737RP2"],
         "13737RP2"),

        ("Already standardized without unit (5-digit)",
         standardize_address,
         ["3555BL1"],
         "3555BL1"),

        ("Already standardized, no unit",
         standardize_address,
         ["9102BC"],
         "9102BC"),

        ("Boulder Point with 'unit' keyword",
         standardize_address,
         ["13662 Boulder Point, unit 102"],
         "13662BP2"),

        ("Boulder Circle, no unit",
         standardize_address,
         ["9102 Boulder Circle"],
         "9102BC"),

        ("Standalone unit number (no # prefix)",
         standardize_address,
         ["13737 Rock Point 101"],
         "13737RP1"),

        ("No unit at all",
         standardize_address,
         ["13737 Rock Point"],
         "13737RP"),

        ("Empty string",
         standardize_address,
         [""],
         ""),

        ("None input",
         standardize_address,
         [None],
         ""),

        ("Stone Circle",
         standardize_address,
         ["13664 Stone Circle #101"],
         "13664SC1"),

        ("Plaster Point",
         standardize_address,
         ["14001 Plaster Pt #102"],
         "14001PP2"),

        ("Broadlands with 'Ln' abbreviation",
         standardize_address,
         ["3555 Broadlands Ln #101"],
         "3555BL1"),

        # --- get_building_address ---
        ("Building from standardized+unit",
         get_building_address,
         ["13737RP2"],
         "13737RP"),

        ("Building from standardized no unit",
         get_building_address,
         ["13737RP"],
         "13737RP"),

        ("Building from full address",
         get_building_address,
         ["13737 Rock Point #102"],
         "13737RP"),

        ("Building from 4-digit address",
         get_building_address,
         ["9102BC"],
         "9102BC"),

        # --- get_unit_from_address ---
        ("Unit 2 from standardized",
         get_unit_from_address,
         ["13737RP2"],
         "2"),

        ("Unit 1 from standardized",
         get_unit_from_address,
         ["13737RP1"],
         "1"),

        ("Unit from full address",
         get_unit_from_address,
         ["13737 Rock Point #102"],
         "2"),

        ("No unit → None",
         get_unit_from_address,
         ["13737RP"],
         None),

        ("No unit from full address → None",
         get_unit_from_address,
         ["9102 Boulder Circle"],
         None),

        # --- get_display_address ---
        ("Display with unit 2",
         get_display_address,
         ["13737RP2"],
         "13737 Rock Point Unit 102"),

        ("Display with unit 1",
         get_display_address,
         ["13664SC1"],
         "13664 Stone Circle Unit 101"),

        ("Display no unit",
         get_display_address,
         ["13650BC"],
         "13650 Boulder Circle"),

        ("Display empty",
         get_display_address,
         [""],
         ""),

        ("Display Broadlands",
         get_display_address,
         ["3555BL1"],
         "3555 Broadlands Unit 101"),

        ("Display Plaster Point",
         get_display_address,
         ["14001PP2"],
         "14001 Plaster Point Unit 102"),
    ]

    passed = 0
    failed = 0

    print(f"Running {len(tests)} tests...\n")

    for desc, func, args, expected in tests:
        try:
            result = func(*args)
        except Exception as exc:
            result = f"EXCEPTION: {exc}"

        if result == expected:
            passed += 1
            # Only print failures and a final summary to keep output clean
        else:
            failed += 1
            print(f"FAIL: {desc}")
            print(f"  func: {func.__name__}({', '.join(repr(a) for a in args)})")
            print(f"  expected: {expected!r}")
            print(f"  got:      {result!r}")
            print()

    print(f"{'=' * 50}")
    print(f"Results: {passed} passed, {failed} failed, {len(tests)} total")
    if failed:
        print("❌ Some tests FAILED")
        sys.exit(1)
    else:
        print("✅ All tests PASSED")


if __name__ == "__main__":
    _run_tests()
