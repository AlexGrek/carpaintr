import click

from .client import ApiClient
from .config import DEFAULT_BASE_URL, load_config
from .service_auth import load_service_credentials
from .commands.check import check
from .commands.create import create
from .commands.get import get
from .commands.license import license
from .commands.login import login


@click.group()
@click.option("--json", "fmt", flag_value="json", default=None, help="Output as JSON.")
@click.option("--table", "fmt", flag_value="table", help="Output as a table.")
@click.option("--yaml", "fmt", flag_value="yaml", help="Output as YAML.")
@click.option("--base-url", default=None, help="Override the backend base URL for this call.")
@click.pass_context
def cli(ctx, fmt, base_url):
    """autolab - CLI for administering the Autolab / carpaintr backend."""
    ctx.ensure_object(dict)
    cfg = load_config()
    effective_base_url = base_url or cfg.get("base_url") or DEFAULT_BASE_URL

    ctx.obj["format"] = fmt
    ctx.obj["config"] = cfg
    client = ApiClient(effective_base_url, cfg.get("token"))
    ctx.obj["client"] = client

    if ctx.invoked_subcommand == "login" or cfg.get("token"):
        return

    # No stored login - if we're running inside the autolab-api pod, the
    # backend leaves service-user credentials on disk so this "just works"
    # without a manual `autolab login` step.
    service_user = load_service_credentials()
    if service_user is None:
        raise click.ClickException("Not logged in. Run 'autolab login <email>' first.")

    resp = client.post("/login", json={"email": service_user["email"], "password": service_user["password"]})
    client.token = resp.json()["token"]


cli.add_command(login)
cli.add_command(get)
cli.add_command(license)
cli.add_command(create)
cli.add_command(check)


def main():
    cli()


if __name__ == "__main__":
    main()
