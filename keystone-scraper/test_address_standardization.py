#!/usr/bin/env python3
"""
Test the address standardization function to ensure it works correctly.
"""
import re

def standardize_address(street_number, street_name, unit):
    """
    Standardize address to HOA format.

    Examples:
        "13738", "Rock Point", "101" -> "13738RP1"
        "13747", "Boulder Point", "202" -> "13747BP2"

    Args:
        street_number: Street number (e.g., "13738")
        street_name: Street name (e.g., "Rock Point")
        unit: Unit number (e.g., "101", "#101", or "")

    Returns:
        Standardized address string or None if cannot parse
    """
    if not street_number or not street_name:
        return None

    # Clean street number (remove non-digits)
    street_num = re.sub(r'\D', '', str(street_number))
    if not street_num:
        return None

    # Street name to code mapping
    street_codes = {
        'rock point': 'RP',
        'boulder point': 'BP',
        'broadlands': 'BL',
        'stone circle': 'SC',
        'plaster point': 'PP'
    }

    # Find matching street code
    street_lower = street_name.lower().strip()
    street_code = None
    for street, code in street_codes.items():
        if street in street_lower:
            street_code = code
            break

    if not street_code:
        print(f"Unknown street name: {street_name}")
        return None

    # Extract and standardize unit number
    unit_suffix = ''
    if unit:
        # Remove # and spaces
        unit_clean = re.sub(r'[#\s]', '', str(unit))
        # Extract the unit pattern (e.g., 101 -> 1, 202 -> 2)
        unit_match = re.search(r'(\d)0[12]', unit_clean)
        if unit_match:
            unit_suffix = unit_match.group(1)
        elif re.search(r'^\d$', unit_clean):
            # Already a single digit
            unit_suffix = unit_clean

    return f"{street_num}{street_code}{unit_suffix}"

# Test cases
test_cases = [
    # (street_number, street_name, unit, expected)
    ("13738", "Rock Point", "101", "13738RP1"),
    ("13738", "Rock Point", "#101", "13738RP1"),
    ("13738", "Rock Point", "1", "13738RP1"),
    ("13747", "Rock Point", "102", "13747RP1"),
    ("13747", "Rock Point", "202", "13747RP2"),
    ("13747", "Boulder Point", "201", "13747BP2"),
    ("13747", "Boulder Point", "", "13747BP"),
    ("13800", "Broadlands", "101", "13800BL1"),
    ("13900", "Stone Circle", "102", "13900SC1"),
    ("14000", "Plaster Point", "201", "14000PP2"),
]

print("Testing address standardization:")
print("=" * 80)

all_passed = True
for street_num, street_name, unit, expected in test_cases:
    result = standardize_address(street_num, street_name, unit)
    status = "✓ PASS" if result == expected else "✗ FAIL"
    if result != expected:
        all_passed = False
    print(f"{status}: ({street_num}, {street_name}, {unit}) -> {result} (expected: {expected})")

print("=" * 80)
if all_passed:
    print("All tests passed!")
else:
    print("Some tests failed!")
