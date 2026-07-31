# Session Transcript: Concrete Repair Photo Workflow Planning

**Date:** 2026-07-14  
**Project:** hoa-code — Villas at the Boulders  
**Participants:** Dee Buck, Claude (AI assistant)  
**Topic:** Planning a workflow to organize board member Tom O'Leary's concrete repair photos into Google Drive folders by address

---

### Dee (22:18 UTC)

Connection was lost, I'm ssh-ing to oregano, do you have record of conversation we had an hour ago about the photos to drives code written some time pack?

### Claude (22:19 UTC)

No record of that specific conversation — Claude Code sessions don't persist between connections, and the memory system has no stored notes about it either.

What I can tell you from reading the code: `photos-to-drive/photos_to_drive.py` is a complete Google Photos → Drive sync tool. It:

- Authenticates via service account with delegation to `admin@villasboulders.org`
- Lists Google Photos albums (`--list-albums`) and generates a sample `sync_config.yaml`
- Reads a YAML config mapping album IDs to Drive folder paths
- Skips already-synced photos via `sync_history.json`
- Converts HEIF/HEIC to JPEG on the fly using Pillow before uploading
- Uploads to the HOA Board Documents shared drive (`0AExYZWmfRm9JUk9PVA`)

Usage:
```bash
cd photos-to-drive
source venv/bin/activate
python photos_to_drive.py --list-albums        # discover albums
python photos_to_drive.py --sync --dry-run     # preview
python photos_to_drive.py --sync               # actually run
```

If you recall what specific issue or change you were working on, just describe it and I can pick up from there.

### Dee (22:25 UTC)

If I remember correctly when we did photos to drives it was for a specific use case involving homes in the HOA, so there may have been some kind of grouping of the photos by homes or something. Can you tell if there is anything in the code like that. Here's why. A board member has a set of photos of concrete repairs that are needed. I haven't seen the photos yet. He says he took a picture at the beginning of each set of the house number, the two to five pictures at that house of concrete repairs needed. He has these in a google album in his own google account, and will share with admin. I want to capture the pictures for each house into folders where folder is house address in standard form, into a directory on the HOA Board Drive -- I'll figure out where. From there I will want to do the other thing we did before which is to move links to those folders into a google sheet. I will specify that operation later. Right now the objective is to figure out what we have to do to get the photos moved from an album to google drive in folders by house.

### Claude (22:25 UTC)

Let me look at the existing code more carefully, and also check the exif-to-parcel work since that seems relevant.

### Claude (22:26 UTC)

Here's the full picture of what exists and what you need:

**What the existing code does:**

- `photos_to_drive.py` — maps an **entire album → one Drive folder**. No house grouping at all.
- `exif-to-parcel/match_photos.py` — *this* is the house-grouping code. It works on **locally downloaded** photos, pulls GPS EXIF from each image, matches against parcel boundary polygons (GeoJSON), and organizes into per-address folders. It even has a neighbor-inference pass for photos that landed outside the polygon. This was used for the gutter/contractor photos.

**Why neither fits your new case:**

The board member's album uses a completely different convention: a photo of the house number sign as a *divider*, then 2-5 repair photos, then the next sign. That's sequential/positional grouping, not GPS-based.

Also: the exif-to-parcel tool works on files already on local disk. The photos_to_drive tool pulls from Photos API but dumps everything into one folder.

**What you'd actually need — the key design questions:**

1. **Shared album access.** The Photos Library API, when accessed via service account delegation to admin@, can see albums *owned* by admin@, but accessing an album shared *to* admin@ from another user's personal account is a known gap in the API. You'd need to verify the board member actually transfers ownership or shares in a way the API can see. Alternatively, he exports and uploads the photos directly to a Drive folder, which sidesteps Photos API entirely.

2. **House number detection.** Reading the house number from the sign photo requires OCR. Google Cloud Vision (`images.annotate` with `TEXT_DETECTION`) would handle this reliably. The detected number would need to be mapped to a full standardized address (e.g., "13737" → "13737 Rock Point Dr Unit 102").

3. **Address mapping.** You'd need a lookup table of house numbers to full HOA addresses. The HOALibrary presumably has this, or the Keystone cache sheet does.

**The simplest reliable path:**

Have the board member share the album such that admin@ can see it, *or* download and drop the photos into a Drive folder. Then write a new script that:
- Iterates photos in sequence order
- Runs OCR on each, checks if it's a house-number-only photo (short text, number pattern)
- When it detects one, starts a new group with that address
- Assigns remaining photos to that group until the next sign photo
- Creates a Drive subfolder (standardized address) and uploads the group

Before writing any code: do you know whether the board member can share the album in a way that admin@'s service account delegation can actually read it? That's the first thing to nail down, since it affects whether you use Photos API or a Drive-drop approach.

### Dee (22:31 UTC)

