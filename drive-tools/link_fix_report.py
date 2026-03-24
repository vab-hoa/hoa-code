#!/usr/bin/env python3
"""
Generate a link-fix report mapping old (broken) Drive file IDs to new replacement IDs.
Groups output by website page for easy editing in Google Sites.

Usage: python link_fix_report.py [--verify]
  --verify  Check each new ID via Drive API (slower but confirms accessibility)
"""

import sys
from config import get_drive_service, check_file_accessible

# ─── Confirmed replacement mappings ───────────────────────────────────────────
# All policy IDs point to the [Policies] folder (canonical location).
# Current.Signed.Policies/ is entirely symlink duplicates and will be trashed.
# Format: old_id -> (description, new_id, url_type)
# url_type: "preview" for Drive embeds, "form" for Google Forms

REPLACEMENTS = {
    # ── 14 Signed Policies (canonical copies in Policies/ folder) ──
    "10AsxcnmTz8xn6Kcd1AOQjPOnQAc1bIiJ": (
        "Adoption and Amendment of Policies",
        "1os0OlZYgGDRMb1prCiEzbioYGrjx_3VV",
        "preview",
    ),
    "137z5ohOvd323lgDE3lOym-0NTbUxq2v-": (
        "Association Directors and Officers (policy)",
        "1ltdSmPja3G5HLeDozHuKWAHcWIGyb8Os",
        "preview",
    ),
    "1Pp7eJCERWW2L0o9J9fSsvYoMT80vzdiV": (
        "Investment of Reserve Funds policy",
        "1IK-TYMwkcJicLyeO4qXCtXfBQeEEdkkL",
        "preview",
    ),
    "1QKeMQIWfV4Xzd6DNu6Ba-iMAaIofJfya": (
        "Alternative Dispute Resolution policy",
        "1lkGkfmPVBZmsLi_Usw7oWg7MBVUJeE0V",
        "preview",
    ),
    "1QcdQp6qubp-pZbZr3-Jz92tuK3CeMFjK": (
        "Collection of Unpaid Assessments policy",
        "1rZGiDnXdvI4EF289L46fF52YBr28uWjF",
        "preview",
    ),
    "1SD5QYSJFMCifWIe0upFKsbF1XOX3KpE9": (
        "Reserve Requirements policy",
        "1GQrL1olKpM78NyQZvYgLbRo2WS0EptJF",
        "preview",
    ),
    "1TdeqabI_X6DYlrSi-Hitug9N2PCtQdqh": (
        "Snow Removal policy",
        "10y4X34OyiWWRIIHkbW-OACCPEZECyHKR",
        "preview",
    ),
    "1_898PAnP58NishT6BEO0M-xHOzB046oB": (
        "Responsibility for Deductible Portion of Insurance Claim",
        "1h7fIPGI4BH5tVW-AsI0kctUN9MxNNGms",
        "preview",
    ),
    "1cwK8BsvqjCcxsdVoWaQ5km1qWrl_hDok": (
        "Director Conflict of Interest policy",
        "1Q-SjhkNQgwTFz30nP6MmkFMe7nxWN_JR",
        "preview",
    ),
    "1is8xWW3b_YhCIta2S6TndGxjKmAl4MIQ": (
        "Inspection and Copying of Association Records policy",
        "15yABqrybAJ4w-4nl1Zc_yWeJtI_dN6pG",
        "preview",
    ),
    "1kpToMEM7ncSAY53fb-b6gb-SE66gYjag": (
        "Homeowner Paid Planting and Removal policy",
        "1E16iZaEVwGk5Zdxzh2cmyKj1rUgkEOho",
        "preview",
    ),
    "1mJZwynZim9MEnUjJnglPaVYBp9aQno_i": (
        "Covenant Enforcement policy",
        "1UqGt1rQM8Tfzmw5xTHIqIceVepBvg0q7",
        "preview",
    ),
    "1ptp2EjRte57I_v10YPN_PEB6xakfet7r": (
        "Committee Authorities policy",
        "1lnms3fSMzfUwtVuBTPdqDvOEUQFju4FU",
        "preview",
    ),
    "1v1v4qwqj3gWDWCV7n7iohaudFM9VcJnn": (
        "Conduct of Meetings policy",
        "1BNeDX1DZnXrz3CpBY0f42h6jkQTPbydN",
        "preview",
    ),

    # ── Governing Documents ──
    "1mf-N6D2SHWIA7u--zlVqR7l1Lldq9KaB": (
        "Articles of Incorporation",
        "1Hd6NGIrGM023fN42bxZV_nzSdlPZSqEk",
        "preview",
    ),
    "1udQFTvcA0Fg8tKHkXEu_an1qzFZLvLIN": (
        "Bylaws",
        "1bjoZLU2hAVZOpMo2VJwNZzP73zXLS3_L",
        "preview",
    ),
    "1G_fxPeHVAHb3YUBVOGHLIRadDZRQ6HyT": (
        "Colorado Certificate (of incorporation)",
        "1t1PbQG7ZtR9gU4g6uUPQcGupkYIqf5dT",
        "preview",
    ),
    "1nAi8h5xjikw8g_T0oTcPJP8xGg-zTRJR": (
        "Amendment to the Covenants",
        "18CbXaVwhasENdTlsaMGigOeHRdCPoRfO",
        "preview",
    ),
    "1533Hg-wnBYNWf8wRp3B2BI7-UDMUWOhx": (
        "Covenants (DCCRs)",
        "1w0QpFQHc9zQlORNKxdSSvyo3L-g4rAin",
        "preview",
    ),

    # ── ARC ──
    "1mu-_ltPczKFYj2IvPUTgi9NXDdzZOFmG": (
        "ARC Guidelines",
        "1aX1kP741jWARBx3tU5KXWiCtnzm3OSpG",
        "preview",
    ),

    # ── Budget ──
    "1DAxuOr2eWMGdcGlwzx_AsZ5JmkuxLfU6": (
        "Operating Budget",
        "16j2aJXvQLHF7PaM5d4BR4vCO1jNF3PNY",
        "preview",
    ),
    "1DQ3VG7iip_lMTbXu2DVcCGWAt_eWaCWT": (
        "Budget Presentation",
        "1Nwzq-Fi-H0IqliKJWw9uCow1SpalAxod",
        "preview",
    ),

    # ── Reserve Studies ──
    "1VzsXjgNzeWFFWfMaELgiAvbQZTz7hvD2": (
        "2006 Reserve Study",
        "1bh6Z9B8duYX0fGzJPZpEAbdfwx55ZEv4",
        "preview",
    ),
    "1iTJ_6j8G7JF8a-A077t5GgogcAVmtmF2": (
        "2015 Reserve Study",
        "1OI2GQrTY0-_jHim0BGzEPCq1P_kIIEpP",
        "preview",
    ),
    "1conXw8mimAJ9XwzivxL0V6WipB9_7pTW": (
        "2022 Reserve Study",
        "1mVeYpUWfPwnrSQNAS4eHfEwqUfixWsgV",
        "preview",
    ),

    # ── Roofing ──
    "1WezdYQm3ogBGHJBjyx4vLAWeX27CKO-n": (
        "Roofing Major Project doc",
        "1x1F76LnO2rMBH_UkKjgCB28G-PuD6-j_",
        "preview",
    ),
    "1rvvnS4AXM6Rksy9ygg_OqTzft0Pf-PqV": (
        "Roofing Conclusions and Recommendations",
        "1ZztsHUg_9hC-da5tgrsCgl5cresGxmhY",
        "preview",
    ),
    "1YXsZL9fGmBEnO-fwDMZqTeMUInP2EOJk": (
        "Roofing Finished doc",
        "1gQqwKAIZy-yOEeflc_nf3DWofyGmM4Bi",
        "preview",
    ),

    # ── Forms ──
    "1Hjgt5BOILNNsIBMeVCkXKRXNq3twsThx": (
        "Homeowner Paid Planting and Removal (form)",
        "1FAIpQLSdePB2ZRaJ-V-9kCYH65oAJMALS0NNDx7L_LSdKgv1Fl6k_9Q",
        "form",
    ),

    # ── Board / Officers ──
    "1p_IK70rLFbRfb0zXo0s2TouOzrmoGzQH": (
        "Current Directors and Officers List",
        "1Iq-ri3ZDumjaTzM7TMhQFwNl6HCx61U-",
        "preview",
    ),

    # ── Geography ──
    "1ePjUVQg6ocQZtUC6Skwjq6O2d5z1fbkM": (
        "The Original Plat",
        "1VvA3-SWt7havg2WslyLmljG6XDfXLydq",
        "preview",
    ),
    "1zVfswsEQHqcCcgtNUAE902qTXZTwtCIm": (
        "Map of the Villas at the Boulders",
        "12R_K-MBX11dtOAoRhCvT9jhiGv9bVyUd",
        "preview",
    ),
}

