---
name: dataman
description: Data architecture expert for Autolab carpaintr - understands T1/T2 table schemas, processors, user-configurable data flows, backend parsing, API endpoints, and frontend UI wiring
triggers: ["T1", "T2", "processor", "processor evaluator", "table", "procs", "data flow", "CSV"]
---

# Dataman Skill: Complete Data Architecture

You are a **DATA ARCHITECT** for the Autolab carpaintr project. You deeply understand how user data is stored, validated, parsed, and displayed through the entire system.

## Core Concepts: T1 vs T2 Tables

### T1 Table: Car Parts Catalog (`tables/t1.csv`)

**Purpose:** Master catalog of all selectable car parts, organized by vehicle class and body type.

**File Location:** `tables/t1.csv` in user's micro-repository

**Structure:** CSV with 4 columns
```csv
Список Класс,Список Тип,Список деталь рус,Список деталь eng,Список деталь укр
A,СЕДАН,Передний бампер,Front bumper,Передній бампер
A,СЕДАН,Капот,Hood,Капот
B,КУПЕ,Передняя дверь,Front door,Передня дверь
```

**Field Definitions (from `src/calc/constants.rs`):**
- **`Список Класс`** (CAR_PART_CLASS_FIELD) - Vehicle class: `A`, `B`, `C`, `D`, `SUV`, etc.
- **`Список Тип`** (CAR_PART_TYPE_FIELD) - Body type (Russian names from constants):
  - `СЕДАН` (sedan) → English: `sedan`
  - `УНИВЕРСАЛ` (wagon) → English: `wagon`
  - `КУПЕ` (coupe) → English: `coupe`
  - `ВНЕДОРОЖНИК 5 дверный` (SUV 5-door) → English: `suv 5 doors`
  - `ХЕТЧБЕК 5 дверей` (hatchback 5-door) → English: `hatchback 5 doors`
- **`Список деталь рус`** (CAR_PART_DETAIL_RUS_FIELD) - Part name in Russian (e.g., "Передний бампер")
- **`Список деталь eng`** (CAR_PART_DETAIL_ENG_FIELD) - Part name in English (e.g., "Front bumper")
- **`Список деталь укр`** (CAR_PART_DETAIL_UKR_FIELD) - Part name in Ukrainian (most commonly used)

**Backend Model:** [cars.rs:65-83]
```rust
pub struct CarPart {
    pub class: String,           // e.g., "A"
    pub type_field: String,      // e.g., "СЕДАН"
    pub detail_rus: String,      // Russian name
    pub detail_eng: String,      // English name
    pub detail_ukr: String,      // Ukrainian name (preferred)
}
```

**API Endpoint for T1 Data:**
```
GET /api/v1/user/carparts/{class}/{body_type}
```
- Returns filtered CarPart array for specific class + body type
- Body type must be translated from English to Russian: `sedan` → `СЕДАН`
- Used in frontend to populate body parts selector

---

### T2 Table: Repair Actions & Zones (`tables/t2.csv`)

**Purpose:** Detailed breakdown of repair actions (assemble, paint, repair, etc.) for each part and zone.

**File Location:** `tables/t2.csv` in user's micro-repository

**ACTUAL Structure (verified from real data):** CSV with 19 columns. A single row can apply to multiple body types via **8 separate body type columns** (`ТИП КУЗОВА1`–`ТИП КУЗОВА8`). Each row lists which body types it covers as cell values, not as filters.

```csv
Схема кузова,ТИП КУЗОВА1,ТИП КУЗОВА2,ТИП КУЗОВА3,ТИП КУЗОВА4,ТИП КУЗОВА5,ТИП КУЗОВА6,ТИП КУЗОВА7,ТИП КУЗОВА8,зона,деталь 1,деталь 2,программа,розібрати/зібрати,усунення перекосу,замінити,зняти/встановити,ремонт,фарбування
Рис.1,ХЕТЧБЕК 3 двери,ХЕТЧБЕК 5 дверей,КУПЕ,ЛИФТБЭК 5 дверей,СЕДАН,УНИВЕРСАЛ,ВНЕДОРОЖНИК 3 дверный,ВНЕДОРОЖНИК 5 дверный,Бампер задній,Бампер задній,,,,,,,, 
Рис.2дв.,ХЕТЧБЕК 3 двери,ХЕТЧБЕК 5 дверей,,ЛИФТБЭК 5 дверей,,,ВНЕДОРОЖНИК 3 дверный,ВНЕДОРОЖНИК 5 дверный,Двері багажника,Деталі дверей багажника,Каркас дверей зад.лів.,,розібрати/зібрати,усунення перекосу,,, ремонт,фарбування
```

