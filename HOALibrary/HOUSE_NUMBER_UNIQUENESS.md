# House Number Uniqueness — Villas at the Boulders

Verified 2026-07-14 against:
`HOA_Contacts_from_LandRecords_2025-09-04_UNIT-ZIP.csv` (124 records, 59 distinct street numbers)

## Key Finding

**Given only a street number, you can infer the street name for 55 of 59 house numbers.**
The remaining 4 are genuinely ambiguous between two streets.

## The Four Ambiguous Numbers

| House Number | Possible Streets |
|---|---|
| 13689 | Boulder Pt or Rock Pt |
| 13708 | Boulder Pt or Rock Pt |
| 13717 | Boulder Pt or Rock Pt |
| 13739 | Rock Pt or Stone Cir |

For these four you can narrow to one of two streets, but cannot resolve further from
the number alone. A street name or physical context is needed.

## Unit Number (101 vs 102)

Every street number has both a Unit 101 and Unit 102. The street number alone does not
distinguish the unit. If unit-level precision is needed, it must come from signage, GPS,
or other context.

**Note:** The bronze plaques on the buildings show the full address including street name
and unit number. OCR on a plaque photo gives a complete, unambiguous address.

## Streets in the HOA

- Boulder Circle (BC)
- Boulder Point (BP)
- Broadlands Lane (BL) — 4-digit numbers starting with 35xx
- Plaster Point (PP)
- Rock Point (RP)
- Stone Circle (SC)

Broadlands Lane numbers (3510, 3522, 3534, 3546, 3555) are trivially distinguishable
from all other streets by their 4-digit format.

## Relevance

This finding came up in the context of photo organization projects
(`exif-to-parcel`, `photos-to-drive`) where photos are grouped by house and folders
are named by address. If a photo source provides only a street number (e.g., OCR of
a partial sign), the inference above applies.