# ─── Page mapping: which pages each broken ID appears on ──────────────────────
PAGES = {
    "10AsxcnmTz8xn6Kcd1AOQjPOnQAc1bIiJ": ["policies"],
    "137z5ohOvd323lgDE3lOym-0NTbUxq2v-": ["policies"],
    "1533Hg-wnBYNWf8wRp3B2BI7-UDMUWOhx": ["governing-documents", "arc", "faq", "rules"],
    "1DAxuOr2eWMGdcGlwzx_AsZ5JmkuxLfU6": ["annual-budgetdues-process"],
    "1DQ3VG7iip_lMTbXu2DVcCGWAt_eWaCWT": ["annual-budgetdues-process"],
    "1G_fxPeHVAHb3YUBVOGHLIRadDZRQ6HyT": ["governing-documents", "the-association"],
    "1Hjgt5BOILNNsIBMeVCkXKRXNq3twsThx": ["homeowner-paid-planting"],
    "1Pp7eJCERWW2L0o9J9fSsvYoMT80vzdiV": ["policies", "budgets-costs-and-dues"],
    "1QKeMQIWfV4Xzd6DNu6Ba-iMAaIofJfya": ["policies"],
    "1QcdQp6qubp-pZbZr3-Jz92tuK3CeMFjK": ["policies"],
    "1SD5QYSJFMCifWIe0upFKsbF1XOX3KpE9": ["policies", "budgets-costs-and-dues", "reserve-studies"],
    "1TdeqabI_X6DYlrSi-Hitug9N2PCtQdqh": ["policies", "snow-removal"],
    "1VzsXjgNzeWFFWfMaELgiAvbQZTz7hvD2": ["reserve-studies"],
    "1WezdYQm3ogBGHJBjyx4vLAWeX27CKO-n": ["the-roofing-loan"],
    "1YXsZL9fGmBEnO-fwDMZqTeMUInP2EOJk": ["the-roofing-loan"],
    "1_898PAnP58NishT6BEO0M-xHOzB046oB": ["policies"],
    "1conXw8mimAJ9XwzivxL0V6WipB9_7pTW": ["reserve-studies"],
    "1cwK8BsvqjCcxsdVoWaQ5km1qWrl_hDok": ["policies"],
    "1ePjUVQg6ocQZtUC6Skwjq6O2d5z1fbkM": ["villas-geography"],
    "1iTJ_6j8G7JF8a-A077t5GgogcAVmtmF2": ["reserve-studies"],
    "1is8xWW3b_YhCIta2S6TndGxjKmAl4MIQ": ["policies"],
    "1kpToMEM7ncSAY53fb-b6gb-SE66gYjag": ["policies"],
    "1mJZwynZim9MEnUjJnglPaVYBp9aQno_i": ["policies"],
    "1mf-N6D2SHWIA7u--zlVqR7l1Lldq9KaB": ["governing-documents", "rules"],
    "1mu-_ltPczKFYj2IvPUTgi9NXDdzZOFmG": ["arc", "arc-guidelines", "rules", "architectural-review-request"],
    "1nAi8h5xjikw8g_T0oTcPJP8xGg-zTRJR": ["governing-documents", "rules", "faq"],
    "1p_IK70rLFbRfb0zXo0s2TouOzrmoGzQH": ["board-of-directors", "former-board-members", "board-and-committees"],
    "1ptp2EjRte57I_v10YPN_PEB6xakfet7r": ["policies"],
    "1rvvnS4AXM6Rksy9ygg_OqTzft0Pf-PqV": ["the-roofing-loan"],
    "1udQFTvcA0Fg8tKHkXEu_an1qzFZLvLIN": ["governing-documents", "annual-budgetdues-process", "rules", "faq"],
    "1v1v4qwqj3gWDWCV7n7iohaudFM9VcJnn": ["policies"],
    "1zVfswsEQHqcCcgtNUAE902qTXZTwtCIm": ["villas-geography"],
}

