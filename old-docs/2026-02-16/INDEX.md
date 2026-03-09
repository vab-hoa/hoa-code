# HOA Code Documentation Index

**Last Updated:** February 16, 2026

This document provides an index of all planning and documentation files in the HOA code repository, their current status, and which ones to follow.

---

## 📋 Active Documents (Read These)

### 1. **CURRENT_PLAN.md** ⭐ START HERE
**Status:** ACTIVE - Current implementation plan
**Purpose:** Incremental approach to finish current PropertyReport system
**Timeline:** This week (5 hours of work)
**Action:** Follow this plan for immediate work

### 2. **INDEX.md** (This File)
**Status:** ACTIVE - Document reference
**Purpose:** Explains what all the documents are and their status
**Action:** Use as navigation guide

---

## 🔮 Future Plans (For Later)

### 3. **FUTURE_APPSHEET_PLAN.md**
**Status:** FUTURE - Deferred until current system is working
**Purpose:** Comprehensive spec for AppSheet + Sheets architecture migration
**Timeline:** Start after current system is deployed (Week 2+)
**Action:** Review later when planning next phase
**Note:** Previously named "APPSHEET_HYBRID_SPECIFICATION.md"

### 4. **REFACTORING_ROADMAP.md**
**Status:** REFERENCE - Long-term improvement ideas
**Purpose:** Code quality improvements (modularization, testing, deployment automation)
**Timeline:** Ongoing, as time permits
**Action:** Consult when considering code improvements
**Note:** Some items already complete (HOALibrary versioning)

---

## 📚 Reference Documents (Historical Context)

### 5. **ARCHITECTURE.md**
**Status:** REFERENCE - System overview
**Purpose:** Current architecture documentation
**Timeline:** Written during initial planning
**Action:** Read for understanding system structure
**Note:** May need updates as we implement changes

### 6. **README.md**
**Status:** REFERENCE - Project overview
**Purpose:** High-level description of HOA code projects
**Timeline:** Created during initial setup
**Action:** Read for context on project organization

---

## ✅ Completed Work (Archived Context)

### 7. **CLEANUP_COMPLETION_SUMMARY.md**
**Status:** ARCHIVED - Completed task summary
**Purpose:** Summary of code cleanup and organization work
**Timeline:** Completed earlier in February 2026
**Action:** Reference only if curious about past work
**Note:** Work described here is complete

### 8. **DEPLOYMENT_CHECKLIST.md**
**Status:** ARCHIVED - Step-by-step deployment guide
**Purpose:** Manual deployment instructions for Apps Script projects
**Timeline:** Used during HOALibrary and PropertyReport deployments
**Action:** Reference if doing manual deployment
**Note:** We now have clasp automation (preferred method)

### 9. **DEPLOYMENT_INSTRUCTIONS.md**
**Status:** ARCHIVED - Deployment procedures
**Purpose:** Detailed deployment steps
**Timeline:** Used during earlier deployments
**Action:** Reference only if needed
**Note:** Superseded by clasp workflow

### 10. **KEYSTONE_INTEGRATION_SUMMARY.md**
**Status:** ARCHIVED - Integration design notes
**Purpose:** Initial Keystone integration planning
**Timeline:** Created when planning Keystone scraper
**Action:** Reference for context
**Note:** Implementation has evolved beyond this doc

---

## 📁 Directory Structure

