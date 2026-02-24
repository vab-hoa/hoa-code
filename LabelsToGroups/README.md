# LabelsToGroups

**Automated synchronization of Google Contacts labels to Google Groups**

**Type:** Google Apps Script (Standalone)
**Script ID:** `13dRmGELCqNZNIjC2MsJg6HGV3cyUd-KMJ50wdbilDo1VnQP5UrKPQVdw`
**Status:** Production
**Last Updated:** February 14, 2026

---

## What It Does

Automatically syncs members from Google Contacts label groups to Google Groups for easy email distribution.

**Workflow:**
1. Maintains contacts with labels in Google Contacts (e.g., "Boulder Circle")
2. Script creates corresponding Google Group (e.g., bouldercircle@villasboulders.org)
3. Syncs all contacts with that label into the group
4. Updates group settings (who can post, join, view)
5. Ensures admin is owner of all groups

**Benefits:**
- Single source of truth: Google Contacts
- Automatic email group creation
- No manual group membership management
- Consistent group settings across all groups

---

## Synced Groups

The script manages **14 Google Groups**:

### Street-Based Groups (6)
- `bouldercircle@villasboulders.org` ← "Boulder Circle" label
- `boulderpoint@villasboulders.org` ← "Boulder Point" label
- `broadlandslane@villasboulders.org` ← "Broadlands Lane" label
- `plasterpoint@villasboulders.org` ← "Plaster Point" label
- `rockpoint@villasboulders.org` ← "Rock Point" label
- `stonecircle@villasboulders.org` ← "Stone Circle" label

### Role-Based Groups (8)
- `lbc@villasboulders.org` ← "LBC" label
- `lbc-workgroup@villasboulders.org` ← "lbc-workgroup" label
- `nonoccupantowner@villasboulders.org` ← "non-occupant owner" label
- `nonowneroccupant@villasboulders.org` ← "non-owner occupant" label
- `owneroccupant@villasboulders.org` ← "owner-occupant" label
- `volunteers@villasboulders.org` ← "volunteers" label
- `snowsquad@villasboulders.org` ← "Snow Squad" label
- `arc@villasboulders.org` ← "ARC" label

📖 See [SYNC_LIST.md](SYNC_LIST.md) for complete group descriptions

---

## Prerequisites

### 1. Google Advanced Services

Enable in Apps Script editor:

- **Admin Directory API** (directory_v1)
- **Admin Groups Settings API** (v1)
- **People API** (v1)

**How to Enable:**
1. Apps Script editor → Services (+ icon)
2. Find each service
3. Click Add

### 2. Google Admin Permissions

**Domain:** villasboulders.org

**Required Admin Roles:**
- Groups Admin (to create and manage groups)
- User Management Admin (to add members)

**Service Account (if using):**
- Domain-wide delegation configured
- Scopes: `admin.directory.group`, `admin.directory.user`, `contacts.readonly`

### 3. Google Contacts Labels

**Contacts Organization:**
- All homeowners in Google Contacts
- Labels applied to organize by street or role
- Label names must match SYNC_LIST (case-sensitive)

**Example Contact:**
```
Name: John Smith
Email: john@example.com
Labels: Boulder Circle, owner-occupant
```

---

## Installation

### Step 1: Create Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. New Project → Name it "LabelsToGroups"
3. Copy contents of `Code.gs` into editor

### Step 2: Enable Advanced Services

1. Services (left sidebar, + icon)
2. Enable: Admin Directory API
3. Enable: Admin Groups Settings API
4. Enable: People API

### Step 3: Authorize the Script

1. Run `executeCommunitySync` function once
2. Review permissions prompt
3. Click "Allow"

### Step 4: Set Up Trigger (Optional)

For automatic daily syncing:

1. Triggers (left sidebar, clock icon)
2. Add Trigger:
   - Function: `executeCommunitySync`
   - Event source: Time-driven
   - Type: Day timer
   - Time of day: Your preference (e.g., 2am)
3. Save

---

## Usage

### Manual Sync

Run from Apps Script editor:

```javascript
executeCommunitySync();
```

