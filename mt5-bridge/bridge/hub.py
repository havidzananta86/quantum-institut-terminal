"""Fan-out of ticks to WebSocket clients with per-client throttling.

The poller publishes every POLL_MS; each client receives at most one batch per
THROTTLE_MS containing only the latest tick of each subscribed symbol that changed.
A slow client never delays the others: each send runs in its own task, and a
client whose send stalls for SEND_TIMEOUT_S is disconnected.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable

from .source import Tick

log = logging.getLogger("bridge.hub")
SEND_TIMEOUT_S = 2.0


class Client:
    def __init__(self, send_json: Callable[[dict[str, Any]], Awaitable[None]],
                 close: Callable[[int, str], Awaitable[None]], symbols: set[str]) -> None:
        self.send_json = send_json
        self.close = close
        self.symbols = symbols
        self.pending: dict[str, dict[str, Any]] = {}
        self.sending = False
        self.closed = False


class Hub:
    def __init__(self, throttle_ms: int) -> None:
        self.throttle_s = throttle_ms / 1000
        self.latest: dict[str, Tick] = {}
        self.clients: set[Client] = set()

    def publish(self, ticks: list[Tick]) -> None:
        for t in ticks:
            prev = self.latest.get(t.symbol)
            self.latest[t.symbol] = t
            if prev is not None and prev.bid == t.bid and prev.ask == t.ask:
                continue
            wire = t.to_wire()
            for c in self.clients:
                if t.symbol in c.symbols:
                    c.pending[t.symbol] = wire

    def add(self, client: Client) -> None:
        self.clients.add(client)

    def remove(self, client: Client) -> None:
        client.closed = True
        self.clients.discard(client)

    def snapshot(self, symbols: set[str]) -> list[dict[str, Any]]:
        return [t.to_wire() for s, t in self.latest.items() if s in symbols]

    async def _flush(self, client: Client) -> None:
        client.sending = True
        try:
            # One batch per throttle interval; ticks arriving meanwhile wait for the next one.
            batch = list(client.pending.values())
            client.pending.clear()
            await asyncio.wait_for(client.send_json({"type": "ticks", "data": batch}), SEND_TIMEOUT_S)
        except Exception as exc:  # timeout or broken socket
            log.info("dropping slow/broken client: %s", exc.__class__.__name__)
            self.remove(client)
            try:
                await client.close(1013, "client too slow")
            except Exception:
                pass
        finally:
            client.sending = False

    async def run(self) -> None:
        while True:
            await asyncio.sleep(self.throttle_s)
            for client in list(self.clients):
                if client.pending and not client.sending and not client.closed:
                    asyncio.create_task(self._flush(client))
