#!/usr/bin/env python3
"""
Fix trailing periods in ТИП КУЗОВА columns of t2.csv files.
'ХЕТЧБЕК 3 двери.' → 'ХЕТЧБЕК 3 двери'
"""
import csv
import io
import sys

T2_FILES = [
    "backend-service-rust/data/common/tables/t2.csv",
    "backend-service-rust/data/users/admin%40example%2Ecom/catalog/tables/t2.csv",
    "data/common/tables/t2.csv",
    "common/tables/t2.csv",
]

def fix_value(v):
    return v.rstrip(".")

def fix_file(path, dry_run=False):
    with open(path, newline="", encoding="utf-8") as f:
        content = f.read()

    reader = csv.DictReader(io.StringIO(content))
    fieldnames = reader.fieldnames
    body_cols = [c for c in fieldnames if "ТИП КУЗОВА" in c]

    rows = []
    changes = 0
    for row in reader:
        new_row = dict(row)
        for col in body_cols:
            old = new_row.get(col, "")
            new = fix_value(old)
            if old != new:
                new_row[col] = new
                changes += 1
        rows.append(new_row)

    if changes == 0:
        print(f"  {path}: already clean, skipped")
        return

    if dry_run:
        print(f"  {path}: would fix {changes} value(s)")
        return

    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)

    with open(path, "w", newline="", encoding="utf-8") as f:
        f.write(out.getvalue())

    print(f"  {path}: fixed {changes} value(s)")


if __name__ == "__main__":
    import os
    dry_run = "--dry-run" in sys.argv
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)

    print(f"{'DRY RUN: ' if dry_run else ''}Fixing t2.csv body type trailing periods...")
    for rel in T2_FILES:
        path = os.path.join(repo_root, rel)
        try:
            fix_file(path, dry_run=dry_run)
        except FileNotFoundError:
            print(f"  {path}: NOT FOUND, skipped")

    print("Done.")
