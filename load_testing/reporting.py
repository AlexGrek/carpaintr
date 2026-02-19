"""
Load test reporting: console summary and matplotlib plots.
"""

import numpy as np

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

from utils import ResultCollector


def print_report(collector: ResultCollector) -> None:
    """Print aggregate stats and per-endpoint breakdown to stdout."""
    records = collector.records
    if not records:
        print("\nNo requests recorded.")
        return

    total = len(records)
    errors = sum(1 for r in records if r.status == 0 or r.status >= 500)
    latencies = [r.latency_ms for r in records]
    duration = max(r.timestamp for r in records)

    print(f"\n{'='*60}")
    print(f"  LOAD TEST RESULTS")
    print(f"{'='*60}")
    print(f"  Total requests:   {total}")
    print(f"  Duration:         {duration:.1f}s")
    print(f"  Throughput:       {total / max(duration, 0.1):.1f} req/s")
    print(f"  Errors (5xx/net): {errors} ({100 * errors / total:.1f}%)")
    print(f"  Latency p50:      {np.percentile(latencies, 50):.1f} ms")
    print(f"  Latency p90:      {np.percentile(latencies, 90):.1f} ms")
    print(f"  Latency p99:      {np.percentile(latencies, 99):.1f} ms")
    print(f"  Latency max:      {max(latencies):.1f} ms")

    endpoints = sorted(set(r.endpoint for r in records))
    print(f"\n  {'Endpoint':<30} {'Count':>7} {'p50':>8} {'p90':>8} {'p99':>8} {'Err%':>7}")
    print(f"  {'-'*30} {'-'*7} {'-'*8} {'-'*8} {'-'*8} {'-'*7}")
    for ep in endpoints:
        ep_records = [r for r in records if r.endpoint == ep]
        ep_lat = [r.latency_ms for r in ep_records]
        ep_err = sum(1 for r in ep_records if r.status == 0 or r.status >= 500)
        err_pct = 100 * ep_err / len(ep_records) if ep_records else 0
        print(
            f"  {ep:<30} {len(ep_records):>7} "
            f"{np.percentile(ep_lat, 50):>7.1f} "
            f"{np.percentile(ep_lat, 90):>7.1f} "
            f"{np.percentile(ep_lat, 99):>7.1f} "
            f"{err_pct:>6.1f}%"
        )
    print()