**What Happens:**
1. For each entry in SYNC_LIST:
   - Creates Google Group if doesn't exist
   - Configures group settings
   - Adds admin as owner
   - Syncs members from Contacts label

2. Console logs progress and results

### Automatic Sync

If trigger is configured, runs daily automatically.

**Check Last Run:**
1. Apps Script editor → Executions
2. Review latest execution
3. Check logs for errors

---

## Configuration

### SYNC_LIST

**Location:** `Code.gs` (top of file)

**Format:**
```javascript
const SYNC_LIST = [
  { label: "Label Name in Contacts", prefix: "group-email-prefix" },
  ...
];
```

**Example:**
```javascript
{ label: "Boulder Circle", prefix: "bouldercircle" }
```

Creates: `bouldercircle@villasboulders.org`

### Adding New Groups

1. Edit SYNC_LIST in Code.gs
2. Add new entry:
   ```javascript
   { label: "New Label", prefix: "newgroup" }
   ```
3. Save
4. Run `executeCommunitySync()`

**Group will be:**
- Created automatically
- Configured with standard settings
- Admin added as owner
- Members synced from "New Label" contacts

### Modifying Existing Groups

**To change group email:**
1. Edit `prefix` in SYNC_LIST
2. Save and run
3. New group created with new email
4. Old group remains (manual cleanup needed)

**To change label name:**
1. Edit `label` in SYNC_LIST
2. Save and run
3. Syncs from new label name

---

## Group Settings

All groups are configured with these settings:

**Membership:**
- `whoCanJoin`: INVITED_CAN_JOIN (members must be added)

**Posting:**
- `whoCanPostMessage`: ANYONE_CAN_POST (any member can email group)

**Viewing:**
- `whoCanViewConversation`: ANYONE_CAN_VIEW

**External Members:**
- `allowExternalMembers`: true (allows non-villasboulders.org emails)

**Ownership:**
- admin@villasboulders.org automatically added as OWNER

### Changing Default Settings

Edit `executeCommunitySync()` function:

```javascript
AdminGroupsSettings.Groups.patch({
  whoCanJoin: "INVITED_CAN_JOIN",
  whoCanViewConversation: "ANYONE_CAN_VIEW",
  whoCanPostMessage: "ANYONE_CAN_POST",  // ← Change this
  allowExternalMembers: "true"
}, groupEmail);
```

