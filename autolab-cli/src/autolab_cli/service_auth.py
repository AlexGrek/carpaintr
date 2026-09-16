import json
import os
from pathlib import Path

# Matches the file the autolab-api backend writes under DATA_DIR_PATH at
# startup (see backend-service-rust/src/auth/service_user.rs). Inside the
# autolab-api pod this CLI ships in, DATA_DIR_PATH is /app/data.
DEFAULT_SERVICE_USERS_FILE = "/app/data/service_users.json"
SERVICE_USERS_FILE = Path(os.environ.get("AUTOLAB_SERVICE_USERS_FILE", DEFAULT_SERVICE_USERS_FILE))


def load_service_credentials() -> dict | None:
    """Read the backend-provisioned service-user credentials, if present.

    This file only exists inside the autolab-api pod - it lets autolab-cli
    authenticate itself with zero setup when invoked from inside the
    container, without requiring `autolab login`.
    """
    if not SERVICE_USERS_FILE.exists():
        return None
    try:
        data = json.loads(SERVICE_USERS_FILE.read_text())
    except (ValueError, OSError):
        return None
    users = data.get("service_users") or []
    return users[0] if users else None
