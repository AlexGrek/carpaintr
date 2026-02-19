# Load Test Results — February 2026

**Backend:** Rust/Axum, release build, single instance on macOS (Apple Silicon)
**Test tool:** Custom async Python script (aiohttp, 20 concurrent workers, 30s duration, 50 seed users)

## Summary

| Metric               | Steady (no auth) | Full (with reg/login) |
| -------------------- | ---------------- | --------------------- |
| Throughput           | 461 req/s        | 88 req/s              |
| p50 latency          | 6.1 ms           | 231 ms                |
| p90 latency          | 69 ms            | 362 ms                |
| p99 latency          | 105 ms           | 516 ms                |
| Error rate           | 0%               | 0%                    |
| Total requests (30s) | 13,849           | 2,678                 |

## Endpoint Breakdown (Steady Mode)

### Fast tier (sub-1ms p50)
- `get_active_license` — 0.3 ms
- `carmakes`, `carparts/*`, `colors.json` — 0.5-0.8 ms
- `get_company_info`, `list_user_files`, `my_licenses` — 0.5-0.7 ms

These are either simple DB lookups or filesystem results that get cached after first access.

### Medium tier (30-70ms p50)
- `carparts_t2/B/*`, `carparts_t2/C/*` — 34-39 ms
- `carparts_t2/D/*`, `carparts_t2/E/*` — 64 ms
- `all_parts_t2` — 70 ms

T2 endpoints involve CSV parsing and filtering. The variation between body types suggests different dataset sizes per class.

### Observations

1. **Bcrypt is the bottleneck.** Register and login use bcrypt password hashing, which is CPU-intensive by design (~255ms per operation). In full mode, these operations starve the Tokio runtime — even trivial endpoints like `get_active_license` jump from 0.3ms to 43ms because bcrypt blocks worker threads.

2. **Per-user caching matters.** With 20 seed users the steady throughput was 880 req/s; with 50 users it dropped to 461 req/s. The filesystem-backed endpoints cache results per user, so more distinct users means more cache misses and more disk I/O.

3. **T2 processing is the heaviest business logic.** `all_parts_t2` and `carparts_t2/*` are consistently the slowest non-auth endpoints. They parse CSV files, filter rows, and build response structures — visible as the upper band in the scatter plot.

4. **Zero errors under load.** Both modes completed 30s runs with 0% error rate. The backend handles backpressure gracefully — latency increases but nothing fails.

5. **Stable throughput over time.** The rolling percentile charts show flat lines (no degradation), meaning there are no memory leaks or resource exhaustion within the test window. The cache warms up in the first 1-2 seconds and stays effective.

## Potential Improvements

- **Offload bcrypt to a blocking thread pool** (e.g., `tokio::task::spawn_blocking`). This would prevent auth operations from starving async request handlers. Could recover most of the 5x throughput gap between steady and full modes.
- **Increase T2 cache TTL or make it global** instead of per-user, if the data is the same across users. The carparts/T2 data doesn't seem user-specific. But actually it is, so this is not the best solution.
- **Consider argon2id** as a bcrypt alternative — it's memory-hard (better security) and can be tuned for lower latency on modern hardware.
