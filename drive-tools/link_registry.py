#!/usr/bin/env python3
"""
Generate a Link Registry — structured inventory of every Drive link on the website.

Crawls villasboulders.org (or uses cached site_structure.txt), extracts all Drive
file and folder links, and produces a registry with:
  - File/folder ID
  - Link text (what homeowners see)
  - Page(s) where it appears
  - URL type (file/view, file/preview, folder, form)
  - Whether the ID is accessible via Drive API

Output: drive-tools/link_registry.txt (human-readable)
        drive-tools/link_registry.json (machine-readable)

Usage:
  python link_registry.py              # generate from live crawl
  python link_registry.py --cached     # use site_structure.txt (faster, offline)
  python link_registry.py --verify     # also check each ID via Drive API
"""

import json
import re
import sys
from collections import defaultdict

from config import get_drive_service, check_file_accessible

SITE_STRUCTURE_FILE = "/home/dee/hoa-code/drive-tools/site_structure.txt"
REGISTRY_TXT = "/home/dee/hoa-code/drive-tools/link_registry.txt"
REGISTRY_JSON = "/home/dee/hoa-code/drive-tools/link_registry.json"

# Patterns for extracting Drive IDs from URLs
FILE_ID_PATTERN = re.compile(r"/file/d/([a-zA-Z0-9_-]+)")
FOLDER_ID_PATTERN = re.compile(r"/folders/([a-zA-Z0-9_-]+)")
OPEN_ID_PATTERN = re.compile(r"/open\?id=([a-zA-Z0-9_-]+)")
FORM_ID_PATTERN = re.compile(r"/forms/d/e/([a-zA-Z0-9_-]+)")


def extract_drive_id(url):
    """Extract Drive file/folder ID and type from a URL.

    Returns (id, type) where type is 'file', 'folder', or 'form'.
    """
    m = FILE_ID_PATTERN.search(url)
    if m:
        return m.group(1), "file"
    m = FOLDER_ID_PATTERN.search(url)
    if m:
        return m.group(1), "folder"
    m = OPEN_ID_PATTERN.search(url)
    if m:
        return m.group(1), "file"
    m = FORM_ID_PATTERN.search(url)
    if m:
        return m.group(1), "form"
    return None, None


def parse_site_structure(path):
    """Parse site_structure.txt to extract all Drive links per page.

    Returns list of dicts: {page, link_text, url, drive_id, link_type}
    """
    entries = []
    current_page = None

    with open(path) as f:
        for line in f:
            line = line.rstrip()

            # Page header: starts with / or is indented with /
            stripped = line.lstrip()
            if stripped.startswith("/") and "→" not in line and "http" not in line:
                current_page = stripped
                continue

            # Drive link line: "link text" → https://drive.google.com/...
            if "→" in line and "drive.google.com" in line:
                parts = line.split("→", 1)
                if len(parts) == 2:
                    link_text = parts[0].strip().strip('"')
                    url = parts[1].strip()
                    drive_id, link_type = extract_drive_id(url)
                    if drive_id and current_page:
                        entries.append({
                            "page": current_page,
                            "link_text": link_text,
                            "url": url,
                            "drive_id": drive_id,
                            "link_type": link_type,
                        })

            # Also catch Google Forms links
            if "→" in line and "docs.google.com/forms" in line:
                parts = line.split("→", 1)
                if len(parts) == 2:
                    link_text = parts[0].strip().strip('"')
                    url = parts[1].strip()
                    drive_id, link_type = extract_drive_id(url)
                    if drive_id and current_page:
                        # Avoid duplicates from the drive.google.com check above
                        if not any(e["drive_id"] == drive_id and e["page"] == current_page
                                   for e in entries):
                            entries.append({
                                "page": current_page,
                                "link_text": link_text,
                                "url": url,
                                "drive_id": drive_id,
                                "link_type": link_type,
                            })

    return entries


