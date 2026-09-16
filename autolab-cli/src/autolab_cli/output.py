import json

import click
import yaml
from tabulate import tabulate


def emit(ctx: click.Context, data) -> None:
    """Print `data` using the format requested via --json/--table/--yaml.

    With no explicit flag: lists render as a table, everything else as YAML.
    """
    fmt = ctx.obj.get("format") if ctx.obj else None
    if fmt is None:
        fmt = "table" if isinstance(data, list) else "yaml"

    if fmt == "json":
        click.echo(json.dumps(data, indent=2, default=str))
    elif fmt == "yaml":
        click.echo(yaml.safe_dump(data, sort_keys=False, default_flow_style=False).rstrip())
    else:
        _emit_table(data)


def _emit_table(data) -> None:
    rows = data if isinstance(data, list) else [data]
    if not rows:
        click.echo("(no results)")
        return
    if all(isinstance(row, dict) for row in rows):
        headers = list(dict.fromkeys(key for row in rows for key in row.keys()))
        table = [[row.get(h, "") for h in headers] for row in rows]
        click.echo(tabulate(table, headers=headers, tablefmt="simple"))
    else:
        click.echo(tabulate([[v] for v in rows], headers=["value"], tablefmt="simple"))
