# HOA Address Format Specification

**Complete reference for Villas at the Boulders address standardization**

**Version:** 1.0
**Last Updated:** February 15, 2026
**Applies To:** HOALibrary v4+

---

## Overview

The HOA uses a compact address format for consistent data storage and matching. This document explains how addresses are standardized and provides examples of supported variations.

**Purpose:**
- Ensure consistent address formatting across all systems
- Enable reliable matching between spreadsheets, forms, and Drive folders
- Support common address variations and abbreviations

---

## Standard Format

### Pattern

```
[Street Number][Street Code][Unit Digit]
```

### Components

**Street Number:** 4-5 digits (required)
- Example: `13737`, `13622`, `13704`
- Must appear at start of address

**Street Code:** 2-letter abbreviation (required)
- See Street Codes table below
- Case-insensitive in input, uppercase in output

**Unit Digit:** Single digit - 1 or 2 (optional)
- `1` = Unit 101
- `2` = Unit 102
- Omit for building-wide address

### Examples

| Full Address | Standardized | Type |
|--------------|--------------|------|
| 13737 Rock Point Unit 102 | **13737RP2** | Unit-specific |
| 13737 Rock Point #101 | **13737RP1** | Unit-specific |
| 13737 Rock Point | **13737RP** | Building-wide |
| 13704 Stone Circle Unit 102 | **13704SC2** | Unit-specific |
| 13622 Boulder Circle #101 | **13622BC1** | Unit-specific |

---

## Street Codes

### Complete List

| Street Name | Code | Full Name | Valid Variations |
|-------------|------|-----------|------------------|
| **BL** | Broadlands | Broadlands Lane | Broadlands, Broadlands Ln, Broadlands L |
| **BP** | Boulder Point | Boulder Point | Boulder Pt, Boulder P |
| **RP** | Rock Point | Rock Point | Rock Pt, Rock P |
| **SC** | Stone Circle | Stone Circle | Stone Cir, Stone Cr, Stone C |
| **BC** | Boulder Circle | Boulder Circle | Boulder Cir, Boulder Cr, Boulder C |
| **PP** | Plaster Point | Plaster Point | Plaster Pt, Plaster P |

### Abbreviation Rules

**Circle:**
- Full: `Circle`
- Abbreviated: `Cir`, `Cr`, `C`

**Point:**
- Full: `Point`
- Abbreviated: `Pt`, `P`

**Lane:**
- Full: `Lane`
- Abbreviated: `Ln`, `L`

**All are case-insensitive in input.**

---

## Unit Number Formats

### Supported Formats

The library recognizes multiple unit number formats:

| Format | Example | Extracts |
|--------|---------|----------|
| Unit 101 | "13737 Rock Point Unit 101" | "1" |
| Unit 102 | "13737 Rock Point Unit 102" | "2" |
| #101 | "13737 Rock Point #101" | "1" |
| #102 | "13737 Rock Point #102" | "2" |
| Apt 101 | "13737 Rock Point Apt 101" | "1" |
| Apt 102 | "13737 Rock Point Apt 102" | "2" |
| Apartment 101 | "13737 Rock Point Apartment 101" | "1" |
| Trailing 101 | "13737 Rock Point 101" | "1" |
| Trailing 102 | "13737 Rock Point 102" | "2" |

### Important Notes

**Only 101 and 102 are recognized:**
- Unit 101 → Unit 1 (digit: "1")
- Unit 102 → Unit 2 (digit: "2")
- Other numbers are ignored

**Last digit is canonical:**
- 101 → "1"
- 102 → "2"

**No unit number means building-wide:**
- "13737 Rock Point" → "13737RP" (no unit digit)

---

## Input Address Variations

### Supported Formats

All of these inputs produce the same standardized output:

**Input Examples (all → "13737RP2"):**
```
13737 Rock Point Unit 102
13737 Rock Point #102
13737 Rock Pt Unit 102
13737 Rock P #102
13737 Rock Point Apt 102
13737 Rock Point Apartment 102
13737 Rock Point 102
13737 ROCK POINT UNIT 102  (case-insensitive)
13737 rock point unit 102  (case-insensitive)
```

