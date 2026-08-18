# Stage 0 Recon: ARC Details Popup Selectors & Structure

## Discovery Summary
Successfully identified all critical selectors for the ARC Details popup and its contents on the Keystone portal.

## Key Findings

### 1. Details Button Selector
- **Exact ID Pattern**: `btnBACCDetail{ACCT_RECORD_ID}_I`
- **For property 13738RP2 (Air Conditioner)**: `btnBACCDetail613824_I`
- **Locator Strategy**: `By.ID` with pattern `btnBACCDetail{acct_record_id}_I`
- **Parent Grid**: `tr[id^='GridBoardACCList_DXDataRow']` (DevExpress data grid rows)

### 2. Popup Container (VERIFIED VISIBLE)
- **Popup ID**: `BoardACCPopUp_PWC-1`
- **Parent Panel ID**: `BoardACCPopUp_PW-1`
- **CSS Classes**: `dxpc-content` (DevExpress popup control)
- **Status**: VISIBLE (confirmed in browser after Details click)
- **Type**: DevExpress PopupControl (`dxpcLite dxpclW`)

### 3. Close Button
- **Close Button ID**: `buttonCloseACCRequestStatus_I`
- **Full Button Div ID**: `buttonCloseACCRequestStatus`
- **Label**: "Close"
- **Type**: dxButton

### 4. Popup Fields (HTML Structure)
All fields visible in `BoardACCPopUp_PWC-1` > `#modal-body`:

```
- Homeowner: <label>Richard J. & Ruth Afton Dancey</label>
- Address: <label>13738 Rock Point #102</label>
- ACC Type: <label>Air Conditioner</label>
- Status: <label>Closed</label>
- Request Date: <label>10/22/2025</label>
- Sent to Committee Date: <label>10/22/2025</label>
- Auto Approval Date: <label><font color="red">11/21/2025</font></label>
- Committee Response Date: <label></label>
```

### 5. Document Links (CONFIRMED PRESENT)
Documents are in the "Attachments" section with two view modes: Gallery (default) and List.

#### Link Types Found:
1. **Download Icon**: 
   - Element: `<i class="fa fa-download" onclick="downloadBoardACCAttachment(2036125)"></i>`
   - Handler: `downloadBoardACCAttachment(attachmentId)`
   
2. **Preview Icon**:
   - Element: `<i class="fa fa-eye" onclick="ShowImagePreview(2036125, 0)"></i>`
   - Handler: `ShowImagePreview(attachmentId, rowIndex)`

#### Document Link Selectors:
- **CSS**: `i.fa.fa-download` (within popup)
- **CSS (Alternative)**: `i[onclick*="downloadBoardACCAttachment"]`
- **XPath**: `.//i[@class="fa fa-download"]` (within popup)

#### Attachments Grid:
- **Grid ID**: `BoardACCAttachmentsGrid`
- **Grid Prefix**: `BoardACCAttachmentsGrid_DXDataRow`
- **Columns**: Date | File Name | Size | Actions (Preview + Download)

#### Example Attachment:
```
File: Dancey ARC Application for HVAC System 101525.pdf
Size: 6.2 MB
Attachment ID: 2036125
```

### 6. HTML Markup Pattern for Future Reference

```html
<div class="dxpc-content" id="BoardACCPopUp_PWC-1">
  <div class="modal-body" id="modal-body">
    <!-- Form fields above -->
    <h2>Attachments</h2>
    <div id="BoardACCAttachmentsGrid">
      <!-- Gallery View (default) -->
      <div id="attachmentGalleryView">
        <!-- Image thumbnails with fa-eye and fa-download icons -->
        <i class="fa fa-eye" onclick="ShowImagePreview(attachmentId, 0)"></i>
        <i class="fa fa-download" onclick="downloadBoardACCAttachment(attachmentId)"></i>
      </div>
      <!-- List View (optional) -->
      <table id="BoardACCAttachmentsGrid">
        <tr id="BoardACCAttachmentsGrid_DXDataRow0">
          <td>Date</td>
          <td>Filename</td>
          <td>Size</td>
          <td><!-- Download/Preview icons --></td>
        </tr>
      </table>
    </div>
    <!-- Notes Grid for detailed notes/comments -->
    <div id="BoardACCNotesGridDetail">
      <!-- Grid with columns: Date | Added By | Status | Notes -->
    </div>
  </div>
</div>
```

### 7. Supporting Elements

#### Close Popup:
- Method 1: Click `#buttonCloseACCRequestStatus_I`
- Method 2: Press ESC key
- Method 3: Click modal backdrop (if enabled)

#### Additional Popups (for future expansion):
- Notes Detail Popup: `#BoardACCPopUpNotes_PWC-1`
- Attachment Preview Popup: `#BoardACCPopUpAttachmentPreview_PWC-1`

## Field Value Extraction Pattern

For parsing popup text into structured fields:

```
1. Homeowner: //div[@id='modal-body']//label[preceding-sibling::label[contains(text(),'Homeowner')]]/text()
2. Address: //div[@id='modal-body']//label[preceding-sibling::label[contains(text(),'Address')]]/text()
3. ACC Type: //div[@id='modal-body']//label[preceding-sibling::label[contains(text(),'ACC Type')]]/text()
4. Status: //div[@id='modal-body']//label[preceding-sibling::label[contains(text(),'Status')]]/text()
5. Dates: //div[@id='modal-body']//label[preceding-sibling::label[contains(text(),'Date')]]/text()
6. Attachments: Iterate //tr[@id^='BoardACCAttachmentsGrid_DXDataRow'] cells
```

## Implementation Notes

1. **Wait Strategy**: After clicking Details button, wait 2-3 seconds for popup AJAX load
2. **Implicit Wait**: Set to 10 seconds (matches keystone_scraper_selenium.py pattern)
3. **Popup Selector**: Use CSS selector `#BoardACCPopUp_PWC-1` or ID lookup
4. **Download Handler**: Function `downloadBoardACCAttachment(attachmentId)` - may trigger file download via POST/AJAX
5. **Files**: Document links reference attachment record IDs, not direct URLs (attachment system is server-side)

## Attachment ID Reference
Attachment IDs are auto-incremented database record IDs, not file IDs:
- Example: `2036125` is the Keystone internal attachment ID
- To fetch file: Call `downloadBoardACCAttachment(2036125)` (JavaScript handler)
- File name stored: "Dancey ARC Application for HVAC System 101525.pdf"

## Next Steps for Bulk Script
1. Iterate ARC rows in GridBoardACCList
2. Extract account record ID from button: `btnBACCDetail{ID}_I`
3. Click button, wait for popup
4. Parse popup HTML for all field values
5. Extract attachment IDs from grid
6. Store mapping: (PropertyCode, AttachmentID) → backfill to work_items table
7. Close popup via `#buttonCloseACCRequestStatus_I`

---
**Recon Date**: 2026-08-16  
**Property Tested**: 13738 Rock Point #102 (A/C unit, ARC ID 613824)  
**Grid Prefix**: GridBoardACCList  
**Portal**: https://kppm.cincwebaxis.com/p9060/architectural-review/
