# Load Testing

Async Python load tester for the carpaintr backend. Measures throughput and latency
across all major endpoint categories, generates a PNG chart, and prints a per-endpoint
breakdown table.

## Requirements

- Python 3.11+
- [pdm](https://pdm-project.org/)  - `pip install pdm`

## Setup

```bash
cd load_testing
pdm install
```

## Running

```bash
# Quickstart - steady mode against local backend (uses pdm venv)
pdm run loadtest

# Or run the script with pdm venv
pdm run python loadtest.py
```

### Targeting a server

```bash
# Bare hostname  - HTTPS assumed
python loadtest.py --server myserver.com

# Hostname with port
python loadtest.py --server myserver.com:8443

# Full URL (useful behind a reverse proxy with a custom path)
python loadtest.py --server https://myserver.com

# Full base-url override (local dev, custom port)
python loadtest.py --base-url http://localhost:9090/api/v1
```

`--server` takes precedence over `--base-url`. The resolved target URL is printed at startup.

### All options

| Flag               | Default                        | Description                                     |
| ------------------ | ------------------------------ | ----------------------------------------------- |
| `--mode`           | `steady`                       | `steady` or `full`  - see Modes below           |
| `--server`         | -                              | Target host/URL (HTTPS). Overrides `--base-url` |
| `--base-url`       | `http://localhost:8080/api/v1` | Full API base URL                               |
| `--duration`       | `30`                           | Test duration in seconds                        |
| `--concurrency`    | `20`                           | Number of concurrent async workers              |
| `--rps`            | `50`                           | Target requests per second per worker           |
| `--seed-users`     | `20`                           | Users pre-registered before the timed run       |
| `--admin-email`    | `test_admin@example.com`       | Admin account for license generation            |
| `--admin-password` | `adminpassword123`             | Admin password                                  |

## Modes

### `steady` (default)

Best for measuring pure endpoint performance without auth noise.

1. Pre-registers `--seed-users` accounts and generates licenses for them
2. All `--concurrency` workers hammer protected + light endpoints with random tokens
3. No registrations or logins during the timed window

Use this to benchmark cache efficiency, T2 processing, and file-serving latency.

### `full`

Simulates a mixed real-world load: concurrent signups, logins, and business requests.

Concurrency split: `1/4` register workers, `1/4` login workers, `1/2` protected-endpoint workers.

Use this to stress-test auth throughput and observe bcrypt contention.

## Endpoint categories

**Heavy (license-protected)**  - filesystem-backed, cached after first access:
- `GET /user/carmakes`
- `GET /user/list_class_body_types`
- `GET /user/global/colors.json`
- `GET /user/global/quality.yaml`
- `GET /user/processors_bundle`
- `GET /user/all_parts` / `all_parts_t2`
- `GET /user/carparts/{class}/{body}`  - 7 class/body combos
- `GET /user/carparts_t2/{class}/{body}`  - same combos, heavier (CSV filtering + T2 parsing)

**Light (auth-only)**  - DB lookups, no license required:
- `GET /getactivelicense`
- `GET /getcompanyinfo`
- `GET /mylicenses`
- `GET /editor/list_user_files`

## Output

- Console: summary table (total, throughput, p50/p90/p99/max) + per-endpoint breakdown
- `load_test_results_{mode}.png`  - 4-panel chart:
  - Response times scatter over time
  - Throughput per second by category
  - Latency distribution histogram
  - Rolling p50/p90/p99 percentiles

## Test phases

```
Phase 1  Health check  - abort if backend unreachable
Phase 2  Seed: register users → login → collect tokens → generate licenses (admin)
Phase 3  Timed load run (collector reset here  - only phase 3 data is reported)
Phase 4  Print report + save PNG
```

## File structure

```
load_testing/
├── loadtest.py       - Main entry point, CLI, orchestrator
├── workloads.py      - Async worker loops (register, login, protected requests)
├── endpoints.py      - Endpoint lists (heavy, light, carparts variations)
├── utils.py          - ResultCollector, timed_request, random helpers
├── reporting.py      - print_report(), plot_results()
├── pyproject.toml    - Dependencies (aiohttp, matplotlib, numpy)
└── RESULTS.md        - Benchmark results history
```

## Known behaviour

- **bcrypt bottleneck in full mode.** Register and login use bcrypt (~255ms/op). In `full`
  mode these CPU-bound operations compete with async handlers on the Tokio thread pool,
  raising latency on all endpoints (even trivial ones jump from <1ms to ~40ms).
- **Cache warm-up.** The first 1–2 seconds of steady mode are slower; percentiles stabilise
  once each file has been loaded once per user.
- **Seed phase excluded from results.** The collector is reset after seeding, so
  registration and login latency during setup do not inflate the benchmark numbers.
