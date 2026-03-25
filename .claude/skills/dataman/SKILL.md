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

**Structure:** CSV with dynamic columns. Required columns:

```csv
зона,деталь 1,деталь 2,Схема кузова,ТИП КУЗОВА,розібрати/зібрати,усунення перекосу,замінити,зняти/встановити,ремонт,фарбування
A,Передній бампер,,bumper_schema,sedan,45,0,120,30,60,25
A,Капот,Основа,hood_main,sedan,30,0,90,20,50,20
```

**Field Definitions (from `src/calc/constants.rs`):**

**Core Fields:**
- **`зона`** (T2_ZONE) - Repair zone identifier (e.g., "A", "B", "hood")
- **`деталь 1`** (T2_PART_1) - Primary part name (required, cannot be empty)
- **`деталь 2`** (T2_PART_2) - Secondary/nested part (optional, e.g., "Основа" for "hood base")
- **`Схема кузова`** (T2_BLUEPRINT) - Reference to visual blueprint/schema name
- **`ТИП КУЗОВА`** (T2_BODY) - Body type (e.g., "sedan", "suv 5 doors")

**Action Fields (repair types):**
- **`розібрати/зібрати`** (T2_ACTION_ASSEMBLE) - Disassemble/assemble time
- **`усунення перекосу`** (T2_ACTION_TWIST) - Straighten/unbend time
- **`замінити`** (T2_ACTION_REPLACE) - Replace part time
- **`зняти/встановити`** (T2_ACTION_MOUNT) - Remove/install time
- **`ремонт`** (T2_ACTION_REPAIR) - Repair time
- **`фарбування`** (T2_ACTION_PAINT) - Paint/toning time

**Values:** Numeric (minutes of labor) or empty if action not applicable

**Backend Model:** [t2.rs:127-135]
```rust
pub struct T2PartEntry {
    pub name: String,           // Part name (detalь 2 if exists, else деtalь 1)
    pub group: Option<String>,  // Group name (деtalь 1) if деtalь 2 exists
    pub actions: HashSet<String>, // Set of applicable action names
    pub car_blueprint: String,  // Schema reference
    pub zone: String,           // Zone identifier
}
```

**API Endpoint for T2 Data:**
```
GET /api/v1/user/carparts_t2/{class}/{body_type}
```
- Returns T2PartEntry array filtered by body type
- Body type filtering checks `ТИП КУЗОВА` column
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
| `tableData` | object | All loaded T1 rows keyed by table name |
| `repairAction` | string | Selected action: "paint", "repair", "mount", etc. |
| `files` | object | Loaded YAML/JSON files from global/ |
| `carClass` | string | E.g., "A", "B" |
| `carBodyType` | string | E.g., "sedan", "suv 5 doors" |
| `carYear` | number | Vehicle year |
| `carModel` | string | E.g., "Camry" |
| `paint` | string | Paint color selected |
| `pricing` | object | Currency and pricing preferences |

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

#### 5. **repair_types.csv** - Available Repair Actions

```csv
Part Category,Repair Types
Body,розібрати/зібрати/усунення перекосу/замінити
Paint,фарбування/тонування
Interior,ремонт/заміна
```

**API Endpoint:**
```
GET /api/v1/user/repair_types
```

Returns unique repair type names from the CSV

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

### Processor Not Running

**Symptom:** Processor appears in list but doesn't execute

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

**Last Updated:** 2026-03-25
**Expertise Level:** Data Architecture Expert
**Scope:** Complete T1/T2/Processor ecosystem
