"""
QIM TradingView Bridge — FastAPI Proxy
Meneruskan endpoint REST & WebSocket ke Node.js TradingView Engine (Port 3001)

Endpoints:
  GET /candles?symbol=BTCUSDT&exchange=BINANCE&tf=5m&limit=500
  GET /search?q=gold&exchange=OANDA
  GET /health
  WS  /ws?symbol=BTCUSDT&exchange=BINANCE&tf=5m
"""

import asyncio
import os
import time
from contextlib import asynccontextmanager
from typing import Optional

import httpx
import uvicorn
import websockets
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketState

NODE_BRIDGE_URL = os.getenv("NODE_BRIDGE_URL", "http://localhost:3001")
NODE_BRIDGE_WS  = os.getenv("NODE_BRIDGE_WS",  "ws://localhost:3001")
FASTAPI_PORT    = int(os.getenv("FASTAPI_PORT", "8001"))

http_client: Optional[httpx.AsyncClient] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    http_client = httpx.AsyncClient(base_url=NODE_BRIDGE_URL, timeout=35.0)
    print(f"[FastAPI Proxy] Forwarding ke {NODE_BRIDGE_URL}")
    yield
    await http_client.aclose()

app = FastAPI(
    title="QIM TradingView Bridge (FastAPI)",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

async def proxy_get(path: str, params: dict = None):
    try:
        resp = await http_client.get(path, params=params)
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Node.js Engine belum berjalan di port 3001. Jalankan: cd tv-bridge && npm start"
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)

@app.get("/health")
async def health():
    try:
        node_health = await proxy_get("/health")
        return {"status": "ok", "proxy": "fastapi", "engine": node_health}
    except Exception:
        return {"status": "degraded", "proxy": "fastapi", "engine": "offline"}

@app.get("/candles")
async def candles(
    symbol: str = Query("BTCUSDT"),
    exchange: str = Query("BINANCE"),
    tf: str = Query("5m"),
    limit: int = Query(300, ge=10, le=1000)
):
    return await proxy_get("/candles", {
        "symbol": symbol,
        "exchange": exchange,
        "tf": tf,
        "limit": limit
    })

@app.get("/search")
async def search(
    q: str = Query(..., description="Query simbol"),
    exchange: str = Query("", description="Filter exchange")
):
    return await proxy_get("/search", {"q": q, "exchange": exchange})

@app.websocket("/ws")
async def ws_candles(
    websocket: WebSocket,
    symbol: str = Query("BTCUSDT"),
    exchange: str = Query("BINANCE"),
    tf: str = Query("5m")
):
    await websocket.accept()
    node_ws_url = f"{NODE_BRIDGE_WS}/ws?symbol={symbol}&exchange={exchange}&tf={tf}"

    try:
        async with websockets.connect(node_ws_url, ping_interval=20) as node_ws:
            async def client_to_node():
                try:
                    while True:
                        msg = await websocket.receive_text()
                        await node_ws.send(msg)
                except Exception:
                    pass

            async def node_to_client():
                try:
                    async for msg in node_ws:
                        if websocket.client_state == WebSocketState.CONNECTED:
                            await websocket.send_text(msg if isinstance(msg, str) else msg.decode())
                        else:
                            break
                except Exception:
                    pass

            await asyncio.gather(client_to_node(), node_to_client(), return_exceptions=True)
    except Exception as e:
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json({"type": "error", "message": str(e)})
            await websocket.close()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=FASTAPI_PORT, reload=False)
