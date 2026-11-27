"""Optional Telegram group alerts for UMAppoint administrators.

Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the backend environment.
This sends minimal operational alerts to one private staff group; in-app
notifications remain the primary, user-specific notification channel.
"""
import json
import logging
import os
from urllib.error import URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


def send_telegram_alert(message: str) -> bool:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        return False

    payload = json.dumps({
        "chat_id": chat_id,
        "text": message[:3500],
        "disable_web_page_preview": True,
    }).encode("utf-8")
    request = Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=3) as response:
            result = json.loads(response.read().decode("utf-8"))
            return bool(result.get("ok"))
    except (URLError, TimeoutError, ValueError, OSError) as exc:
        logger.warning("Telegram notification delivery failed: %s", exc)
        return False