**IMPORTANT — Body type values are Russian (same format as T1):**
- `ХЕТЧБЕК 3 двери` (hatchback 3 doors)
- `ХЕТЧБЕК 5 дверей` (hatchback 5 doors)
- `СЕДАН` (sedan)
- `УНИВЕРСАЛ` (wagon)
- `КУПЕ` (coupe)
- `ЛИФТБЭК 5 дверей` (liftback 5 doors)
- `ВНЕДОРОЖНИК 3 дверный` (suv 3 doors)
- `ВНЕДОРОЖНИК 5 дверный` (suv 5 doors)

**IMPORTANT — Action columns store the action name as a string (not a number):**
The action columns (`розібрати/зібрати`, `ремонт`, etc.) contain either the action name string (non-empty = action supported) or empty string (action not applicable). **Not numeric labor times** — those come from separate lookup tables.

**Header/section rows:** Rows where `деталь 2` is empty and ALL action columns are empty are section header markers (e.g., "Кришка багажника" with `програма = "программа"`). They group sub-parts but are not themselves actionable.

**Field Definitions (from `src/calc/constants.rs`):**

**Core Fields:**
- **`зона`** (T2_ZONE) - Repair zone identifier (e.g., "Кришка багажника", "Бампер задній")
- **`деталь 1`** (T2_PART_1) - Primary part name or group name (required, cannot be empty)
- **`деталь 2`** (T2_PART_2) - Sub-part name. If empty: part is ungrouped (`group=null`, `name=деталь 1`). If filled: `group=деталь 1`, `name=деталь 2`
- **`Схема кузова`** (T2_BLUEPRINT) - Reference to visual blueprint/schema name
- **`ТИП КУЗОВАn`** (T2_BODY = "ТИП КУЗОВА") - 8 columns; backend filters by checking if ANY `ТИП КУЗОВАn` value matches the requested body type (using `k.contains("ТИП КУЗОВА")`)

**Action Fields:**
- **`розібрати/зібрати`** (T2_ACTION_ASSEMBLE) → internal action name: `"assemble"`
- **`усунення перекосу`** (T2_ACTION_TWIST) → internal action name: `"twist"`
- **`замінити`** (T2_ACTION_REPLACE) → internal action name: `"replace"`
- **`зняти/встановити`** (T2_ACTION_MOUNT) → internal action name: `"mount"`
- **`ремонт`** (T2_ACTION_REPAIR) → internal action name: `"repair"`
- **`фарбування`** (T2_ACTION_PAINT) → internal action name: `"paint"`

**Backend Model:** [t2.rs:127-135]
```rust
pub struct T2PartEntry {
    pub name: String,           // Part name (деталь 2 if exists, else деталь 1)
    pub group: Option<String>,  // Group name (деталь 1) if деталь 2 exists
    pub actions: HashSet<String>, // Internal action codes: "assemble","twist","replace","mount","repair","paint"
    pub car_blueprint: String,  // Schema reference
    pub zone: String,           // Zone identifier
}
```

**API Endpoint for T2 Data:**
```
GET /api/v1/user/carparts_t2/{class}/{body_type}
```
- `body_type` is the **English** URL param (e.g., `hatchback 3 doors`)
- Backend converts it to Russian via `body_type_into_t1_entry()` before filtering T2
- Filtering matches ANY `ТИП КУЗОВАn` column (column name contains "ТИП КУЗОВА")
- Used to populate repair action selector and calculations

---

## Processors: User-Configurable Calculation Logic

### What Are Processors?

**Processors** are user-written JavaScript functions that customize calculation outputs. They allow users to define repair timelines, costs, and pricing logic without modifying the backend.

**File Location:** `procs/*.js` in user's micro-repository

**Purpose:** Transform raw T1/T2 data into formatted calculation rows with labor time/cost estimates.

### Processor Structure

**File Example:** `procs/bumper_repair.js`
```javascript
module.exports = {
  // Unique name displayed in results
  name: "Front Bumper Repair",

  // Order of execution (lower first)
  orderingNum: 0,

  // Category for grouping
  category: "Body Panels",

  // Which T1 tables this processor depends on
  // Prevents processor from running if table missing
  requiredTables: ["t1", "bumper_details"],

  // Which repair types this processor supports
  // Empty array = all types supported
  requiredRepairTypes: ["paint", "repair"],

  // Required global files (yaml/json)
  requiredFiles: ["pricing_rules.yaml"],

  // Determines if processor should execute
  // Returns boolean
  shouldRun: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
    return carPart.name.includes("Bumper") && repairAction === "paint";
  },

  // Main calculation logic
  // Returns array of output rows
  run: (x, carPart, tableData, repairAction, files, carClass, carBodyType, carYear, carModel, paint, pricing) => {
    const baseTime = tableData.t1[repairAction] || 0;
    const adjustedTime = baseTime * 1.1; // 10% increase

    return [
      x.mkRow({
        name: `Paint "«деталь»" bumper`,  // «деталь» gets replaced with actual part name
        evaluate: adjustedTime.toString(),
        tooltip: "Includes sanding and two coats"
      })
    ];
  }
};
```

