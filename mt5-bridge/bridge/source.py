"""Price sources: the real MetaTrader 5 terminal, and a clearly-labelled mock for development."""
from __future__ import annotations

import logging
import math
import random
import threading
import time
from dataclasses import dataclass
from typing import Any, Protocol

from .config import Settings

log = logging.getLogger("bridge.source")

# Dashboard interval codes and MT5 names → MT5 timeframe constant names.
TIMEFRAMES = {
    "1": "TIMEFRAME_M1", "M1": "TIMEFRAME_M1",
    "5": "TIMEFRAME_M5", "M5": "TIMEFRAME_M5",
    "15": "TIMEFRAME_M15", "M15": "TIMEFRAME_M15",
    "30": "TIMEFRAME_M30", "M30": "TIMEFRAME_M30",
    "60": "TIMEFRAME_H1", "H1": "TIMEFRAME_H1",
    "240": "TIMEFRAME_H4", "H4": "TIMEFRAME_H4",
    "D": "TIMEFRAME_D1", "D1": "TIMEFRAME_D1",
    "W": "TIMEFRAME_W1", "W1": "TIMEFRAME_W1",
    "MN": "TIMEFRAME_MN1", "MN1": "TIMEFRAME_MN1",
}
TIMEFRAME_SECONDS = {
    "TIMEFRAME_M1": 60, "TIMEFRAME_M5": 300, "TIMEFRAME_M15": 900, "TIMEFRAME_M30": 1800,
    "TIMEFRAME_H1": 3600, "TIMEFRAME_H4": 14400, "TIMEFRAME_D1": 86400,
    "TIMEFRAME_W1": 604800, "TIMEFRAME_MN1": 2592000,
}
MAX_CANDLES = 5000


class SourceError(Exception):
    """The terminal is unreachable or refused a request."""


class UnknownSymbol(KeyError):
    pass


@dataclass(frozen=True)
class Tick:
    symbol: str          # dashboard code, e.g. "XAUUSD"
    bid: float
    ask: float
    time_msc: int        # broker timestamp (milliseconds)
    received_at: float   # local wall-clock seconds; used for staleness, not broker time
    source: str          # "mt5" or "mock"

    def to_wire(self) -> dict[str, Any]:
        return {
            "s": self.symbol,
            "bid": self.bid,
            "ask": self.ask,
            "spread": round(self.ask - self.bid, 10),
            "t": self.time_msc,
            "src": self.source,
        }


def resolve_timeframe(tf: str) -> str:
    key = (tf or "").strip().upper()
    if key not in TIMEFRAMES:
        raise ValueError(f"Unsupported timeframe {tf!r}; use one of M1 M5 M15 M30 H1 H4 D1 W1 MN1")
    return TIMEFRAMES[key]


class PriceSource(Protocol):
    name: str

    def connect(self) -> None: ...
    def poll(self) -> list[Tick]: ...
    def candles(self, symbol: str, timeframe: str, count: int) -> list[dict[str, float]]: ...
    def healthy(self) -> bool: ...
    def shutdown(self) -> None: ...


