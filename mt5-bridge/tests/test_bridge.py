import asyncio
import base64
import hashlib
import hmac
import json
import time
from types import SimpleNamespace

import jwt
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from bridge.app import create_app
from bridge.auth import AuthError, verify_token
from bridge.config import Settings, _parse_symbol_map
from bridge.hub import Client, Hub
from bridge.source import MockSource, MT5Source, SourceError, Tick, UnknownSymbol

SECRET = "s" * 40
ORIGIN = "https://quantum-institut.com"


def settings(**overrides):
    base = dict(jwt_secret=SECRET, symbols={"XAUUSD": "XAUUSD.m", "EURUSD": "EURUSD", "BTCUSDT": "BTCUSD"},
                allowed_origins=(ORIGIN,), environment="development", mock=True, poll_ms=20, throttle_ms=20)
    base.update(overrides)
    return Settings(**base)


def php_token(secret=SECRET, ttl=300, sub="7", aud="qim-mt5-bridge", scope="ticks candles", iat=None):
    """Byte-for-byte the signing done by api/mt5-bridge-token.php."""
    def b64(raw: bytes) -> str:
        return base64.urlsafe_b64encode(raw).decode().rstrip("=")
    now = int(iat if iat is not None else time.time())
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = b64(json.dumps({"iss": "qim", "aud": aud, "sub": sub, "scope": scope,
                              "iat": now, "nbf": now - 5, "exp": now + ttl, "jti": "x"}).encode())
    sig = b64(hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


# ── config ─────────────────────────────────────────────────────────────
def test_symbol_map_keeps_broker_suffix():
    assert _parse_symbol_map("xauusd:XAUUSD.m, EURUSD") == {"XAUUSD": "XAUUSD.m", "EURUSD": "EURUSD"}


def test_mock_refused_outside_development(monkeypatch):
    monkeypatch.setenv("BRIDGE_JWT_SECRET", SECRET)
    monkeypatch.setenv("ALLOWED_ORIGINS", ORIGIN)
    monkeypatch.setenv("MT5_MOCK", "1")
    monkeypatch.setenv("BRIDGE_ENV", "production")
    with pytest.raises(ValueError, match="only allowed"):
        Settings.from_env()


def test_short_secret_refused(monkeypatch):
    monkeypatch.setenv("BRIDGE_JWT_SECRET", "short")
    with pytest.raises(ValueError, match="32"):
        Settings.from_env()


# ── auth ───────────────────────────────────────────────────────────────
def test_php_signed_token_verifies():
    p = verify_token(php_token(), SECRET)
    assert p.user_id == "7" and {"ticks", "candles"} <= p.scopes


@pytest.mark.parametrize("token", [
    php_token(secret="x" * 40),                       # other secret
    php_token(aud="someone-else"),                    # other audience
    php_token(ttl=-60, iat=time.time() - 400),        # expired
    "not.a.token",
    "",
])
def test_bad_tokens_rejected(token):
    with pytest.raises(AuthError):
        verify_token(token, SECRET)


def test_alg_none_rejected():
    unsigned = jwt.encode({"iss": "qim", "aud": "qim-mt5-bridge", "sub": "7", "iat": int(time.time()),
                           "exp": int(time.time()) + 60}, key=None, algorithm="none")
    with pytest.raises(AuthError):
        verify_token(unsigned, SECRET)


# ── MT5 adapter against a fake MetaTrader5 module ──────────────────────
class FakeMT5:
    TIMEFRAME_H1 = 16385

    def __init__(self, ticks=None, select_fail=(), last_error=(1, "ok")):
        self.ticks = ticks or {}
        self.select_fail = set(select_fail)
        self._last_error = last_error
        self.init_kwargs = None

    def initialize(self, **kw):
        self.init_kwargs = kw
        return True

    def last_error(self):
        return self._last_error

    def symbol_select(self, sym, enable):
        return sym not in self.select_fail

    def symbol_info_tick(self, sym):
        return self.ticks.get(sym)

    def copy_rates_from_pos(self, sym, tf, start, count):
        return [{"time": 1_700_003_600, "open": 1, "high": 2, "low": 0.5, "close": 1.5, "tick_volume": 42}][:count]

    def terminal_info(self):
        return SimpleNamespace(connected=True)

    def shutdown(self):
        pass


def test_mt5_poll_maps_broker_symbols_and_skips_bad_ticks():
    fake = FakeMT5(ticks={
        "XAUUSD.m": SimpleNamespace(bid=2650.1, ask=2650.4, time_msc=1),
        "EURUSD": SimpleNamespace(bid=0, ask=1.1, time_msc=1),        # invalid
    }, select_fail={"BTCUSD"})
    src = MT5Source(settings(mock=False, mt5_login=123, mt5_password="pw", mt5_server="Broker-Demo"), fake)
    src.connect()
    assert fake.init_kwargs["login"] == 123 and fake.init_kwargs["server"] == "Broker-Demo"
    ticks = src.poll()
    assert [(t.symbol, t.bid, t.source) for t in ticks] == [("XAUUSD", 2650.1, "mt5")]


def test_mt5_link_loss_raises_for_reconnect():
    src = MT5Source(settings(mock=False), FakeMT5(last_error=(-10004, "No IPC connection")))
    src.connect()
    with pytest.raises(SourceError):
        src.poll()


def test_mt5_candles_shift_broker_time_to_utc():
    src = MT5Source(settings(mock=False, broker_tz_offset_h=3), FakeMT5())
    bars = src.candles("XAUUSD", "H1", 10)
    assert bars == [{"time": 1_700_003_600 - 3 * 3600, "open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5, "volume": 42.0}]
    with pytest.raises(UnknownSymbol):
        src.candles("GBPJPY", "H1", 10)


# ── hub ────────────────────────────────────────────────────────────────
def tick(sym, bid):
    return Tick(sym, bid, bid + 0.1, 1, time.time(), "mt5")


def test_hub_sends_only_latest_changed_tick_per_interval():
    async def scenario():
        sent = []

        async def send(msg):
            sent.append(msg)

        async def close(code, reason):
            pass

        hub = Hub(throttle_ms=20)
        hub.add(Client(send, close, {"XAUUSD"}))
        runner = asyncio.create_task(hub.run())
        hub.publish([tick("XAUUSD", 1.0), tick("EURUSD", 5.0)])
        hub.publish([tick("XAUUSD", 2.0)])
        await asyncio.sleep(0.06)
        hub.publish([tick("XAUUSD", 2.0)])                # unchanged → nothing new
        await asyncio.sleep(0.06)
        runner.cancel()
        return sent

    sent = asyncio.run(scenario())
    assert len(sent) == 1
    assert [d["bid"] for d in sent[0]["data"]] == [2.0]


def test_hub_drops_client_that_stalls():
    async def scenario():
        closed = []

        async def never(msg):
            await asyncio.sleep(10)

        async def close(code, reason):
            closed.append(code)

        import bridge.hub as hub_mod
        hub_mod.SEND_TIMEOUT_S = 0.05
        hub = Hub(throttle_ms=10)
        hub.add(Client(never, close, {"XAUUSD"}))
        runner = asyncio.create_task(hub.run())
        hub.publish([tick("XAUUSD", 1.0)])
        await asyncio.sleep(0.2)
        runner.cancel()
        hub_mod.SEND_TIMEOUT_S = 2.0
        return hub, closed

    hub, closed = asyncio.run(scenario())
    assert not hub.clients and closed == [1013]


# ── app: WebSocket + REST with the mock source ─────────────────────────
@pytest.fixture
def client():
    with TestClient(create_app(settings(auth_timeout_s=0.5))) as c:
        yield c


def test_ws_streams_ticks_after_auth(client):
    with client.websocket_connect("/ws/harga", headers={"origin": ORIGIN}) as ws:
        ws.send_text(json.dumps({"type": "auth", "token": php_token()}))
        ready = ws.receive_json()
        assert ready["type"] == "ready" and ready["source"] == "mock"
        ws.send_text(json.dumps({"type": "subscribe", "symbols": ["XAUUSD", "NOPE"]}))
        # Before "subscribed" the client gets every symbol (default subscription);
        # after it, only the symbols it asked for that this bridge serves.
        seen, subscribed, batches = set(), False, 0
        while batches < 5:
            msg = ws.receive_json()
            if msg["type"] == "subscribed":
                assert msg["symbols"] == ["XAUUSD"]
                subscribed = True
            elif msg["type"] == "ticks" and subscribed:
                seen |= {d["s"] for d in msg["data"]}
                batches += 1
        assert seen == {"XAUUSD"}


def test_ws_rejects_foreign_origin(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/harga", headers={"origin": "https://evil.example"}) as ws:
            ws.receive_json()


def test_ws_closes_on_bad_token(client):
    with client.websocket_connect("/ws/harga", headers={"origin": ORIGIN}) as ws:
        ws.send_text(json.dumps({"type": "auth", "token": php_token(secret="x" * 40)}))
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        assert exc.value.code == 4401


def test_ws_closes_when_no_auth_sent(client):
    with client.websocket_connect("/ws/harga", headers={"origin": ORIGIN}) as ws:
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        assert exc.value.code == 4408


def test_ws_renewal_must_be_same_user(client):
    with client.websocket_connect("/ws/harga", headers={"origin": ORIGIN}) as ws:
        ws.send_text(json.dumps({"type": "auth", "token": php_token(sub="7")}))
        assert ws.receive_json()["type"] == "ready"
        ws.send_text(json.dumps({"type": "auth", "token": php_token(sub="8")}))
        with pytest.raises(WebSocketDisconnect) as exc:
            while True:
                ws.receive_json()
        assert exc.value.code == 4403


def test_candles_require_token_and_return_bars(client):
    assert client.get("/api/candles", params={"symbol": "XAUUSD"}).status_code == 401
    r = client.get("/api/candles", params={"symbol": "XAUUSD", "tf": "H1", "count": 50},
                   headers={"Authorization": f"Bearer {php_token()}"})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "mock" and len(body["candles"]) == 50
    assert client.get("/api/candles", params={"symbol": "XAUUSD", "tf": "H2"},
                      headers={"Authorization": f"Bearer {php_token()}"}).status_code == 400


def test_health_reports_source(client):
    time.sleep(0.1)
    body = client.get("/health").json()
    assert body["source"] == "mock" and body["connected"] is True


def test_quotes_require_ticks_scope_and_return_latest_with_daily_stats(client):
    assert client.get("/api/quotes").status_code == 401
    assert client.get("/api/quotes", headers={"Authorization": f"Bearer {php_token(scope='candles')}"}).status_code == 403
    time.sleep(0.4)  # let the poller publish at least one tick
    r = client.get("/api/quotes", params={"symbols": "XAUUSD,NOPE"}, headers={"Authorization": f"Bearer {php_token()}"})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "mock"
    assert [row["s"] for row in body["ticks"]] == ["XAUUSD"]
    row = body["ticks"][0]
    assert row["bid"] > 0 and row["ask"] >= row["bid"] and row["age"] >= 0
    assert {"open", "high", "low", "prev_close"} <= set(row["day"])


def test_broker_offset_auto_detects_from_moving_ticks_only():
    now = time.time()
    # Broker di UTC+3: waktu tick = UTC + 3 jam. Pada poll pertama belum ada pembanding.
    fake = FakeMT5(ticks={"XAUUSD.m": SimpleNamespace(bid=1.0, ask=1.1, time_msc=int((now + 3 * 3600) * 1000))})
    src = MT5Source(settings(mock=False, broker_tz_auto=True), fake)
    src.connect()
    src.poll()
    assert src.detected_offset_h is None and src.broker_offset_h == 0.0     # belum ada tick yang "bergerak"
    fake.ticks["XAUUSD.m"] = SimpleNamespace(bid=1.2, ask=1.3, time_msc=int((time.time() + 3 * 3600) * 1000) + 250)
    src.poll()
    assert src.detected_offset_h == 3.0 and src.broker_offset_h == 3.0
    bars = src.candles("XAUUSD", "H1", 10)
    assert bars[0]["time"] == 1_700_003_600 - 3 * 3600


def test_broker_offset_auto_ignores_stale_ticks_and_follows_dst():
    now = time.time()
    stale_msc = int((now - 15 * 3600 + 3 * 3600) * 1000)                   # pasar tutup: tick 15 jam lalu
    fake = FakeMT5(ticks={"XAUUSD.m": SimpleNamespace(bid=1.0, ask=1.1, time_msc=stale_msc)})
    src = MT5Source(settings(mock=False, broker_tz_auto=True, broker_tz_offset_h=3.0), fake)
    src.connect()
    src.poll(); src.poll()                                                   # tick tidak berubah → bukan bukti
    assert src.detected_offset_h is None and src.broker_offset_h == 3.0     # memakai nilai statis
    fake.ticks["XAUUSD.m"] = SimpleNamespace(bid=1.0, ask=1.1, time_msc=int((time.time() + 3 * 3600) * 1000))
    src.poll()
    fake.ticks["XAUUSD.m"] = SimpleNamespace(bid=1.1, ask=1.2, time_msc=int((time.time() + 3 * 3600) * 1000) + 100)
    src.poll()
    assert src.broker_offset_h == 3.0
    fake.ticks["XAUUSD.m"] = SimpleNamespace(bid=1.1, ask=1.2, time_msc=int((time.time() + 2 * 3600) * 1000))   # DST berakhir → UTC+2
    src.poll()
    assert src.broker_offset_h == 2.0


def test_auto_offset_setting_parsed(monkeypatch):
    monkeypatch.setenv("BRIDGE_JWT_SECRET", "x" * 40)
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://a.example")
    monkeypatch.setenv("BROKER_TZ_OFFSET_H", "auto")
    s = Settings.from_env()
    assert s.broker_tz_auto is True and s.broker_tz_offset_h == 0.0
    monkeypatch.setenv("BROKER_TZ_OFFSET_H", "2.5")
    s = Settings.from_env()
    assert s.broker_tz_auto is False and s.broker_tz_offset_h == 2.5
