import sys
import csv
import yaml

def yaml_to_binary_csv(input_yaml, output_csv):
    # Load YAML
    with open(input_yaml, encoding='utf-8') as f:
        data = yaml.safe_load(f)

    # Collect all unique options
    all_options = sorted({opt for opts in data.values() for opt in opts})

    # Write binary matrix
    with open(output_csv, "w", newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        # Header: first column is the key, then all options
        writer.writerow(["item"] + all_options)

        for key, opts in data.items():
            row = [key]
            for option in all_options:
                row.append("1" if option in opts else "0")
            writer.writerow(row)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py input.yaml output.csv")
        sys.exit(1)

    input_yaml = sys.argv[1]
    output_csv = sys.argv[2]

    yaml_to_binary_csv(input_yaml, output_csv)
