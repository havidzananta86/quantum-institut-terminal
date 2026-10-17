"""Verification of the short-lived HS256 tokens issued by api/mt5-bridge-token.php."""
from __future__ import annotations

from dataclasses import dataclass

import jwt

AUDIENCE = "qim-mt5-bridge"
ISSUER = "qim"


class AuthError(Exception):
    """Token missing, malformed, expired, or signed with another secret."""


@dataclass(frozen=True)
class Principal:
    user_id: str
    expires_at: int
    scopes: frozenset[str]


def verify_token(token: str, secret: str, *, leeway_s: int = 5) -> Principal:
    if not token or not isinstance(token, str):
        raise AuthError("missing token")
    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],          # never accept "none" or asymmetric algs here
            audience=AUDIENCE,
            issuer=ISSUER,
            leeway=leeway_s,
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("token expired") from exc
    except jwt.PyJWTError as exc:
        raise AuthError("invalid token") from exc
    return Principal(
        user_id=str(claims["sub"]),
        expires_at=int(claims["exp"]),
        scopes=frozenset(str(claims.get("scope", "")).split()),
    )
