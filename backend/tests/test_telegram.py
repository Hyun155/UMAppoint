import json
from urllib.error import URLError

from app import telegram


def test_telegram_disabled_without_credentials(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)
    assert telegram.send_telegram_alert("test") is False


def test_telegram_sends_minimal_message(monkeypatch):
    captured = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return b'{"ok": true}'

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["payload"] = json.loads(request.data.decode("utf-8"))
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "-100123")
    monkeypatch.setattr(telegram, "urlopen", fake_urlopen)

    assert telegram.send_telegram_alert("New appointment request") is True
    assert captured["payload"]["chat_id"] == "-100123"
    assert captured["payload"]["text"] == "New appointment request"
    assert captured["timeout"] == 3


def test_telegram_failure_does_not_raise(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "-100123")

    def failed_urlopen(*args, **kwargs):
        raise URLError("offline")

    monkeypatch.setattr(telegram, "urlopen", failed_urlopen)
    assert telegram.send_telegram_alert("New request") is False
