use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CarCalcData {
    pub car: Car,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub calculations: Option<Value>,
    #[serde(flatten)]
    pub additional_fields: HashMap<String, Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Car {
    pub make: Option<String>,
    pub model: Option<String>,
    pub year: String,
    pub car_class: String,
    pub body_type: String,
    pub license_plate: Option<String>,
    pub vin: Option<String>,
    pub notes: Option<String>,
    pub store_file_name: Option<String>,
}

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
    pub saved_file_name: Option<String>,
    pub vin: Option<String>,
    pub license_plate: Option<String>
}