```
~/hoa-code/
│
├── INDEX.md                        ⭐ START HERE - This file
├── CURRENT_PLAN.md                 ⭐ ACTIVE - Follow this
├── FUTURE_APPSHEET_PLAN.md         🔮 FUTURE - For later
│
├── REFACTORING_ROADMAP.md          📚 REFERENCE - Long-term ideas
├── ARCHITECTURE.md                 📚 REFERENCE - System overview
├── README.md                       📚 REFERENCE - Project intro
│
├── CLEANUP_COMPLETION_SUMMARY.md   ✅ ARCHIVED - Completed
├── DEPLOYMENT_CHECKLIST.md         ✅ ARCHIVED - Completed
├── DEPLOYMENT_INSTRUCTIONS.md      ✅ ARCHIVED - Completed
├── KEYSTONE_INTEGRATION_SUMMARY.md ✅ ARCHIVED - Historical
│
└── [Project Directories]/
    ├── PropertyReport/
    │   └── README.md               (Project-specific docs)
    ├── HOALibrary/
    │   └── README.md
    ├── keystone-scraper/
    │   ├── README.md
    │   └── SETUP.md
    ├── photos-to-drive/
    │   ├── README.md
    │   └── SETUP.md
    └── heif-converter/
        └── README.md
```

---

## 🎯 What to Read Based on Your Goal

### "I want to know what we're working on NOW"
→ Read: **CURRENT_PLAN.md**

### "I want to understand the big picture"
→ Read: **README.md**, then **ARCHITECTURE.md**

### "I want to know about future plans"
→ Read: **FUTURE_APPSHEET_PLAN.md**, **REFACTORING_ROADMAP.md**

### "I need to deploy code"
→ Use: `clasp push` (see CURRENT_PLAN.md for details)
→ Reference: DEPLOYMENT_CHECKLIST.md (if needed)

### "I want to understand Keystone integration"
→ Read: CURRENT_PLAN.md (current approach)
→ Reference: KEYSTONE_INTEGRATION_SUMMARY.md (historical context)

### "I want to set up a project"
→ Read: Project-specific README.md in subdirectory
→ Example: `~/hoa-code/photos-to-drive/README.md`

---

## 🔄 Document Lifecycle

### Active Documents
Updated frequently, reflect current work

### Future Documents
Updated when planning next phase, become Active when work starts

### Reference Documents
Updated occasionally, provide context and guidance

### Archived Documents
Rarely updated, historical record only

---

## ⚠️ Important Notes

### Conflicting Information?
If documents conflict, priority order:
1. **CURRENT_PLAN.md** (highest priority)
2. **Project-specific README.md**
3. **INDEX.md** (this file)
4. Other documents (lower priority)

### Outdated Documents?
Some docs may be outdated. When in doubt:
- Check document "Status" in this index
- Consult CURRENT_PLAN.md
- Ask Claude

### Creating New Documents?
- Add entry to this INDEX.md
- Mark status clearly (ACTIVE/FUTURE/REFERENCE/ARCHIVED)
- Update "Last Updated" date at top of this file

---

## 📊 Document Status Summary

| Status | Count | Documents |
|--------|-------|-----------|
| ⭐ ACTIVE | 2 | CURRENT_PLAN, INDEX |
| 🔮 FUTURE | 2 | FUTURE_APPSHEET_PLAN, REFACTORING_ROADMAP |
| 📚 REFERENCE | 2 | ARCHITECTURE, README |
| ✅ ARCHIVED | 4 | CLEANUP_COMPLETION, DEPLOYMENT_*, KEYSTONE_INTEGRATION |

**Total:** 10 top-level documentation files

---

## 🚀 Quick Start

**New to this project?**
1. Read: **README.md** (5 min)
2. Read: **ARCHITECTURE.md** (10 min)
3. Read: **CURRENT_PLAN.md** (15 min)
4. Browse project directories (15 min)

**Working on current tasks?**
1. Read: **CURRENT_PLAN.md**
2. Refer to project-specific READMEs as needed

**Planning future work?**
1. Read: **CURRENT_PLAN.md** (understand baseline)
2. Read: **FUTURE_APPSHEET_PLAN.md** (proposed changes)
3. Discuss and update plans

---

## 📝 Maintenance

### Weekly
- Update CURRENT_PLAN.md status
- Add completion notes

### Monthly
- Review document relevance
- Archive completed work
- Update this INDEX

### Quarterly
- Major review of all docs
- Clean up outdated information
- Reorganize if needed

---

**Questions about which document to read?**
→ Start with CURRENT_PLAN.md or ask Claude

**END OF INDEX**
