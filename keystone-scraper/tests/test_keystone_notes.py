from keystone_notes import arc_note_row, fingerprint, match_arc, wo_note_rows


def test_wo_note_rows_are_stable_and_skip_blanks():
    notes = [{"noteDate": "10/2/2026", "note": "Vendor scheduled"}, {"noteDate": "10/3/2026", "note": "  "}]
    rows = wo_note_rows("110259", "wi-1", notes)
    assert len(rows) == 1
    r = rows[0]
    assert (r["work_item_id"], r["note_date"], r["content"]) == ("wi-1", "2026-10-02", "Vendor scheduled")
    assert r["source_key"] == f"keystone:wo-note:110259:{fingerprint('10/2/2026', 'Vendor scheduled')}"
    assert wo_note_rows("110259", "wi-1", notes) == rows          # same input -> same key


def test_edited_note_gets_new_key():
    a = wo_note_rows("1", "wi", [{"noteDate": "10/2/2026", "note": "Draft"}])[0]["source_key"]
    b = wo_note_rows("1", "wi", [{"noteDate": "10/2/2026", "note": "Draft, revised"}])[0]["source_key"]
    assert a != b


CANDS = [
    {"id": "near", "parcel": "3510BL1", "created_date": "2026-10-05"},
    {"id": "far", "parcel": "3510BL1", "created_date": "2026-06-01"},
    {"id": "other", "parcel": "13713BP2", "created_date": "2026-10-02"},
]


def test_match_arc_nearest_same_parcel():
    assert match_arc("3510BL1", "2026-10-02", CANDS) == "near"


def test_match_arc_rejects_distant_and_ambiguous():
    assert match_arc("3510BL1", "2026-08-01", CANDS) is None              # nothing within 14 days
    tie = CANDS + [{"id": "tie", "parcel": "3510BL1", "created_date": "2026-09-29"}]
    assert match_arc("3510BL1", "2026-10-02", tie) is None                # 3 days either side
    assert match_arc(None, "2026-10-02", CANDS) is None


def test_arc_note_row():
    rec = {"_id": 42, "committeeResponse": "Approved with conditions", "requestType": "Paint"}
    row = arc_note_row(rec, "wi-9", "2026-10-31")
    assert row["content"] == "ARC committee response (Paint): Approved with conditions"
    assert row["source_key"].startswith("keystone:arc-response:42:")
    assert arc_note_row({"_id": 1, "committeeResponse": None}, "wi", "2026-10-31") is None
