/**
 * @typedef {Object} VinInfo
 * @property {string|null} make - The manufacturer of the vehicle (e.g., "Toyota").
 * @property {string|null} model - The model of the vehicle (e.g., "Camry").
 * @property {string|null} bodyType - The body type of the vehicle (e.g., "Sedan").
 * @property {string|null} year - The model year of the vehicle (e.g., "2023").
 * @property {boolean} fromApi - True if the data came from the API, false if it was guessed.
 */

/**
 * A database of World Manufacturer Identifiers (WMI) with a focus on
 * common European and Japanese brands, as the API is US-centric.
 * The WMI is the first 3 characters of the VIN.
 */
const wmiData = {
  // Japan
  JA: "Isuzu",
  JC: "Isuzu",
  JF: "Subaru",
  JH: "Honda",
  JK: "Kawasaki",
  JM: "Mazda",
  JN: "Nissan",
  JS: "Suzuki",
  JT: "Toyota",
  "1G1": "Chevrolet", "1G2": "Chevrolet", "1G3": "Chevrolet", "2G1": "Chevrolet", "3G1": "Chevrolet", "9BG": "Chevrolet", "KL1": "Chevrolet",
  "1GT": "GMC", "2GT": "GMC", "3GT": "GMC",
  "1G6": "Cadillac", "2G6": "Cadillac", "3G6": "Cadillac",
  "1B3": "Dodge", "1B4": "Dodge", "1B7": "Dodge", "2B3": "Dodge", "2B4": "Dodge", "2B7": "Dodge", "3B3": "Dodge", "3B4": "Dodge", "3B7": "Dodge",
  "1C3": "Chrysler", "1C4": "Chrysler", "1C8": "Chrysler", "2C3": "Chrysler", "2C4": "Chrysler", "2C8": "Chrysler", "3C3": "Chrysler", "3C4": "Chrysler",
  "1LN": "Lincoln", "5LM": "Lincoln",
  "5YJ": "Tesla", "7SA": "Tesla",
  "ZFA": "Fiat", "ZFC": "Fiat",
  "ZAR": "Alfa Romeo", "ZAS": "Alfa Romeo",
  "SAL": "Land Rover",
  "VSS": "Seat",
  "JA3": "Mitsubishi", "JA4": "Mitsubishi", "JMB": "Mitsubishi", "MMB": "Mitsubishi", "ML3": "Mitsubishi", "6MM": "Mitsubishi",
  JTH: "Lexus",
  JTJ: "Lexus",
  "2T2": "Lexus",
  JF1: "Subaru",
  JF2: "Subaru",
  "4S3": "Subaru",
  "4S4": "Subaru",
  "1FA": "Ford",
  "1FB": "Ford",
  "1FC": "Ford",
  "1FD": "Ford",
  "1FM": "Ford",
  "1FT": "Ford",
  "1ZV": "Ford",
  "2FA": "Ford",
  "2FB": "Ford",
  "2FC": "Ford",
  "2FM": "Ford",
  "2FT": "Ford",
  "3FA": "Ford",
  "3FC": "Ford",
  "3FM": "Ford",
  "3FT": "Ford",
  "WF0": "Ford",
  "WFO": "Ford",
  "WF1": "Ford",
  "VS6": "Ford",
  "X9F": "Ford",
  "9BF": "Ford",
  SB1: "Toyota",
  NMT: "Toyota",
  MR0: "Toyota",
  AHT: "Toyota",
  "2T": "Toyota",
  "4T": "Toyota",
  "5T": "Toyota",
  // Germany
  WAU: "Audi",
  WBA: "BMW",
  WBS: "BMW M",
  WDB: "Mercedes-Benz",
  WDC: "Mercedes-Benz",
  WDD: "Mercedes-Benz",
  WMW: "MINI",
  W0L: "Opel",
  WVG: "Volkswagen",
  WVW: "Volkswagen",
  WP0: "Porsche",
  WP1: "Porsche",
  // Sweden
  YV1: "Volvo Cars",
  YV4: "Volvo Cars",
  YS3: "Saab",
  // UK
  SAJ: "Jaguar",
  SCC: "Lotus Cars",
  SCA: "Rolls Royce",
  SCB: "Bentley",
  // Italy
  ZAM: "Maserati",
  ZFF: "Ferrari",
  ZHW: "Lamborghini",
  // France
  VF1: "Renault",
  VF3: "Peugeot",
  VF7: "Citroën",
  // South Korea
  KNA: "Kia",
  KNB: "Kia",
  KNC: "Kia",
  KNH: "Hyundai",
  KNM: "Hyundai",
  // USA (for completeness)
  "1G": "General Motors",
  "1GC": "Chevrolet",
  "1C": "Chrysler",
  "1F": "Ford",
  "4S": "Subaru",
};

