use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct CarModel {
    pub brand: String,
    pub model: String
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CarBodyPart {
    pub brand: String,
    pub model: String
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Estimation {
    pub total: i32,
    pub sections: Option<Vec<String>>
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalculationData {
    pub model: Option<CarModel>,
    pub year: String,
    pub body_type: String,
    pub car_class: String,
    pub color: String,
    pub paint_type: String,
    pub body_parts: Option<Vec<CarBodyPart>>,
    pub timestamp: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub saved_file_name: Option<String>
}