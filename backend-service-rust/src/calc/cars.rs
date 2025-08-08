use serde::{Deserialize, Serialize};
use serde_yaml;
use std::collections::HashMap;
use std::error::Error;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use csv::ReaderBuilder;
use crate::calc::constants::*; 

// Define the structure to represent car data
// This handles the fields we care about (estimated_price, body, is_suv)
// while ignoring other fields
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct CarData {
    body: Vec<String>,
    #[serde(default)]
    is_suv: bool,
    estimated_price: u32,
    euro_class: String,
    euro_body_types: Vec<String>
}


pub fn parse_car_yaml<P: AsRef<Path>>(path: P) -> Result<HashMap<String, CarData>, Box<dyn Error>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);    
    let car_data: HashMap<String, CarData> = serde_yaml::from_reader(reader)?;
    
    Ok(car_data)
}


pub fn body_type_into_t1_entry(s: &str) -> String {
    match s {
        BODY_TYPE_WAGON => T1_ENTRY_WAGON.into(),
        BODY_TYPE_PICKUP => T1_ENTRY_PICKUP.into(),
        BODY_TYPE_SEDAN => T1_ENTRY_SEDAN.into(),
        BODY_TYPE_LIFTBACK => T1_ENTRY_LIFTBACK.into(),
        BODY_TYPE_HATCHBACK_5_DOORS => T1_ENTRY_HATCHBACK_5_DOORS.into(),
        BODY_TYPE_HATCHBACK_3_DOORS => T1_ENTRY_HATCHBACK_3_DOORS.into(),
        BODY_TYPE_SUV_3_DOORS => T1_ENTRY_SUV_3_DOORS.into(),
        BODY_TYPE_SUV_5_DOORS => T1_ENTRY_SUV_5_DOORS.into(),
        BODY_TYPE_COUPE => T1_ENTRY_COUPE.into(),
        x => x.into(),
    }
}

pub fn t1_entry_into_body_type(s: &str) -> String {
    match s {
        T1_ENTRY_WAGON => BODY_TYPE_WAGON.into(),
        T1_ENTRY_PICKUP => BODY_TYPE_PICKUP.into(),
        T1_ENTRY_SEDAN => BODY_TYPE_SEDAN.into(),
        T1_ENTRY_LIFTBACK => BODY_TYPE_LIFTBACK.into(),
        T1_ENTRY_HATCHBACK_5_DOORS => BODY_TYPE_HATCHBACK_5_DOORS.into(),
        T1_ENTRY_HATCHBACK_3_DOORS => BODY_TYPE_HATCHBACK_3_DOORS.into(),
        T1_ENTRY_SUV_3_DOORS => BODY_TYPE_SUV_3_DOORS.into(),
        T1_ENTRY_SUV_5_DOORS => BODY_TYPE_SUV_5_DOORS.into(),
        T1_ENTRY_COUPE => BODY_TYPE_COUPE.into(),
        x => x.into(),
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CarPart {
    #[serde(rename = "Список Класс")]
    pub class: String,
    
    #[serde(rename = "Список Тип")]
    pub type_field: String,
    
    #[serde(rename = "Список деталь рус")]
    #[serde(default)]
    pub detail_rus: String,
    
    #[serde(rename = "Список деталь eng")]
    #[serde(default)]
    pub detail_eng: String,

    #[serde(rename = "Список деталь укр")]
    #[serde(default)]
    pub detail_ukr: String,
}

pub fn parse_csv_t1<P: AsRef<Path>>(path: P) -> Result<Vec<CarPart>, Box<dyn Error>> {
    let file = File::open(path)?;
    let mut rdr = ReaderBuilder::new()
        .has_headers(true)
        .from_reader(file);

    let mut records = Vec::new();
    for result in rdr.deserialize() {
        let record: CarPart = result?;
        records.push(record);
    }

    Ok(records)
}
