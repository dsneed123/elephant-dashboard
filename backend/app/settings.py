"""Settings storage, management, and Discord integration for Elephant Dashboard."""

import json
import logging
import os
from pathlib import Path

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel

from .watchlists import CRYPTO_WATCHLIST, STOCK_WATCHLIST

logger = logging.getLogger("elephant.settings")

_DEFAULT_SETTINGS_PATH = Path(__file__).parent.parent / "settings.json"
SETTINGS_FILE = Path(os.environ.get("ELEPHANT_SETTINGS_PATH", str(_DEFAULT_SETTINGS_PATH)))

DEFAULT_SETTINGS: dict = {
    "stock_scan_interval": "5m",
    "crypto_scan_interval": "1m",
    "min_signal_strength": 25,
    "sound_alerts_enabled": True,
    "discord_webhook_enabled": False,
    "discord_webhook_url": "",
    "stock_watchlist": list(STOCK_WATCHLIST),
    "crypto_watchlist": list(CRYPTO_WATCHLIST),
}

_settings: dict = {}

_INTERVAL_TO_CRON: dict[str, str] = {
    "1m": "*",
    "5m": "*/5",
    "15m": "*/15",
    "30m": "*/30",
}


def load_settings() -> dict:
    """Load settings from file, merging with defaults for any missing keys."""
    global _settings
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE) as f:
                stored = json.load(f)
            _settings = {**DEFAULT_SETTINGS, **stored}
        except Exception as exc:
            logger.warning("Failed to load settings: %s — using defaults", exc)
            _settings = dict(DEFAULT_SETTINGS)
    else:
        _settings = dict(DEFAULT_SETTINGS)
    return _settings


def save_settings(new_settings: dict) -> None:
    """Persist settings dict to disk and update in-memory state."""
    global _settings
    _settings = new_settings
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(new_settings, f, indent=2)


def get_settings() -> dict:
    """Return current in-memory settings (loaded once at startup)."""
    return _settings


# ---------------------------------------------------------------------------
# API router
# ---------------------------------------------------------------------------

class SettingsUpdate(BaseModel):
    stock_scan_interval: str = "5m"
    crypto_scan_interval: str = "1m"
    min_signal_strength: int = 25
    sound_alerts_enabled: bool = True
    discord_webhook_enabled: bool = False
    discord_webhook_url: str = ""
    stock_watchlist: list[str] = []
    crypto_watchlist: list[str] = []


router = APIRouter()


@router.get("/api/settings")
async def get_settings_endpoint() -> dict:
    return get_settings()


@router.put("/api/settings")
async def update_settings_endpoint(body: SettingsUpdate, request: Request) -> dict:
    data = body.model_dump()
    save_settings(data)
    # Reschedule scanner jobs when intervals change
    try:
        scheduler = request.app.state.scheduler
        scheduler.reschedule_job(
            "stock_scan",
            trigger="cron",
            minute=_INTERVAL_TO_CRON.get(data["stock_scan_interval"], "*/5"),
        )
        scheduler.reschedule_job(
            "crypto_scan",
            trigger="cron",
            minute=_INTERVAL_TO_CRON.get(data["crypto_scan_interval"], "*"),
        )
        logger.info(
            "Rescheduled: stocks=%s crypto=%s",
            data["stock_scan_interval"],
            data["crypto_scan_interval"],
        )
    except Exception as exc:
        logger.warning("Failed to reschedule jobs: %s", exc)
    return data


# ---------------------------------------------------------------------------
# Discord integration
# ---------------------------------------------------------------------------

async def post_signal_to_discord(signal: dict, webhook_url: str) -> None:
    """Post a new trading signal as a Discord embed to the given webhook URL."""
    direction = signal.get("direction", "?")
    ticker = signal.get("ticker", "?")
    strength = signal.get("strength", 0)
    entry = signal.get("entry", 0)
    target_1 = signal.get("target_1", 0)
    stop_loss = signal.get("stop_loss", 0)
    rr_ratio = signal.get("rr_ratio", 0)
    signals_list = signal.get("signals", [])
    asset_type = signal.get("asset_type", "?")

    color = 0x00B09B if direction == "LONG" else 0xE74C3C
    emoji = "📈" if direction == "LONG" else "📉"

    embed = {
        "title": f"{emoji} {direction}: {ticker}",
        "color": color,
        "fields": [
            {"name": "Type", "value": asset_type.upper(), "inline": True},
            {"name": "Strength", "value": str(strength), "inline": True},
            {"name": "Entry", "value": f"${entry:.4f}", "inline": True},
            {"name": "Target", "value": f"${target_1:.4f}", "inline": True},
            {"name": "Stop Loss", "value": f"${stop_loss:.4f}", "inline": True},
            {"name": "R/R", "value": f"{rr_ratio:.2f}", "inline": True},
            {
                "name": "Signals",
                "value": "\n".join(signals_list) if signals_list else "—",
                "inline": False,
            },
        ],
        "footer": {"text": "Elephant Dashboard"},
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(webhook_url, json={"embeds": [embed]})
            if resp.status_code not in (200, 204):
                logger.warning("Discord webhook returned HTTP %s", resp.status_code)
    except Exception as exc:
        logger.warning("Discord webhook error: %s", exc)
