"""FastAPI application: MT5 poller thread, WebSocket tick stream, REST candles."""
from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from .auth import AuthError, Principal, verify_token
from .config import Settings
from .hub import Client, Hub
from .source import MockSource, MT5Source, PriceSource, SourceError, UnknownSymbol, resolve_timeframe

log = logging.getLogger("bridge.app")

CLOSE_UNAUTHORIZED = 4401
CLOSE_FORBIDDEN = 4403
CLOSE_AUTH_TIMEOUT = 4408
CLOSE_OVERLOADED = 1013
CANDLE_CACHE_TTL_S = 2.0
CANDLE_CACHE_MAX = 256


class Poller:
    """Polls the source every POLL_MS on a dedicated thread and reconnects with backoff."""

    def __init__(self, source: PriceSource, hub: Hub, loop: asyncio.AbstractEventLoop, poll_ms: int) -> None:
        self.source, self.hub, self.loop = source, hub, loop
        self.interval = poll_ms / 1000
        self.connected = False
        self.last_error: str | None = None
        self.last_tick_at: float | None = None
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="mt5-poller", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=5)

    def _run(self) -> None:
        backoff = 1.0
        while not self._stop.is_set():
            if not self.connected:
                try:
                    self.source.connect()
                    self.connected, self.last_error, backoff = True, None, 1.0
                except Exception as exc:
                    self.last_error = str(exc)
                    log.error("connect failed (retry in %.0fs): %s", backoff, exc)
                    self._stop.wait(backoff)
                    backoff = min(backoff * 2, 30.0)
                    continue
            started = time.monotonic()
            try:
                ticks = self.source.poll()
            except SourceError as exc:
                log.error("poll failed, reconnecting: %s", exc)
                self.connected, self.last_error = False, str(exc)
                continue
            except Exception:
                log.exception("unexpected poll error")
                ticks = []
            if ticks:
                self.last_tick_at = time.time()
                self.loop.call_soon_threadsafe(self.hub.publish, ticks)
            self._stop.wait(max(0.0, self.interval - (time.monotonic() - started)))


