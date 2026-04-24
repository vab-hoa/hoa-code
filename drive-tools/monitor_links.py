#!/usr/bin/env python3
"""
Nightly link checker for villasboulders.org.

Crawls the site, validates all links (with Drive-specific file ID checks),
and emails alerts when NEW broken links are found.

Usage:
  python monitor_links.py                          # check and report to stdout
  python monitor_links.py --email                  # send alert email if NEW broken links found
  python monitor_links.py --email --force-report   # send report email regardless

Exit codes: 0=clean, 1=broken links found, 2=error
"""

import json
import re
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse, urldefrag

import requests

from config import get_drive_service, check_file_accessible, send_alert_email

BASE = "https://www.villasboulders.org"
TIMEOUT = 20
SKIP_SCHEMES = {"mailto", "tel", "javascript", "data"}
KNOWN_BROKEN_FILE = "/home/dee/hoa-code/drive-tools/known_broken.json"
MAX_WORKERS = 8

# Match Google Drive file IDs in URLs
DRIVE_ID_RE = re.compile(r"drive\.google\.com/file/d/([a-zA-Z0-9_-]+)")
DRIVE_OPEN_RE = re.compile(r"drive\.google\.com/open\?id=([a-zA-Z0-9_-]+)")

session = requests.Session()
session.headers["User-Agent"] = "Mozilla/5.0 (compatible; HOA-LinkChecker/1.0)"


def load_known_broken():
    try:
        with open(KNOWN_BROKEN_FILE) as f:
            return set(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def save_known_broken(urls):
    with open(KNOWN_BROKEN_FILE, "w") as f:
        json.dump(sorted(urls), f, indent=2)


def normalize(url):
    url, _ = urldefrag(url)
    return url.rstrip("/") if url else ""


def is_internal(url):
    parsed = urlparse(url)
    return parsed.netloc == "" or parsed.netloc == urlparse(BASE).netloc


def extract_drive_id(url):
    """Extract a Google Drive file ID from a URL, or None."""
    m = DRIVE_ID_RE.search(url)
    if m:
        return m.group(1)
    m = DRIVE_OPEN_RE.search(url)
    if m:
        return m.group(1)
    return None


def _link_context(el, tag):
    """Build a brief context string describing where a link element appears."""
    parts = [f"<{tag}>"]
    if tag == "a":
        text = el.get_text(strip=True)[:80]
        if text:
            parts.append(f'text="{text}"')
    elif tag in ("img", "source"):
        alt = el.get("alt", "").strip()[:40]
        if alt:
            parts.append(f'alt="{alt}"')
    # Walk up ancestors looking for a block element with id or class
    parent = el.parent
    for _ in range(6):
        if parent is None or not hasattr(parent, "name") or parent.name is None:
            break
        if parent.name in ("div", "section", "article", "main", "aside", "nav", "footer", "header", "p", "li"):
            pid = parent.get("id", "").strip()
            pcls = " ".join(parent.get("class", [])).strip()[:60]
            desc = pid or pcls
            if desc:
                parts.append(f'in <{parent.name} "{desc}">')
                break
        parent = parent.parent
    return " ".join(parts)


def extract_links(page_url, html):
    """Extract all linked resources from HTML with location context.

    Returns list of (url, context_str) tuples.
    """
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    attrs = [
        ("a", "href"), ("img", "src"), ("script", "src"),
        ("link", "href"), ("source", "src"), ("iframe", "src"),
    ]
    results = []
    for tag, attr in attrs:
        for el in soup.find_all(tag):
            val = el.get(attr)
            if not val:
                continue
            val = val.strip()
            parsed = urlparse(val)
            if parsed.scheme in SKIP_SCHEMES:
                continue
            if val.startswith("#"):
                continue
            full = normalize(urljoin(page_url, val))
            if full:
                ctx = _link_context(el, tag)
                results.append((full, ctx))
    return results


def check_url_http(url):
    """Check a non-Drive URL via HTTP HEAD/GET."""
    try:
        r = session.head(url, timeout=TIMEOUT, allow_redirects=True)
        if r.status_code == 405:
            r = session.get(url, timeout=TIMEOUT, allow_redirects=True, stream=True)
        return r.status_code
    except requests.RequestException as e:
        return str(e)


def crawl_site():
    """Crawl the site and return (checked_urls, found_on) dicts.

    found_on maps link_url -> list of (page_url, context_str) tuples.
    """
    visited = set()
    to_crawl = {BASE}
    checked = {}
    found_on = defaultdict(list)

    while to_crawl:
        url = to_crawl.pop()
        if url in visited:
            continue
        visited.add(url)

        try:
            r = session.get(url, timeout=TIMEOUT)
            checked[url] = r.status_code
        except requests.RequestException as e:
            checked[url] = str(e)
            continue

        if r.status_code >= 400:
            continue
        ct = r.headers.get("content-type", "")
        if "html" not in ct:
            continue

        for link, ctx in extract_links(url, r.text):
            found_on[link].append((url, ctx))
            if is_internal(link) and link not in visited:
                to_crawl.add(link)

    return checked, found_on, visited


def check_external_links(checked, found_on, drive):
    """Check all unchecked external links, using Drive API for Drive URLs."""
    to_check = [url for url in found_on if url not in checked]

    # Separate Drive URLs from regular URLs
    drive_urls = []
    http_urls = []
    for url in to_check:
        fid = extract_drive_id(url)
        if fid:
            drive_urls.append((url, fid))
        else:
            http_urls.append(url)

    # Check Drive URLs via API
    for url, fid in drive_urls:
        ok, name = check_file_accessible(drive, fid)
        checked[url] = 200 if ok else 404

    # Check HTTP URLs in parallel
    def _check(url):
        return url, check_url_http(url)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(_check, url): url for url in http_urls}
        for future in as_completed(futures):
            url, status = future.result()
            checked[url] = status


