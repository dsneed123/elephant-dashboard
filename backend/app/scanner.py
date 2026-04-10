"""Stock and crypto scanning engine with WebSocket push support."""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import WebSocket

from . import db as _db
from .watchlists import CRYPTO_WATCHLIST, STOCK_WATCHLIST

logger = logging.getLogger("elephant.scanner")

ET = ZoneInfo("America/New_York")
MARKET_OPEN_MINUTES = 9 * 60 + 30   # 9:30 AM ET
MARKET_CLOSE_MINUTES = 16 * 60      # 4:00 PM ET


# ---------------------------------------------------------------------------
# Technical indicator helpers (ported from lib/stock_scanner.py)
# ---------------------------------------------------------------------------

def compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def compute_macd(series: pd.Series) -> tuple[pd.Series, pd.Series, pd.Series]:
    ema12 = series.ewm(span=12, adjust=False).mean()
    ema26 = series.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    histogram = macd - signal
    return macd, signal, histogram


def compute_bollinger(series: pd.Series, period: int = 20) -> tuple[pd.Series, pd.Series, pd.Series]:
    sma = series.rolling(window=period).mean()
    std = series.rolling(window=period).std()
    upper = sma + (std * 2)
    lower = sma - (std * 2)
    return upper, sma, lower


def _get_quick_price(ticker: str) -> Optional[dict]:
    """Fetch only current price and change_pct for a ticker (no full analysis)."""
    try:
        t = yf.Ticker(ticker)
        df = t.history(period="2d", interval="1d")
        if df is None or len(df) < 2:
            return None
        close = df["Close"]
        price = float(close.iloc[-1])
        prev = float(close.iloc[-2])
        change_pct = (price - prev) / prev * 100
        return {"price": round(price, 4), "change_pct": round(change_pct, 2)}
    except Exception:
        return None


