#!/usr/bin/env python3
"""Crawl villasboulders.org and report broken links."""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urldefrag
from collections import defaultdict

BASE = "https://www.villasboulders.org"
TIMEOUT = 20
SKIP_SCHEMES = {"mailto", "tel", "javascript", "data"}

session = requests.Session()
session.headers["User-Agent"] = "Mozilla/5.0 (compatible; HOA-LinkChecker/1.0)"

visited_pages = set()
pages_to_crawl = {BASE}
# url -> status_or_error
checked = {}
# url -> set of pages it was found on
found_on = defaultdict(set)


def normalize(url):
    """Remove fragment, return cleaned URL."""
    url, _ = urldefrag(url)
    return url.rstrip("/") if url else ""


def is_internal(url):
    parsed = urlparse(url)
    return parsed.netloc == "" or parsed.netloc == urlparse(BASE).netloc


def check_url(url):
    """HEAD then GET. Returns (status_code_or_error_string)."""
    if url in checked:
        return checked[url]
    try:
        r = session.head(url, timeout=TIMEOUT, allow_redirects=True)
        if r.status_code == 405:
            r = session.get(url, timeout=TIMEOUT, allow_redirects=True, stream=True)
        checked[url] = r.status_code
    except requests.RequestException as e:
        checked[url] = str(e)
    return checked[url]


def extract_links(page_url, html):
    """Extract all linked resources from HTML."""
    soup = BeautifulSoup(html, "html.parser")
    attrs = [
        ("a", "href"), ("img", "src"), ("script", "src"),
        ("link", "href"), ("source", "src"), ("iframe", "src"),
    ]
    urls = []
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
                urls.append(full)
    return urls


def crawl():
    while pages_to_crawl:
        url = pages_to_crawl.pop()
        if url in visited_pages:
            continue
        visited_pages.add(url)
        print(f"  Crawling: {url}")
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
        for link in extract_links(url, r.text):
            found_on[link].add(url)
            if is_internal(link) and link not in visited_pages:
                pages_to_crawl.add(link)

    # Now check all external links we haven't checked yet
    all_links = list(found_on.keys())
    for i, url in enumerate(all_links):
        if url not in checked:
            print(f"  Checking ({i+1}/{len(all_links)}): {url}")
            check_url(url)


def report():
    broken = []
    for url, pages in sorted(found_on.items()):
        status = checked.get(url)
        if status is None:
            continue
        is_error = (isinstance(status, str) or
                    (isinstance(status, int) and status >= 400))
        if is_error:
            broken.append((url, status, sorted(pages)))

    if not broken:
        print("\nNo broken links found!")
        return

    print(f"\n{'='*80}")
    print(f"BROKEN LINK REPORT — {len(broken)} broken links found")
    print(f"Pages crawled: {len(visited_pages)}")
    print(f"Total links checked: {len(checked)}")
    print(f"{'='*80}\n")

    for url, status, pages in broken:
        print(f"  BROKEN: {url}")
        print(f"  Status: {status}")
        for p in pages:
            print(f"    Found on: {p}")
        print()


if __name__ == "__main__":
    print("Crawling villasboulders.org...\n")
    crawl()
    report()
