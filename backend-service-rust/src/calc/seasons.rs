use chrono::{Datelike, Local, NaiveDate};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

// Structure to represent season data from the YAML file
#[derive(Debug, Deserialize, Clone)]
struct SeasonData {
    date_from: String,
    date_to: String,
    est_fuel_cons_for_paint_dry: f64,
    est_fuel_cons_for_base_dry: f64,
}

// Structure to hold all seasons from the YAML file
#[derive(Debug, Deserialize)]
struct Seasons {
    #[serde(flatten)]
    seasons: HashMap<String, SeasonData>,
}

// Output structure returned by our function
#[derive(Debug, Serialize)]
pub struct CurrentSeasonInfo {
    pub season_name: String,
    pub est_fuel_cons_for_paint_dry: f64,
    pub est_fuel_cons_for_base_dry: f64,
}

/// Parses a date string in format "DD.MM" into a NaiveDate
fn parse_date_string(date_str: &str, current_year: i32) -> Result<NaiveDate, Box<dyn Error>> {
    let parts: Vec<&str> = date_str.split('.').collect();
    if parts.len() != 2 {
        return Err(format!("Invalid date format: {}", date_str).into());
    }
    
    let day: u32 = parts[0].parse()?;
    let month: u32 = parts[1].parse()?;
    
    // Create a date with the current year
    Ok(NaiveDate::from_ymd_opt(current_year, month, day).ok_or("Invalid date")?)
}

/// Determines if a date falls within a season's range, handling year transitions
fn is_date_in_season(
    current_date: &NaiveDate,
    from_date: &NaiveDate,
    to_date: &NaiveDate,
) -> bool {
    // If to_date is earlier in the year than from_date, it means the season spans across years
    if to_date < from_date {
        // Season crosses year boundary (e.g., winter: Nov 1 to Apr 1)
        current_date >= from_date || current_date < to_date
    } else {
        // Season within same year (e.g., summer: Apr 1 to Nov 1)
        current_date >= from_date && current_date < to_date
    }
}

/// Main function to determine current season and retrieve fuel consumption values
pub fn get_current_season_info<P: AsRef<Path>>(
    path: P,
) -> Result<CurrentSeasonInfo, Box<dyn Error>> {
    // Read the YAML file
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    
    // Parse the YAML into our Seasons struct
    let seasons_data: Seasons = serde_yaml::from_reader(reader)?;
    
    // Get current date
    let today = Local::now().date_naive();
    let current_year = today.year();
    
    // Determine current season
    for (season_name, season_data) in &seasons_data.seasons {
        // Parse season date ranges
        let from_date = parse_date_string(&season_data.date_from, current_year)?;
        let to_date = parse_date_string(&season_data.date_to, current_year)?;
        
        if is_date_in_season(&today, &from_date, &to_date) {
            return Ok(CurrentSeasonInfo {
                season_name: season_name.clone(),
                est_fuel_cons_for_paint_dry: season_data.est_fuel_cons_for_paint_dry,
                est_fuel_cons_for_base_dry: season_data.est_fuel_cons_for_base_dry,
            });
        }
    }
    
    // If we get here, no season matched (should not happen with proper data)
    Err("Could not determine current season".into())
}
