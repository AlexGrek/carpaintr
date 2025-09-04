import csv

# Define the input and output file paths.
# The input file is the one you uploaded.
INPUT_FILE = "repairs_input.csv"
# The output file will contain the new, reorganized data.
OUTPUT_FILE = "repair_types.csv"

def reorganize_repair_data(input_file, output_file):
    """
    Reads a CSV file, rearranges the data into two columns,
    and writes the result to a new CSV file.

    Args:
        input_file (str): The path to the source CSV file.
        output_file (str): The path where the new CSV file will be saved.
    """
    try:
        with open(input_file, 'r', newline='', encoding='utf-8') as infile, \
             open(output_file, 'w', newline='', encoding='utf-8') as outfile:

            reader = csv.reader(infile)
            writer = csv.writer(outfile)

            # Read the header row from the input file
            header = next(reader)

            # Write the new header to the output file
            new_header = ["Detail Name", "Repair Types"]
            writer.writerow(new_header)

            # Process each row in the input file
            for row in reader:
                # The first column is the detail name
                detail_name = row[0]

                # The repair types start from the second column
                # We filter out any empty strings from the list of repair types
                repair_types_list = [repair.strip() for repair in row[1:] if repair.strip()]

                # Join the non-empty repair types with a semicolon
                combined_repairs = " / ".join(repair_types_list)

                # Write the new row to the output file
                writer.writerow([detail_name, combined_repairs])

        print(f"Successfully reorganized data from '{input_file}' to '{output_file}'.")

    except FileNotFoundError:
        print(f"Error: The file '{input_file}' was not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

# Run the function
reorganize_repair_data(INPUT_FILE, OUTPUT_FILE)