### Processor Parameters

When `run()` or `shouldRun()` is called:

| Parameter | Type | Description |
|-----------|------|-------------|
| `x` | object | Sandbox with `mkRow()` helper |
| `carPart` | T2PartEntry | Selected car part with name, group, actions |
| `tableData` | object | All loaded table rows keyed by table name (e.g., `tableData["Арматурные работы"]["СНЯТИЕ ДЛЯ РЕМОНТА"]`) |
| `repairAction` | string | Selected **Ukrainian repair type** from repair_types.csv (e.g., `"Ремонт без фарбування"`), NOT a T2 internal code |
| `files` | object | Loaded YAML/JSON files from global/ |
| `carClass` | string | E.g., "A", "B" |
| `carBodyType` | string | E.g., "sedan", "suv 5 doors" |
| `carYear` | number | Vehicle year |
| `carModel` | string | E.g., "Camry" |
| `paint` | string | Paint color selected |
| `pricing` | object | Currency and pricing preferences |

**`requiredRepairTypes` must use Ukrainian repair type names** matching `repair_types.csv` values:
```javascript
requiredRepairTypes: ["Ремонт без фарбування", "Ремонт з зовнішнім фарбуванням"]
// NOT: ["repair", "paint"]  ← WRONG, these are T2 internal codes
```

**`requiredRepairTypes: []` (empty) means the processor runs for ALL repair types.** The `is_supported_repair_type()` function returns `true` when the array is empty.

**`requiredTables`** must match the table filename without extension (e.g., `"Арматурные работы"` for `Арматурные_работы.csv`). Case-sensitive, word-order matters.

### Row Output Structure

Each processor returns array of rows:
```javascript
x.mkRow({
  name: string,           // Display name (supports «word» replacement)
  evaluate: string,       // JavaScript expression to evaluate
  tooltip: string         // Hover tooltip
})
```

**Name Substitution:** Words in «guillemets» or "quotes" are replaced:
- Input: `"Painting «деталь» with color \"color\""`
- Output: `"Painting Front bumper with color red"`
- Supported: `деталь` (part name), `color` (selected paint)

**Evaluate Expression:** Executed with `eval()` in sandbox context. Can use:
- Numbers: `45 + 30`
- Variables from parameters
- Math operations
- No access to global functions (security sandbox)

### Frontend Processor Evaluation

**File:** [processor_evaluator.js]

**Key Functions:**
```javascript
// Verify processor has required structure
verify_processor(processor) → ProcessorWithDefaults

// Check if processor should run for current context
should_evaluate_processor(processor, stuff) → boolean

// Execute processor and evaluate all output rows
evaluate_processor(processor, stuff) → {
  name: string,
  result: Array<{name, evaluate, estimation, tooltip}>,
  error: Error | null
}

// Validate processor has required tables
validate_requirements(processor, tableData) → missingTableName | null

// Check if repair action is supported
is_supported_repair_type(processor, repairAction) → boolean
```

### Backend Plugin Loading

**Endpoint:** `GET /api/v1/user/plugins` (or similar)

**Process:**
1. Backend finds all `.js` files in `procs/` directory
2. Reads each file content
3. Bundles into single JS array:
```javascript
exports.default = [
  // bumper_repair.js
  ({ name: "...", run: function() {...} }),
  // door_repair.js
  ({ name: "...", run: function() {...} }),
];
```
4. Returns as `text/javascript` MIME type
5. Frontend imports and uses processors

---

## User-Configurable Data Files

### Global Configuration Files

**Location:** `global/` directory in user's micro-repository

#### 1. **parts_visual.yaml** - Grid Layout for Damage Visualization

```yaml
# Default grid dimensions
default:
  x: 10      # Width in cells
  y: 8       # Height in cells
  unused: ["0,0", "9,7"]  # Cells that don't exist (disabled)

# Part-specific overrides
"Front bumper":
  x: 5
  y: 3
  unused: ["0,0"]

"Hood":
  x: 8
  y: 6
  unused: ["7,5"]
```

**Frontend Usage:** [CarBodyMain.jsx:142-150]
```javascript
const generateInitialGrid = (visual) => {
  const grid = Array(visual.y).fill(0).map(() =>
    Array(visual.x).fill(0)
  );
  // Mark unused cells as -1
  visual.unused.forEach(coord => {
    const [x, y] = coord.split(',').map(Number);
    grid[y][x] = -1;
  });
  return grid;
};
```

