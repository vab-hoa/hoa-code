# Property Report Section Format Guide

This document describes the standard format and theme for Property Report sections.
All report sections should follow this guide to maintain visual consistency.

## Color Scheme

| Element | Color | Hex Code |
|---------|-------|----------|
| Primary heading | Navy blue | `#1a3c5e` |
| Secondary heading | Dark gray | `#555555` |
| Body text | Dark gray | `#333333` |
| Muted text / captions | Medium gray | `#666666` |
| Subtle text (dates, footer) | Light gray | `#888888` |
| Error/placeholder text | Very light gray | `#999999` |
| Table label background | Light gray | `#f5f5f5` |
| Table border | Light gray | `#dddddd` |

## Typography

- **Font family**: Arial
- **Heading 1** (section title): Centered, navy blue (#1a3c5e)
- **Heading 2** (address): Centered, dark gray (#555555)
- **Heading 3** (subsections): Left-aligned, navy blue (#1a3c5e)
- **Body text**: 10pt, dark gray (#333333)
- **Captions**: 9pt, italic, medium gray (#666666)
- **Footer**: 9pt, light gray (#888888)

## Document Structure

### Page 1: Header and Data

```
[HEADING 1: Section Title - centered, navy]

[HEADING 2: Property Address - centered, gray]

Generated: [timestamp - centered, 10pt, light gray]

[empty line]

[HEADING 3: Summary Title - left, navy]
[italic note about data scope - 9pt, gray]

[empty line]

[2-column data table]
```

### Page 2+: Photos (if applicable)

```
[PAGE BREAK - always start photos on new page]

[HEADING 2: Photos Section Title - centered, navy]

[empty line]

[Photo 1]
[Caption - centered, 9pt, italic, gray]

[Photo 2]
[Caption - centered, 9pt, italic, gray]

...
```

### Footer (last page)

```
[empty line]
[horizontal rule]
Villas at the Boulders HOA [centered, 9pt, gray]
```

## Data Tables

Use a 2-column table format for field/value pairs:

- **Left column (labels)**: 150px width, light gray background (#f5f5f5), bold text
- **Right column (values)**: Auto width, white background, normal text
- **Border**: 1px, light gray (#dddddd)
- **Cell padding**: 6px top/bottom, 8px left/right
- **Font size**: 10pt

Multiple records should be separated by:
```
[empty paragraph]
[horizontal rule]
[empty paragraph]
```

## Photo Sizing

Photos are sized to fit 2 per page comfortably:

```javascript
var PHOTO_MAX_WIDTH = 350;   // ~4.9 inches
var PHOTO_MAX_HEIGHT = 250;  // ~3.5 inches
```

Scale calculation (maintain aspect ratio):
```javascript
var widthRatio = PHOTO_MAX_WIDTH / width;
var heightRatio = PHOTO_MAX_HEIGHT / height;
var ratio = Math.min(widthRatio, heightRatio, 1); // Don't scale up
```

## Photo Captions

- Simple sequential numbering: "Photo 1", "Photo 2", etc.
- Additional context can be appended: "Photo 1 - Before Repair"
- Style: centered, 9pt, italic, gray (#666666)
- Spacing after caption: 12pt

## Page Breaks

- **Always** add a page break before the photos section
- Data tables stay on page 1 (or first few pages if long)
- Photos start fresh on their own page(s)

## Code Template

```javascript
function generateSection___(address, displayAddress, data) {
  const sectionLabel = 'Section Name';

  // Create document
  const doc = DocumentApp.create('Report_' + address + '_type_' + dateStr);
  const body = doc.getBody();
  body.setFontFamily('Arial');

  // === PAGE 1: Header ===
  body.appendParagraph(sectionLabel)
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .setForegroundColor('#1a3c5e');

  body.appendParagraph(displayAddress)
    .setHeading(DocumentApp.ParagraphHeading.HEADING2)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .setForegroundColor('#555555');

  body.appendParagraph('Generated: ' + new Date().toLocaleString('en-US', {timeZone: 'America/Denver'}))
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .setFontSize(10)
    .setForegroundColor('#888888');

  body.appendParagraph('');

  // === Data Section ===
  body.appendParagraph('Summary Title')
    .setHeading(DocumentApp.ParagraphHeading.HEADING3)
    .setForegroundColor('#1a3c5e');

  body.appendParagraph('Note about data scope')
    .setFontSize(9)
    .setItalic(true)
    .setForegroundColor('#666666');

  body.appendParagraph('');

  // [Add data table here]

  // === PAGE 2+: Photos ===
  if (hasPhotos) {
    body.appendPageBreak();

    body.appendParagraph('Photos')
      .setHeading(DocumentApp.ParagraphHeading.HEADING2)
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
      .setForegroundColor('#1a3c5e');

    body.appendParagraph('');

    // [Add photos here with captions]
  }

  // === Footer ===
  body.appendParagraph('');
  body.appendHorizontalRule();
  body.appendParagraph('Villas at the Boulders HOA')
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .setFontSize(9)
    .setForegroundColor('#888888');

  doc.saveAndClose();

  // Set sharing and return
  var file = DriveApp.getFileById(doc.getId());
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { label: sectionLabel, url: file.getUrl() };
}
```

## Existing Sections Using This Format

- `SectionGutters.js` - Gutter Cleaning & Inspection
- `SectionWoodTrim.js` - Wood Trim Evaluation
- `SectionHOAAccount.js` - HOA Account (uses same color scheme, simpler layout)
- `SectionPropertyActivity.js` - Work Orders & Architectural Requests

## Future Sections

When creating new sections (concrete evaluation, window wells, etc.):

1. Copy the template from an existing section (SectionGutters.js is a good model)
2. Follow the color scheme and typography exactly
3. Use 2-column tables for data
4. Force page break before photos
5. Size photos for 2 per page
6. Use sequential "Photo N" captions
7. Add entry to `ReportConfig.js` with dated label (e.g., "Spring 2026 Concrete Evaluation")