**Available Options:**
- `whoCanPostMessage`: "ALL_IN_DOMAIN", "ANYONE_CAN_POST", "ALL_MEMBERS_CAN_POST"
- `whoCanJoin`: "CAN_REQUEST_TO_JOIN", "INVITED_CAN_JOIN", "ANYONE_CAN_JOIN"
- See [Groups Settings API docs](https://developers.google.com/admin-sdk/groups-settings/v1/reference/groups) for all options

---

## Rate Limiting

**Important:** Script includes 200ms delay between operations to prevent quota errors.

### Quota Limits

**People API:**
- 600 requests per minute (user)
- Script uses ~1 request per contact

**Admin Directory API:**
- 1,500 requests per minute
- Script uses ~3 requests per group

### Symptoms of Rate Limiting

**Error Message:**
```
Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute per user'
```

**If This Occurs:**
1. Increase delay in `syncLabelMembers()`:
   ```javascript
   Utilities.sleep(500);  // Increase from 200ms to 500ms
   ```
2. Run script less frequently
3. Sync groups in batches (split SYNC_LIST)

---

## Monitoring

### Check Sync Results

1. **Apps Script Editor:**
   - Executions → View latest run
   - Check console logs for "Added: email@example.com"

2. **Google Groups Admin:**
   - [admin.google.com/groups](https://admin.google.com/ac/groups)
   - Verify groups exist
   - Check member counts

3. **Email Test:**
   - Send test email to group
   - Verify members receive it

### Common Log Messages

**Success:**
```
Processing Boulder Circle...
Added: john@example.com
Added: jane@example.com
Batch complete.
```

**Warnings:**
```
Settings error: bouldercircle@villasboulders.org
```
*Usually means settings already correct*

**Errors:**
```
Skipped a contact due to error: [error message]
```
*Individual contact failed, others continue*

---

## Troubleshooting

### "User not found" Errors

**Cause:** Email in Contacts doesn't exist in Google Workspace or external

**Fix:**
- Verify email is correct
- For external emails, ensure `allowExternalMembers: true`

### Groups Not Created

**Cause:** Missing permissions or API not enabled

**Fix:**
1. Verify Admin Directory API enabled
2. Check user has Groups Admin role
3. Review authorization scopes

### Members Not Added

**Cause:** Contacts API can't access label

**Fix:**
1. Verify People API enabled
2. Check label name matches exactly (case-sensitive)
3. Ensure contacts have emails

### "Settings error" Messages

**Not Actually an Error:**
- Settings patch fails if already set
- Group still works correctly
- Can safely ignore

**If Concerned:**
1. Check group settings in Admin Console
2. Verify they match expected configuration

### Quota Exceeded

**Fix:**
1. Increase `Utilities.sleep()` delay
2. Reduce number of groups synced at once
3. Run less frequently

---

## Best Practices

### Contact Management

**Organization:**
- Keep Contacts up to date
- Remove outdated emails promptly
- Use consistent label names

**Label Naming:**
- Must match SYNC_LIST exactly
- Case-sensitive
- Avoid special characters in prefixes

### Sync Frequency

**Recommendations:**
- Daily sync: Good for active communities
- Weekly sync: Sufficient for stable membership
- On-demand: For testing or infrequent changes

**Avoid:**
- Hourly syncs (unnecessary, wastes quota)
- Multiple concurrent runs (causes errors)

### Group Email Naming

**Good Prefixes:**
- `bouldercircle` (lowercase, no spaces)
- `lbc-workgroup` (hyphens OK)

**Avoid:**
- `Boulder Circle` (no spaces)
- `boulder_circle` (underscores work but uncommon)

---

## Security Considerations

### Access Control

**Who Can Run:**
- Only users with admin@villasboulders.org credentials
- Or service account with domain-wide delegation

**Group Ownership:**
- Admin automatically added as owner to all groups
- Prevents unauthorized group deletion or modification

### Email Privacy

**External Members:**
- Enabled by default (`allowExternalMembers: true`)
- Allows non-villasboulders.org emails in groups
- Consider disabling for internal-only groups

**Posting Permissions:**
- Currently: Anyone can post
- Consider restricting to members only if needed

---

## File Structure

```
LabelsToGroups/
├── Code.gs              (77 lines - main script)
├── appsscript.json      (project manifest)
├── README.md            (this file)
└── SYNC_LIST.md         (group mappings explained)
```

---

## Advanced Usage

### Custom Sync for Specific Groups

Instead of syncing all groups:

```javascript
function syncOneGroup() {
  const item = { label: "Boulder Circle", prefix: "bouldercircle" };
  const groupEmail = `${item.prefix}@villasboulders.org`;

  // Create group if needed
  try {
    AdminDirectory.Groups.get(groupEmail);
  } catch (e) {
    AdminDirectory.Groups.insert({ email: groupEmail, name: item.label });
  }

  // Sync members
  syncLabelMembers(item.label, groupEmail);
}
```

### Audit Group Membership

```javascript
function auditGroup(groupEmail) {
  const members = AdminDirectory.Members.list(groupEmail).members || [];

  console.log(`Group: ${groupEmail}`);
  console.log(`Total members: ${members.length}`);

  members.forEach(m => {
    console.log(`  - ${m.email} (${m.role})`);
  });
}
```

---

## Related Documentation

- [SYNC_LIST.md](SYNC_LIST.md) - Complete group mappings and descriptions
- [Google Groups Settings API](https://developers.google.com/admin-sdk/groups-settings/v1/reference/groups) - API reference
- [People API](https://developers.google.com/people) - Contacts API docs

---

## Support

**Developer:** Dee Buck (mcdonaldbuck@gmail.com)
**HOA Admin:** admin@villasboulders.org

**For Issues:**
1. Check execution logs for error details
2. Verify APIs enabled and authorized
3. Review this README troubleshooting section
4. Contact developer if stuck

---

**Created:** January 20, 2026
**Last Updated:** February 15, 2026
**Next Review:** After any group structure changes
