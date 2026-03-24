#!/usr/bin/env python3
"""
For each broken Drive link, fetch the page it's on and extract context
(surrounding text, link text, iframe title) to identify the document.
Then search the shared drive for a match.
"""

import re
import requests
from bs4 import BeautifulSoup
from google.oauth2 import service_account
from googleapiclient.discovery import build

SA_FILE = "/home/dee/.config/openclaw/google-service-account.json"
SCOPES = ["https://www.googleapis.com/auth/drive"]
SUBJECT = "admin@villasboulders.org"
SHARED_DRIVE_ID = "0AExYZWmfRm9JUk9PVA"

session = requests.Session()
session.headers["User-Agent"] = "Mozilla/5.0 (compatible; HOA-LinkChecker/1.0)"

# Broken links: {file_id: [(page_url, ...), ...]}
BROKEN = {
    "10AsxcnmTz8xn6Kcd1AOQjPOnQAc1bIiJ": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "137z5ohOvd323lgDE3lOym-0NTbUxq2v-": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1533Hg-wnBYNWf8wRp3B2BI7-UDMUWOhx": ["https://www.villasboulders.org/community/governing-documents"],
    "1DAxuOr2eWMGdcGlwzx_AsZ5JmkuxLfU6": ["https://www.villasboulders.org/budgets-costs-and-dues/annual-budgetdues-process"],
    "1DQ3VG7iip_lMTbXu2DVcCGWAt_eWaCWT": ["https://www.villasboulders.org/budgets-costs-and-dues/annual-budgetdues-process"],
    "1G_fxPeHVAHb3YUBVOGHLIRadDZRQ6HyT": ["https://www.villasboulders.org/community/governing-documents"],
    "1Hjgt5BOILNNsIBMeVCkXKRXNq3twsThx": ["https://www.villasboulders.org/forms/homeowner-paid-planting"],
    "1Pp7eJCERWW2L0o9J9fSsvYoMT80vzdiV": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1QKeMQIWfV4Xzd6DNu6Ba-iMAaIofJfya": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1QcdQp6qubp-pZbZr3-Jz92tuK3CeMFjK": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1SD5QYSJFMCifWIe0upFKsbF1XOX3KpE9": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1TdeqabI_X6DYlrSi-Hitug9N2PCtQdqh": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1VzsXjgNzeWFFWfMaELgiAvbQZTz7hvD2": ["https://www.villasboulders.org/budgets-costs-and-dues/reserve-studies"],
    "1WezdYQm3ogBGHJBjyx4vLAWeX27CKO-n": ["https://www.villasboulders.org/budgets-costs-and-dues/the-roofing-loan"],
    "1YXsZL9fGmBEnO-fwDMZqTeMUInP2EOJk": ["https://www.villasboulders.org/budgets-costs-and-dues/the-roofing-loan"],
    "1_898PAnP58NishT6BEO0M-xHOzB046oB": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1conXw8mimAJ9XwzivxL0V6WipB9_7pTW": ["https://www.villasboulders.org/budgets-costs-and-dues/reserve-studies"],
    "1cwK8BsvqjCcxsdVoWaQ5km1qWrl_hDok": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1ePjUVQg6ocQZtUC6Skwjq6O2d5z1fbkM": ["https://www.villasboulders.org/community/villas-geography"],
    "1iTJ_6j8G7JF8a-A077t5GgogcAVmtmF2": ["https://www.villasboulders.org/budgets-costs-and-dues/reserve-studies"],
    "1is8xWW3b_YhCIta2S6TndGxjKmAl4MIQ": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1kpToMEM7ncSAY53fb-b6gb-SE66gYjag": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1mJZwynZim9MEnUjJnglPaVYBp9aQno_i": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1mf-N6D2SHWIA7u--zlVqR7l1Lldq9KaB": ["https://www.villasboulders.org/community/governing-documents"],
    "1mu-_ltPczKFYj2IvPUTgi9NXDdzZOFmG": ["https://www.villasboulders.org/committees/arc"],
    "1nAi8h5xjikw8g_T0oTcPJP8xGg-zTRJR": ["https://www.villasboulders.org/community/governing-documents"],
    "1p_IK70rLFbRfb0zXo0s2TouOzrmoGzQH": ["https://www.villasboulders.org/committees/the-board-of-directors"],
    "1ptp2EjRte57I_v10YPN_PEB6xakfet7r": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1rvvnS4AXM6Rksy9ygg_OqTzft0Pf-PqV": ["https://www.villasboulders.org/budgets-costs-and-dues/the-roofing-loan"],
    "1udQFTvcA0Fg8tKHkXEu_an1qzFZLvLIN": ["https://www.villasboulders.org/community/governing-documents"],
    "1v1v4qwqj3gWDWCV7n7iohaudFM9VcJnn": ["https://www.villasboulders.org/community/governing-documents/policies"],
    "1zVfswsEQHqcCcgtNUAE902qTXZTwtCIm": ["https://www.villasboulders.org/community/villas-geography"],
}


def extract_context(html, file_id):
    """Find the broken link in HTML and extract identifying context."""
    soup = BeautifulSoup(html, "html.parser")
    contexts = []

    # Check <a> tags
    for a in soup.find_all("a", href=True):
        if file_id in a["href"]:
            text = a.get_text(strip=True)
            # Get surrounding text
            parent = a.parent
            parent_text = parent.get_text(strip=True)[:200] if parent else ""
            contexts.append(f"LINK TEXT: '{text}' | PARENT: '{parent_text}'")

    # Check <iframe> tags (embedded previews)
    for iframe in soup.find_all("iframe", src=True):
        if file_id in iframe["src"]:
            title = iframe.get("title", "")
            aria = iframe.get("aria-label", "")
            # Get text before/after the iframe
            parent = iframe.parent
            if parent:
                prev_sib = parent.find_previous_sibling()
                prev_text = prev_sib.get_text(strip=True)[:150] if prev_sib else ""
                next_sib = parent.find_next_sibling()
                next_text = next_sib.get_text(strip=True)[:150] if next_sib else ""
            else:
                prev_text = next_text = ""
            contexts.append(
                f"IFRAME title='{title}' aria='{aria}' | BEFORE: '{prev_text}' | AFTER: '{next_text}'"
            )

    return contexts


def main():
    # Cache fetched pages
    page_cache = {}

    print("=" * 100)
    print("IDENTIFYING BROKEN DOCUMENTS BY PAGE CONTEXT")
    print("=" * 100)

    for file_id, pages in sorted(BROKEN.items(), key=lambda x: x[1][0]):
        page_url = pages[0]
        print(f"\n{'─' * 100}")
        print(f"FILE ID: {file_id}")
        print(f"PAGE: {page_url}")

        if page_url not in page_cache:
            try:
                r = session.get(page_url, timeout=20)
                page_cache[page_url] = r.text
            except Exception as e:
                print(f"  ERROR fetching page: {e}")
                continue

        html = page_cache[page_url]
        contexts = extract_context(html, file_id)

        if contexts:
            for ctx in contexts:
                print(f"  {ctx}")
        else:
            print("  (no context found - ID may be in dynamically loaded content)")


if __name__ == "__main__":
    main()
