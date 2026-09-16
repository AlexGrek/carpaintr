import click

from ..jwtutil import decode_jwt_claims, license_status
from ..output import emit


@click.group()
def get():
    """Look up users."""


@get.command("users")
@click.pass_context
def get_users(ctx):
    """List all registered users."""
    client = ctx.obj["client"]
    emails = client.get("/admin/listusers").json()
    emit(ctx, [{"email": e} for e in emails])


@get.command("user")
@click.argument("email")
@click.pass_context
def get_user(ctx, email):
    """Show one user, with a summary of their licenses."""
    client = ctx.obj["client"]
    emails = client.get("/admin/listusers").json()
    result = {"email": email, "exists": email in emails}

    if result["exists"]:
        filenames = client.get(f"/admin/license/list/{email}").json()
        licenses = []
        for filename in filenames:
            token = client.get(f"/admin/license/{email}/{filename}").text
            try:
                licenses.append({"id": filename, **license_status(decode_jwt_claims(token))})
            except ValueError:
                licenses.append({"id": filename, "status": "unreadable"})
        result["license_count"] = len(licenses)
        result["active_license"] = next((l for l in licenses if l["status"] == "active"), None)

    emit(ctx, result)
