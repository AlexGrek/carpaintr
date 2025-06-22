import csv
import io

def process_car_parts_csv(csv_content):
    """
    Reads CSV content, corrects Russian car part names, and adds
    Ukrainian and English translations.

    Args:
        csv_content (str): The raw content of the CSV file as a string.

    Returns:
        str: The processed CSV content as a string with updated translations.
    """

    # Define the mapping for car parts:
    # Key: Original Russian name (as found in the CSV, including typos)
    # Value: (Corrected Russian, Ukrainian, English)
    part_translations = {
        "Бампер задний": ("Бампер задний", "Бампер задній", "Rear Bumper"),
        "Бампер передний": ("Бампер передний", "Бампер передній", "Front Bumper"),
        "Дверь левая": ("Дверь левая", "Двері ліва", "Left Door"),
        "Дверь правая": ("Дверь правая", "Двері права", "Right Door"),
        "Капот": ("Капот", "Капот", "Hood"),
        "Крыло заднее левое": ("Крыло заднее левое", "Крило заднє ліве", "Rear Left Fender"),
        "Крыло заднее правое": ("Крыло заднее правое", "Крило заднє праве", "Rear Right Fender"),
        "Крыло переднее левое": ("Крыло переднее левое", "Крило переднє ліве", "Front Left Fender"),
        "Крыло переднее правое": ("Крыло переднее правое", "Крило переднє праве", "Front Right Fender"),
        "Крыша": ("Крыша", "Дах", "Roof"),
        "Крыша ": ("Крыша", "Дах", "Roof"), # Handle typo with extra space
        "Крышка багажника": ("Крышка багажника", "Кришка багажника", "Trunk Lid"),
        "Дверь пердняя левая": ("Дверь передняя левая", "Двері передні ліва", "Front Left Door"), # Correct typo
        "Дверь пердняя правая": ("Дверь передняя правая", "Двері передні права", "Front Right Door"), # Correct typo
        "Дверь задняя левая": ("Дверь задняя левая", "Двері задні ліва", "Rear Left Door"),
        "Дверь задняя правая": ("Дверь задняя правая", "Двері задні права", "Rear Right Door"),
        "Боковина леавая": ("Боковина левая", "Боковина ліва", "Left Side Panel"), # Correct typo
        "Боковина правая": ("Боковина правая", "Боковина права", "Right Side Panel"),
    }

    # Use StringIO to treat the string content as a file
    input_file = io.StringIO(csv_content)
    output_file = io.StringIO()

    # Create CSV reader and writer objects
    reader = csv.reader(input_file)
    writer = csv.writer(output_file)

    header = next(reader) # Read the header row

    # Find the indices of the columns we need to modify
    try:
        ru_index = header.index("Список деталь рус")
        ua_index = header.index("Список деталь укр")
        eng_index = header.index("Список деталь eng")
    except ValueError as e:
        print(f"Error: Missing expected column in CSV header: {e}")
        # If columns are missing, add them to the header
        if "Список деталь рус" not in header:
            print("Adding 'Список деталь рус' column.")
            header.insert(2, "Список деталь рус")
            ru_index = 2
        if "Список деталь укр" not in header:
            print("Adding 'Список деталь укр' column.")
            header.insert(3, "Список деталь укр")
            ua_index = 3
        if "Список деталь eng" not in header:
            print("Adding 'Список деталь eng' column.")
            header.insert(4, "Список деталь eng")
            eng_index = 4
        # Re-evaluate indices after potential insertion
        ru_index = header.index("Список деталь рус")
        ua_index = header.index("Список деталь укр")
        eng_index = header.index("Список деталь eng")


    writer.writerow(header) # Write the modified header to the output

    for row in reader:
        # Ensure the row has enough columns; extend with empty strings if necessary
        while len(row) <= max(ru_index, ua_index, eng_index):
            row.append("")

        original_ru_name = row[ru_index].strip() # Get and strip whitespace

        if original_ru_name in part_translations:
            corrected_ru, ua_translation, eng_translation = part_translations[original_ru_name]
            row[ru_index] = corrected_ru # Fix Russian name
            row[ua_index] = ua_translation # Add Ukrainian translation
            row[eng_index] = eng_translation # Add English translation
        else:
            # If a part name is not in the dictionary, print a warning
            # and leave the row as is for that part, but fill empty translation cells
            if not row[ua_index]:
                row[ua_index] = "N/A" # Indicate missing translation
            if not row[eng_index]:
                row[eng_index] = "N/A" # Indicate missing translation
            print(f"Warning: No translation found for '{original_ru_name}'. Leaving as is.")

        writer.writerow(row)

    return output_file.getvalue()

