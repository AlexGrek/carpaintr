import os
from pathlib import Path

import yaml

DEFAULT_BASE_URL = "http://localhost:8080"
CONFIG_PATH = Path(os.environ.get("AUTOLAB_CLI_CONFIG", Path.home() / ".autolab-cli.yaml"))


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        return {}
    with CONFIG_PATH.open() as f:
        return yaml.safe_load(f) or {}


def save_config(data: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CONFIG_PATH.open("w") as f:
        yaml.safe_dump(data, f, default_flow_style=False)
    CONFIG_PATH.chmod(0o600)
