import datetime as dt

import click

from ..jwtutil import decode_jwt_claims, license_status, parse_expires_at
from ..output import emit


def _fetch(client, email, license_id):
    token = client.get(f"/admin/license/{email}/{license_id}").text
    claims = decode_jwt_claims(token)
    return {"id": license_id, **license_status(claims)}


@click.group()
@click.argument("email")
@click.pass_context
def license(ctx, email):
    """Manage licenses for EMAIL."""
    ctx.obj["email"] = email


@license.command("list")
@click.pass_context
def license_list(ctx):
    """List EMAIL's licenses with active/expired status."""
    client, email = ctx.obj["client"], ctx.obj["email"]
    filenames = client.get(f"/admin/license/list/{email}").json()
    items = []
    for filename in filenames:
        try:
            items.append(_fetch(client, email, filename))
        except ValueError:
            items.append({"id": filename, "status": "unreadable"})
    emit(ctx, items)


@license.command("issue")
@click.argument("duration", type=int)
@click.argument("level", required=False, default="Basic")
@click.pass_context
def license_issue(ctx, duration, level):
    """Issue a new license valid for DURATION days at LEVEL."""
    client, email = ctx.obj["client"], ctx.obj["email"]
    before = set(client.get(f"/admin/license/list/{email}").json())
    client.post("/admin/license/generate", json={"email": email, "days": duration, "level": level})
    after = client.get(f"/admin/license/list/{email}").json()
    new_ids = [f for f in after if f not in before]
    if new_ids:
        emit(ctx, _fetch(client, email, new_ids[0]))
    else:
        emit(ctx, {"email": email, "status": "issued", "id": None})


@license.command("revoke")
@click.argument("license_id")
@click.pass_context
def license_revoke(ctx, license_id):
    """Delete a license file (also invalidates the cached license)."""
    client, email = ctx.obj["client"], ctx.obj["email"]
    client.delete(f"/admin/license/{email}/{license_id}")
    emit(ctx, {"email": email, "id": license_id, "status": "revoked"})


@license.command("get")
@click.argument("license_id")
@click.pass_context
def license_get(ctx, license_id):
    """Show one license's decoded status."""
    client, email = ctx.obj["client"], ctx.obj["email"]
    emit(ctx, _fetch(client, email, license_id))


@license.command("extend")
@click.argument("license_id")
@click.argument("days", type=int)
@click.pass_context
def license_extend(ctx, license_id, days):
    """Push a license's expiry back by DAYS (from now if already expired)."""
    client, email = ctx.obj["client"], ctx.obj["email"]
    current = _fetch(client, email, license_id)
    base = max(parse_expires_at(current["expires_at"]), dt.datetime.now(dt.timezone.utc))
    new_expiry = base + dt.timedelta(days=days)
    client.post(
        "/admin/license/generate",
        json={"email": email, "expiry_date": new_expiry.strftime("%Y-%m-%dT%H:%M:%SZ"), "level": current["level"]},
    )
    client.delete(f"/admin/license/{email}/{license_id}")
    emit(ctx, {"email": email, "replaces": license_id, "level": current["level"], "expires_at": new_expiry.strftime("%Y-%m-%dT%H:%M:%SZ"), "status": "extended"})


@license.command("upgrade")
@click.argument("license_id")
@click.argument("level")
@click.pass_context
def license_upgrade(ctx, license_id, level):
    """Reissue a license at a new LEVEL, keeping its current expiry."""
    client, email = ctx.obj["client"], ctx.obj["email"]
    current = _fetch(client, email, license_id)
    client.post(
        "/admin/license/generate",
        json={"email": email, "expiry_date": current["expires_at"], "level": level},
    )
    client.delete(f"/admin/license/{email}/{license_id}")
    emit(ctx, {"email": email, "replaces": license_id, "level": level, "expires_at": current["expires_at"], "status": "upgraded"})
