"""SQLite persistence for signal history and performance tracking.

Stores every signal from creation to resolution in backend/signals.db.
Override the path with SIGNALS_DB_PATH env var if needed.
"""

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("elephant.db")

_HERE = os.path.dirname(os.path.abspath(__file__))
_DB_PATH = os.path.normpath(os.path.join(_HERE, "..", "signals.db"))
SIGNALS_DB = os.environ.get("SIGNALS_DB_PATH", _DB_PATH)


def _open() -> sqlite3.Connection:
    con = sqlite3.connect(SIGNALS_DB)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    """Create tables and indexes if they don't exist."""
    con = _open()
    try:
        con.execute(
            """
            CREATE TABLE IF NOT EXISTS signal_history (
                signal_id    TEXT PRIMARY KEY,
                ticker       TEXT NOT NULL,
                direction    TEXT NOT NULL,
                entry_price  REAL NOT NULL,
                target_1     REAL NOT NULL,
                target_2     REAL NOT NULL,
                stop_loss    REAL NOT NULL,
                strength     INTEGER NOT NULL,
                asset_type   TEXT NOT NULL,
                signals_json TEXT NOT NULL,
                status       TEXT NOT NULL DEFAULT 'active',
                created_at   TEXT NOT NULL,
                resolved_at  TEXT,
                exit_price   REAL,
                pnl_pct      REAL
            )
            """
        )
        con.execute(
            "CREATE INDEX IF NOT EXISTS idx_sh_created ON signal_history(created_at)"
        )
        con.execute(
            "CREATE INDEX IF NOT EXISTS idx_sh_status ON signal_history(status)"
        )
        con.commit()
    finally:
        con.close()
    logger.info("Signal history DB initialized at %s", SIGNALS_DB)


def save_signal(sig: dict) -> str:
    """Persist a new active signal. Returns the generated signal_id."""
    signal_id = f"{sig['ticker']}_{sig['timestamp'].isoformat()}"
    con = _open()
    try:
        con.execute(
            """
            INSERT OR IGNORE INTO signal_history
                (signal_id, ticker, direction, entry_price, target_1, target_2,
                 stop_loss, strength, asset_type, signals_json, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
            """,
            (
                signal_id,
                sig["ticker"],
                sig["direction"],
                sig["entry"],
                sig["target_1"],
                sig["target_2"],
                sig["stop_loss"],
                sig["strength"],
                sig.get("asset_type", "stock"),
                json.dumps(sig.get("signals", [])),
                sig["timestamp"].isoformat(),
            ),
        )
        con.commit()
    except Exception as exc:
        logger.error("save_signal failed for %s: %s", sig.get("ticker"), exc)
    finally:
        con.close()
    return signal_id


def update_signal(
    signal_id: str,
    status: str,
    exit_price: Optional[float] = None,
) -> None:
    """Update a signal's status to won/lost/expired and compute P&L."""
    now = datetime.now(timezone.utc).isoformat()
    con = _open()
    try:
        pnl_pct: Optional[float] = None
        if exit_price is not None:
            row = con.execute(
                "SELECT entry_price, direction FROM signal_history WHERE signal_id = ?",
                (signal_id,),
            ).fetchone()
            if row and row["entry_price"] > 0:
                entry = row["entry_price"]
                if row["direction"] == "LONG":
                    pnl_pct = round((exit_price - entry) / entry * 100, 4)
                else:
                    pnl_pct = round((entry - exit_price) / entry * 100, 4)
        con.execute(
            """
            UPDATE signal_history
            SET status = ?, resolved_at = ?, exit_price = ?, pnl_pct = ?
            WHERE signal_id = ?
            """,
            (status, now, exit_price, pnl_pct, signal_id),
        )
        con.commit()
    except Exception as exc:
        logger.error("update_signal failed for %s: %s", signal_id, exc)
    finally:
        con.close()


