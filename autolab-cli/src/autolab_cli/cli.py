import click

from .client import ApiClient
from .config import DEFAULT_BASE_URL, load_config
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
    ctx.obj["client"] = ApiClient(effective_base_url, cfg.get("token"))

    if ctx.invoked_subcommand != "login" and not cfg.get("token"):
        raise click.ClickException("Not logged in. Run 'autolab login <email>' first.")


cli.add_command(login)
cli.add_command(get)
cli.add_command(license)
cli.add_command(create)
cli.add_command(check)


def main():
    cli()


if __name__ == "__main__":
    main()
