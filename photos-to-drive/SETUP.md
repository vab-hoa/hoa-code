# Setup Instructions

## Prerequisites Check

✅ Service account exists: `openclaw-automation@villasboulders-automation.iam.gserviceaccount.com`
✅ Service account credentials: `~/.config/openclaw/google-service-account.json`
✅ Domain-wide delegation configured
⚠️ **MISSING:** Google Photos Library API scope

## Add Google Photos API Scope

### Step 1: Get Service Account Client ID

From your service account JSON file:

```bash
cat ~/.config/openclaw/google-service-account.json | grep client_id
```

Copy the `client_id` value (looks like: `123456789012345678901`)

### Step 2: Add Scope to Domain-Wide Delegation

1. Go to https://admin.google.com
2. Log in as admin@villasboulders.org
3. Navigate to: **Security** → **Access and data control** → **API Controls**
4. Click **MANAGE DOMAIN WIDE DELEGATION**
5. Find your service account (Client ID from Step 1)
6. Click **Edit**
7. Add this scope to the existing list:

```
https://www.googleapis.com/auth/photoslibrary.readonly
```

**Your complete scope list should include:**
```
https://www.googleapis.com/auth/photoslibrary.readonly
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/admin.directory.user.readonly
https://www.googleapis.com/auth/admin.directory.group
https://www.googleapis.com/auth/admin.directory.group.member
https://www.googleapis.com/auth/apps.groups.settings
... (your other existing scopes)
```

8. Click **Authorize**
9. Wait 5-10 minutes for changes to propagate

### Step 3: Test

```bash
cd ~/hoa-code/photos-to-drive
./venv/bin/python3 photos_to_drive.py --list-albums
```

Should now show your Google Photos albums!

## Alternative: OAuth2 Instead of Service Account (Not Recommended)

If you can't add the scope (or want to test immediately):

1. Use OAuth2 user credentials instead
2. Requires browser login
3. Less suitable for automation

**Stick with service account for production use.**

## Troubleshooting

### "Client is unauthorized"
- Service account scope not added yet
- Wait 5-10 minutes after adding scope
- Check you added the READONLY scope (not the full scope)

### "Albums not found"
- Check admin@villasboulders.org has albums in Google Photos
- Verify albums are shared WITH admin (not just view links)
- Go to photos.google.com to confirm

### "Static discovery" warning
- This is normal for Photos API
- Script handles it automatically
- Can be ignored

---

**Next Steps After Setup:**
1. Share contractor albums with admin@villasboulders.org
2. Run `--list-albums` to see them
3. Create `sync_config.yaml`
4. Test with `--dry-run`
5. Run actual sync!
