# autolab-cli

A small [uv](https://docs.astral.sh/uv/)-managed [Click](https://click.palletsprojects.com/) CLI for administering the carpaintr/Autolab backend API (`backend-service-rust/`) — user and license management, plus a quick debug command. It talks to the real `/api/v1` REST surface documented in [`docs/api.md`](../docs/api.md); it doesn't invent any endpoints the backend doesn't have.

It ships two ways:
- **From a workstation** — `uv run autolab ...` against any environment (local dev, `autolab-dev`, staging, prod), authenticated via `autolab login`.
- **Baked into the `autolab-api` Docker image** as a precompiled, self-contained binary at `/usr/local/bin/autolab` — no `uv`/Python install needed inside the pod, and no login step either (see [Running inside the pod](#running-inside-the-pod-zero-config-auth) below).

## Install / run

```bash
cd autolab-cli
uv sync
uv run autolab --help
```

Or install it as a regular console script (`pip install -e .` / `uv tool install .`), which exposes `autolab` directly.

## Authentication

```bash
autolab login admin@admin.com              # prompts for password (hidden input)
autolab login admin@admin.com -p admin123  # non-interactive
```

The resulting JWT is stored in `~/.autolab-cli.yaml` (`0600` permissions) along with the `base_url` used at login time, so subsequent commands don't need `--base-url` again. Override the config file location with `AUTOLAB_CLI_CONFIG` (useful for testing against multiple environments without clobbering your real login).

Every command other than `login` requires a token — either from `~/.autolab-cli.yaml`, or, when running inside the `autolab-api` pod, from the auto-provisioned service user (see below).

**Note:** `--base-url` and the output-format flags (`--json`/`--table`/`--yaml`) are options on the root `autolab` command, not on subcommands — they must come *before* the subcommand name:

```bash
autolab --base-url https://autolab-dev.example.com login admin@admin.com -p admin123
```

## Output modes

Every command prints through the same formatter:

- `--json` — pretty-printed JSON
- `--table` — tabulated (via `tabulate`)
- `--yaml` — YAML
- *(no flag)* — table for list results, YAML for single-item results

```bash
autolab get users                 # table (list of users)
autolab get user admin@admin.com  # YAML (single object)
autolab --json get user admin@admin.com
```

## Commands

```bash
autolab get users                              # list all registered users
autolab get user <email>                       # one user + license summary (exists, active_license, ...)

autolab license <email> list                    # that user's licenses, each with active/expired status
autolab license <email> issue <days> [level]    # issue a new license (level defaults to "Basic")
autolab license <email> get <license_id>        # decoded status of one license file
autolab license <email> revoke <license_id>     # delete a license file
autolab license <email> extend <license_id> <days>   # push expiry back by N days (reissue + delete old)
autolab license <email> upgrade <license_id> <level> # change level, keep expiry (reissue + delete old)

autolab create user <email> <password>          # register a new account (admin bulk-create endpoint)

autolab check <email>                           # debug: existence + license status + files in owned dir
```

Notes on how these map to the backend:

- The backend has **no in-place license mutation endpoint** — only generate (`/admin/license/generate`), list, get, and delete. So `license extend` and `license upgrade` work by generating a replacement license (with the adjusted expiry or level) and then deleting the old file. `license issue` diffs the file list before/after `generate` to report back the new license's id.
- `get user` / `check` decode each license JWT's payload locally (base64, **not signature-verified**) purely to compute/display active-vs-expired and expiry — this is safe because it's only reachable through already-authenticated admin API calls, never used for a trust decision.
- `check <email>` lists files in the user's owned directory by pulling `/admin/export_user_data/<email>` (a ZIP) and reading its member names in memory — no disk writes.
- `create user` uses the admin bulk-create endpoint (`/admin/users/bulk`), not the public `/register`, and reports whether the account was actually created or already existed.

## Running inside the pod (zero-config auth)

The `autolab-api` backend provisions a **service user** at startup: an admin-equivalent account that also bypasses license checks (see `backend-service-rust/src/auth/service_user.rs`). Its credentials (`{random}@user.service` + a large random password) are generated once and persisted to `{DATA_DIR_PATH}/service_users.json` — on the PVC, so they survive pod restarts.

`autolab-cli` looks for that file (default path `/app/data/service_users.json`, overridable via `AUTOLAB_SERVICE_USERS_FILE`) whenever there's no stored login, and auto-authenticates as the service user. In practice this means every command works inside the pod with zero setup:

```bash
kubectl exec -n autolab-dev autolab-dev-autolab-api-0 -- autolab get users
kubectl exec -n autolab-dev autolab-dev-autolab-api-0 -- autolab check someone@example.com
```

The service-user login is re-done on every invocation (nothing is persisted to disk for it), so it always reflects the current backend state and never writes to `~/.autolab-cli.yaml` inside the container.

## Building the standalone binary

The Docker image builds `autolab` with [PyInstaller](https://pyinstaller.org/) (`--onefile`), bundling the interpreter and all dependencies into a single executable — see the `autolab-cli-builder` stage in the root `Dockerfile`. To build it locally:

```bash
cd autolab-cli
python3 -m venv /tmp/autolab-build-venv
/tmp/autolab-build-venv/bin/pip install . pyinstaller
/tmp/autolab-build-venv/bin/pyinstaller --onefile --name autolab run_autolab.py
./dist/autolab --help
```

On Debian/Ubuntu this requires `python3-dev` (or another package providing `libpython3.*.so`) — PyInstaller needs the Python *shared* library to embed the interpreter, which plain `python3`/`python3-venv` don't include.

## Project layout

```
autolab-cli/
├── pyproject.toml                  # uv project; console script `autolab`
├── run_autolab.py                  # PyInstaller entry point (thin wrapper around cli.main)
└── src/autolab_cli/
    ├── cli.py                      # root Click group, auth resolution (config file / service user)
    ├── client.py                   # ApiClient - thin requests wrapper over /api/v1
    ├── config.py                   # ~/.autolab-cli.yaml load/save
    ├── service_auth.py             # in-pod service-user credential lookup
    ├── jwtutil.py                  # unverified JWT claim decoding, for display only
    ├── output.py                   # --json/--table/--yaml formatting
    └── commands/                   # login, get, license, create, check
```
