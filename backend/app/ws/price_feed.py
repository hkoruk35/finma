"""WebSocket price feed for real-time market data"""

import asyncio
import json
import logging
from typing import Set
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and price subscriptions"""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.subscriptions: dict[WebSocket, Set[str]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        self.subscriptions[websocket] = set()
        logger.info(f"WS bağlantısı: {len(self.active_connections)} aktif")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        self.subscriptions.pop(websocket, None)
        logger.info(f"WS bağlantı koptu: {len(self.active_connections)} aktif")

    async def subscribe(self, websocket: WebSocket, tickers: list[str]):
        """Subscribe to price updates for given tickers"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].update(t.upper() for t in tickers)

    async def unsubscribe(self, websocket: WebSocket, tickers: list[str]):
        """Unsubscribe from price updates"""
        if websocket in self.subscriptions:
            for t in tickers:
                self.subscriptions[websocket].discard(t.upper())

    async def broadcast_price(self, ticker: str, price_data: dict):
        """Send price update to all subscribers of this ticker"""
        disconnected = set()
        for ws, subs in self.subscriptions.items():
            if ticker.upper() in subs:
                try:
                    await ws.send_json({"type": "price", "data": price_data})
                except Exception:
                    disconnected.add(ws)

        for ws in disconnected:
            self.disconnect(ws)


manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for price feed"""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                action = msg.get("action")

                if action == "subscribe":
                    tickers = msg.get("tickers", [])
                    await manager.subscribe(websocket, tickers)
                    await websocket.send_json({
                        "type": "subscribed",
                        "tickers": tickers,
                    })
                elif action == "unsubscribe":
                    tickers = msg.get("tickers", [])
                    await manager.unsubscribe(websocket, tickers)

            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Geçersiz JSON"})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