def analyze_ticker(ticker: str, interval: str = "1d", period: str = "3mo") -> Optional[dict]:
    """Analyze a ticker for swing trade setups. Returns a signal dict or None."""
    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period, interval=interval)
        if df is None or len(df) < 30:
            return None

        close = df["Close"]
        volume = df["Volume"]
        high = df["High"]
        low = df["Low"]

        current_price = close.iloc[-1]
        prev_price = close.iloc[-2]
        change_pct = round(float((current_price - prev_price) / prev_price * 100), 2)

        rsi = compute_rsi(close)
        rsi_now = rsi.iloc[-1]
        rsi_prev = rsi.iloc[-2]

        _, _, macd_hist = compute_macd(close)
        macd_now = macd_hist.iloc[-1]
        macd_prev = macd_hist.iloc[-2]

        bb_upper, _, bb_lower = compute_bollinger(close)

        sma20 = close.rolling(20).mean().iloc[-1]
        sma50 = close.rolling(50).mean().iloc[-1]
        ema9 = close.ewm(span=9, adjust=False).mean().iloc[-1]

        avg_vol = volume.rolling(20).mean().iloc[-1]
        vol_now = volume.iloc[-1]
        vol_ratio = vol_now / avg_vol if avg_vol > 0 else 1.0

        tr = pd.concat([
            high - low,
            (high - close.shift()).abs(),
            (low - close.shift()).abs(),
        ], axis=1).max(axis=1)
        atr = tr.rolling(14).mean().iloc[-1]
        atr_pct = (atr / current_price) * 100

        signals = []
        score = 0

        if rsi_now < 35 and rsi_now > rsi_prev:
            signals.append("RSI oversold bounce")
            score += 25

        if rsi_now > 70 and rsi_now < rsi_prev:
            signals.append("RSI overbought reversal")
            score -= 25

        if macd_prev < 0 and macd_now > 0:
            signals.append("MACD bullish crossover")
            score += 30

        if macd_prev > 0 and macd_now < 0:
            signals.append("MACD bearish crossover")
            score -= 30

        if close.iloc[-1] <= bb_lower.iloc[-1] * 1.01:
            signals.append("Bollinger Band support")
            score += 20

        if close.iloc[-1] >= bb_upper.iloc[-1] * 0.99:
            signals.append("Bollinger Band resistance")
            score -= 20

        sma20_prev = close.rolling(20).mean().iloc[-5]
        sma50_prev = close.rolling(50).mean().iloc[-5]
        if sma20_prev < sma50_prev and sma20 > sma50:
            signals.append("Golden cross (20/50)")
            score += 25

        if sma20_prev > sma50_prev and sma20 < sma50:
            signals.append("Death cross (20/50)")
            score -= 25

        if vol_ratio > 1.5:
            signals.append(f"Volume spike ({vol_ratio:.1f}x avg)")
            score += 10 if score > 0 else -10

        if current_price > ema9 > sma20 > sma50:
            signals.append("Strong uptrend (above all MAs)")
            score += 15

        if current_price < ema9 < sma20 < sma50:
            signals.append("Strong downtrend (below all MAs)")
            score -= 15

        if abs(score) < 25 or not signals:
            return None

        direction = "LONG" if score > 0 else "SHORT"
        strength = abs(score)

        if direction == "LONG":
            entry = current_price
            stop_loss = current_price - (atr * 1.5)
            target_1 = current_price + (atr * 2)
            target_2 = current_price + (atr * 3)
            risk = entry - stop_loss
            reward = target_1 - entry
        else:
            entry = current_price
            stop_loss = current_price + (atr * 1.5)
            target_1 = current_price - (atr * 2)
            target_2 = current_price - (atr * 3)
            risk = stop_loss - entry
            reward = entry - target_1

        rr_ratio = reward / risk if risk > 0 else 0

        avg_daily_move = atr
        days_to_target = int(abs(target_1 - entry) / avg_daily_move) if avg_daily_move > 0 else 5
        days_to_target = max(2, min(days_to_target, 15))

        if days_to_target <= 3:
            hold_duration = "2-3 days"
        elif days_to_target <= 5:
            hold_duration = "3-5 days"
        elif days_to_target <= 8:
            hold_duration = "5-8 days"
        else:
            hold_duration = "1-2 weeks"

        return {
            "ticker": ticker,
            "direction": direction,
            "strength": strength,
            "signals": signals,
            "entry": round(float(entry), 4),
            "stop_loss": round(float(stop_loss), 4),
            "target_1": round(float(target_1), 4),
            "target_2": round(float(target_2), 4),
            "rr_ratio": round(float(rr_ratio), 2),
            "hold_duration": hold_duration,
            "rsi": round(float(rsi_now), 1),
            "atr_pct": round(float(atr_pct), 2),
            "vol_ratio": round(float(vol_ratio), 1),
            "current_price": round(float(current_price), 4),
            "change_pct": change_pct,
        }

    except Exception as e:
        logger.warning("Failed to analyze %s: %s", ticker, e)
        return None


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        data = json.dumps(message, default=str)
        dead = []
        for ws in self.active_connections:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active_connections.remove(ws)


# ---------------------------------------------------------------------------
# Base scanner
# ---------------------------------------------------------------------------