def get_history(limit: int = 200, offset: int = 0) -> list[dict]:
    """Return signals sorted newest-first."""
    con = _open()
    try:
        rows = con.execute(
            """
            SELECT * FROM signal_history
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["signals"] = json.loads(d.pop("signals_json", "[]"))
            out.append(d)
        return out
    except Exception as exc:
        logger.error("get_history failed: %s", exc)
        return []
    finally:
        con.close()


def get_performance_stats() -> dict:
    """Aggregate performance statistics from signal history."""
    con = _open()
    try:
        # ---- Overall counts ----
        totals = con.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status='won'     THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN status='lost'    THEN 1 ELSE 0 END) AS losses,
                SUM(CASE WHEN status='expired' THEN 1 ELSE 0 END) AS expired
            FROM signal_history
            WHERE status IN ('won', 'lost', 'expired')
            """
        ).fetchone()

        # ---- Last 7 days ----
        d7 = con.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) AS wins
            FROM signal_history
            WHERE status IN ('won', 'lost', 'expired')
              AND resolved_at >= datetime('now', '-7 days')
            """
        ).fetchone()

        # ---- Last 30 days ----
        d30 = con.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) AS wins
            FROM signal_history
            WHERE status IN ('won', 'lost', 'expired')
              AND resolved_at >= datetime('now', '-30 days')
            """
        ).fetchone()

        # ---- Avg gain / loss, profit factor ----
        gain_row = con.execute(
            """
            SELECT AVG(pnl_pct) AS avg_gain, SUM(pnl_pct) AS total_gain
            FROM signal_history WHERE status = 'won'
            """
        ).fetchone()
        loss_row = con.execute(
            """
            SELECT AVG(ABS(pnl_pct)) AS avg_loss, SUM(ABS(pnl_pct)) AS total_loss
            FROM signal_history WHERE status = 'lost'
            """
        ).fetchone()

        # ---- Best / worst individual signals ----
        best = con.execute(
            """
            SELECT ticker, direction, pnl_pct, created_at, asset_type
            FROM signal_history WHERE status = 'won'
            ORDER BY pnl_pct DESC LIMIT 1
            """
        ).fetchone()
        worst = con.execute(
            """
            SELECT ticker, direction, pnl_pct, created_at, asset_type
            FROM signal_history WHERE status = 'lost'
            ORDER BY pnl_pct ASC LIMIT 1
            """
        ).fetchone()

        # ---- By asset category ----
        by_cat_rows = con.execute(
            """
            SELECT
                asset_type,
                COUNT(*) AS total,
                SUM(CASE WHEN status='won'  THEN 1 ELSE 0 END) AS wins,
                SUM(CASE WHEN status='lost' THEN 1 ELSE 0 END) AS losses
            FROM signal_history
            WHERE status IN ('won', 'lost', 'expired')
            GROUP BY asset_type
            """
        ).fetchall()

        # ---- Equity curve (cumulative P&L ordered by resolution time) ----
        eq_rows = con.execute(
            """
            SELECT resolved_at, pnl_pct
            FROM signal_history
            WHERE status IN ('won', 'lost')
              AND pnl_pct IS NOT NULL
              AND resolved_at IS NOT NULL
            ORDER BY resolved_at ASC
            """
        ).fetchall()
        cumulative = 0.0
        equity_curve = []
        for row in eq_rows:
            cumulative = round(cumulative + row["pnl_pct"], 4)
            equity_curve.append(
                {
                    "date": row["resolved_at"][:10],
                    "cumulative_pnl": cumulative,
                }
            )

        # ---- Calendar heatmap (daily total P&L) ----
        hm_rows = con.execute(
            """
            SELECT DATE(resolved_at) AS day, SUM(pnl_pct) AS daily_pnl
            FROM signal_history
            WHERE status IN ('won', 'lost')
              AND pnl_pct IS NOT NULL
              AND resolved_at IS NOT NULL
            GROUP BY day
            ORDER BY day ASC
            """
        ).fetchall()
        heatmap = [
            {"date": r["day"], "pnl": round(r["daily_pnl"], 2)} for r in hm_rows
        ]

        def _f(v):
            return round(float(v), 2) if v is not None else None

        total = totals["total"] or 0
        wins = totals["wins"] or 0
        losses_cnt = totals["losses"] or 0
        expired_cnt = totals["expired"] or 0
        d7_total = d7["total"] or 0
        d7_wins = d7["wins"] or 0
        d30_total = d30["total"] or 0
        d30_wins = d30["wins"] or 0
        total_gain = gain_row["total_gain"] or 0.0
        total_loss = loss_row["total_loss"] or 0.0

        return {
            "total": total,
            "wins": wins,
            "losses": losses_cnt,
            "expired": expired_cnt,
            "win_rate": round(wins / total * 100, 1) if total > 0 else None,
            "win_rate_7d": round(d7_wins / d7_total * 100, 1) if d7_total > 0 else None,
            "win_rate_30d": round(d30_wins / d30_total * 100, 1) if d30_total > 0 else None,
            "avg_gain_pct": _f(gain_row["avg_gain"]),
            "avg_loss_pct": _f(loss_row["avg_loss"]),
            "profit_factor": round(total_gain / total_loss, 2) if total_loss > 0 else None,
            "best": dict(best) if best else None,
            "worst": dict(worst) if worst else None,
            "by_category": [dict(r) for r in by_cat_rows],
            "equity_curve": equity_curve,
            "heatmap": heatmap,
        }

    except Exception as exc:
        logger.error("get_performance_stats failed: %s", exc)
        return {
            "total": 0,
            "wins": 0,
            "losses": 0,
            "expired": 0,
            "win_rate": None,
            "win_rate_7d": None,
            "win_rate_30d": None,
            "avg_gain_pct": None,
            "avg_loss_pct": None,
            "profit_factor": None,
            "best": None,
            "worst": None,
            "by_category": [],
            "equity_curve": [],
            "heatmap": [],
        }
    finally:
        con.close()