def find_broken(checked, found_on):
    """Return list of (url, status, by_page) for broken links.

    by_page is a dict mapping page_url -> list of context strings.
    """
    broken = []
    for url, occurrences in sorted(found_on.items()):
        status = checked.get(url)
        if status is None:
            continue
        is_error = isinstance(status, str) or (isinstance(status, int) and status >= 400)
        if is_error:
            by_page = defaultdict(list)
            for page_url, ctx in occurrences:
                by_page[page_url].append(ctx)
            broken.append((url, status, dict(by_page)))
    return broken


def main():
    send_email = "--email" in sys.argv
    force_report = "--force-report" in sys.argv

    try:
        drive = get_drive_service()
    except Exception as e:
        print(f"ERROR: Could not initialize Drive service: {e}")
        sys.exit(2)

    print("Crawling villasboulders.org...")
    checked, found_on, visited = crawl_site()
    print(f"  Pages crawled: {len(visited)}")

    print("Checking external links...")
    check_external_links(checked, found_on, drive)
    print(f"  Total links checked: {len(checked)}")

    broken = find_broken(checked, found_on)

    # Filter against known broken list
    known = load_known_broken()
    new_broken = [(url, st, pages) for url, st, pages in broken if url not in known]
    still_known = [(url, st, pages) for url, st, pages in broken if url in known]

    print(f"\nBroken links: {len(broken)} total")
    print(f"  New: {len(new_broken)}")
    print(f"  Known/suppressed: {len(still_known)}")

    if broken:
        print(f"\n{'=' * 80}")
        print(f"BROKEN LINK REPORT")
        print(f"{'=' * 80}")

        if new_broken:
            print(f"\n--- NEW BROKEN LINKS ({len(new_broken)}) ---\n")
            for url, status, by_page in new_broken:
                print(f"  {url}")
                print(f"    Status: {status}")
                for page_url, contexts in sorted(by_page.items()):
                    print(f"    Found on: {page_url}")
                    for ctx in contexts:
                        print(f"      {ctx}")
                print()

        if still_known:
            print(f"\n--- KNOWN/SUPPRESSED ({len(still_known)}) ---\n")
            for url, status, by_page in still_known:
                print(f"  {url}  ({status})")

    # Build email body
    should_email = send_email and (new_broken or force_report)
    if should_email:
        if new_broken:
            subject = f"villasboulders.org: {len(new_broken)} NEW broken link(s) found"
        elif broken:
            subject = f"villasboulders.org: link check — {len(broken)} known broken, no new"
        else:
            subject = "villasboulders.org: link check — all links OK"

        body_lines = [
            f"Link monitor report for villasboulders.org",
            f"Pages crawled: {len(visited)}",
            f"Total links checked: {len(checked)}",
            "",
        ]

        if new_broken:
            body_lines.append(f"{len(new_broken)} NEW broken link(s):\n")
            for url, status, by_page in new_broken:
                body_lines.append(f"  {url}")
                body_lines.append(f"    Status: {status}")
                for page_url, contexts in sorted(by_page.items()):
                    body_lines.append(f"    Found on: {page_url}")
                    for ctx in contexts:
                        body_lines.append(f"      {ctx}")
                body_lines.append("")

        if still_known:
            body_lines.append(
                f"{len(still_known)} known/suppressed broken link(s)."
            )

        if not broken:
            body_lines.append("All links OK!")

        try:
            send_alert_email(subject, "\n".join(body_lines))
            print(f"\nAlert email sent.")
        except Exception as e:
            print(f"\nFailed to send alert email: {e}")

    if not broken:
        print("\nAll links OK!")
        sys.exit(0)
    elif new_broken:
        sys.exit(1)
    else:
        # Only known broken links, no new ones
        sys.exit(0)


if __name__ == "__main__":
    main()
