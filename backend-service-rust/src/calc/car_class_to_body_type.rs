// main.rs
use std::collections::{HashMap, HashSet};
use std::fs;
use std::error::Error;
use std::path::{Path, PathBuf};
use serde::Serialize;

use crate::calc::cars::t1_entry_into_body_type;
use crate::errors::AppError;
use crate::exlogging::log_event;

pub const CLASS_TYPE_MAPPING_FILE: &str = "tables/class_body_mapping.yaml";


/// Reads a CSV file and creates a mapping from carClass to a list of unique bodyTypes.
pub fn read_csv_and_map<P: AsRef<Path>>(file_path: &P, catalog_root: &P) -> Result<HashMap<String, Vec<String>>, Box<dyn Error>> {
    let _path = crate::utils::safety_check_only(catalog_root, file_path)?;
    if !fs::exists(file_path).unwrap_or(false) {
        return Err(Box::new(AppError::FileNotFound));
    }
    let mut reader = csv::Reader::from_path(file_path)?;
    log_event(crate::exlogging::LogLevel::Debug, format!("Reader created, use path {:?}", PathBuf::from(file_path.as_ref()).to_string_lossy()), None::<String>);

    // Use a HashMap to store the carClass to HashSet mapping
    let mut mapping: HashMap<String, HashSet<String>> = HashMap::new();

    // Iterate over each record in the CSV file
    for result in reader.records() {
        let record = result?; // Get the record or propagate the error

        // Ensure there are at least two columns
        if record.len() < 2 {
            eprintln!("Skipping row due to insufficient columns: {:?}", record);
            continue;
        }

        let car_class = record[0].to_string(); // Get the carClass from the first column
        let body_type = record[1].to_string(); // Get the bodyType from the second column

        // Insert the bodyType into the HashSet associated with the carClass
        // If the carClass doesn't exist, a new HashSet is created
        mapping.entry(car_class).or_default().insert(t1_entry_into_body_type(&body_type));
    }

    // Convert the HashMap<String, HashSet<String>> to HashMap<String, Vec<String>>
    // by collecting elements from each HashSet into a Vec
    let final_mapping: HashMap<String, Vec<String>> = mapping
        .into_iter()
        .map(|(car_class, body_types_set)| {
            // Convert HashSet to Vec and sort for consistent output
            let mut body_types_vec: Vec<String> = body_types_set.into_iter().collect();
            body_types_vec.sort(); // Sort the body types alphabetically
            (car_class, body_types_vec)
        })
        .collect();

    Ok(final_mapping)
}

/// Serializes a given data structure to a YAML file.
///
/// # Arguments
/// * `data` - A reference to the data structure to be serialized. Must implement `Serialize`.
/// * `file_path` - The path to the output YAML file.
///
/// # Returns
/// A `Result` indicating success or an `Box<dyn Error>` on failure.
pub fn serialize_to_yaml<T: Serialize, P: AsRef<Path>>(data: &T, file_path: P) -> Result<(), Box<dyn Error>> {
    // Serialize the data to a YAML string
    let yaml_string = serde_yaml::to_string(data)?;

    // Write the YAML string to the specified file
    fs::write(file_path, yaml_string)?;

    Ok(())
}
