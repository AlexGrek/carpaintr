use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct CarModel {
    brand: String,
    model: String
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CarBodyPart {
    brand: String,
    model: String
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Estimation {
    total: i32,
    sections: Option<Vec<String>>
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CalculationData {
    model: Option<CarModel>,
    year: String,
    body_type: String,
    car_class: String,
    color: String,
    paint_type: String,
    body_parts: Option<Vec<CarBodyPart>>,
    timestamp: DateTime<Utc>
}