class MT5Source:
    """Wraps the MetaTrader5 package. All terminal calls go through one lock:
    the package talks to the terminal over a single IPC channel and is not thread-safe."""

    name = "mt5"

    def __init__(self, settings: Settings, mt5_module: Any | None = None) -> None:
        self._settings = settings
        self._mt5 = mt5_module
        self._lock = threading.Lock()
        self._unavailable: set[str] = set()

    def _module(self) -> Any:
        if self._mt5 is None:
            try:
                import MetaTrader5  # Windows-only; talks to a locally running terminal64.exe
            except ImportError as exc:
                raise SourceError("MetaTrader5 package not installed (it only exists for Windows)") from exc
            self._mt5 = MetaTrader5
        return self._mt5

    def connect(self) -> None:
        mt5 = self._module()
        s = self._settings
        kwargs: dict[str, Any] = {"timeout": 10_000}
        if s.mt5_path:
            kwargs["path"] = s.mt5_path
        if s.mt5_login is not None:
            kwargs.update(login=s.mt5_login, password=s.mt5_password or "", server=s.mt5_server or "")
        with self._lock:
            if not mt5.initialize(**kwargs):
                raise SourceError(f"initialize() failed: {mt5.last_error()}")
            self._unavailable.clear()
            for app_key, broker in s.symbols.items():
                if not mt5.symbol_select(broker, True):
                    self._unavailable.add(app_key)
                    log.warning("symbol_select(%s) failed for %s: %s — check the broker's symbol name/suffix",
                                broker, app_key, mt5.last_error())
        log.info("connected to MT5; streaming %s", sorted(set(s.symbols) - self._unavailable))

    def poll(self) -> list[Tick]:
        mt5 = self._module()
        now = time.time()
        ticks: list[Tick] = []
        with self._lock:
            for app_key, broker in self._settings.symbols.items():
                if app_key in self._unavailable:
                    continue
                t = mt5.symbol_info_tick(broker)
                if t is None:
                    err = mt5.last_error()
                    # -10001..-10005 = IPC send/receive/init/connect/timeout: the terminal
                    # link dropped, so let the poller reconnect instead of skipping quietly.
                    if err and -10005 <= err[0] <= -10001:
                        raise SourceError(f"terminal link lost: {err}")
                    continue
                if t.bid <= 0 or t.ask <= 0 or t.ask < t.bid:
                    continue
                ticks.append(Tick(app_key, float(t.bid), float(t.ask), int(t.time_msc), now, self.name))
        return ticks

    def candles(self, symbol: str, timeframe: str, count: int) -> list[dict[str, float]]:
        broker = self._settings.symbols.get(symbol.upper())
        if broker is None:
            raise UnknownSymbol(symbol)
        mt5 = self._module()
        tf_const = getattr(mt5, resolve_timeframe(timeframe))
        count = max(1, min(int(count), MAX_CANDLES))
        with self._lock:
            rates = mt5.copy_rates_from_pos(broker, tf_const, 0, count)
            if rates is None:
                raise SourceError(f"copy_rates_from_pos({broker}) failed: {mt5.last_error()}")
        # MT5 returns bar times in the broker's server time; shift to real UTC.
        offset = int(self._settings.broker_tz_offset_h * 3600)
        return [
            {
                "time": int(r["time"]) - offset,
                "open": float(r["open"]),
                "high": float(r["high"]),
                "low": float(r["low"]),
                "close": float(r["close"]),
                "volume": float(r["tick_volume"]),
            }
            for r in rates
        ]

    def healthy(self) -> bool:
        mt5 = self._module()
        with self._lock:
            info = mt5.terminal_info()
        return bool(info is not None and getattr(info, "connected", False))

    def shutdown(self) -> None:
        if self._mt5 is not None:
            with self._lock:
                self._mt5.shutdown()


class MockSource:
    """Random-walk prices for local development only. Every tick is labelled
    src="mock"; Settings refuses MT5_MOCK outside BRIDGE_ENV=development."""

    name = "mock"
    _START = {"XAUUSD": 2650.0, "EURUSD": 1.085, "BTCUSDT": 82000.0, "BTCUSD": 82000.0, "GBPUSD": 1.27, "USDJPY": 150.0}

    def __init__(self, settings: Settings, seed: int = 7) -> None:
        self._symbols = list(settings.symbols)
        self._rng = random.Random(seed)
        self._price = {s: self._START.get(s, 100.0) for s in self._symbols}

    def connect(self) -> None:
        log.warning("MOCK price source active — prices are simulated, not from a broker")

    def poll(self) -> list[Tick]:
        now = time.time()
        out = []
        for s in self._symbols:
            p = self._price[s] * (1 + self._rng.gauss(0, 0.00005))
            self._price[s] = p
            spread = p * 0.00008
            out.append(Tick(s, round(p, 5), round(p + spread, 5), int(now * 1000), now, self.name))
        return out

    def candles(self, symbol: str, timeframe: str, count: int) -> list[dict[str, float]]:
        if symbol.upper() not in self._symbols:
            raise UnknownSymbol(symbol)
        step = TIMEFRAME_SECONDS[resolve_timeframe(timeframe)]
        count = max(1, min(int(count), MAX_CANDLES))
        rng = random.Random(f"{symbol}:{timeframe}")
        end = int(time.time()) // step * step
        price = self._START.get(symbol.upper(), 100.0)
        bars = []
        for i in range(count):
            o = price
            c = o * (1 + rng.gauss(0, 0.002))
            hi, lo = max(o, c) * (1 + abs(rng.gauss(0, 0.0008))), min(o, c) * (1 - abs(rng.gauss(0, 0.0008)))
            bars.append({"time": end - (count - 1 - i) * step, "open": o, "high": hi, "low": lo, "close": c,
                         "volume": float(math.floor(rng.uniform(100, 1000)))})
            price = c
        return bars

    def healthy(self) -> bool:
        return True

    def shutdown(self) -> None:
        pass
