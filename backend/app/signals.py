"""Signal query endpoints."""

import logging
import os
import sqlite3
from datetime import datetime, timedelta

from fastapi import APIRouter, Query, Request

from . import db as _db

router = APIRouter()
logger = logging.getLogger("elephant.signals")

# Path to the Elephant SQLite DB (sibling repo).
# Override with ELEPHANT_DB_PATH env var if needed.
_HERE = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_DB = os.path.normpath(
    os.path.join(_HERE, "..", "..", "..", "elephant", "backend", "elephant.db")
)
ELEPHANT_DB = os.environ.get("ELEPHANT_DB_PATH", _DEFAULT_DB)


def _serialize_signal(sig: dict) -> dict:
    """Convert a signal dict to JSON-safe form."""
    out = dict(sig)
    ts = out.get("timestamp")
    if ts is not None and not isinstance(ts, str):
        out["timestamp"] = ts.isoformat()
    return out


def _open_elephant_db() -> sqlite3.Connection | None:
    """Return a row-factory connection to the Elephant DB, or None if unavailable."""
    if not os.path.exists(ELEPHANT_DB):
        logger.warning("Elephant DB not found at %s", ELEPHANT_DB)
        return None
    con = sqlite3.connect(ELEPHANT_DB)
    con.row_factory = sqlite3.Row
    return con


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
async def get_kalshi_signals():
    """Active Kalshi event-contract signals from the Elephant whale-detection DB.

    Returns trade_signals joined with tracked_traders for the past 7 days,
    sorted by creation time (newest first).
    """
    con = _open_elephant_db()
    if con is None:
        return []
    try:
        since = (datetime.utcnow() - timedelta(days=7)).isoformat()
        cur = con.cursor()
        cur.execute(
            """
            SELECT
                ts.id,
                ts.market_ticker,
                ts.market_title,
                ts.side,
                ts.action,
                ts.detected_price,
                ts.detected_volume,
                ts.confidence,
                ts.status,
                ts.created_at,
                tt.kalshi_username,
                tt.display_name,
                tt.elephant_score,
                tt.total_profit,
                tt.win_rate,
                tt.tier
            FROM trade_signals ts
            JOIN tracked_traders tt ON ts.trader_id = tt.id
            WHERE ts.created_at >= ?
            ORDER BY ts.created_at DESC
            LIMIT 100
            """,
            (since,),
        )
        return [dict(r) for r in cur.fetchall()]
    except Exception as exc:
        logger.error("Failed to query Kalshi signals: %s", exc)
        return []
    finally:
        con.close()


@router.get("/api/signals/kalshi/whales")
async def get_kalshi_whales():
    """Top tracked whale traders ranked by elephant_score."""
    con = _open_elephant_db()
    if con is None:
        return []
    try:
        cur = con.cursor()
        cur.execute(
            """
            SELECT
                kalshi_username,
                display_name,
                elephant_score,
                total_profit,
                win_rate,
                total_trades,
                tier,
                is_active,
                last_seen
            FROM tracked_traders
            WHERE is_enabled = 1
            ORDER BY elephant_score DESC
            LIMIT 50
            """
        )
        return [dict(r) for r in cur.fetchall()]
    except Exception as exc:
        logger.error("Failed to query Kalshi whales: %s", exc)
        return []
    finally:
        con.close()


@router.get("/api/signals/history")
async def get_signal_history(
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    """Past signals from SQLite DB, newest first."""
    return _db.get_history(limit=limit, offset=offset)


@router.get("/api/signals/performance")
async def get_performance():
    """Aggregated performance statistics (win rates, P&L, equity curve, heatmap)."""
    return _db.get_performance_stats()
