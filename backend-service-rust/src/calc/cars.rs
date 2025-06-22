use serde::{Deserialize, Serialize};
use serde_yaml;
use std::collections::HashMap;
use std::error::Error;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use csv::ReaderBuilder;

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


// NAME MAPPING
pub fn body_type_into_t1_entry(s: &str) -> String {
    match s {
        "wagon" => "УНИВЕРСАЛ".into(),
        "pickup" => "ПИКАП".into(),
        "sedan" => "СЕДАН".into(),
        "liftback" => "ЛИФТБЭК 5 дверей".into(),
        "hatchback 5 doors" => "ХЕТЧБЕК 5 дверей".into(),
        "hatchback 3 doors" => "ХЕТЧБЕК 3 двери".into(),
        "suv 3 doors" => "ВНЕДОРОЖНИК 3 дверный".into(),
        "suv 5 doors" => "ВНЕДОРОЖНИК 5 дверный".into(),
        "coupe" => "КУПЕ".into(),
        x => x.into(),
    }
}

pub fn t1_entry_into_body_type(s: &str) -> String {
    match s {
        "УНИВЕРСАЛ" => "wagon".into(),
        "ПИКАП" => "pickup".into(),
        "СЕДАН" => "sedan".into(),
        "ЛИФТБЭК 5 дверей" => "liftback".into(),
        "ХЕТЧБЕК 5 дверей" => "hatchback 5 doors".into(),
        "ХЕТЧБЕК 3 двери" => "hatchback 3 doors".into(),
        "ВНЕДОРОЖНИК 3 дверный" => "suv 3 doors".into(),
        "ВНЕДОРОЖНИК 5 дверный" => "suv 5 doors".into(),
        "КУПЕ" => "coupe".into(),
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
    pub detail_rus: String,
    
    #[serde(rename = "Список деталь eng")]
    pub detail_eng: String,

    #[serde(rename = "Список деталь укр")]
    pub detail_ukr: String,
    
    // #[serde(rename = "порядок печати")]
    // pub print_order: String,
    
    // #[serde(rename = "съемная несъемная")]
    // pub removable: String,
    
    // #[serde(rename = "красится наружно  или 2 стороны")]
    // pub paint_type: String,
    
    // #[serde(rename = "с чего сделан")]
    // pub material: String,
    
    // #[serde(rename = "Ремонт з зовнішнім фарбуванням")]
    // pub repair_external_paint: String,
    
    // #[serde(rename = "Ремонт з фарбуваням 2 сторони")]
    // pub repair_two_side_paint: String,
    
    // #[serde(rename = "Ремонт без фарбування")]
    // pub repair_no_paint: String,
    
    // #[serde(rename = "Заміна  оригінал деталь з фарбуванням")]
    // pub replace_original_with_paint: String,
    
    // #[serde(rename = "Заміна Не оригінал деталь з фарбуванням")]
    // pub replace_non_original_with_paint: String,
    
    // #[serde(rename = "Полірування")]
    // pub polishing: String,
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
