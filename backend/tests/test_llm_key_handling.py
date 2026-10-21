import io
import json
import urllib.error

import pytest

import server

SECRET = "test-secret-key-not-real-123"


class _FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def test_gemini_key_is_sent_in_header_not_url(monkeypatch):
    captured = {}

    def fake_urlopen(req, timeout):
        captured["req"] = req
        body = {"candidates": [{"content": {"parts": [{"text": "summary"}]}}]}
        return _FakeResponse(json.dumps(body).encode("utf-8"))

    monkeypatch.setattr(server, "GEMINI_API_KEY", SECRET)
    monkeypatch.setattr(server.urllib.request, "urlopen", fake_urlopen)

    assert server.call_gemini("system", "user") == "summary"
    req = captured["req"]
    assert SECRET not in req.full_url
    assert req.get_header("X-goog-api-key") == SECRET


@pytest.mark.parametrize(
    "error",
    [
        urllib.error.URLError("connection refused"),
        urllib.error.HTTPError("https://example.invalid", 400, "Bad Request", {}, io.BytesIO(b"{}")),
    ],
)
def test_gemini_errors_never_print_or_return_the_key(monkeypatch, capsys, error):
    def fake_urlopen(req, timeout):
        raise error

    monkeypatch.setattr(server, "GEMINI_API_KEY", SECRET)
    monkeypatch.setattr(server.urllib.request, "urlopen", fake_urlopen)

    with pytest.raises(server.LLMError) as raised:
        server.call_gemini("system", "user")

    printed = capsys.readouterr()
    assert SECRET not in printed.out + printed.err
    assert SECRET not in str(raised.value)
    assert SECRET not in json.dumps(raised.value.diagnostics)
