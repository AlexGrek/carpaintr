import click

from ..output import emit


@click.group()
def create():
    """Create resources."""


@create.command("user")
@click.argument("email")
@click.argument("password")
@click.pass_context
def create_user(ctx, email, password):
    """Register a new user account."""
    client = ctx.obj["client"]
    resp = client.post("/admin/users/bulk", json={"users": [{"email": email, "password": password}]}).json()
    created = email in resp.get("created", [])
    emit(ctx, {"email": email, "status": "created" if created else "already existed"})