def plot_results(collector: ResultCollector, args) -> None:
    """Generate 2x2 matplotlib figure and save to load_test_results_{mode}.png."""
    if not HAS_MATPLOTLIB:
        print("[*] matplotlib not installed, skipping plot.")
        return

    records = collector.records
    if not records:
        return

    seed_labels = {"register (seed)", "login (seed)", "register (admin)",
                   "login (admin)", "admin_license_gen"}
    load_records = [r for r in records if r.endpoint not in seed_labels]
    if not load_records:
        load_records = records

    fig, axes = plt.subplots(2, 2, figsize=(18, 11))
    fig.suptitle(
        f"Load Test Results [{args.mode}] - {args.duration}s, concurrency={args.concurrency}",
        fontsize=14, fontweight="bold",
    )

    endpoints = sorted(set(r.endpoint for r in load_records))
    cmap = matplotlib.colormaps.get_cmap("tab20").resampled(max(len(endpoints), 1))
    colors = {ep: cmap(i) for i, ep in enumerate(endpoints)}

    # --- Plot 1: Response times scatter ---
    ax1 = axes[0, 0]
    for ep in endpoints:
        ep_recs = [r for r in load_records if r.endpoint == ep]
        ax1.scatter(
            [r.timestamp for r in ep_recs],
            [r.latency_ms for r in ep_recs],
            c=[colors[ep]], label=ep, alpha=0.4, s=8,
        )
    ax1.set_xlabel("Time (s)")
    ax1.set_ylabel("Latency (ms)")
    ax1.set_title("Response Times Over Time")
    ax1.legend(fontsize=7, loc="upper right")
    ax1.grid(True, alpha=0.3)

    # --- Plot 2: Throughput over time (1s buckets, grouped by category) ---
    ax2 = axes[0, 1]
    if load_records:
        max_t = max(r.timestamp for r in load_records)
        bucket_size = 1.0
        buckets = np.arange(0, max_t + bucket_size, bucket_size)

        categories = {
            "carparts/*": lambda ep: ep.startswith("carparts/"),
            "carparts_t2/*": lambda ep: ep.startswith("carparts_t2/"),
            "heavy (other)": lambda ep: ep in {
                "carmakes", "list_class_body", "colors.json", "quality.yaml",
                "processors_bundle", "all_parts_t2", "all_parts",
            },
            "light (auth-only)": lambda ep: ep in {
                "get_active_license", "get_company_info", "my_licenses",
                "list_user_files",
            },
            "register": lambda ep: ep == "register",
            "login": lambda ep: ep == "login",
        }
        cat_colors = ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#a65628"]
        for (cat_name, matcher), cat_color in zip(categories.items(), cat_colors):
            cat_times = [r.timestamp for r in load_records if matcher(r.endpoint)]
            if not cat_times:
                continue
            counts, _ = np.histogram(cat_times, bins=buckets)
            ax2.plot(
                buckets[:-1] + bucket_size / 2, counts / bucket_size,
                label=cat_name, color=cat_color, alpha=0.8, linewidth=1.5,
            )
        all_times = [r.timestamp for r in load_records]
        counts, _ = np.histogram(all_times, bins=buckets)
        ax2.plot(
            buckets[:-1] + bucket_size / 2, counts / bucket_size,
            label="TOTAL", color="black", alpha=0.6, linewidth=2, linestyle="--",
        )
    ax2.set_xlabel("Time (s)")
    ax2.set_ylabel("Requests/sec")
    ax2.set_title("Throughput Over Time (by category)")
    ax2.legend(fontsize=8, loc="upper right")
    ax2.grid(True, alpha=0.3)

    # --- Plot 3: Latency distribution (histogram) ---
    ax3 = axes[1, 0]
    for ep in endpoints:
        ep_lat = [r.latency_ms for r in load_records if r.endpoint == ep]
        if ep_lat:
            ax3.hist(
                ep_lat, bins=50, alpha=0.5, label=ep, color=colors[ep],
            )
    ax3.set_xlabel("Latency (ms)")
    ax3.set_ylabel("Count")
    ax3.set_title("Latency Distribution")
    ax3.legend(fontsize=7, loc="upper right")
    ax3.grid(True, alpha=0.3)

    # --- Plot 4: Rolling p50/p90/p99 ---
    ax4 = axes[1, 1]
    if load_records:
        sorted_recs = sorted(load_records, key=lambda r: r.timestamp)
        window = max(len(sorted_recs) // 50, 10)
        times, p50s, p90s, p99s = [], [], [], []
        for i in range(0, len(sorted_recs) - window, window // 2):
            chunk = sorted_recs[i : i + window]
            lats = [r.latency_ms for r in chunk]
            times.append(np.mean([r.timestamp for r in chunk]))
            p50s.append(np.percentile(lats, 50))
            p90s.append(np.percentile(lats, 90))
            p99s.append(np.percentile(lats, 99))
        ax4.plot(times, p50s, label="p50", linewidth=2)
        ax4.plot(times, p90s, label="p90", linewidth=2)
        ax4.plot(times, p99s, label="p99", linewidth=2)
    ax4.set_xlabel("Time (s)")
    ax4.set_ylabel("Latency (ms)")
    ax4.set_title("Rolling Percentiles")
    ax4.legend(fontsize=9)
    ax4.grid(True, alpha=0.3)

    plt.tight_layout()
    out_path = f"load_test_results_{args.mode}.png"
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    print(f"[*] Response times graph saved to: {out_path}")
    plt.close()
