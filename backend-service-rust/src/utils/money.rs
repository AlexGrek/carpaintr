use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::fmt;
use std::ops::{Add, Div, Mul, Sub};
use std::str::FromStr;

use crate::exlogging;

/// Money stored internally as *cents* (two decimal places).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default)]
pub struct Money {
    cents: i64,
}

impl Money {
    pub const fn from_cents(cents: i64) -> Self {
        Self { cents }
    }

    pub fn as_cents(&self) -> i64 {
        self.cents
    }

    pub fn as_major_minor(&self) -> (i64, u8) {
        let sign = if self.cents < 0 { -1 } else { 1 };
        let abs = self.cents.abs();
        ((abs / 100) * sign, (abs % 100) as u8)
    }
}

// Display in fixed 2 decimal format
impl fmt::Display for Money {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let (major, minor) = self.as_major_minor();
        write!(f, "{}.{:02}", major, minor)
    }
}

// Parse from string with "." or "," decimal separator
impl FromStr for Money {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let mut s = s.trim().replace(',', "."); // normalize decimal separator
        if s.is_empty() {
            exlogging::log_event(
                exlogging::LogLevel::Error,
                &format!("Currency parsing error: '{}'", s),
                None::<String>,
            );
            return Ok(Self::default());
        }

        // If no decimal point, append ".00"
        if !s.contains('.') {
            s.push_str(".00");
        }

        let negative = s.starts_with('-');
        let s = if s.starts_with('+') || s.starts_with('-') {
            &s[1..]
        } else {
            &s
        };

        let parts: Vec<&str> = s.split('.').collect();
        if parts.len() != 2 {
            exlogging::log_event(
                exlogging::LogLevel::Error,
                &format!("Currency parsing error: '{}'", s),
                None::<String>,
            );
            return Ok(Self::default());
        }

        let major: i64 = parts[0].parse().unwrap_or_else(|_| {
            exlogging::log_event(
                exlogging::LogLevel::Error,
                &format!("Currency parsing error: '{}'", s),
                None::<String>,
            );
            0
        });

        let frac_str = match parts[1].len() {
            0 => "00".to_string(),
            1 => format!("{}0", parts[1]),
            _ => parts[1][..2].to_string(), // truncate extra
        };

        let minor: i64 = frac_str.parse().unwrap_or_else(|_| {
            exlogging::log_event(
                exlogging::LogLevel::Error,
                &format!("Currency parsing error: '{}'", s),
                None::<String>,
            );
            0
        });

        let cents = major.abs() * 100 + minor;
        let cents = if negative { -cents } else { cents };

        Ok(Self { cents })
    }
}

// Serde — can deserialize from string, integer, or float
impl<'de> Deserialize<'de> for Money {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct MoneyVisitor;

        impl<'de> serde::de::Visitor<'de> for MoneyVisitor {
            type Value = Money;

            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                write!(f, "string, integer, or float representing money")
            }

            fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(Money::from_str(v).unwrap_or_default())
            }

            fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(Money::from_cents((v * 100.0).round() as i64))
            }

            fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(Money::from_cents(v * 100))
            }

            fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(Money::from_cents((v as i64) * 100))
            }
        }

        deserializer.deserialize_any(MoneyVisitor)
    }
}

impl Serialize for Money {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// From / Into numeric types
impl From<i64> for Money {
    fn from(v: i64) -> Self {
        Self::from_cents(v * 100)
    }
}
impl From<f64> for Money {
    fn from(v: f64) -> Self {
        Self::from_cents((v * 100.0).round() as i64)
    }
}
impl From<Money> for i64 {
    fn from(m: Money) -> Self {
        m.cents / 100
    }
}
impl From<Money> for f64 {
    fn from(m: Money) -> Self {
        m.cents as f64 / 100.0
    }
}

// Arithmetic
impl Add for Money {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        Self::from_cents(self.cents + rhs.cents)
    }
}
impl Sub for Money {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self::Output {
        Self::from_cents(self.cents - rhs.cents)
    }
}

// Multiply/divide by numeric
macro_rules! impl_mul_div_for_numeric {
    ($($t:ty),*) => {
        $(
            impl Mul<$t> for Money {
                type Output = Self;
                fn mul(self, rhs: $t) -> Self::Output {
                    let val = (self.cents as f64) * (rhs as f64);
                    Self::from_cents(val.round() as i64)
                }
            }
            impl Div<$t> for Money {
                type Output = Self;
                fn div(self, rhs: $t) -> Self::Output {
                    let val = (self.cents as f64) / (rhs as f64);
                    Self::from_cents(val.round() as i64)
                }
            }
        )*
    };
}
impl_mul_div_for_numeric!(i8, i16, i32, i64, isize, u8, u16, u32, u64, usize, f32, f64);

unsafe impl Send for Money {}
unsafe impl Sync for Money {}

/// Money with currency
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MoneyWithCurrency {
    pub amount: Money,
    pub currency: String,
}

impl MoneyWithCurrency {
    pub fn new(amount: Money, currency: impl Into<String>) -> Self {
        Self {
            amount,
            currency: currency.into(),
        }
    }
}

impl Default for MoneyWithCurrency {
    fn default() -> Self {
        let currency = std::env::var("DEFAULT_CURRENCY").unwrap_or_else(|_| "грн".to_string());
        Self {
            amount: Money::default(),
            currency,
        }
    }
}

impl Add for MoneyWithCurrency {
    type Output = Result<Self, String>;
    fn add(self, rhs: Self) -> Self::Output {
        if self.currency != rhs.currency {
            return Err("Currency mismatch".into());
        }
        Ok(Self {
            amount: self.amount + rhs.amount,
            currency: self.currency,
        })
    }
}
impl Sub for MoneyWithCurrency {
    type Output = Result<Self, String>;
    fn sub(self, rhs: Self) -> Self::Output {
        if self.currency != rhs.currency {
            return Err("Currency mismatch".into());
        }
        Ok(Self {
            amount: self.amount - rhs.amount,
            currency: self.currency,
        })
    }
}

// Mul/Div by numeric — no currency check needed
macro_rules! impl_mul_div_for_numeric_currency {
    ($($t:ty),*) => {
        $(
            impl Mul<$t> for MoneyWithCurrency {
                type Output = Self;
                fn mul(self, rhs: $t) -> Self::Output {
                    Self {
                        amount: self.amount * rhs,
                        currency: self.currency,
                    }
                }
            }
            impl Div<$t> for MoneyWithCurrency {
                type Output = Self;
                fn div(self, rhs: $t) -> Self::Output {
                    Self {
                        amount: self.amount / rhs,
                        currency: self.currency,
                    }
                }
            }
        )*
    };
}
impl_mul_div_for_numeric_currency!(i8, i16, i32, i64, isize, u8, u16, u32, u64, usize, f32, f64);
