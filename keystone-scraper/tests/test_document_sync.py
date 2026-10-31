from broadlands_docs import classify, match_drive_file
from keystone_documents import mapping_for, new_files, DOCUMENT_MAPPINGS


def test_classify():
    rec = {"name": "a.pdf", "size": 10, "updatedAt": "2026-05-28T00:00:00Z"}
    assert classify(None, rec) == "new"
    assert classify({"size": 10, "updated_at": "2026-05-28T00:00:00Z"}, rec) == "unchanged"
    assert classify({"size": 9, "updated_at": "2026-05-28T00:00:00Z"}, rec) == "updated"
    assert classify({"size": 10, "updated_at": "2026-01-01T00:00:00Z"}, rec) == "updated"


DRIVE = [  # mirrors the real Architectural folder: sync copies + older manual BRL-prefixed copies
    {"id": "manual", "name": "BRL Design Guidelines.pdf", "size": "415654", "modifiedTime": "2026-06-01T00:00:00Z"},
    {"id": "synced", "name": "Design Guidelines.pdf", "size": "415654", "modifiedTime": "2026-09-28T00:00:00Z"},
    {"id": "fence", "name": "Fence and Mailbox Detail.pdf", "size": "139221", "modifiedTime": "2026-09-28T00:00:00Z"},
    {"id": "annex", "name": "BRL Annexation.PDF", "size": "389261", "modifiedTime": "2026-05-23T00:00:00Z"},
]


def test_match_exact_name():
    assert match_drive_file("Fence and Mailbox Detail.pdf", 139221, DRIVE) == (DRIVE[2], "exact name")


def test_match_similar_name_ignores_extension_case():
    assert match_drive_file("BRL Annexation.pdf", 1, DRIVE) == (DRIVE[3], "similar name")


def test_match_renamed_file_by_size_prefers_newest():
    item, how = match_drive_file("Design Guidelines 15.pdf", 415654, DRIVE)
    assert (item["id"], how) == ("synced", "same size")


def test_no_match():
    assert match_drive_file("Brand New.pdf", 1, DRIVE) == (None, "no match")


def test_mapping_for():
    assert mapping_for("Financials/2026") == (DOCUMENT_MAPPINGS["Financials"], "2026")
    assert mapping_for("General Session Minutes/2025") == (DOCUMENT_MAPPINGS["General Session Minutes"], "2025")
    assert mapping_for("Board - Financials") == (DOCUMENT_MAPPINGS["Board - Financials"], None)
    assert mapping_for("Newsletters/2026") == (None, None)
    assert mapping_for("") == (None, None)


def test_new_files():
    current = {"Financials/2026": [{"name": "a.pdf"}, {"name": "b.pdf"}], "Forms": [{"name": "c.pdf"}]}
    known = {"Financials/2026": {"a.pdf": {}}}
    assert [(p, r["name"]) for p, r in new_files(current, known)] == [("Financials/2026", "b.pdf"), ("Forms", "c.pdf")]
