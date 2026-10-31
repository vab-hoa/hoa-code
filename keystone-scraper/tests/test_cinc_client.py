import pytest

import cinc_client
from cinc_client import CincAuthError, CincClient, CincError


class FakeResp:
    def __init__(self, status, body, ctype="application/json"):
        self.status_code = status
        self._body = body
        self.headers = {"content-type": ctype}

    def json(self):
        return self._body


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(cinc_client, "MIN_REQUEST_INTERVAL", 0)
    return CincClient("user@example.com", "pw")


@pytest.mark.parametrize("method, path", [
    ("POST", "/api/v1/bod/invoice-approval/approveInvoice/1"),
    ("PUT", "/api/v2/user/1"),
    ("DELETE", "/api/v2/user/1"),
    ("GET", "https://evil.example.com/x"),
])
def test_read_only_guard(client, method, path):
    with pytest.raises(CincError):
        client._request(method, path)


def test_login_rejected_is_not_retried(client, monkeypatch):
    calls = []

    def fake_request(method, path, **kw):
        calls.append(path)
        return FakeResp(401, {"code": 401, "msg": "Invalid credentials"})
    monkeypatch.setattr(client, "_request", fake_request)
    with pytest.raises(CincAuthError):
        client.login()
    assert calls == [cinc_client.LOGIN_PATH]


def _pages(monkeypatch, client, pages):
    seen = []

    def fake_get(path, params=None):
        seen.append(params["page"])
        return pages[params["page"] - 1]
    monkeypatch.setattr(client, "get", fake_get)
    return seen


def test_get_all_paginates(client, monkeypatch):
    pages = [{"data": {"docs": [1, 2], "totalDocs": 3, "totalPages": 2}},
             {"data": {"docs": [3], "totalDocs": 3, "totalPages": 2}}]
    seen = _pages(monkeypatch, client, pages)
    assert client.get_all("/x") == [1, 2, 3]
    assert seen == [1, 2]


def test_get_all_short_fetch_raises(client, monkeypatch):
    _pages(monkeypatch, client, [{"data": {"docs": [1], "totalDocs": 5, "totalPages": 1}}])
    with pytest.raises(CincError, match="Short fetch"):
        client.get_all("/x")


def test_get_all_bad_shape_raises(client, monkeypatch):
    _pages(monkeypatch, client, [{"data": [1, 2]}])
    with pytest.raises(CincError, match="Unexpected response shape"):
        client.get_all("/x")


def test_token_expiry_minutes_reads_exp():
    import base64, json, time
    payload = base64.urlsafe_b64encode(json.dumps({"exp": time.time() + 600}).encode()).decode().rstrip("=")
    assert cinc_client.token_expiry_minutes(f"JWT x.{payload}.y") in (9, 10)
    assert cinc_client.token_expiry_minutes("garbage") is None