**Wiring:**
- User loads T2 parts → frontend calls `parts_visual.yaml`
- Maps part names to grid dimensions
- Displays damage grid in UI (GridDraw component)

#### 2. **quality.yaml** - Repair Quality Levels

```yaml
default: "standard"
options:
  - "economy"
  - "standard"
  - "premium"
  - "show"

# Optional pricing multipliers
multipliers:
  economy: 0.7
  standard: 1.0
  premium: 1.3
  show: 1.5
```

**Frontend Usage:** [BodyPartsStage.jsx:95-98]
```javascript
const qualityData = await authFetchYaml("/api/v1/user/global/quality.yaml");
setRepairQualityOptions(qualityData.options || []);
setRepairQuality(qualityData.default || "");
```

#### 3. **colors.json** - Available Paint Colors

```json
[
  { "id": "red-metallic", "name": "Red Metallic", "hex": "#c41e3a", "price": 500 },
  { "id": "white", "name": "White", "hex": "#ffffff", "price": 300 },
  { "id": "black", "name": "Pearl Black", "hex": "#000000", "price": 600 }
]
```

**API Endpoint:**
```
GET /api/v1/user/global/colors.json
```

**Frontend Usage:** [ColorPicker.jsx]
```javascript
const colors = await authFetchJson("/api/v1/user/global/colors.json");
```

#### 4. **seasons.yaml** - Time Adjustments by Season

```yaml
current_season: "summer"
adjustments:
  summer:
    factor: 1.0
    description: "Standard labor time"
  winter:
    factor: 1.15
    description: "15% longer due to weather"
  spring:
    factor: 1.05
    description: "Minor adjustments"
```

**Backend Usage:** [data_endpoints.rs]
Used by `get_current_season_info()` to adjust calculation times

#### 5. **repair_types.csv** - Available Repair Actions per Part

**ACTUAL Structure (verified from real data):**
```csv
Список деталь укр,Ремонти
Капот,Ремонт з зовнішнім фарбуванням/ Ремонт з фарбуваням 2 сторони/ Ремонт без фарбування/ Розтонування фарби/ Заміна  оригінал деталь з фарбуванням/ Заміна Не оригінал деталь з фарбуванням/ Заміна без фарбування/ Полірування
Бампер задній,Ремонт з зовнішнім фарбуванням/ Ремонт без фарбування/ Заміна  оригінал деталь з фарбуванням/ ...
```

- Column 1: `Список деталь укр` — part name (Ukrainian), matches T1/T2 part names
- Column 2: `Ремонти` — slash-separated repair type names (Ukrainian, user-visible)
- Separator is `/ ` (slash + space); backend splits by `/` and trims

**These Ukrainian repair type names are what processors use in `requiredRepairTypes`.**
The frontend drawer reads them from `tableData["repair_types"]["Ремонти"]` (available via the `lookup_all_tables` endpoint) and shows them as the action picker options. The selected value is passed as `repairAction` to processors.

**This is NOT the same as T2 internal action codes** (`"repair"`, `"paint"`, etc.). The repair types from this file are descriptive Ukrainian strings like `"Ремонт без фарбування"`.

**API Endpoint:**
```
GET /api/v1/user/repair_types
```
Returns all unique repair type name strings across all parts (for reference/validation).

**Per-part repair types** are fetched via:
```
GET /api/v1/user/lookup_all_tables?car_class=A&car_type=sedan&part=Капот
```
Returns table data including a `repair_types` entry with the specific part's repair types.

---

## Data Flow Architecture