**Input Examples (all → "13737RP"):**
```
13737 Rock Point
13737 Rock Pt
13737 Rock P
13737 ROCK POINT
13737 rock point
```

---

## Building vs. Unit Addresses

### Building-Wide Address

**Format:** `[Number][Code]` (no unit digit)
**Example:** `13737RP`

**Represents:**
- The entire building at that address
- Data applicable to both Unit 101 and Unit 102
- Shared facilities or building-level information

**Use Cases:**
- Building-wide photos (e.g., roof, siding)
- Shared systems (e.g., HVAC, foundation)
- General building information

### Unit-Specific Address

**Format:** `[Number][Code][1 or 2]`
**Examples:** `13737RP1`, `13737RP2`

**Represents:**
- Specific unit within building
- Unit 101 (ends in 1) or Unit 102 (ends in 2)
- Data specific to one unit

**Use Cases:**
- Unit-specific photos (e.g., interior, deck)
- Unit owner information
- Individual maintenance records

### Smart Building Matching

When searching for unit-specific address, HOA Library can return building-wide data too:

**Example:**
```javascript
// Search for unit 102
const data = getBuildingDataFromSheet(sheet, "13737RP2");

// Returns data for:
// - 13737RP2 (unit 102 specific)
// - 13737RP1 (unit 101 - same building)
// - 13737RP (building-wide)
```

This ensures comprehensive reports include all relevant information.

---

## Parsing Algorithm

### Step-by-Step Process

1. **Extract Street Number**
   - Match 4-5 digits at start
   - If not found, return empty string (invalid)

2. **Extract Unit Number (if present)**
   - Look for "Unit 101", "#102", "Apt 101", etc.
   - Also check for trailing "101" or "102"
   - Extract last digit (1 or 2)

3. **Identify Street**
   - Search for street name keywords
   - Check all variations (full name + abbreviations)
   - Match case-insensitively
   - Look up corresponding code (BL, BP, RP, etc.)

4. **Build Standardized Address**
   - Combine: `[Number] + [Code] + [Unit Digit if present]`
   - Example: "13737" + "RP" + "2" = "13737RP2"

### Invalid Inputs

**Returns empty string if:**
- No street number found
- Street name doesn't match any known street
- Street number not 4-5 digits

**Examples of Invalid Addresses:**
```
"123 Rock Point"          (street number too short)
"Rock Point 102"          (no street number at start)
"13737 Main Street"       (unknown street)
"13737 RP"               (code-only input - not recognized)
```

---

## Reverse Conversion (Display Format)

### From Standardized to Readable

The library can convert standardized addresses back to human-readable format:

**Function:** `getDisplayAddress(standardizedAddress)`

**Examples:**

| Input | Output |
|-------|--------|
| 13737RP2 | 13737 Rock Point #102 |
| 13737RP1 | 13737 Rock Point #101 |
| 13737RP | 13737 Rock Point |
| 13704SC2 | 13704 Stone Circle #102 |
| 13622BC1 | 13622 Boulder Circle #101 |

**Format Pattern:**
```
[Number] [Full Street Name] [#Unit if present]
```

---

## Common Edge Cases

### 1. Mixed Case Input
**Input:** `13737 ROCK POINT UNIT 102`
**Output:** `13737RP2`
**Handled:** Yes, case-insensitive

### 2. Extra Whitespace
**Input:** `13737  Rock  Point   Unit  102`
**Output:** `13737RP2`
**Handled:** Yes, whitespace is normalized

### 3. Abbreviations
**Input:** `13737 Rock Pt #102`
**Output:** `13737RP2`
**Handled:** Yes, common abbreviations recognized

### 4. No Unit Number
**Input:** `13737 Rock Point`
**Output:** `13737RP`
**Handled:** Yes, building-wide address

### 5. Unit at End
**Input:** `13737 Rock Point 102`
**Output:** `13737RP2`
**Handled:** Yes, trailing unit number recognized

### 6. Non-Standard Unit Numbers
**Input:** `13737 Rock Point Unit 103`
**Output:** `13737RP` (no unit digit)
**Handled:** Unit ignored (only 101/102 valid)

