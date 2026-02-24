# HOA Utilities

**Helper scripts for Google Workspace administration and management**

**Location:** `~/hoa-code/utilities/` and `~/openclaw.jane/workspace/scripts/google_workspace_utilities/`
**Last Updated:** February 15, 2026

---

## Overview

Collection of Python utility scripts for managing HOA Google Workspace resources:
- Google Drive file access and organization
- Apps Script project management
- Service account testing and diagnostics
- Form and spreadsheet utilities

**Prerequisites:**
- Python 3.10+
- Google service account credentials at `~/.config/openclaw/google-service-account.json`
- Required Python packages: `google-auth`, `google-api-python-client`

---

## Google Workspace Utilities

Located in: `~/openclaw.jane/workspace/scripts/google_workspace_utilities/`

### Access Scripts

**access_hoa_code_directory.py**
- Access HOA Board Documents shared drive
- Navigate to Code directory
- List contents

**Usage:**
```bash
cd ~/openclaw.jane/workspace/scripts/google_workspace_utilities
python3 access_hoa_code_directory.py
```

---

**check_service_account_access.py**
- Verify service account permissions
- Test Drive API access
- List accessible files

**Usage:**
```bash
python3 check_service_account_access.py
```

---

**test_domain_delegation.py**
- Test domain-wide delegation configuration
- Try different OAuth scopes
- Verify impersonation works

**Usage:**
```bash
python3 test_domain_delegation.py
```

---

### Search & Discovery Scripts

**find_code_folder.py**
- Search for Code folders in all shared drives
- Handles both folders and shortcuts
- Shows file IDs and paths

**Usage:**
```bash
python3 find_code_folder.py
```

---

**list_code_directory.py**
- List all files in Code directory
- Show sizes, modification dates, owners
- Format output for easy reading

**Usage:**
```bash
python3 list_code_directory.py
```

---

### Apps Script Management

**list_apps_scripts.py**
- Find all Apps Script projects for admin@villasboulders.org
- Show project IDs, names, modification dates
- Save results to JSON

**Usage:**
```bash
python3 list_apps_scripts.py
# Output: apps_script_projects.json
```

---

**get_apps_script_code.py**
- Retrieve code from Apps Script projects
- Download all .gs files
- Save with proper file extensions
- Includes metadata

**Usage:**
```bash
python3 get_apps_script_code.py
# Output: ~/apps_scripts/[project_name]/
```

---

## Main Workspace Utilities

Located in: `~/openclaw.jane/workspace/`

### File Organization

**organize_property_report_files.py**
- Organize property report output files
- Move to appropriate directories
- Clean up temporary files

**find_uploaded_files.py**
- Search Drive for recently uploaded files
- Filter by date, type, or name
- Show file locations

**move_to_shared_drive.py** *(current version)*
- Move files to HOA Board Documents shared drive
- Handles permissions
- Preserves metadata

**fix_hoa_documents_access.py**
- Fix permissions on HOA Documents folder
- Grant access to service account
- Verify sharing settings

---

## Installation

### Install Python Dependencies

```bash
# Install Google API client libraries
pip install --upgrade google-auth google-api-python-client

# Or use requirements file if provided
pip install -r requirements.txt
```

### Configure Service Account

```bash
# Ensure credentials exist
ls ~/.config/openclaw/google-service-account.json

# If missing, copy from backup or download from Google Cloud Console
```

---

## Common Use Cases

### 1. Verify Google Workspace Access

```bash
# Test service account
python3 check_service_account_access.py

# Test domain delegation with specific scope
python3 test_domain_delegation.py
```

### 2. Backup Apps Script Projects

```bash
# List all projects
python3 list_apps_scripts.py

# Download code
python3 get_apps_script_code.py

# Results in ~/apps_scripts/
```

### 3. Explore Shared Drives

```bash
# Find Code folder
python3 find_code_folder.py

# List contents
python3 list_code_directory.py
```

---

## Troubleshooting

### "Permission Denied" Errors

**Check:**
1. Service account credentials exist: `ls ~/.config/openclaw/google-service-account.json`
2. Domain-wide delegation enabled
3. Required scopes authorized

**Fix:**
```bash
# Verify credentials are valid JSON
cat ~/.config/openclaw/google-service-account.json | python3 -m json.tool
```

### "Module not found" Errors

**Fix:**
```bash
# Install missing packages
pip install google-auth google-api-python-client
```

### Scripts Run But Show No Results

**Possible Causes:**
- Service account not added to shared drives
- Insufficient OAuth scopes
- Wrong user being impersonated

**Diagnosis:**
```bash
# Check what the service account can see
python3 check_service_account_access.py
```

---

## Security Notes

**Service Account Credentials:**
- Stored at `~/.config/openclaw/google-service-account.json`
- Permissions: 600 (read/write for owner only)
- Contains private key - treat like a password
- Never commit to git or share publicly

**Scopes Required:**
```
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/script.projects.readonly
https://www.googleapis.com/auth/admin.directory.group
```

---

## Related Documentation

- `~/openclaw.jane/workspace/docs/google-workspace-service-account-setup.md` - Service account setup
- `~/hoa-code/README.md` - Master project index
- Google API documentation: https://developers.google.com/workspace

---

**Maintained By:** Dee Buck
**Questions:** admin@villasboulders.org
**Purpose:** Google Workspace automation and management
