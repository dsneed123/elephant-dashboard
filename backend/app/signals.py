"""Signal query endpoints."""

from fastapi import APIRouter, Request

router = APIRouter()


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

    TODO: wire up to the elephant SQLite DB when the schema is finalized.
    """
    return []


@router.get("/api/signals/history")
async def get_signal_history(request: Request):
    """Past signals with win/loss/expired status."""
    stock_history = request.app.state.stock_scanner.history
    crypto_history = request.app.state.crypto_scanner.history
    combined = stock_history + crypto_history
    combined.sort(key=lambda s: s.get("timestamp", ""), reverse=True)
    return combined