SITE_BASE = "https://www.villasboulders.org"


def make_url(file_id, url_type="preview"):
    """Build a URL for the replacement link."""
    if url_type == "form":
        return f"https://docs.google.com/forms/d/e/{file_id}/viewform"
    elif url_type == "view":
        return f"https://drive.google.com/file/d/{file_id}/view?usp=drive_link"
    else:
        return f"https://drive.google.com/file/d/{file_id}/preview"


def main():
    verify = "--verify" in sys.argv
    drive = get_drive_service() if verify else None

    # Group entries by page
    by_page = {}
    for old_id, pages in PAGES.items():
        for page in pages:
            by_page.setdefault(page, []).append(old_id)

    lines = []
    lines.append("=" * 100)
    lines.append("LINK FIX REPORT — villasboulders.org broken Drive links")
    lines.append("Generated for manual Google Sites editing")
    lines.append(f"All 32 broken links now have confirmed replacements.")
    lines.append("=" * 100)

    if verify:
        lines.append("\n[Verifying new file IDs via Drive API...]")

    # Output grouped by page
    for page in sorted(by_page.keys()):
        page_url = f"{SITE_BASE}/.../{page}"
        lines.append(f"\n{'━' * 100}")
        lines.append(f"PAGE: {page_url}")
        lines.append(f"{'━' * 100}")

        for old_id in sorted(by_page[page], key=lambda x: REPLACEMENTS[x][0]):
            desc, new_id, url_type = REPLACEMENTS[old_id]
            old_url = f"https://drive.google.com/file/d/{old_id}/preview"
            new_url = make_url(new_id, url_type)

            lines.append(f"\n  {desc}")
            lines.append(f"  OLD: {old_url}")

            verified_str = ""
            if verify and url_type != "form":
                ok, name = check_file_accessible(drive, new_id)
                verified_str = f"  [{'OK' if ok else 'FAILED'}: {name}]"
            elif verify and url_type == "form":
                verified_str = "  [Google Form — not verified via Drive API]"

            lines.append(f"  NEW: {new_url}{verified_str}")

    report = "\n".join(lines)
    print(report)

    # Write to file
    out_path = "/home/dee/hoa-code/drive-tools/link_fix_report.txt"
    with open(out_path, "w") as f:
        f.write(report + "\n")
    print(f"\nReport written to {out_path}")


if __name__ == "__main__":
    main()
