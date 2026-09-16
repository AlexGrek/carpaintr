import base64
import datetime as dt
import json

# Licenses are signed JWTs, but this CLI only ever reads them back through
# admin endpoints that already required a valid admin session to reach - so
# decoding claims here is just for display/computation, never for trust
# decisions. Signature verification happens server-side.
DATE_FMT = "%Y-%m-%dT%H:%M:%SZ"


def decode_jwt_claims(token: str) -> dict:
    parts = token.strip().split(".")
    if len(parts) < 2:
        raise ValueError("not a JWT")
    payload = parts[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))


def license_status(claims: dict) -> dict:
    exp = claims.get("exp")
    expires_at = None
    is_active = False
    if exp is not None:
        expires_at = dt.datetime.fromtimestamp(exp, tz=dt.timezone.utc).strftime(DATE_FMT)
        is_active = exp > dt.datetime.now(tz=dt.timezone.utc).timestamp()
    return {
        "level": claims.get("level"),
        "expires_at": expires_at,
        "status": "active" if is_active else "expired",
    }


def parse_expires_at(value: str) -> dt.datetime:
    return dt.datetime.strptime(value, DATE_FMT).replace(tzinfo=dt.timezone.utc)
