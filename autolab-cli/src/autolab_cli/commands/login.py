import click

from ..config import save_config
from ..output import emit


@click.command()
@click.argument("email")
@click.option("--password", "-p", default=None, help="Password (omit for an interactive prompt)")
@click.pass_context
def login(ctx, email, password):
    """Authenticate and store a JWT token in ~/.autolab-cli.yaml."""
    if password is None:
        password = click.prompt("Password", hide_input=True)

    client = ctx.obj["client"]
    resp = client.post("/login", json={"email": email, "password": password})
    token = resp.json()["token"]

    cfg = ctx.obj["config"]
    cfg.update({"base_url": client.root_base_url, "token": token, "email": email})
    save_config(cfg)

    emit(ctx, {"email": email, "base_url": client.root_base_url, "status": "logged in"})
