# Keystone Cache Migration Plan: Split Type/Description

**Objective:** Separate the combined "Type/Description" field in the Keystone Cache spreadsheet into two distinct columns: "Type" and "Description".

**Scope:** 
- ~120 existing rows in Keystone Cache spreadsheet
- Scraper code (keystone_scraper_selenium.py)
- Downstream code verification (sync-keystone-status.js, PropertyReport, etc.)

**Timeline:** Single coordinated update (no long-running parallel processes)

---

## Current State

**Keystone Cache spreadsheet (Work Orders tab):**
```
Address | WO Number | Date Created | Type/Description | Vendor | Status
```

**Current data format in Type/Description column:**
```
"Exterior - Fix the siding"
"General Repair - Replace door lock"
"Unassigned - Water leak in basement"
```

**How it gets there:**
1. Keystone portal has two-line field: "Type\nDescription"
2. Scraper reads it, combines with " - " separator
3. Stores as single "description" field in sheet

---

## Desired End State

**Keystone Cache spreadsheet (Work Orders tab):**
```
Address | WO Number | Date Created | Description | Vendor | Status | Type
```

**Data format (after migration + scraper update):**
- Description column: "Fix the siding"
- Type column: "Exterior"

**How scraper will work (future):**
1. Read two-line field: "Type\nDescription"
2. Extract line 1 → Type column
3. Extract line 2 → Description column
4. Write both separately

---

## Implementation Steps

### Phase 1: Preparation (Safe, Reversible)

**1.1 Backup the current sheet**
- Export current Keystone Cache sheet to Google Drive as backup
- Name: "Keystone Cache - BACKUP 2026-09-16"
- Keep for 30 days as rollback point

**1.2 Verify downstream dependencies**
- [ ] Check PropertyReport reads from Keystone Cache (verify it won't break)
- [ ] Check sync-keystone-status.js header-based lookups
- [ ] Check work_order_schedule.py usage
- [ ] Check any other scripts that read this sheet

**1.3 Create migration script**
- Write Python script to:
  - Read current Keystone Cache sheet
  - Parse each row's "Type/Description" field
  - Split on " - " (existing delimiter)
  - Create output with Type and Description separated
  - Validate parsing (check for edge cases)

### Phase 2: Sheet Structure Change (No Data Loss)

**2.1 Modify the sheet**
- Rename column "Type/Description" → "Description"
- Add new column "Type" at the end (after Status column)
- Existing data in Description column stays as-is for now

**2.2 Run migration script**
- Read Description column
- Parse each row:
  - Find " - " delimiter
  - Extract everything before → Type column
  - Extract everything after (without " - ") → Description column
- Write results back to sheet

**2.3 Verification**
- Spot-check 10 rows manually:
  - Confirm Type extracted correctly
  - Confirm Description is clean (no leading/trailing spaces)
  - Confirm no data loss
- Count rows: should match original count
- Check for parsing failures (rows where split failed)

### Phase 3: Scraper Code Update

**3.1 Update keystone_scraper_selenium.py**
- Modify the work order parsing to extract Type and Description separately
- Current code (combines with " - "):
  ```python
  if '\n' in type_desc_raw:
      parts = type_desc_raw.split('\n', 1)
      description = ' - '.join(p.strip() for p in parts if p.strip())
  ```
- New code (keeps separate):
  ```python
  wo_type = ''
  wo_description = ''
  if '\n' in type_desc_raw:
      parts = type_desc_raw.split('\n', 1)
      wo_type = parts[0].strip() if len(parts) > 0 else ''
      wo_description = parts[1].strip() if len(parts) > 1 else ''
  else:
      wo_description = type_desc_raw.strip()
  ```

**3.2 Update sheet write**
- Current headers: `['Address', 'WO Number', 'Date Created', 'Type/Description', 'Vendor', 'Status']`
- New headers: `['Address', 'WO Number', 'Date Created', 'Description', 'Vendor', 'Status', 'Type']`
- Current data write: `[address, wo_number, date, description, vendor, status]`
- New data write: `[address, wo_number, date, wo_description, vendor, status, wo_type]`

**3.3 Commit changes**
- Single commit with both migration script and scraper updates
- Message: "refactor: split Keystone Cache Type/Description into separate columns"

### Phase 4: Downstream Code Verification

**4.1 Test sync-keystone-status.js**
- Script searches for 'description' or 'desc' header (should still work)
- No changes needed, but verify it reads the renamed Description column correctly

**4.2 Test PropertyReport**
- PropertyReport reads from Keystone Cache
- Verify it still displays information correctly
- Manual test: generate a property report and check WO descriptions

**4.3 Test work_order_schedule.py**
- Verify it reads WO data and generates correct emails
- Check that descriptions are formatted properly in the report

**4.4 Monitor next scraper run**
- Next keystone-scraper.yml execution will write new rows
- Verify new rows have Type and Description separated correctly
- Check Supabase dashboard to confirm sync worked

### Phase 5: Cleanup (Optional, Future)

**5.1 Deprecate old approach**
- Add comment to code noting Type/Description is now split
- Remove any parsing logic that was splitting on " - "

**5.2 Archive backup**
- Keep backup for 30 days, then delete

---

## Risk Assessment

**Low Risk Because:**
- Only ~120 rows (manageable)
- No complex joins or dependencies
- Sheet-level change (no code must run during migration)
- Downstream code uses header names (not positions)
- Easy to rollback (restore from backup)

**Potential Issues & Mitigations:**

| Issue | Probability | Mitigation |
|-------|-------------|-----------|
| Rows with unusual " - " format fail to parse | Low | Review parsing logic, test on sample data first |
| PropertyReport breaks | Very Low | Test PropertyReport manually before going live |
| sync-keystone-status.js fails | Very Low | It searches by header name, should still work |
| Edge case: Type or Description is missing | Low | Script should handle empty parts gracefully |
| New scraper run writes to wrong columns | Low | Test with dry-run or single WO before full run |

---

## Execution Checklist

- [ ] **Backup sheet** (Google Drive export)
- [ ] **Verify dependencies** (PropertyReport, sync scripts, work_order_schedule)
- [ ] **Write & test migration script** (on local data copy first)
- [ ] **Modify sheet structure** (rename column, add Type column)
- [ ] **Run migration** (parse & split existing data)
- [ ] **Verify results** (spot-check 10 rows, count matches original)
- [ ] **Update scraper code** (extract Type and Description separately)
- [ ] **Commit to git**
- [ ] **Test PropertyReport** (generate a report manually)
- [ ] **Monitor first scraper run** (check new WOs have Type/Description split)
- [ ] **Verify sync-keystone-status.js** (check Supabase dashboard)
- [ ] **Document completion** (update CLAUDE.md if needed)

---

## Rollback Plan

If something goes wrong:
1. Restore from "Keystone Cache - BACKUP 2026-09-16" export
2. Revert scraper code commits
3. Re-run next scraper cycle with reverted code

Rollback should take <15 minutes.

---

## Notes

- **No downtime** — all changes are direct to the sheet and code, no dependencies need to restart
- **Safe to test** — can test migration script on a copy of the sheet first
- **Reversible** — backup exists as rollback point
- **One-time cost** — this is the only data cleanup needed; future data is clean

---

**Ready to proceed?** 

Next step: Write and test the migration script on sample data.