/**
 * A mapping of the 10th character of a VIN to its corresponding model year.
 * This is a standardized system. Note that letters I, O, Q, U, Z and number 0 are not used.
 * The cycle repeats every 30 years.
 */
const yearData1980 = {
  A: "1980",
  B: "1981",
  C: "1982",
  D: "1983",
  E: "1984",
  F: "1985",
  G: "1986",
  H: "1987",
  J: "1988",
  K: "1989",
  L: "1990",
  M: "1991",
  N: "1992",
  P: "1993",
  R: "1994",
  S: "1995",
  T: "1996",
  V: "1997",
  W: "1998",
  X: "1999",
  Y: "2000",
  1: "2001",
  2: "2002",
  3: "2003",
  4: "2004",
  5: "2005",
  6: "2006",
  7: "2007",
  8: "2008",
  9: "2009",
};

const yearData2010 = {
  A: "2010",
  B: "2011",
  C: "2012",
  D: "2013",
  E: "2014",
  F: "2015",
  G: "2016",
  H: "2017",
  J: "2018",
  K: "2019",
  L: "2020",
  M: "2021",
  N: "2022",
  P: "2023",
  R: "2024",
  S: "2025",
  T: "2026",
  V: "2027",
  W: "2028",
  X: "2029",
  Y: "2030",
};

/** VIN year codes repeat every 30 years; pick the cycle closest to today. */
function decodeVinYear(yearChar) {
  const older = yearData1980[yearChar];
  const newer = yearData2010[yearChar];
  if (!older && !newer) return null;
  if (!older) return newer;
  if (!newer) return older;

  const currentYear = new Date().getFullYear();
  const olderDiff = Math.abs(parseInt(older, 10) - currentYear);
  const newerDiff = Math.abs(parseInt(newer, 10) - currentYear);
  return olderDiff <= newerDiff ? older : newer;
}

export const VIN_LENGTH = 17;

/** Uppercase and drop whitespace/dashes; keeps at most 17 characters. */
export function normalizeVinInput(raw) {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .slice(0, VIN_LENGTH);
}

/** Characters that can never appear in a VIN (I, O, Q and non-alphanumerics). */
export function invalidVinChars(vin) {
  return [...new Set(String(vin).match(/[^A-HJ-NPR-Z0-9]/g) ?? [])];
}

/** Make from the WMI (first 2-3 chars). With only 2 chars typed, answers
 * when every known 3-char WMI with that prefix belongs to the same make. */
function decodeVinMake(vin) {
  if (vin.length >= 3) {
    return wmiData[vin.slice(0, 3)] || wmiData[vin.slice(0, 2)] || null;
  }
  if (vin.length === 2) {
    if (wmiData[vin]) return wmiData[vin];
    const candidates = new Set(
      Object.entries(wmiData)
        .filter(([wmi]) => wmi.length === 3 && wmi.startsWith(vin))
        .map(([, make]) => make),
    );
    return candidates.size === 1 ? [...candidates][0] : null;
  }
  return null;
}

/**
 * Decodes as much as possible from a (possibly partial) VIN, locally and
 * synchronously: make from the WMI, model from chassis-code heuristics as
 * soon as the relevant characters are typed, year from the 10th character.
 * @param {string} rawVin
 * @returns {{vin: string, make: string|null, model: string|null, year: string|null, complete: boolean, invalidChars: string[]}}
 */
export function decodeVinPartial(rawVin) {
  const vin = normalizeVinInput(rawVin);
  const make = decodeVinMake(vin);
  return {
    vin,
    make,
    model: make && vin.length >= 4 ? heuristicGuessModel(make, vin) : null,
    year: vin.length >= 10 ? decodeVinYear(vin.charAt(9)) : null,
    complete: vin.length === VIN_LENGTH,
    invalidChars: invalidVinChars(vin),
  };
}

/**
 * Looks the full VIN up in the free NHTSA database (US market only).
 * @returns {Promise<{make: string|null, model: string|null, bodyType: string|null, year: string|null}|null>}
 *   null when the VIN isn't known there (expected for most European cars).
 */
export async function fetchNhtsaVin(vin, signal) {
  const response = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
    { signal },
  );
  if (!response.ok) return null;
  const result = (await response.json())?.Results?.[0];
  if (!result?.Make || result.Make === "Not Applicable") return null;
  return {
    make: result.Make || null,
    model: result.Model || null,
    bodyType: result.BodyClass || null,
    year: result.ModelYear || null,
  };
}

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const compact = (value) => slugify(value).replace(/-/g, "");

/** Catalog key (e.g. "land-rover") for a decoded make name, or null. */
export function matchCatalogMake(make, catalogMakes = []) {
  if (!make) return null;
  const slug = slugify(make);
  if (catalogMakes.includes(slug)) return slug;
  const words = slug.split("-");
  return catalogMakes.find((m) => words.includes(m)) ?? null;
}

