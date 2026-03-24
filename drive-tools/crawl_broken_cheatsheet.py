#!/usr/bin/env python3
"""
Crawl villasboulders.org, find broken links, and produce a cheat sheet
for manual fixing in Google Sites.

Output: page-by-page list of broken links with their visible link text.
"""

import re
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse, urldefrag

import requests
from bs4 import BeautifulSoup

from config import get_drive_service, check_file_accessible

BASE = "https://www.villasboulders.org"
TIMEOUT = 20
SKIP_SCHEMES = {"mailto", "tel", "javascript", "data"}
MAX_WORKERS = 8

DRIVE_ID_RE = re.compile(r"drive\.google\.com/file/d/([a-zA-Z0-9_-]+)")
DRIVE_OPEN_RE = re.compile(r"drive\.google\.com/open\?id=([a-zA-Z0-9_-]+)")
FORMS_RE = re.compile(r"docs\.google\.com/forms/d/e/([a-zA-Z0-9_-]+)")

session = requests.Session()
session.headers["User-Agent"] = "Mozilla/5.0 (compatible; HOA-LinkChecker/1.0)"


def normalize(url):
    url, _ = urldefrag(url)
    return url.rstrip("/") if url else ""


def is_internal(url):
    parsed = urlparse(url)
    return parsed.netloc == "" or parsed.netloc == urlparse(BASE).netloc


def extract_drive_id(url):
    for pat in [DRIVE_ID_RE, DRIVE_OPEN_RE]:
        m = pat.search(url)
        if m:
            return m.group(1)
    return None


def extract_links_with_text(page_url, html):
    """Extract <a> links with their visible text and href."""
    soup = BeautifulSoup(html, "html.parser")
    results = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        parsed = urlparse(href)
        if parsed.scheme in SKIP_SCHEMES or href.startswith("#"):
            continue
        full = normalize(urljoin(page_url, href))
        if not full:
            continue
        text = a.get_text(strip=True) or "[no text]"
        results.append((full, text))

    # Also check iframes (Drive embeds)
    for iframe in soup.find_all("iframe", src=True):
        src = iframe["src"].strip()
        full = normalize(urljoin(page_url, src))
        if full:
            results.append((full, "[embedded document]"))

    return results


def check_url_http(url):
    try:
        r = session.head(url, timeout=TIMEOUT, allow_redirects=True)
        if r.status_code == 405:
            r = session.get(url, timeout=TIMEOUT, allow_redirects=True, stream=True)
        return r.status_code
    except requests.RequestException as e:
        return str(e)


def page_label(url):
    """Extract a human-readable page name from URL."""
    path = urlparse(url).path.rstrip("/")
    if not path or path == "/":
        return "Home"
    # Google Sites URLs are like /page-name or /parent/page-name
    return path.split("/")[-1]


def main():
    drive = get_drive_service()

    print("Crawling villasboulders.org...")
    visited = set()
    to_crawl = {BASE}
    checked = {}
    # link_url -> [(page_url, link_text), ...]
    link_occurrences = defaultdict(list)

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

        for link_url, link_text in extract_links_with_text(url, r.text):
            link_occurrences[link_url].append((url, link_text))
            if is_internal(link_url) and link_url not in visited:
                to_crawl.add(link_url)

    print(f"  Pages crawled: {len(visited)}")

    # Check external links
    to_check = [url for url in link_occurrences if url not in checked]
    drive_urls = []
    http_urls = []
    for url in to_check:
        fid = extract_drive_id(url)
        if fid:
            drive_urls.append((url, fid))
        else:
            http_urls.append(url)

    print(f"Checking {len(drive_urls)} Drive links via API...")
    for url, fid in drive_urls:
        ok, name = check_file_accessible(drive, fid)
        checked[url] = 200 if ok else 404

    print(f"Checking {len(http_urls)} other external links...")
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(check_url_http, url): url for url in http_urls}
        for future in as_completed(futures):
            url = futures[future]
            checked[url] = future.result()

    print(f"  Total links checked: {len(checked)}")

    # Find broken
    broken = []
    for url, occurrences in sorted(link_occurrences.items()):
        status = checked.get(url)
        if status is None:
            continue
        is_error = isinstance(status, str) or (isinstance(status, int) and status >= 400)
        if is_error:
            broken.append((url, status, occurrences))

    print(f"\nBroken links found: {len(broken)}")

    if not broken:
        print("\nAll links OK!")
        sys.exit(0)

    # Group by page
    by_page = defaultdict(list)
    for url, status, occurrences in broken:
        for page_url, link_text in occurrences:
            by_page[page_url].append((link_text, url, status))

    # Output cheat sheet
    lines = []
    lines.append("=" * 80)
    lines.append("BROKEN LINK CHEAT SHEET — villasboulders.org")
    lines.append(f"{len(broken)} broken links across {len(by_page)} pages")
    lines.append("=" * 80)
    lines.append("")
    lines.append("For each page: find the link by its text, then relink it")
    lines.append("by navigating to the correct file on Google Drive.")

    for page_url in sorted(by_page.keys()):
        items = by_page[page_url]
        label = page_label(page_url)
        lines.append(f"\n{'━' * 80}")
        lines.append(f"PAGE: {label}")
        lines.append(f"  {page_url}")
        lines.append(f"  ({len(items)} broken link{'s' if len(items) != 1 else ''})")
        lines.append(f"{'━' * 80}")

        for link_text, url, status in sorted(items, key=lambda x: x[0]):
            lines.append(f"\n  Link text: \"{link_text}\"")
            lines.append(f"  Broken URL: {url}")
            lines.append(f"  Status: {status}")

    report = "\n".join(lines)
    print(report)

    out_path = "/home/dee/hoa-code/drive-tools/broken_cheatsheet.txt"
    with open(out_path, "w") as f:
        f.write(report + "\n")
    print(f"\nCheat sheet written to {out_path}")


if __name__ == "__main__":
    main()
