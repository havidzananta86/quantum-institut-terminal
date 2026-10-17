"""Settings read from environment variables (see .env.example)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _parse_symbol_map(raw: str) -> dict[str, str]:
    """"XAUUSD:XAUUSD.m,BTCUSDT:BTCUSD" -> {"XAUUSD": "XAUUSD.m", "BTCUSDT": "BTCUSD"}.

    Keys are the dashboard's symbol codes; values are the broker's symbol names
    (brokers often add suffixes such as .m, .pro or #).
    """
    mapping: dict[str, str] = {}
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        app_key, _, broker = part.partition(":")
        app_key = app_key.strip().upper()
        broker = broker.strip() or app_key
        if not app_key:
            raise ValueError(f"Invalid SYMBOLS entry: {part!r}")
        mapping[app_key] = broker
    if not mapping:
        raise ValueError("SYMBOLS must contain at least one symbol")
    return mapping


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    jwt_secret: str
    symbols: dict[str, str]
    allowed_origins: tuple[str, ...]
    environment: str = "production"
    mock: bool = False
    poll_ms: int = 100
    throttle_ms: int = 100
    stale_after_s: float = 10.0
    max_clients: int = 200
    auth_timeout_s: float = 5.0
    broker_tz_offset_h: float = 0.0
    mt5_path: str | None = None
    mt5_login: int | None = None
    mt5_password: str | None = field(default=None, repr=False)
    mt5_server: str | None = None

    @property
    def is_dev(self) -> bool:
        return self.environment == "development"

    @classmethod
    def from_env(cls) -> "Settings":
        secret = os.getenv("BRIDGE_JWT_SECRET", "")
        if len(secret) < 32:
            raise ValueError("BRIDGE_JWT_SECRET must be at least 32 characters (same value as QI_MT5_BRIDGE_SECRET in PHP)")
        environment = os.getenv("BRIDGE_ENV", "production").strip().lower()
        mock = _bool("MT5_MOCK")
        if mock and environment != "development":
            raise ValueError("MT5_MOCK=1 is only allowed with BRIDGE_ENV=development; mock prices must never reach production")
        origins = tuple(o.strip().rstrip("/") for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip())
        if not origins:
            raise ValueError("ALLOWED_ORIGINS must list the dashboard origin(s), e.g. https://quantum-institut.com")
        login = os.getenv("MT5_LOGIN", "").strip()
        poll_ms = int(os.getenv("POLL_MS", "100"))
        throttle_ms = int(os.getenv("THROTTLE_MS", "100"))
        if poll_ms < 20 or throttle_ms < 20:
            raise ValueError("POLL_MS and THROTTLE_MS must be >= 20")
        return cls(
            jwt_secret=secret,
            symbols=_parse_symbol_map(os.getenv("SYMBOLS", "XAUUSD:XAUUSD,EURUSD:EURUSD,BTCUSDT:BTCUSD")),
            allowed_origins=origins,
            environment=environment,
            mock=mock,
            poll_ms=poll_ms,
            throttle_ms=throttle_ms,
            stale_after_s=float(os.getenv("STALE_AFTER_S", "10")),
            max_clients=int(os.getenv("MAX_CLIENTS", "200")),
            auth_timeout_s=float(os.getenv("AUTH_TIMEOUT_S", "5")),
            broker_tz_offset_h=float(os.getenv("BROKER_TZ_OFFSET_H", "0")),
            mt5_path=os.getenv("MT5_PATH") or None,
            mt5_login=int(login) if login else None,
            mt5_password=os.getenv("MT5_PASSWORD") or None,
            mt5_server=os.getenv("MT5_SERVER") or None,
        )
