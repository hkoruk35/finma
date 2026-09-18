"""
FastAPI app for the SPY signal engine.

GET  /health            -> liveness check
GET  /history?limit=50  -> recent rows from Supabase (spy_signals)
WS   /ws                -> broadcasts every new scheduler result as JSON

Started via: uvicorn spy_signal_engine.app:app --host 127.0.0.1 --port 8787
On startup the scheduler is launched as an asyncio background task inside
this same process (not a separate process) — one uvicorn worker does both
scheduling and serving. Binds only to 127.0.0.1; nginx reverse-proxies from
the public path (see nginx_snippet.conf) — this process is never exposed
directly.
"""
from __future__ import annotations

import asyncio
import hmac
import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from spy_signal_engine import db
from spy_signal_engine.scheduler import SpySignalScheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("spy_signal_engine.app")

SPY_ENGINE_SECRET = os.getenv("SPY_ENGINE_SECRET", "")


def _token_ok(candidate: str | None) -> bool:
    # No secret configured -> fail closed, never treat as "open access".
    if not SPY_ENGINE_SECRET or not candidate:
        return False
    return hmac.compare_digest(candidate, SPY_ENGINE_SECRET)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)

    async def broadcast(self, message: dict) -> None:
        if not self._connections:
            return
        data = json.dumps(message)
        dead: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.discard(ws)


manager = ConnectionManager()
scheduler = SpySignalScheduler(broadcast_fn=manager.broadcast)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await scheduler.start()
    try:
        yield
    finally:
        scheduler.stop()


app = FastAPI(title="SPY Signal Engine", lifespan=lifespan)

# /history is only ever called from the Next.js server (localhost, not
# nginx-exposed) and /ws is gated by SPY_ENGINE_SECRET, so this process
# never trusts a browser Origin directly — CORS stays permissive since it
# isn't the access-control boundary here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/history")
async def history(limit: int = 50, x_spy_engine_secret: str | None = Header(default=None)):
    if not _token_ok(x_spy_engine_secret):
        raise HTTPException(status_code=401, detail="unauthorized")
    limit = max(1, min(limit, 200))
    try:
        rows = await asyncio.to_thread(db.fetch_recent, limit)
    except Exception as exc:
        logger.exception("history read basarisiz")
        return {"error": str(exc), "rows": []}
    return {"rows": rows}


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, token: str | None = None):
    if not _token_ok(token):
        # Reject before accept() so no connection is ever established.
        await websocket.close(code=4401)
        return
    await manager.connect(websocket)
    try:
        while True:
            # We don't expect client messages; just keep the connection
            # open and drain anything the client sends (e.g. pings).
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
