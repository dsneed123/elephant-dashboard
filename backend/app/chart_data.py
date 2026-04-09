"""OHLCV candlestick data endpoints."""

import logging

import yfinance as yf
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger("elephant.chart_data")

router = APIRouter()

# Allowed intervals and periods to prevent abuse
VALID_INTERVALS = {"1m", "2m", "5m", "15m", "30m", "60m", "1h", "1d", "1wk", "1mo"}
VALID_PERIODS = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "ytd", "max"}


@router.get("/api/chart/{ticker}")
async def get_chart_data(
    ticker: str,
    interval: str = Query(default="5m", description="Candle interval (e.g. 5m, 1h, 1d)"),
    period: str = Query(default="1d", description="Lookback period (e.g. 1d, 3mo)"),
):
    """Return OHLCV candlestick data for a ticker.

    Examples:
        GET /api/chart/AAPL?interval=5m&period=1d   — intraday
        GET /api/chart/BTC-USD?interval=1d&period=3mo — daily
    """
    if interval not in VALID_INTERVALS:
        raise HTTPException(status_code=400, detail=f"Invalid interval. Choose from: {sorted(VALID_INTERVALS)}")
    if period not in VALID_PERIODS:
        raise HTTPException(status_code=400, detail=f"Invalid period. Choose from: {sorted(VALID_PERIODS)}")

    try:
        t = yf.Ticker(ticker.upper())
        df = t.history(period=period, interval=interval)
    except Exception as e:
        logger.warning("yfinance error for %s: %s", ticker, e)
        raise HTTPException(status_code=502, detail="Failed to fetch market data")

    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for {ticker}")

    candles = []
    for ts, row in df.iterrows():
        # Lightweight Charts expects Unix timestamp (seconds)
        try:
            unix_ts = int(ts.timestamp())
        except Exception:
            continue
        candles.append({
            "time": unix_ts,
            "open": round(float(row["Open"]), 4),
            "high": round(float(row["High"]), 4),
            "low": round(float(row["Low"]), 4),
            "close": round(float(row["Close"]), 4),
            "volume": int(row["Volume"]),
        })

    return candles
