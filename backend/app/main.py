"""Elephant Dashboard — FastAPI backend."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .chart_data import router as chart_router
from .db import init_db
from .scanner import ConnectionManager, CryptoScanner, StockScanner
from .settings import _INTERVAL_TO_CRON, load_settings, router as settings_router
from .signals import router as signals_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("elephant.main")

# When built frontend is present, serve it as static files
STATIC_DIR = Path(os.environ.get("ELEPHANT_STATIC_DIR", "frontend/dist"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    settings = load_settings()

    manager = ConnectionManager()
    stock_scanner = StockScanner(manager)
    crypto_scanner = CryptoScanner(manager)

    app.state.manager = manager
    app.state.stock_scanner = stock_scanner
    app.state.crypto_scanner = crypto_scanner

    stock_cron = _INTERVAL_TO_CRON.get(settings["stock_scan_interval"], "*/5")
    crypto_cron = _INTERVAL_TO_CRON.get(settings["crypto_scan_interval"], "*")

    scheduler = AsyncIOScheduler()
    scheduler.add_job(stock_scanner.scan, "cron", minute=stock_cron, id="stock_scan")
    scheduler.add_job(crypto_scanner.scan, "cron", minute=crypto_cron, id="crypto_scan")
    scheduler.start()
    app.state.scheduler = scheduler
    logger.info(
        "Scheduler started — stocks=%s, crypto=%s",
        settings["stock_scan_interval"],
        settings["crypto_scan_interval"],
    )

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
app.include_router(settings_router)


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


# Serve the production frontend build (only when dist/ exists)
if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
