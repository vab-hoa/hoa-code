from keystone_attachments import already_have, arc_attachment, document_row, safe_name, wo_attachment


def test_safe_name():
    assert safe_name("Front porch (1).JPG") == "Front_porch_1_.JPG"
    assert safe_name("../../etc/passwd") == "etc_passwd"
    assert safe_name("") == "file"


def test_keys_and_modules():
    w = wo_attachment({"_id": 80145, "filename": "a.jpg", "database": "db1", "fileSize": 10}, "wi")
    a = arc_attachment({"attachmentId": 2846484, "fileName": "p.pdf", "database": "db2", "fileSize": 5}, "wi2")
    assert (w["source_key"], w["module"]) == ("keystone:wo-attachment:80145", "boardWorkOrders")
    assert (a["source_key"], a["module"]) == ("keystone:arc-attachment:2846484", "boardAccReview")


def test_already_have_by_key_or_old_backfill():
    att = wo_attachment({"_id": 1, "filename": "a.jpg", "database": "d", "fileSize": 10}, "wi")
    assert already_have(att, {"keystone:wo-attachment:1"}, set())
    assert already_have(att, set(), {("wi", "a.jpg", "10")})      # imported by the old backfill
    assert not already_have(att, set(), {("wi", "a.jpg", "11")})


def test_document_row():
    att = arc_attachment({"attachmentId": 7, "fileName": "plan.pdf", "database": "d", "fileSize": 5}, "wi")
    row = document_row(att, "wi/keystone-arc-attachment-7-plan.pdf", 5)
    assert row["content_type"] == "application/pdf"
    assert row["source_key"] == "keystone:arc-attachment:7"
    assert row["title"] == "plan.pdf"
