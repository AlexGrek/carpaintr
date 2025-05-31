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
    pub saved_file_name: Option<String>,
    pub vin: Option<String>,
    pub license_plate: Option<String>
}

impl CalculationData {
    pub fn digest(&self) -> String {
        let mut parts = Vec::new();
        
        if let Some(ref model) = self.model {
            parts.push(format!("{:?}", model));
        }
        
        parts.push(self.year.clone());
        
        if let Some(ref license_plate) = self.license_plate {
            parts.push(license_plate.clone());
        }
        
        parts.push(self.color.clone());
        
        parts.join(" | ")
    }
}
