use serde::{Deserialize, Serialize};
use serde_yaml;
use std::collections::HashMap;
use std::error::Error;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

// Define the structure to represent car data
// This handles the fields we care about (estimated_price, body, is_suv)
// while ignoring other fields
#[derive(Debug, Deserialize, Serialize)]
pub struct CarData {
    body: Vec<String>,
    #[serde(default)]
    is_suv: bool,
    estimated_price: u32,
    // Other fields will be ignored
}

// Function to parse the YAML file
pub fn parse_car_yaml<P: AsRef<Path>>(path: P) -> Result<HashMap<String, CarData>, Box<dyn Error>> {
    // Open the file
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    
    // Parse the YAML into our HashMap
    let car_data: HashMap<String, CarData> = serde_yaml::from_reader(reader)?;
    
    Ok(car_data)
}