We went through the steps to share the drive from his account to admin, but the share email has never come through, not sure why. I did that separately as an experiment from my own account and it worked. But if the board member (Tom O'Leary is his name) has the ability to just move the photos to google drive directly that would probably be easier than changing the code for photos to drive. The photos to drive code already had albums organized by house number which we were trying to preserve. What is the simple process for an ordinary google user to take photos in an album and move them to his own google drive in a folder.

### Claude (22:32 UTC)

This is straightforward for Tom. The simplest process:

**On a computer (photos.google.com):**

1. Open the album
2. Click the first photo, then Shift-click the last to select all (or use the checkmark that appears on hover to select each)
3. Click the three-dot menu (top right) → **Download**
4. Google Photos downloads a `.zip` file of all photos in the album
5. Unzip it on his computer
6. Go to **drive.google.com**
7. Click **New → Folder**, name it something like "Concrete Repairs 2026"
8. Drag the unzipped photos into that folder (or use New → File upload / Folder upload)
9. Right-click the folder → **Share** → add `admin@villasboulders.org`

That's it. You'd then have all the photos in a single Drive folder, accessible to admin@.

**One thing worth knowing:** Google Photos downloads preserve EXIF metadata, including GPS if his phone was tagging locations. That means if his phone had location on when shooting, the exif-to-parcel approach could actually work on these photos — potentially cleaner than OCR on house number signs, since GPS would place each repair photo at the parcel automatically.

**On mobile (Google Photos app):**
Same idea — select all, tap Share → Save to Drive. That saves directly without the zip step, but you only get to pick a Drive destination, not a specific folder name easily. Computer method is cleaner.

### Dee (22:36 UTC)

My problem with exif-to-parcel is the camera is always actually outside parcel boundary when photo is taken so it is always a bit of a crapshoot. We ended up doing a bit of heuristics like deriving from adjacent photos etc. For the gutter photos many were taken on the roof and so were actually inside the parcel boundary. That and the fact that the photos were adjacent helped us. But even then they weren't perfect.

### Claude (22:36 UTC)

Right, and it makes sense why — concrete and sidewalk repairs are photographed from the street or sidewalk, which is almost always outside the parcel boundary. The GPS would land you in the street or a neighbor's parcel consistently. The neighbor-inference heuristic helped with gutters because those photos clustered tightly and were taken from inside the parcel, giving it a solid anchor. You'd lose both of those advantages here.

Tom's house-number-sign convention is actually a better fit for this problem than GPS. It's explicit, unambiguous, and intentional — no inference needed if you can read the sign. The sequence is deterministic: sign photo starts a new group, everything after it belongs to that address until the next sign.

That makes the right approach:

1. Tom downloads the album zip, uploads the folder to Drive, shares with admin@
2. A script reads the photos from that Drive folder **in filename/sequence order**
3. For each photo, runs OCR (Google Cloud Vision `TEXT_DETECTION` is the obvious choice since you're already in the Google ecosystem)
4. If the OCR result is short text matching a house number pattern (just digits, or digits + unit), that starts a new address group
5. All subsequent photos go into that group until the next sign photo
6. Script creates a subfolder per address on the HOA Board Drive and moves the photos there

The one soft spot: OCR on a house number sign should be very reliable — high contrast, large text, single token. But you'd want a dry-run mode that prints what it detected as sign photos vs. repair photos before it actually moves anything, so you can sanity-check it before committing.

Is Tom likely to have the unit number on his sign photos, or just the street number? That affects how you map to a full standardized address.

### Dee (22:39 UTC)

That is one of my concerns, that the house number is not going to have a street name. We'll have to infer. Almost every house number is unique to a street. You might verify that in the keystone cache or elsewhere -- we probably have a couple of files around which show all 124 standard addresses. Can you locate one and do a quick verify for duplicates of the house number part?

### Claude (22:40 UTC)

Good, found the right file. Let me read it and check house number uniqueness.

### Claude (22:41 UTC)

The results are clear and the news is mixed:

**The good news:** Most house numbers are unique to a street.

**The expected "duplicates":** Every house number appears twice — Unit 101 and Unit 102 share the same street number. That's a given; each building has one number, two units. Tom's sign photo will show just the number (e.g., "13737"), and you'd have to decide whether to group repairs at the building level or per unit.

**The real problem — 4 genuine cross-street collisions:**

| Number | Streets |
|--------|---------|
| 13689 | Boulder Pt AND Rock Pt |
| 13708 | Boulder Pt AND Rock Pt |
| 13717 | Boulder Pt AND Rock Pt |
| 13739 | Rock Pt AND Stone Cir |

For those four, a house number alone is genuinely ambiguous — you can't tell which street without more context.

**Practical implications for Tom's album:**

- For 55 of 59 house numbers, street inference works fine — there's only one possible street.
- For those 4, you'd either need Tom to note the street (e.g., a photo of a street sign), or handle them as exceptions requiring manual assignment after the fact.
- The unit (101 vs 102) question is separate — for concrete repairs, are you tracking per building or per unit? That determines whether Tom needs to indicate the unit somehow.

Worth asking Tom before he does any shooting whether he's planning to capture anything beyond the house number, and whether the repairs he's documenting apply to the whole building or a specific unit.

### Dee (22:45 UTC)

My mistake, I was wrong. the bronze plaque has all the info, street name and unit as well as address. False alarm false memory on my meat computer. Hallucination by the human.

### Claude (22:45 UTC)

Good news actually — that makes the design much cleaner. If OCR can read the full street name and unit off the plaque, the lookup becomes a direct match against the address list with no inference required. The 4 collision numbers and the 101/102 question both go away.

So the flow becomes straightforward:
- Plaque photo → OCR → full address → standardize → Drive folder name
- Repair photos → go into that folder
- Repeat

The main remaining uncertainty before writing code is access: does Tom upload a zip to a Drive folder shared with admin@, or does the Photos API shared-album route end up working? Once you know how the photos arrive, the script structure is clear.

### Dee (22:48 UTC)

by the way I would like you to record the information about the uniqueness/duplicate stuff for the future. write a file in the hoa files -- maybe there is some documentation in hoa-code either of the photos to drives, or the exif-to-parcel where it would be sensible to record this -- a file called house number uniqueness or something, so we have this data next time we need it. Very high probability that given a house number we can infer street name in future if we need to, except for the four, and even there we can get down to one of two streets.

### Claude (22:48 UTC)

The most logical home is `exif-to-parcel/` — that's where address inference lives. I'll put it there.

### Claude (22:49 UTC)

Done. `exif-to-parcel/HOUSE_NUMBER_UNIQUENESS.md` — covers the uniqueness finding, the four collision cases, the unit question, and the bronze plaque note so future context is preserved. Also noted the Broadlands 4-digit numbers as a free distinguisher.

### Dee (22:50 UTC)

commit this

### Claude (22:50 UTC)

Done.

### Dee (22:51 UTC)

I don't want to do the photo organizer yet. I am thinking that it may be easier when Tom is moving the files to google drive that instead of moving all files, he move them in batches to folders with house number. It is manual but saves a lot of code and doesn't depend on ocr.

### Claude (22:52 UTC)

That's a pragmatic call. If Tom is already going to the effort of moving files to Drive, organizing them into per-house folders as he goes is straightforward — he knows which photos belong where since he took them. He'd just create a folder for each house number as he works through the album.

That also gives you a cleaner input for the next step (the spreadsheet linking), since the folder structure arrives already organized rather than being produced by a script.

When you're ready to do the spreadsheet part, the input will be a Drive directory of address-named subfolders, each containing 2-5 photos. That's a well-defined starting point to write against.

### Dee (22:53 UTC)

Back to the uniqueness file you just built, I'm thinking we should have a copy with the hoa library where we do the standard house number conversion should we?

### Claude (22:53 UTC)

Yes, that makes sense — `HOALibrary/` is exactly where someone would look when working on address inference. Let me check what's there first.

### Claude (22:53 UTC)

No markdown files there currently. I'll put a copy alongside `AddressStandardization.gs` where it's most relevant.

### Claude (22:53 UTC)

Done. Two copies now — one where the address matching code lives, one where the standardization library lives. They're static reference data so drift between them is unlikely to be a problem.

### Dee (22:53 UTC)

push it

### Claude (22:53 UTC)

Remote has commits we don't have locally. Let me pull first.

### Claude (22:54 UTC)

That's the deleted `.claude/settings.json` showing as unstaged. I'll stash it, pull, then push.

### Claude (22:54 UTC)

Pushed. There were 5 commits on the remote we didn't have — rebased cleanly on top of them. The deleted `.claude/settings.json` is still sitting as an unstaged change; let me know if you want to deal with that separately.

### Dee (22:55 UTC)

you can commit that and push it, there is nothing in that settings.json file except letting you write bash scripts in a couple of directories, and you can already do that. I am getting a lot of permission requests for you during this work - I am surprised.

### Claude (22:56 UTC)

Done. 

On the permission prompts — the settings.json that just got deleted was what granted pre-approved bash permissions for specific directories. Without it, Claude Code falls back to prompting for each bash command. You can recreate it to reduce the noise. A minimal one that covers this project:

```json
{
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Bash(python3 *)",
      "Bash(curl *)"
    ]
  }
}
```

Put that in `/home/dee/hoa-code/.claude/settings.json` and the prompts for those command types will stop. Or if you want it project-wide across all your work, the same structure goes in `~/.claude/settings.json` at the user level.

### Dee (22:56 UTC)

put the settings.json back

### Claude (22:56 UTC)

Done. That should quiet the permission prompts for git, python3, and curl commands going forward.

### Dee (22:57 UTC)

No, don't want to write the organizer till I talk to tom, and I don't even have the spreadsheet yet, so we will deal with that in coming days. Is there a good way for you to produce for me a full transcript of this session for tom as a markdown?

### Claude (22:58 UTC)

Good, the parsing works. Let me write the full transcript out.
