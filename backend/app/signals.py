"""Signal query endpoints."""

import logging
import os
import sqlite3

from fastapi import APIRouter, Request

logger = logging.getLogger("elephant.signals")
router = APIRouter()

# Path to the elephant SQLite DB (set via ELEPHANT_DB_PATH env var)
_ELEPHANT_DB_PATH: str = os.getenv("ELEPHANT_DB_PATH", "")


def _query_kalshi_signals() -> list[dict]:
    """Read active trade signals from the elephant SQLite DB."""
    if not _ELEPHANT_DB_PATH or not os.path.exists(_ELEPHANT_DB_PATH):
        return []
    try:
        conn = sqlite3.connect(_ELEPHANT_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(
            """
            SELECT ts.id, ts.market_ticker, ts.market_title, ts.side, ts.action,
                   ts.detected_price, ts.confidence, ts.status, ts.created_at,
                   tt.display_name AS trader_name, tt.elephant_score
            FROM trade_signals ts
            JOIN tracked_traders tt ON ts.trader_id = tt.id
            WHERE ts.status IN ('pending', 'copied')
            ORDER BY ts.created_at DESC
            LIMIT 50
            """
        )
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
    except Exception as exc:
        logger.warning("Failed to query Kalshi signals from elephant DB: %s", exc)
        return []

    results = []
    for row in rows:
        results.append({
            "id": row["id"],
            "ticker": row["market_ticker"],
            "market_title": row.get("market_title") or "",
            "direction": (row.get("side") or "yes").upper(),
            "action": row.get("action") or "buy",
            "entry": row.get("detected_price"),
            "stop_loss": None,
            "target_1": None,
            "target_2": None,
            "strength": round((row.get("confidence") or 0.0) * 100),
            "signals": [f"Tracked trader: {row.get('trader_name') or 'unknown'}"],
            "timestamp": row.get("created_at"),
            "status": "active",
            "asset_type": "kalshi",
            "trader_name": row.get("trader_name"),
            "trader_score": row.get("elephant_score"),
        })
    return results


def _serialize_signal(sig: dict) -> dict:
    """Convert a signal dict to JSON-safe form."""
    out = dict(sig)
    ts = out.get("timestamp")
    if ts is not None and not isinstance(ts, str):
        out["timestamp"] = ts.isoformat()
    return out


@router.get("/api/signals/stocks")
async def get_stock_signals(request: Request):
    """Active stock swing-trade signals."""
    scanner = request.app.state.stock_scanner
    return [_serialize_signal(s) for s in scanner.active_signals.values()]


@router.get("/api/signals/crypto")
async def get_crypto_signals(request: Request):
    """Active crypto signals."""
    scanner = request.app.state.crypto_scanner
    return [_serialize_signal(s) for s in scanner.active_signals.values()]


@router.get("/api/signals/kalshi")
async def get_kalshi_signals(request: Request):
    """Active Kalshi event-contract signals (from elephant DB).

    Set the ELEPHANT_DB_PATH environment variable to the path of elephant.db.
    """
    return _query_kalshi_signals()


@router.get("/api/signals/history")
async def get_signal_history(request: Request):
    """Past signals with win/loss/expired status."""
    stock_history = request.app.state.stock_scanner.history
    crypto_history = request.app.state.crypto_scanner.history
    combined = stock_history + crypto_history
    combined.sort(key=lambda s: s.get("timestamp", ""), reverse=True)
    return combined