### 7. Spelled-Out Numbers
**Input:** `thirteen thousand Rock Point`
**Output:** Empty string
**Handled:** No, must use digits

### 8. Wrong Street Name
**Input:** `13737 Main Street`
**Output:** Empty string
**Handled:** No, street not in HOA

---

## Usage Examples

### Example 1: Form Input Validation

```javascript
function validateAddress(userInput) {
  const standardized = HOALibrary.standardizeHOAAddress(userInput);

  if (!standardized) {
    return {
      valid: false,
      message: "Address not recognized. Please use format: '13737 Rock Point Unit 102'"
    };
  }

  return {
    valid: true,
    standardized: standardized,
    message: "Address accepted"
  };
}
```

### Example 2: Folder Matching

```javascript
function findPhotosFolder(address) {
  // Standardize input
  const std = HOALibrary.standardizeHOAAddress(address);
  const building = HOALibrary.getBuildingAddress(address);

  // Try unit-specific folder first
  let folder = findFolder(std);

  // If not found, try building-wide
  if (!folder) {
    folder = findFolder(building);
  }

  return folder;
}
```

### Example 3: Data Aggregation

```javascript
function getCompletePropertyData(address) {
  const building = HOALibrary.getBuildingAddress(address);
  const unit = HOALibrary.getUnitFromAddress(address);

  console.log("Building:", building);
  console.log("Unit:", unit || "None (building-wide)");

  // Get all related data
  const allData = getBuildingDataFromSheet(sheet, building);

  return {
    building: building,
    unit: unit,
    dataRows: allData
  };
}
```

---

## Testing

### Test Cases

The library includes built-in tests:

```javascript
HOALibrary.testHOAAddressStandardization();
```

**Test Coverage:**

| Test Input | Expected Output | Category |
|------------|----------------|----------|
| "13737 Rock Point Unit 102" | "13737RP2" | Standard format |
| "13737 Rock Pt #102" | "13737RP2" | Abbreviated street |
| "13737 ROCK POINT 102" | "13737RP2" | Uppercase + trailing unit |
| "13737 Rock Point" | "13737RP" | Building-wide |
| "13704 Stone Circle Unit 101" | "13704SC1" | Different street |
| "13622 Boulder Circle #102" | "13622BC2" | Another street |
| "13737 Rock Point Apt 102" | "13737RP2" | Apartment keyword |
| "Invalid Address" | "" | Invalid input |
| "123 Rock Point" | "" | Too few digits |
| "13737 Main Street" | "" | Unknown street |

---

## Integration Notes

### For Spreadsheets

**Column Format Recommendation:**
- Store addresses in standardized format: "13737RP2"
- Add display column with formula: `=getDisplayAddress(A2)`

**Search Strategy:**
1. Standardize user input first
2. Match against standardized column
3. Consider building-wide matches

### For Drive Folders

**Naming Convention:**
- Use standardized format: "13737RP2" or "13737RP"
- Both formats accepted for matching
- Case-sensitive in folder names (use uppercase)

**Search Strategy:**
1. Standardize input address
2. Try exact match first
3. Fall back to building-wide
4. Log mismatches for manual review

### For Forms

**Input Field:**
- Free text input (don't restrict format)
- Validate and standardize on submission
- Show standardized version in confirmation

**Example Validation:**
```javascript
const input = formResponse.getItemResponses()[0].getResponse();
const std = HOALibrary.standardizeHOAAddress(input);

if (!std) {
  throw new Error("Invalid address format. Example: 13737 Rock Point Unit 102");
}

// Use std for all data lookups
```

---

## Version History

**v1.0 (Feb 15, 2026)** - Initial specification
- Defined 6 street codes
- Unit number handling (101/102)
- Building vs. unit distinction
- Common abbreviation support

---

## Future Enhancements

**Planned:**
- Additional street codes if HOA expands
- Support for more unit number formats if needed
- International address support (if applicable)

**Not Planned:**
- Spelled-out numbers (too complex, low value)
- Non-standard unit numbers (103+)
- Non-HOA streets

---

**Maintained By:** Dee Buck
**Questions:** admin@villasboulders.org
**Related:** HOALibrary/README.md, PropertyReport/CONFIGURATION.md