class BaseScanner:
    SIGNAL_EXPIRY_HOURS: int = 120

    def __init__(self, manager: ConnectionManager):
        self.manager = manager
        self.active_signals: dict[str, dict] = {}
        self.history: list[dict] = []
        self._max_history = 500

    def _expire_old_signals(self):
        now = datetime.now(timezone.utc)
        expired = []
        for ticker, sig in self.active_signals.items():
            age_hours = (now - sig["timestamp"]).total_seconds() / 3600
            if age_hours > self.SIGNAL_EXPIRY_HOURS:
                sig["status"] = "expired"
                self.history.append({**sig, "timestamp": sig["timestamp"].isoformat()})
                expired.append(ticker)
                if sig.get("signal_id"):
                    try:
                        _db.update_signal(sig["signal_id"], "expired")
                    except Exception as exc:
                        logger.warning("DB update_signal (expired) failed: %s", exc)
        for t in expired:
            del self.active_signals[t]
        if len(self.history) > self._max_history:
            self.history = self.history[-self._max_history:]

    def _do_scan(
        self, watchlist: list[str], interval: str, period: str
    ) -> tuple[list[dict], dict[str, dict]]:
        """Run analysis on all tickers. Returns (signals, prices_by_ticker)."""
        results = []
        prices: dict[str, dict] = {}
        for ticker in watchlist:
            signal = analyze_ticker(ticker, interval, period)
            if signal:
                prices[ticker] = {
                    "price": signal["current_price"],
                    "change_pct": signal.get("change_pct", 0.0),
                }
                results.append(signal)
            time.sleep(0.2)
        results.sort(key=lambda x: x["strength"], reverse=True)
        return results, prices

    async def _process_results(self, results: list[dict], asset_type: str):
        self._expire_old_signals()
        now = datetime.now(timezone.utc)
        for signal in results:
            ticker = signal["ticker"]
            signal["timestamp"] = now
            signal["status"] = "active"
            signal["asset_type"] = asset_type
            is_new = ticker not in self.active_signals
            self.active_signals[ticker] = signal
            if is_new:
                try:
                    signal_id = _db.save_signal(signal)
                    signal["signal_id"] = signal_id
                    self.active_signals[ticker]["signal_id"] = signal_id
                except Exception as exc:
                    logger.warning("DB save_signal failed: %s", exc)
                await self.manager.broadcast({
                    "type": "signal",
                    "asset_type": asset_type,
                    "data": {**signal, "timestamp": now.isoformat()},
                })

    async def _post_scan_updates(self, scanned_prices: dict[str, dict]):
        """After each scan: broadcast live prices and check target/stop hits."""
        to_remove: list[str] = []

        for ticker, signal in list(self.active_signals.items()):
            # Use price from current scan if available; otherwise fetch fresh
            if ticker in scanned_prices:
                price_data = scanned_prices[ticker]
            else:
                price_data = await asyncio.to_thread(_get_quick_price, ticker)

            if not price_data:
                continue

            current_price = price_data["price"]
            change_pct = price_data.get("change_pct", 0.0)

            # Broadcast price update
            await self.manager.broadcast({
                "type": "price",
                "ticker": ticker,
                "price": current_price,
                "change_pct": change_pct,
            })

            # Check if target_1 or stop_loss has been hit
            direction = signal["direction"]
            hit_status: Optional[str] = None

            if direction == "LONG":
                if current_price >= signal["target_1"]:
                    hit_status = "won"
                elif current_price <= signal["stop_loss"]:
                    hit_status = "lost"
            else:  # SHORT
                if current_price <= signal["target_1"]:
                    hit_status = "won"
                elif current_price >= signal["stop_loss"]:
                    hit_status = "lost"

            if hit_status:
                signal["status"] = hit_status
                self.history.append({**signal, "timestamp": signal["timestamp"].isoformat()})
                to_remove.append(ticker)
                if signal.get("signal_id"):
                    try:
                        _db.update_signal(signal["signal_id"], hit_status, current_price)
                    except Exception as exc:
                        logger.warning("DB update_signal (%s) failed: %s", hit_status, exc)
                await self.manager.broadcast({
                    "type": "signal_update",
                    "ticker": ticker,
                    "status": hit_status,
                })
                logger.info("Signal %s closed: %s", ticker, hit_status)

        for t in to_remove:
            del self.active_signals[t]

        if len(self.history) > self._max_history:
            self.history = self.history[-self._max_history:]


# ---------------------------------------------------------------------------
# Stock scanner — every 5 min during NYSE market hours
# ---------------------------------------------------------------------------

class StockScanner(BaseScanner):
    SIGNAL_EXPIRY_HOURS = 14 * 24  # 14 days

    def is_market_open(self) -> bool:
        now = datetime.now(ET)
        if now.weekday() >= 5:
            return False
        minutes = now.hour * 60 + now.minute
        return MARKET_OPEN_MINUTES <= minutes < MARKET_CLOSE_MINUTES

    async def scan(self):
        if not self.is_market_open():
            return
        logger.info("StockScanner: scanning %d stocks", len(STOCK_WATCHLIST))
        results, prices = await asyncio.to_thread(self._do_scan, STOCK_WATCHLIST, "1d", "3mo")
        await self._process_results(results, "stock")
        await self._post_scan_updates(prices)
        logger.info("StockScanner: found %d signals", len(results))


# ---------------------------------------------------------------------------
# Crypto scanner — every 1 min, 24/7
# ---------------------------------------------------------------------------

class CryptoScanner(BaseScanner):
    SIGNAL_EXPIRY_HOURS = 24

    async def scan(self):
        logger.info("CryptoScanner: scanning %d cryptos", len(CRYPTO_WATCHLIST))
        results, prices = await asyncio.to_thread(self._do_scan, CRYPTO_WATCHLIST, "1h", "7d")
        await self._process_results(results, "crypto")
        await self._post_scan_updates(prices)
        logger.info("CryptoScanner: found %d signals", len(results))
