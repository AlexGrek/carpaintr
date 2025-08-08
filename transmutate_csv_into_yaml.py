import sys
import csv
import yaml
from collections import defaultdict

# usage: python3 transmutate_csv_into_yaml.py tdvr.csv Деталь "Вид ремонта" > data/common/global/parts_repair_types.yaml

def clean(value):
    return str(value).strip()

def csv_to_yaml(input_file, key_column, duplicated_column):
    with open(input_file, newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)

        # Find all indices of the key column and duplicated column
        key_indices = [i for i, col in enumerate(header) if col == key_column]
        dup_indices = [i for i, col in enumerate(header) if col == duplicated_column]

        if not key_indices:
            raise ValueError(f"Key column '{key_column}' not found.")
        if not dup_indices:
            raise ValueError(f"Duplicated column '{duplicated_column}' not found.")

        key_index = key_indices[0]  # assume key column appears only once

        result = {}

        for row in reader:
            if key_index >= len(row):
                continue
            key = clean(row[key_index])
            items = [clean(row[i]) for i in dup_indices if i < len(row)]
            # Filter out empty strings
            items = [item for item in items if item]
            if items:
                result[key] = items

        print(yaml.dump(result, allow_unicode=True, sort_keys=False))

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python script.py input.csv key_column duplicated_column")
        sys.exit(1)

    input_csv = sys.argv[1]
    key_col = sys.argv[2]
    dup_col = sys.argv[3]

    csv_to_yaml(input_csv, key_col, dup_col)