def create_app(settings: Settings, source: PriceSource | None = None) -> FastAPI:
    source = source or (MockSource(settings) if settings.mock else MT5Source(settings))
    hub = Hub(settings.throttle_ms)
    candle_cache: dict[tuple[str, str, int], tuple[float, list[dict[str, float]]]] = {}

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        poller = Poller(source, hub, asyncio.get_running_loop(), settings.poll_ms)
        app.state.poller = poller
        poller.start()
        flusher = asyncio.create_task(hub.run())
        try:
            yield
        finally:
            flusher.cancel()
            poller.stop()
            await run_in_threadpool(source.shutdown)

    app = FastAPI(title="QIM MT5 Bridge", version="1.0.0", lifespan=lifespan,
                  docs_url="/docs" if settings.is_dev else None, redoc_url=None, openapi_url="/openapi.json" if settings.is_dev else None)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins),
                       allow_methods=["GET"], allow_headers=["Authorization"], max_age=600)

    def principal_from_header(request: Request) -> Principal:
        header = request.headers.get("authorization", "")
        scheme, _, token = header.partition(" ")
        if scheme.lower() != "bearer":
            raise HTTPException(401, "Bearer token required")
        try:
            return verify_token(token.strip(), settings.jwt_secret)
        except AuthError as exc:
            raise HTTPException(401, str(exc)) from exc

    @app.get("/health")
    async def health() -> dict[str, Any]:
        poller: Poller = app.state.poller
        now = time.time()
        ages = {s: round(now - t.received_at, 1) for s, t in hub.latest.items()}
        stale = [s for s in settings.symbols if ages.get(s, float("inf")) > settings.stale_after_s]
        return {
            "status": "ok" if poller.connected and not stale else "degraded",
            "source": source.name,
            "connected": poller.connected,
            "last_error": poller.last_error,
            "clients": len(hub.clients),
            "tick_age_s": ages,
            "stale": stale,
            "broker_tz_offset_h": getattr(source, "broker_offset_h", None),
            "broker_tz_auto": settings.broker_tz_auto,
        }

    @app.get("/api/candles")
    async def candles(request: Request, symbol: str = Query(..., max_length=20),
                      tf: str = Query("H1", max_length=4), count: int = Query(500, ge=1, le=5000)) -> dict[str, Any]:
        principal = principal_from_header(request)
        if "candles" not in principal.scopes:
            raise HTTPException(403, "token lacks candles scope")
        try:
            resolve_timeframe(tf)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        key = (symbol.upper(), tf.upper(), count)
        cached = candle_cache.get(key)
        if cached and cached[0] > time.monotonic():
            data = cached[1]
        else:
            try:
                data = await run_in_threadpool(source.candles, symbol, tf, count)
            except UnknownSymbol as exc:
                raise HTTPException(404, f"symbol not served by this bridge: {symbol}") from exc
            except SourceError as exc:
                log.error("candles failed: %s", exc)
                raise HTTPException(503, "MT5 terminal unavailable") from exc
            if len(candle_cache) >= CANDLE_CACHE_MAX:
                candle_cache.pop(next(iter(candle_cache)))
            candle_cache[key] = (time.monotonic() + CANDLE_CACHE_TTL_S, data)
        return {"symbol": key[0], "tf": key[1], "source": source.name, "candles": data}

    daily_cache: dict[str, tuple[float, dict[str, float]]] = {}

    def daily_stats(symbol: str) -> dict[str, float] | None:
        """Today's open/high/low and yesterday's close (D1 bars), cached 30 s per symbol."""
        cached = daily_cache.get(symbol)
        if cached and cached[0] > time.monotonic():
            return cached[1]
        try:
            bars = source.candles(symbol, "D1", 2)
        except Exception:
            return cached[1] if cached else None
        if not bars:
            return None
        today = bars[-1]
        stats = {"open": today["open"], "high": today["high"], "low": today["low"],
                 "volume": today["volume"], "prev_close": bars[-2]["close"] if len(bars) > 1 else today["open"]}
        daily_cache[symbol] = (time.monotonic() + 30.0, stats)
        return stats

    @app.get("/api/quotes")
    async def quotes(request: Request, symbols: str = Query("", max_length=300)) -> dict[str, Any]:
        """Latest tick (+ daily stats) per symbol for the PHP side — same data as the WebSocket,
        for browsers that poll instead of streaming. Requires a token with the `ticks` scope."""
        principal = principal_from_header(request)
        if "ticks" not in principal.scopes:
            raise HTTPException(403, "token lacks ticks scope")
        wanted = {x.strip().upper() for x in symbols.split(",") if x.strip()} or set(settings.symbols)
        now = time.time()
        rows: list[dict[str, Any]] = []
        for sym, tick in list(hub.latest.items()):
            if sym not in wanted or sym not in settings.symbols:
                continue
            row = tick.to_wire()
            row["age"] = round(now - tick.received_at, 2)
            stats = await run_in_threadpool(daily_stats, sym)
            if stats:
                row["day"] = stats
            rows.append(row)
        return {"source": source.name, "ticks": rows}

    @app.websocket("/ws/harga")
    async def ws_prices(ws: WebSocket) -> None:
        origin = (ws.headers.get("origin") or "").rstrip("/")
        if origin not in settings.allowed_origins:
            await ws.close(code=CLOSE_FORBIDDEN)      # rejected during the handshake (HTTP 403)
            return
        if len(hub.clients) >= settings.max_clients:
            await ws.close(code=CLOSE_OVERLOADED)
            return
        await ws.accept()

        # The token travels in the first message, not the URL, so it never lands in proxy logs.
        try:
            first = json.loads(await asyncio.wait_for(ws.receive_text(), settings.auth_timeout_s))
            principal = verify_token(first.get("token", "") if first.get("type") == "auth" else "", settings.jwt_secret)
        except asyncio.TimeoutError:
            await ws.close(code=CLOSE_AUTH_TIMEOUT, reason="auth timeout")
            return
        except (AuthError, ValueError, AttributeError):
            await ws.close(code=CLOSE_UNAUTHORIZED, reason="unauthorized")
            return
        except WebSocketDisconnect:
            return
        if "ticks" not in principal.scopes:
            await ws.close(code=CLOSE_FORBIDDEN, reason="token lacks ticks scope")
            return

        client = Client(ws.send_json, lambda code, reason: ws.close(code=code, reason=reason), set(settings.symbols))
        hub.add(client)
        try:
            await ws.send_json({"type": "ready", "symbols": sorted(settings.symbols), "exp": principal.expires_at,
                                "source": source.name, "throttle_ms": settings.throttle_ms})
            snap = hub.snapshot(client.symbols)
            if snap:
                await ws.send_json({"type": "ticks", "data": snap})
            while True:
                remaining = principal.expires_at - time.time()
                if remaining <= 0:
                    await ws.close(code=CLOSE_UNAUTHORIZED, reason="token expired")
                    return
                try:
                    msg = json.loads(await asyncio.wait_for(ws.receive_text(), remaining))
                except asyncio.TimeoutError:
                    continue                                   # loop re-checks expiry and closes
                except ValueError:
                    continue
                kind = msg.get("type") if isinstance(msg, dict) else None
                if kind == "auth":                             # renew without reconnecting
                    try:
                        renewed = verify_token(msg.get("token", ""), settings.jwt_secret)
                    except AuthError:
                        await ws.close(code=CLOSE_UNAUTHORIZED, reason="unauthorized")
                        return
                    if renewed.user_id != principal.user_id:
                        await ws.close(code=CLOSE_FORBIDDEN, reason="token belongs to another user")
                        return
                    principal = renewed
                    await ws.send_json({"type": "renewed", "exp": principal.expires_at})
                elif kind == "subscribe":
                    wanted = {str(s).upper() for s in msg.get("symbols", []) if isinstance(s, str)}
                    client.symbols = (wanted & set(settings.symbols)) or set(settings.symbols)
                    client.pending.clear()
                    await ws.send_json({"type": "subscribed", "symbols": sorted(client.symbols)})
                    snap = hub.snapshot(client.symbols)
                    if snap:
                        await ws.send_json({"type": "ticks", "data": snap})
                elif kind == "ping":
                    await ws.send_json({"type": "pong", "t": int(time.time() * 1000)})
        except WebSocketDisconnect:
            pass
        except RuntimeError:
            pass                                               # socket already closed by the hub
        finally:
            hub.remove(client)

    return app