/** Catalog key for a decoded model name ("CX-5", "cx5" -> "cx-5"), or null. */
export function matchCatalogModel(model, catalogModels = []) {
  if (!model) return null;
  const needle = compact(model);
  return catalogModels.find((m) => compact(m) === needle) ?? null;
}

/** Slug used for models that aren't in the catalog. */
export const vinModelSlug = (model) => (model ? slugify(model) : null);

// Heuristic VIN decoding for Mazda, Honda, Suzuki, Audi models
export function heuristicGuessModel(make, vinUpper) {
  const chars45 = vinUpper.substring(3, 5);
  const chars456 = vinUpper.substring(3, 6);
  const chars567 = vinUpper.substring(4, 7);
  const chars78 = vinUpper.substring(6, 8); // Used by VAG/Audi
  
  if (make === "Audi") {
    switch (chars78) {
      case "8V": return "a3";
      case "8P": return "a3";
      case "8W": return "a4";
      case "8K": return "a4";
      case "F4": return "a4";
      case "8T": return "a5";
      case "F5": return "a5";
      case "4G": return "a6";
      case "4F": return "a6";
      case "4A": return "a6";
      case "4H": return "a8";
      case "4N": return "a8";
      case "8U": return "q3";
      case "F3": return "q3";
      case "8R": return "q5";
      case "FY": return "q5";
      case "4L": return "q7";
      case "4M": return "q7"; // Also q8, but returning q7 as fallback
    }
  } else if (make === "Mazda") {
    switch (chars45) {
      case "BK": case "BL": case "BM": case "BN": case "BP": return "mazda3";
      case "GG": case "GH": case "GJ": case "GL": return "mazda6";
      case "KE": case "KF": return "cx-5";
      case "DK": return "cx-3";
      case "DM": return "cx-30";
      case "TB": case "TC": return "cx-9";
      case "NA": case "NB": case "NC": case "ND": return "mx-5";
    }
  } else if (make === "Honda") {
    if (["EG", "EH", "EJ", "EK", "EM", "EN", "EP", "ES", "EU", "EV", "FA", "FD", "FG", "FN", "FK", "FB", "FC", "FE", "FL"].includes(chars45)) return "civic";
    if (["CB", "CC", "CD", "CE", "CF", "CG", "CH", "CL", "CM", "CN", "CP", "CR", "CT", "CU", "CV", "CY"].includes(chars45)) return "accord";
    if (["RD", "RE", "RM", "RW", "RT", "RS"].includes(chars45)) return "cr-v";
    if (["GH", "RU", "RV"].includes(chars45)) return "hr-v";
    if (["GD", "GE", "GG", "GF", "GK", "GR", "GS"].includes(chars45)) return "jazz";
    if (["YF"].includes(chars45)) return "pilot";
  } else if (make === "Suzuki") {
    if (["AZ", "ZC", "ZD", "RS", "FZ", "NZ"].includes(chars45) || chars456.startsWith("ZC")) return "swift";
    if (["LY", "JT", "TE", "TD"].includes(chars45)) return chars45 === "LY" ? "vitara" : "grand-vitara";
    if (["JB", "JA", "FJ"].includes(chars45)) return "jimny";
    if (["MF", "MH", "RM", "FF"].includes(chars45)) return "ignis";
    if (["GY", "JY", "YA", "YB"].includes(chars45)) return "sx4-s-cross";
    if (["EW", "WB"].includes(chars45)) return "baleno";
  } else if (make === "Toyota") {
    if (chars45.includes("E1") || chars45.includes("E2")) return "corolla"; // E150, E210
    if (chars45.includes("A3") || chars45.includes("A4") || chars45.includes("A5")) return "rav4"; // XA30, XA40, XA50
    if (chars45.includes("V4") || chars45.includes("V5") || chars45.includes("V7")) return "camry";
    if (chars45.includes("P1") || chars45.includes("P9") || chars45.includes("P2")) return "yaris"; // P13, P21
    if (chars45.includes("J12") || chars45.includes("J15") || chars45.includes("J25") || (chars456.startsWith("J1") && chars456[2] !== "0")) return "land-cruiser-prado";
    if (chars45.includes("J10") || chars45.includes("J20") || chars45.includes("J30")) return "land-cruiser";
    if (chars45.includes("N1") || chars45.includes("N2") || chars45.includes("N3")) return "hilux";
    if (chars45.includes("X1") || chars45.includes("X5")) return "c-hr";
  } else if (make === "Lexus") {
    if (chars45.includes("Z1") || chars45.includes("Z2") || chars45.includes("XV")) return "es";
    if (chars45.includes("L1") || chars45.includes("L2") || chars45.includes("L3") || chars45.includes("A1")) return "rx";
    if (chars45.includes("Z1") || chars45.includes("Z2")) return "nx"; // NX often shares Z with ES, but this is a heuristic
    if (chars45.includes("E2") || chars45.includes("E3") || chars45.includes("E4")) return "is";
    if (chars45.includes("J2") || chars45.includes("J3")) return "lx";
    if (chars45.includes("J1")) return "gx";
    if (chars45.includes("F1") || chars45.includes("F2") || chars45.includes("F3") || chars45.includes("F4") || chars45.includes("F5")) return "ls";
    if (chars45.includes("ZA") || chars45.includes("AA") || chars45.includes("A1")) return "ux";
  } else if (make === "Ford") {
    // US Models (positions 5, 6, 7)
    if (chars567.includes("F1E") || chars567.includes("W1E")) return "focus";
    if (chars567.includes("P8E") || chars567.includes("P8T") || chars567.includes("P8C") || chars567.includes("P8F") || chars456.includes("P8")) return "mustang";
    if (chars567.includes("E8E") || chars567.includes("K8B") || chars567.includes("K8C") || chars567.includes("K8D")) return "explorer";
    if (chars567.includes("T8E") || chars567.includes("K8A")) return "edge";
    if (chars567.includes("D8E") || chars567.includes("U9C") || chars567.includes("U9F")) return "escape";
    if (chars567.includes("F0A") || chars567.includes("P0G") || chars567.includes("F0G") || chars456.includes("M2E") || chars567.includes("M2E")) return "fusion";
    if (vinUpper.startsWith("1FT") || vinUpper.startsWith("1FD") || vinUpper.startsWith("1FC")) {
      if (chars567.includes("EW") || chars567.includes("EX") || chars567.includes("X1C") || chars567.includes("F1C")) return "f-150";
    }
    
    // EU Models (WF0...)
    if (vinUpper.startsWith("WF0") || vinUpper.startsWith("WF1") || vinUpper.startsWith("WFO")) {
       const char8 = vinUpper.charAt(7); // 8th character is model in EU Ford VINs
       if (char8 === "C" || char8 === "M") return "focus";
       if (char8 === "B" || char8 === "W" || char8 === "E") return "mondeo";
       if (char8 === "J" || char8 === "U" || char8 === "D") return "fiesta";
       if (char8 === "V" || char8 === "R") return "kuga";
       if (char8 === "X" || char8 === "Y" || char8 === "T") return "transit";
    }
  } else if (make === "Subaru") {
    const char4 = vinUpper.charAt(3);
    if (char4 === "B") return "outback"; // Legacy / Outback, assuming Outback is more common
    if (char4 === "G") return "crosstrek"; // Impreza / Crosstrek
    if (char4 === "S") return "forester"; 
    if (char4 === "V") return "wrx"; 
    if (char4 === "W") return "ascent"; 
    if (char4 === "Z") return "brz";
    if (char4 === "E") return "solterra"; 
  } else if (make === "Tesla") {
    const char4 = vinUpper.charAt(3);
    if (char4 === "S") return "model-s";
    if (char4 === "3") return "model-3";
    if (char4 === "X") return "model-x";
    if (char4 === "Y") return "model-y";
  } else if (make === "Fiat") {
    if (chars456.includes("334")) return "500x";
    if (chars456.includes("330")) return "500l";
    if (chars456.includes("312") || chars456.includes("150")) return "500";
    if (chars456.includes("319")) return "panda";
    if (chars456.includes("356")) return "tipo";
    if (chars456.includes("263")) return "doblo";
    if (chars456.includes("250") || chars456.includes("290")) return "ducato";
  } else if (make === "Alfa Romeo") {
    if (chars456.includes("952") || chars567.includes("952") || chars45.includes("FA") || chars45.includes("FB")) return "giulia";
    if (chars456.includes("949") || chars567.includes("949") || chars45.includes("FC") || chars45.includes("FD")) return "stelvio";
    if (chars456.includes("965") || chars567.includes("965")) return "tonale";
    if (chars456.includes("940") || chars567.includes("940")) return "giulietta";
  } else if (make === "Land Rover") {
    if (chars45.includes("LG") || chars45.includes("VA")) return "range-rover";
    if (chars45.includes("LW") || chars45.includes("WA")) return "range-rover-sport";
    if (chars45.includes("LY") || chars45.includes("YA")) return "range-rover-velar";
    if (chars45.includes("LV") || chars45.includes("LZ")) return "range-rover-evoque";
    if (chars45.includes("LR") || chars45.includes("LA")) return "discovery";
    if (chars45.includes("LC")) return "discovery-sport";
    if (chars45.includes("LE")) return "defender";
  }
  return null;
}
