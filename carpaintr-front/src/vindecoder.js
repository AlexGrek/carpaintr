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
  JF: "Fuji Heavy Industries (Subaru)",
  JH: "Honda",
  JK: "Kawasaki",
  JM: "Mazda",
  JN: "Nissan",
  JS: "Suzuki",
  JT: "Toyota",
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
  SAL: "Land Rover",
  SCC: "Lotus Cars",
  SCA: "Rolls Royce",
  SCB: "Bentley",
  // Italy
  ZAR: "Alfa Romeo",
  ZAM: "Maserati",
  ZFA: "Fiat",
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
  "1GT": "GMC",
  "1C": "Chrysler",
  "1F": "Ford",
  "4S": "Subaru",
  "5YJ": "Tesla",
};

/**
 * A mapping of the 10th character of a VIN to its corresponding model year.
 * This is a standardized system. Note that letters I, O, Q, U, Z and number 0 are not used.
 * The cycle repeats every 30 years.
 */
const yearData = {
  // 1980-2009
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
  // 2010-2039
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

/**
 * Attempts to decode a Vehicle Identification Number (VIN).
 * First, it tries a free API for the American market. If that fails,
 * it falls back to guessing the make and year from the VIN structure.
 * @param {string} vin - The 17-character VIN to decode.
 * @returns {Promise<VinInfo|null>} A promise that resolves to an object with vehicle info, or null if it cannot be decoded.
 */
export async function tryDecodeVin(vin) {
  // Basic validation
  if (!vin || typeof vin !== "string" || vin.length !== 17) {
    console.error("Invalid VIN provided. Must be a 17-character string.");
    return null;
  }
  const vinUpper = vin.toUpperCase();

  // --- Step 1: Try to decode using the free NHTSA API (best for US market) ---
  try {
    const apiUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vinUpper}?format=json`;
    const response = await fetch(apiUrl);

    if (response.ok) {
      const data = await response.json();
      // Check if the API returned a valid result with a make
      if (
        data &&
        data.Results &&
        data.Results[0] &&
        data.Results[0].Make &&
        data.Results[0].Make !== "Not Applicable"
      ) {
        const result = data.Results[0];
        return {
          make: result.Make || null,
          model: result.Model || null,
          bodyType: result.BodyClass || null,
          year: result.ModelYear || null,
          fromApi: true,
        };
      }
    }
  } catch (error) {
    console.warn(
      "API call failed. This is expected for non-US cars. Falling back to guessing.",
      error.message,
    );
  }

  // --- Step 2: Fallback to guessing based on WMI and Year Code ---
  // This part will execute if the API call fails or returns no useful data.
  console.log("Attempting to guess VIN details locally.");

  const wmi = vinUpper.substring(0, 3);
  const wmi2 = vinUpper.substring(0, 2); // Some WMIs are 2 chars
  const yearChar = vinUpper.charAt(9);

  const guessedMake = wmiData[wmi] || wmiData[wmi2] || null;
  const guessedYear = yearData[yearChar] || null;

  // Only return a result if we can at least identify the make.
  if (guessedMake) {
    return {
      make: guessedMake,
      model: null, // Cannot be reliably guessed
      bodyType: null, // Cannot be reliably guessed
      year: guessedYear,
      fromApi: false,
    };
  }

  // --- Step 3: If all else fails, return null ---
  console.error(`Could not decode or guess VIN: ${vinUpper}`);
  return null;
}
