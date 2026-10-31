"""Synthetic records only — never commit real owner data here."""
import pytest

from keystone_extract import (SchemaError, arch_review_rows, normalize_date, profile_rows,
                              require_fields, unit_address, violation_rows, work_order_rows)


@pytest.mark.parametrize("name, expected", [
    ("3510 Broadlands Lane #101  Broomfield CO 80023", "3510BL1"),
    ("3510 Broadlands Lane #102  Broomfield CO 80023", "3510BL2"),
    ("13713 Boulder Point #102  Broomfield CO 80023", "13713BP2"),
    ("13668 Plaster Point 101  Broomfield CO 80023", "13668PP1"),
    ("13704 Stone Circle Unit 102  Broomfield CO 80023", "13704SC2"),
    ("13639 Boulder Circle #101  Broomfield CO 80023", "13639BC1"),
    ("13723 Rock Point #101  Broomfield CO 80023", "13723RP1"),
    ("999 Nowhere St  Denver CO 80000", None),
    ("", None),
])
def test_unit_address(name, expected):
    assert unit_address(name) == expected


@pytest.mark.parametrize("value, expected", [
    ("10/2/2026", "2026-10-02"),
    ("2026-10-27", "2026-10-27"),
    ("2026-10-27T03:00:00.000Z", "2026-10-26"),   # 9 PM the previous evening in Denver
    ("2026-10-27T18:00:00.000Z", "2026-10-27"),
    ("", ""),
    (None, ""),
    ("not a date", ""),
])
def test_normalize_date(value, expected):
    assert normalize_date(value) == expected


def _wo(**over):
    wo = {"_id": 110259, "workLocation": "13713 Boulder Point #102", "createdDate": "2026-10-27T18:00:00Z",
          "description": "Gutter leak", "status": "On Hold", "category": "Gutters", "vendor": {"name": "Acme"}}
    wo.update(over)
    return wo


def test_work_order_row_layout():
    assert work_order_rows([_wo()]) == [
        ["13713BP2", "110259", "2026-10-27", "Gutter leak", "Acme", "On Hold", "Gutters"]]


def test_unassigned_vendor_is_blank_not_none():
    assert work_order_rows([_wo(vendor={"_id": None, "name": None})])[0][4] == ""
    assert work_order_rows([_wo(vendor=None)])[0][4] == ""


def test_work_orders_skip_common_area():
    rows = work_order_rows([_wo(), _wo(_id=2, workLocation="Common Area - Pond")])
    assert [r[1] for r in rows] == ["110259"]


def test_work_order_number_must_be_numeric():
    with pytest.raises(SchemaError):
        work_order_rows([_wo(_id="6553a1f0c0ffee")])


def test_missing_field_everywhere_is_schema_change():
    with pytest.raises(SchemaError):
        require_fields([{"a": 1}, {"a": 2}], ["a", "b"], "thing")
    require_fields([{"a": 1, "b": ""}, {"a": 2}], ["a", "b"], "thing")  # empty/partial is fine


def test_violation_and_arc_rows():
    unit = {"name": "3510 Broadlands Lane #101  Broomfield CO 80023"}
    v = violation_rows([{"unit": unit, "violationDate": "10/2/2026",
                         "violationDescription": "Trash cans", "violationStatus": "Open"}])
    assert v == [["3510BL1", "2026-10-02", "Trash cans", "Open"]]
    a = arch_review_rows([{"unit": unit, "postedDate": "9/30/2026", "requestType": "Paint", "status": "Approved"}])
    assert a == [["3510BL1", "2026-09-30", "Paint", "Approved"]]


def test_profiles_merge_one_row_per_unit():
    unit1 = "3510 Broadlands Lane #101  Broomfield CO 80023"
    docs = [
        {"name": unit1, "accountNumber": "A1", "owner": {"names": "Pat", "lastNames": "Doe", "email": "p@example.com", "phoneNumber": "555"}},
        {"name": unit1, "accountNumber": "A1", "owner": {"names": "Lee", "lastNames": "Doe", "email": "l@example.com", "phoneNumber": "555"}},
        {"name": unit1, "accountNumber": "A1", "owner": {"names": "Lee", "lastNames": "Doe", "email": "l@example.com", "phoneNumber": "555"}},
        {"name": "3510 Broadlands Lane #102  Broomfield CO 80023", "accountNumber": "A2", "owner": None},
    ]
    assert profile_rows(docs, today="2026-11-01") == [
        ["3510BL1", "A1", "Pat Doe & Lee Doe", "p@example.com; l@example.com", "555", "2026-11-01", "Keystone"],
        ["3510BL2", "A2", "", "", "", "2026-11-01", "Keystone"],
    ]