### Complete Flow: T1/T2 from File Editor → UI

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER CREATES/EDITS DATA IN FILE EDITOR                        │
│    Files: tables/t1.csv, tables/t2.csv, global/*.yaml            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. BACKEND PARSES & VALIDATES                                    │
│    - CSV parsing with error detection                            │
│    - Validation: required fields, whitespace, delimiters         │
│    - Caching: DataStorageCache prevents re-parsing               │
│    - Logging: All operations logged to application.log           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. API ENDPOINTS SERVE DATA                                      │
│    GET /api/v1/user/carparts/{class}/{body}       → T1 filtered  │
│    GET /api/v1/user/carparts_t2/{class}/{body}    → T2 filtered  │
│    GET /api/v1/user/global/colors.json            → colors       │
│    GET /api/v1/user/global/parts_visual.yaml      → grids        │
│    GET /api/v1/user/plugins                       → processors   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. FRONTEND RECEIVES DATA & RENDERS                              │
│    - CarSelect: Shows available cars (from cars/*.yaml)          │
│    - CarBodyMain: Shows T2 parts, zones, actions                 │
│    - GridDraw: Shows damage grid (parts_visual.yaml)             │
│    - Processors: Execute JS logic on part selection              │
│    - Results: Display calculation table                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. USER SUBMITS CALCULATION                                      │
│    POST /api/v1/user/calculation                                 │
│    Saves: { carClass, carBody, selectedParts, repairQuality,     │
│             calculations, paint, gridDamage, ... }               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Data Processing Pipeline

### CSV Parsing & Caching

**File:** [src/utils/mod.rs]

**Process:**
1. **Load file from filesystem** - with user repo overlay (user > common)
2. **Parse CSV with header** - preserves column order with `IndexMap`
3. **Cache in memory** - `Arc<Vec<IndexMap>>` for fast re-access
4. **Invalidate on edit** - when file is updated via editor

**Cache Key:** File path (inode-based tracking prevents stale data)

### T1 Filtering

**File:** [src/calc/cars.rs]

```rust
pub fn parse_csv_t1(path) -> Result<Vec<CarPart>> {
  // Read CSV, deserialize each row into CarPart struct
  // Fields mapped via serde #[serde(rename = "...")] attributes
}

// Usage in endpoint:
let cars_data = parse_csv_t1(&cars_path)?;
let filtered: Vec<CarPart> = cars_data
  .into_iter()
  .filter(|p| p.class == requested_class && p.type_field == body_type)
  .collect();
```

### T2 Parsing & Filtering

**File:** [src/calc/t2.rs]

**Step 1: Load all T2 rows**
```rust
pub async fn t2_rows_by_body_type(
  car_type: &str,
  user_email: &str,
  data_dir: &PathBuf,
  cache: &DataStorageCache,
) -> Result<Vec<IndexMap>> {
  // 1. Resolve user file path
  // 2. Parse CSV (cached)
  // 3. Filter rows where "ТИП КУЗОВА" == car_type
  // 4. Log match count + any empty results warning
}
```

**Step 2: Parse individual row into T2PartEntry**
```rust
pub fn t2_parse_row(row: IndexMap) -> Result<T2PartEntry> {
  // 1. Validate required fields present
  // 2. Extract part names (detalь 1, деtalь 2)
  // 3. If деtalь 2 empty: group = None, name = деtalь 1
  // 4. If деtalь 2 filled: group = деtalь 1, name = деtalь 2
  // 5. Extract actions (assemble, paint, repair, etc.)
  // 6. Return T2PartEntry struct
}
```

### Validation Rules

**File:** [src/models/table_validation.rs]

**Auto-Fix Checks:**
- Trailing/leading whitespace → trimmed
- Wrong column names → renames (e.g., "Деталь" → "Список деталь укр")
- Incorrect delimiters → warns user
- Missing required columns → error with suggestions

**Validation Process:**
```rust
pub async fn find_issues_with_csv_async(path) -> Result<Vec<String>> {
  // Returns list of issues found
}

pub async fn fix_issues_with_csv_async(path) -> Result<Vec<String>> {
  // Fixes issues, rewrites CSV, invalidates cache
  // Returns list of fixes applied
}
```

---

## Frontend Components & T1/T2 Integration

### Component: CarBodyMain

**File:** [carpaintr-front/src/components/calc/CarBodyMain.jsx]

**Data Dependencies:**
1. **T2 Parts** - Via `GET /api/v1/user/carparts_t2/{class}/{body}`
2. **Parts Visual** - Via `GET /api/v1/user/global/parts_visual.yaml`
3. **Repair Types** - Via `GET /api/v1/user/repair_types`
4. **Processors** - Via `GET /api/v1/user/plugins`

**Processing Pipeline:**
```javascript
1. Fetch T2 data filtered by car class + body
   └─ buildCarSubcomponentsFromT2(t2Data)
   └─ Build zones/parts tree structure

2. For each selected part:
   ├─ Load parts_visual.yaml
   ├─ Generate damage grid (GridDraw)
   ├─ Load available repair types
   └─ Load applicable processors

3. When action selected:
   ├─ Validate processor requirements
   ├─ Evaluate shouldRun() condition
   ├─ Execute processor.run()
   ├─ Evaluate result.estimate expressions
   └─ Display EvaluationResultsTable

4. When all parts selected:
   └─ Save to stageData.parts: {
       selectedParts,
       calculations,
       repairQuality,
       partsVisual
     }
```

### Component: BodyPartsStage

**File:** [carpaintr-front/src/components/calc/BodyPartsStage.jsx]

**Fetches:**
```javascript
// Global config files
const partsVisualData = await authFetchYaml("/api/v1/user/global/parts_visual.yaml");
const qualityData = await authFetchYaml("/api/v1/user/global/quality.yaml");
```

**State Management:**
```javascript
const [selectedParts, setSelectedParts] = useState([]); // Array of T2PartEntry
const [calculations, setCalculations] = useState({}); // Map of part → processor results
const [repairQuality, setRepairQuality] = useState(""); // "economy", "standard", etc.
const [partsVisual, setPartsVisual] = useState({}); // Grid configs
```

---

## Data Validation & Error Handling

### Validation Layers

**Layer 1: CSV Structure**
- Delimiter check (must be comma)
- Header presence
- Column count consistency

**Layer 2: Field Requirements**
- Required columns for T1: class, type, detail_ukr
- Required columns for T2: zone, part 1, blueprint, body type, all actions
- Required values: part 1 cannot be empty

**Layer 3: Processor Safety**
- JavaScript syntax validation
- Required tables check
- Repair type support verification
- Sandbox execution (no global access)

### Error Reporting

**Backend Logging:** [src/exlogging.rs]
```rust
log_event(LogLevel::Debug, "T2 loaded 150 rows", Some(user_email));
log_event(LogLevel::Warn, "No rows matched car_type='sedan'", Some(user_email));
log_event(LogLevel::Error, "Missing required field: зона", Some(user_email));
```

**Frontend Error Display:**
```javascript
// Via RSuite toaster
toaster.push(
  <Message type="error" showIcon>
    {errorMessage}
  </Message>,
  { placement: 'topCenter', duration: 5000 }
);
```

---

## Caching Strategy

**Purpose:** Prevent repeated CSV parsing on every request

**Implementation:** [DataStorageCache]

```rust
pub struct DataStorageCache {
  cache: Arc<DashMap<PathBuf, Arc<Vec<IndexMap>>>>,
}

impl DataStorageCache {
  pub async fn get_or_parse(&self, path) -> Result<Arc<Vec<IndexMap>>> {
    if let Some(cached) = self.cache.get(path) {
      return Ok(cached.clone());
    }
    let data = parse_csv(path)?;
    self.cache.insert(path, Arc::new(data));
    Ok(Arc::new(data))
  }

  pub async fn invalidate(&self, path) {
    self.cache.remove(path);
  }
}
```

**Invalidation Triggers:**
- File edited in editor → `POST /api/v1/editor/commit`
- User data updated → explicit cache invalidate call

---

## Common Issues & Debugging

### T2 Rows Not Appearing

**Symptom:** Selected car part but no rows show in table

**Checklist:**
1. ✅ Check T2 CSV exists at `tables/t2.csv`
2. ✅ Verify `ТИП КУЗОВА` column contains selected body type (e.g., "sedan")
3. ✅ Check part name matches `деталь 1` or `деталь 2` in T2
4. ✅ Verify required columns present: зона, деталь 1, Схема кузова, all action columns
5. ✅ Check backend logs: `grep "T2 rows" application.log`

**Debug:**
```javascript
// Frontend: check what T2 data was returned
console.log("T2 data:", t2_rows);
console.log("Selected body type:", bodyType);
console.log("Filtered rows:", t2_rows.filter(r => r["ТИП КУЗОВА"] === bodyType));
```

### In-App Processor Debug Panel (Primary Debugging Tool)

Each selected part in the body parts stage has a **"?" button** (bottom-right of the part panel) that opens a per-part debug panel showing exactly why each processor ran, was skipped, or failed.

**Components:** `PartDebugPanel` and `ProcessorLogEntry` in `CarBodyMainDebug.jsx`

**Each log entry shows:**
- ✅ `applied` — processor ran and produced rows (green row)
- ⏭ `skipped` — processor deliberately did not run (grey row)
- ❌ `error` — processor crashed or a required table was null (red row)

**Skip/error reasons:**
| `reason` | Meaning | Fix |
|----------|---------|-----|
| `missing_table` | `requiredTables` key not found in loaded tableData | Check table name spelling vs filename (without extension) |
| `null_table` | Table key present but server returned no rows for this part | Part has no matching rows in that table's CSV |
| `unsupported_action` | `requiredRepairTypes` doesn't include the selected action | Add the Ukrainian repair type string to `requiredRepairTypes` |
| `shouldRun_false` | `shouldRun()` returned false | Logic condition not met for this part/action |
| `shouldRun_threw` | `shouldRun()` threw an exception | JavaScript error in the `shouldRun` function body |
| `run_threw` | `run()` threw an exception | JavaScript error in the `run` function body; detail includes required/available/null table lists |

**Clickable links in debug panel:**
- **U / C badges** next to processor name → open `procs/` directory in file editor (User or Common fs) in a new tab
- **Table chips** (indigo pills) → open the specific table CSV in file editor, linking to User fs if the user has overridden it, Common fs otherwise

**Also available:** The ⚙️ button (top-right of the car diagram area) opens a global tech data panel (`TechDataPanel` in `CarBodyMainDebug.jsx`) showing company info, loaded processors, all fetched table data, and error log — useful for checking what data actually loaded.

**State:** `evaluatorLogs` in `CarBodyMain` is always populated during evaluation (not gated on debug mode). It is keyed by part name and contains the full log array for that part.

### Processor Not Running

**Symptom:** Processor appears in list but doesn't execute

**First: open the "?" debug panel** for the affected part — it shows the exact reason per processor (see above).

**Check RequiredTables:**
```javascript
// Processor requires t1 table but it's not loaded
validate_requirements(processor, tableData) // Returns "t1"
```

**Check shouldRun():**
```javascript
// Condition failed - check if part/action match
should_evaluate_processor(processor, {
  carPart, tableData, repairAction, ...
}) // Returns false
```

**Check Syntax Error:**
```javascript
// Evaluate caught exception
evaluate_processor(processor, stuff)
// Returns: { error: SyntaxError, ... }
```

### Grid Not Showing Correctly

**Issue:** Damage grid doesn't match part shape

**Solution:** Update `parts_visual.yaml`
```yaml
"Front bumper":
  x: 5        # Adjust width
  y: 3        # Adjust height
  unused: ["0,0", "4,2"]  # Mark missing cells
```

**Test:**
```javascript
// Frontend: verify grid loaded
console.log("Visual config:", partsVisual["Front bumper"]);
// Should show {x: 5, y: 3, unused: [...]}
```

---

## Key File References

| File | Purpose |
|------|---------|
| `backend-service-rust/src/calc/t2.rs` | T2 parsing & filtering |
| `backend-service-rust/src/calc/cars.rs` | Car/part data structures |
| `backend-service-rust/src/calc/constants.rs` | Field name constants |
| `backend-service-rust/src/calc/table_processing.rs` | CSV validation & fixing |
| `backend-service-rust/src/api/v1/calc/data_endpoints.rs` | API endpoints (GET carparts, GET carparts_t2) |
| `backend-service-rust/src/api/v1/calc/plugin_endpoints.rs` | Processor bundling |
| `carpaintr-front/src/calc/processor_evaluator.js` | Processor execution & validation |
| `carpaintr-front/src/components/calc/CarBodyMain.jsx` | T2 rendering & processor execution |
| `carpaintr-front/src/components/calc/BodyPartsStage.jsx` | Global config loading |

---

## Architecture Summary

**T1 Tables:**
- Master catalog of car parts
- Organized by class + body type
- Filtered via API endpoint
- Rendered in part selector

**T2 Tables:**
- Repair zone/action breakdown
- Links parts to labor times
- Sub-components supported (деталь 1/2 hierarchy)
- Filtered by body type

**Processors:**
- User-configurable JavaScript functions
- Transform T1/T2 into calculation rows
- Validated before execution (requirements, sandbox)
- Executed in frontend sandbox (no global access)

**Global Files:**
- `parts_visual.yaml` - Grid layouts for damage mapping
- `quality.yaml` - Repair quality levels
- `colors.json` - Paint color catalog
- `seasons.yaml` - Time adjustments
- `repair_types.csv` - Available actions

**Data Flow:**
- File Editor → Backend Parser → API Endpoints → Frontend Components → UI Display
- All T1/T2 data cached in memory, invalidated on edit
- Processors downloaded as bundled JavaScript
- All calculations stored in localStorage/stageData during wizard

---

---

## Deployment: Accessing & Fixing Data in Kubernetes

### Pod & Data Location

```bash
# List running pods (dev namespace)
kubectl get pods -n autolab-dev

# Main backend pod name pattern: autolab-dev-autolab-api-0
# Data lives at /app/data/ inside the pod

kubectl exec -n autolab-dev autolab-dev-autolab-api-0 -- sh -c 'ls /app/data/'
# → common/  users/

# Find all t2.csv files (common + per-user)
kubectl exec -n autolab-dev autolab-dev-autolab-api-0 -- sh -c \
  'find /app/data -name "t2.csv"'
# → /app/data/common/tables/t2.csv
# → /app/data/users/alexgrek%2Ehq%40gmail%2Ecom/catalog/tables/t2.csv
```

**Note:** The pod has NO Python. Use `sed`, `grep`, `awk`, or `sh` for in-pod data fixes.

### Checking Data Quality In-Pod

```bash
# Check for trailing period bug in body type columns
kubectl exec -n autolab-dev autolab-dev-autolab-api-0 -- sh -c \
  'grep -o "ХЕТЧБЕК 3 двери[^,\"]*" /app/data/common/tables/t2.csv | sort -u'

# Verify fix applied
kubectl exec -n autolab-dev autolab-dev-autolab-api-0 -- sh -c \
  'grep -c "ХЕТЧБЕК 3 двери\." /app/data/common/tables/t2.csv || echo "CLEAN"'
```

### Applying CSV Fixes In-Pod (sed, no Python)

```bash
# Fix trailing period on ХЕТЧБЕК 3 двери. in ALL t2.csv files
kubectl exec -n autolab-dev autolab-dev-autolab-api-0 -- sh -c '
for f in /app/data/common/tables/t2.csv $(find /app/data/users -name "t2.csv" 2>/dev/null); do
  sed -i "s/ХЕТЧБЕК 3 двери\./ХЕТЧБЕК 3 двери/g" "$f"
  echo "Fixed: $f"
done'
```

### Applying Fixes Locally (Python available)

Use the script at `scripts/fix_t2_body_types.py`:
```bash
python3 scripts/fix_t2_body_types.py --dry-run   # preview
python3 scripts/fix_t2_body_types.py              # apply
```

Local data directories that need fixing are listed in the script. All 4 copies of t2.csv exist locally in different data dirs.

### Flushing Backend Cache After Data Fix

The backend caches CSV files in memory. After fixing data in-pod:

```bash
# Restart the statefulset to flush cache
kubectl rollout restart statefulset/autolab-dev-autolab-api -n autolab-dev

# Wait for readiness
kubectl rollout status statefulset/autolab-dev-autolab-api -n autolab-dev --timeout=60s
```

Alternatively, saving any file via the file editor triggers cache invalidation for that specific file without a restart.

### Known Data Issues (Fixed)

| Issue | Location | Fix Applied |
|-------|----------|-------------|
| `"ХЕТЧБЕК 3 двери."` trailing period in all `ТИП КУЗОВАn` columns | All `t2.csv` files | `sed -i "s/ХЕТЧБЕК 3 двери\./ХЕТЧБЕК 3 двери/g"` |
| Wrong `requiredTables` name in processor | `Розібрати_зібрати_для_заміни.js` | Must use `"Арматурные работы"` not `"Работы арматурные"` |
| `requiredRepairTypes` using T2 codes instead of Ukrainian names | Processor files | Use Ukrainian strings from `repair_types.csv` |
| `"Крило заднє праве"` — all 12 rows had empty `ТИП КУЗОВАn` columns | All `t2.csv` files | Fill columns with same body types as `"Крило заднє ліве"` rows (see below) |

### Case Study: "Крило заднє праве" returns no data

**Symptom:** Selecting "Крило заднє праве" (rear right fender) in the UI shows no parts/actions, while "Крило заднє ліве" (rear left fender) works correctly.

**Root cause:** The 12 rows for `Крило заднє праве` in `t2.csv` had all 8 `ТИП КУЗОВАn` columns left empty. The backend filters T2 rows by matching any `ТИП КУЗОВАn` column against the requested body type — empty columns means no row ever matches, so zero results are returned for any body type.

**How to diagnose:** `grep "Крило заднє праве" tables/t2.csv | head -2` — if rows start with `,,,,,,,,,Крило заднє праве,` (9 leading commas) the body type columns are missing.

**Fix (Python, all 4 local copies):**
```python
import re
REPLACEMENT = '"Рис.1 дв, ,  Рис.2дв.",ХЕТЧБЕК 3 двери,ХЕТЧБЕК 5 дверей,КУПЕ,ЛИФТБЭК 5 дверей,СЕДАН,УНИВЕРСАЛ,ВНЕДОРОЖНИК 3 дверный,ВНЕДОРОЖНИК 5 дверный,Крило заднє праве,'
content = re.sub(r'^,{8},Крило заднє праве,', REPLACEMENT, content, flags=re.MULTILINE)
```

**Sync to cluster (common file only — no per-user override for this part):**
```bash
kubectl cp common/tables/t2.csv autolab-dev/autolab-dev-autolab-api-0:/app/data/common/tables/t2.csv
kubectl rollout restart statefulset/autolab-dev-autolab-api -n autolab-dev
kubectl rollout status statefulset/autolab-dev-autolab-api -n autolab-dev --timeout=60s
```

**General pattern:** Any part that appears in T2 with empty body type columns will be invisible in all body type views. When a right-side part (праве/правий) shows no data but its left-side mirror (ліве/лівий) works, this is the first thing to check.

---

**Last Updated:** 2026-04-06
**Expertise Level:** Data Architecture Expert
**Scope:** Complete T1/T2/Processor ecosystem