def build_registry(entries):
    """Group entries by Drive ID into a registry.

    Returns dict of drive_id -> {
        id, type, pages: [{page, link_text, url}], url_format
    }
    """
    by_id = defaultdict(lambda: {"pages": [], "link_type": None})

    for e in entries:
        rec = by_id[e["drive_id"]]
        rec["link_type"] = e["link_type"]
        rec["pages"].append({
            "page": e["page"],
            "link_text": e["link_text"],
            "url": e["url"],
        })

    # Determine URL format used
    registry = {}
    for drive_id, rec in by_id.items():
        url_formats = set()
        for p in rec["pages"]:
            url = p["url"]
            if "/preview" in url:
                url_formats.add("preview")
            elif "/view" in url:
                url_formats.add("view")
            elif "/viewform" in url:
                url_formats.add("form")
            elif "/folders/" in url:
                url_formats.add("folder")
            else:
                url_formats.add("other")

        registry[drive_id] = {
            "id": drive_id,
            "link_type": rec["link_type"],
            "url_formats": sorted(url_formats),
            "page_count": len(set(p["page"] for p in rec["pages"])),
            "pages": rec["pages"],
        }

    return registry


def verify_ids(registry, drive):
    """Check accessibility of each file/folder ID."""
    for drive_id, rec in registry.items():
        if rec["link_type"] == "form":
            rec["status"] = "form (not checked)"
            rec["name"] = rec["pages"][0]["link_text"] if rec["pages"] else ""
            continue
        ok, name = check_file_accessible(drive, drive_id)
        rec["status"] = "OK" if ok else "BROKEN"
        rec["name"] = name


def format_report(registry, verified=False):
    """Format the registry as a human-readable report."""
    lines = []
    lines.append("=" * 100)
    lines.append("LINK REGISTRY — villasboulders.org Drive Links")
    lines.append(f"Total unique Drive IDs: {len(registry)}")

    # Count by type
    by_type = defaultdict(int)
    for rec in registry.values():
        by_type[rec["link_type"]] += 1
    for t, n in sorted(by_type.items()):
        lines.append(f"  {t}: {n}")

    if verified:
        broken = [r for r in registry.values() if r.get("status") == "BROKEN"]
        lines.append(f"\nBroken links: {len(broken)}")

    lines.append("=" * 100)

    # Group by link type
    for link_type in ["file", "folder", "form"]:
        type_entries = {k: v for k, v in registry.items()
                        if v["link_type"] == link_type}
        if not type_entries:
            continue

        lines.append(f"\n{'━' * 100}")
        lines.append(f"{link_type.upper()} LINKS ({len(type_entries)})")
        lines.append(f"{'━' * 100}")

        for drive_id, rec in sorted(type_entries.items(),
                                     key=lambda x: -x[1]["page_count"]):
            status = ""
            if verified:
                status = f" [{rec.get('status', '?')}]"
                if rec.get("name"):
                    status += f" {rec['name']}"

            lines.append(f"\n  ID: {drive_id}{status}")
            lines.append(f"  Format: {', '.join(rec['url_formats'])}")
            lines.append(f"  Used on {rec['page_count']} page(s):")
            seen_pages = set()
            for p in rec["pages"]:
                if p["page"] not in seen_pages:
                    seen_pages.add(p["page"])
                    lines.append(f"    {p['page']}  \"{p['link_text']}\"")

    return "\n".join(lines)


def main():
    verify = "--verify" in sys.argv

    print("Parsing site_structure.txt...")
    entries = parse_site_structure(SITE_STRUCTURE_FILE)
    print(f"  Found {len(entries)} Drive link references")

    print("Building registry...")
    registry = build_registry(entries)
    print(f"  {len(registry)} unique Drive IDs")

    if verify:
        print("Verifying IDs via Drive API...")
        drive = get_drive_service()
        verify_ids(registry, drive)

    # Text report
    report = format_report(registry, verified=verify)
    print(report)
    with open(REGISTRY_TXT, "w") as f:
        f.write(report + "\n")
    print(f"\nText report: {REGISTRY_TXT}")

    # JSON output
    with open(REGISTRY_JSON, "w") as f:
        json.dump(registry, f, indent=2)
    print(f"JSON report: {REGISTRY_JSON}")


if __name__ == "__main__":
    main()
