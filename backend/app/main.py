"""Elephant Dashboard — FastAPI backend."""

import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .chart_data import router as chart_router
from .scanner import ConnectionManager, CryptoScanner, StockScanner
from .signals import router as signals_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("elephant.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    manager = ConnectionManager()
    stock_scanner = StockScanner(manager)
    crypto_scanner = CryptoScanner(manager)

    app.state.manager = manager
    app.state.stock_scanner = stock_scanner
    app.state.crypto_scanner = crypto_scanner

    scheduler = AsyncIOScheduler()
    # Stocks: every 5 minutes — scanner checks market hours internally
    scheduler.add_job(stock_scanner.scan, "cron", minute="*/5", id="stock_scan")
    # Crypto: every 1 minute, 24/7
    scheduler.add_job(crypto_scanner.scan, "cron", minute="*", id="crypto_scan")
    scheduler.start()
    logger.info("Scheduler started")

    yield

    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")


app = FastAPI(title="Elephant Dashboard API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chart_router)
app.include_router(signals_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Real-time price and signal push channel."""
    manager: ConnectionManager = websocket.app.state.manager
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive; client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
