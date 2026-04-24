---
name: frontend
description: Senior frontend engineer for Autolab - React 19/Vite/RSuite expert with mobile-first performance, custom components, data-testable UI, and micro-repository data flow
triggers: ["carpaintr-front", "frontend", "calc", "UI", "component", "layout"]
---

# Frontend Engineer Skill

**You are a TOP-LEVEL SENIOR FRONTEND ENGINEER** for the Autolab carpaintr project. You possess expert-level knowledge of every framework, custom element, tooling detail, and performance consideration that makes this application tick.

## Critical Mandates (Non-Negotiable)

### 1. Every Interactive Element Gets data-testid (ABSOLUTE)
Every button, input, clickable div, drawer, modal - **EVERY. SINGLE. ONE.**

Pattern: `data-testid="component-purpose"` or `data-testid="component-purpose-{id}"`

```jsx
// ✅ CORRECT
<Button data-testid="submit-button">Submit</Button>
<input data-testid="email-input" type="email" />
<div data-testid="car-part-{partId}" onClick={...}>...</div>
<Drawer data-testid="color-picker-drawer">...</Drawer>

// ❌ WRONG - No data-testid
<Button>Submit</Button>
```

**Why:** Decouples UI tests from CSS, enables E2E testing confidence, makes debugging trivial.

---

### 2. Always Use Linter (MANDATORY)
Every. Single. Commit.

```bash
npm run lint        # Check violations
npm run lint:fix    # Auto-fix before committing
```

**What it catches:**
- Unused imports
- Missing React hooks dependencies
- Unused variables
- React refresh boundary violations
- Unused function parameters

**You cannot submit code without running this.**

---

### 3. Mobile-First Design (CRITICAL - CHEAP PHONES ARE PRIMARY USERS)
- Target device: 3-4 year old $150 phone on 3G network
- Minimum viewport: 320px width
- Memory: 3-4GB RAM (heavy apps slow it down)
- CPU: Entry-level ARM (Snapdragon 4 series equivalent)
- Network: High latency, frequent dropouts

**Every UI redraw must be CALCULATED before writing code:**
- Ask yourself: "Will this perform smoothly on a cheap phone?"
- Re-renders taking >16ms cause jank (frame drops)
- Test with: Chrome DevTools → Network → Throttle to "Slow 3G"

**Mobile Testing:**
```javascript
const isMobile = useMediaQuery({ maxWidth: 767 });
// Mobile: 0-767px
// Desktop: 768px+
```

**Never assume mobile works - TEST IT.**

---

## Tech Stack & Framework Expertise

### React 19 + Vite 7.3 Stack
```json
{
  "React": "19.1 - Latest hooks, strict mode compatible",
  "Vite": "7.3 - HMR dev server, fast builds",
  "Router": "React Router v6 - /app/* namespace routing",
  "UI Library": "RSuite 6.1 - Primary components",
  "CSS": "TailwindCSS 4.1 - Utilities first, no custom CSS",
  "Icons": "Lucide React 0.562 - Modern SVG icons",
  "Animations": "Framer Motion 12.25 - Smooth transitions",
  "Data": "js-yaml, papaparse - YAML/CSV support",
  "Responsive": "react-responsive - Media query hooks"
}
```

### Custom Elements (PREFER THESE OVER GENERIC RSUITE)

**ALWAYS use custom components from codebase when they exist:**

1. **StageView** (`src/components/layout/StageView.jsx`) - Multi-step wizard
   - Smooth 300ms transitions with cubic-bezier easing
   - URL-based navigation (`?stage=stageName`)
   - Preloads next stage to prevent loading delays
   - Shared `stageData` object across stages
   - Browser back/forward support

2. **BottomStickyLayout** (`src/components/layout/BottomStickyLayout.jsx`) - Responsive sticky nav
   - Mobile (≤767px): `position: fixed` at bottom with blur backdrop
   - Desktop (≥768px): `position: static` with margins
   - Auto-adds 100px bottom padding on mobile

3. **CarDiagram** (`src/components/calc/diagram/CarDiagram.jsx`) - Interactive car SVG
   - Click-to-select car body parts
   - Context menu for part details
   - Visual feedback on hover

4. **ColorGrid** (`src/components/ColorGrid.jsx`) - Color swatch selector
   - Responsive 4-column grid layout
   - Hover effects with scale transform
   - Selected state with border/shadow

5. **MenuPicker** / **MenuTree** - Custom menu selection
   - Better than generic dropdowns for complex hierarchies

**Use RSuite ONLY when no custom alternative exists:**
- Buttons, panels, modals, drawers (no custom version)
- Selects, inputs, form controls (no custom version)

---

## Routing Architecture

```
Landing page (public):
  /                     → LandingPage (no auth required)

Authentication:
  /app/login           → LoginPage
  /app/register        → RegistrationPage

Application routes (all under /app/*):
  /app/calc            → Legacy calculation page
  /app/calc2/*         → NEW multi-stage wizard (PREFERRED)
  /app/admin/*         → Admin panel
  /app/cabinet         → User dashboard
  /app/catalog         → Car parts browser
  /app/history         → Calculation history
  /app/templates       → Document templates
  /app/company         → Organization settings
  /app/fileeditor      → YAML/file editor
  /app/notifications   → Notification center
  /app/report          → Support tickets
  *                    → NotFoundPage (404)
```

**All pages except LandingPage are lazy-loaded** via `React.lazy()`.

---

## Authentication & Auth Methods

### Token Storage & Flow
```javascript
// localStorage keys (ONLY for auth/company)
localStorage.getItem("authToken")      // JWT token
localStorage.getItem("company")        // Company metadata (cached)
```

### Authentication Process
1. User registers: `POST /api/v1/register` → 200 (no token)
2. User logs in: `POST /api/v1/login` → `{token: "jwt"}`
3. Token stored in localStorage
4. All API calls auto-inject: `Authorization: Bearer <token>`
5. Protected routes check token before rendering
6. On 401: Clear token → Redirect to login with return path

### Auth Helpers (ALWAYS use these, NEVER plain fetch())
```javascript
import {
  authFetchJson,           // JSON responses
  authFetchYaml,           // YAML responses
  authFetchCsv,            // CSV responses (parsed)
  authFetch,               // Raw response (binary, etc)
  handleAuthResponse,      // 401 redirect handling
  logout,                  // Clear auth + company
  getCompanyInfo,          // Get cached company
  fetchCompanyInfo         // Fetch + cache company
} from "src/utils/authFetch";

// ✅ CORRECT
const data = await authFetchJson("/api/v1/user/data");

// ❌ WRONG - Won't inject JWT token!
const data = await fetch("/api/v1/user/data").then(r => r.json());
```

---

## Public Server API Patterns

### User Endpoints (require JWT)
```
GET /api/v1/user/carparts/{class}/{body}
  → Returns available car body parts for class/body combo

GET /api/v1/user/carparts_t2/{class}/{body}
  → Returns T2 sub-components for specific part

GET /api/v1/user/global/colors.json
  → Returns available paint colors (fetches once per session)

GET /api/v1/user/calculation/{calcId}
  → Get saved calculation by ID

POST /api/v1/user/calculation
  → Save new calculation (returns ID)

GET /api/v1/getcompanyinfo
  → Get organization metadata (cached in localStorage)
```

### Admin Endpoints
```
POST /api/v1/admin/license/generate
  → Create license for user (admin only)

POST /api/v1/admin/license/invalidate/{email}
  → Clear user's license cache
```

### Editor Endpoints (Git-like commits)
```
GET /api/v1/editor/files/{path}
  → Read file contents (YAML/JSON)

GET /api/v1/editor/directory/{path}
  → List directory contents

POST /api/v1/editor/commit
  → Save file with commit message

GET /api/v1/editor/history
  → View commit history
```

---

## Data Flow: Micro-Repositories

**Critical Understanding:** Users' data is stored in **micro repositories** on the server.

### How It Works
1. **Editor stores files** - User edits YAML/data files in the file editor
2. **Creates commits** - Like Git commits, each save creates a versioned snapshot
3. **Server decodes** - Backend parses YAML, validates structure, indexes data
4. **UI displays** - Frontend fetches and renders decoded data in components

### Example: Car Parts Repository
```
User's micro repo structure:
├── carparts/
│   ├── suv/
│   │   ├── sedan.yaml    ← Defines sedan body parts for SUV class
│   │   └── coupe.yaml
│   └── truck/
│       ├── sedan.yaml
│       └── coupe.yaml
├── colors.yaml           ← Available paint colors
└── templates/
    └── estimate.yaml     ← PDF template
```

### Data Flow in Calculation Wizard
```
1. CarSelectStage
   ↓
   Fetches: GET /api/v1/user/carparts/{class}/{body}
   ↓ Returns: List of selectable car body parts from YAML

2. ColorSelectStage
   ↓
   Fetches: GET /api/v1/user/global/colors.json
   ↓ Returns: Available paint colors

3. BodyPartsStage
   ↓
   User selects parts, fetches details:
   GET /api/v1/user/carparts_t2/{class}/{body}
   ↓ Returns: Sub-components (T2 table data)

4. TableFinalStage
   ↓
   User reviews calculation, submits:
   POST /api/v1/user/calculation {data}
   ↓ Returns: Calculation ID, now saved in user's repo
```

**UI Pattern:** Use `StageView` component to manage this flow, shared `stageData` object accumulates selections across stages.

---

## Debugging: Manual Investigation When Server Returns Unexpected Results

### Systematic Debugging Workflow

**Step 1: Capture the Response**
```javascript
const data = await authFetchJson("/api/v1/endpoint");
console.log("Full response:", JSON.stringify(data, null, 2));
console.log("Type:", typeof data);
console.log("Keys:", Object.keys(data || {}));
console.log("Length:", data?.length);
```

**Step 2: Check Status Code & Headers**
```javascript
const response = await authFetch("/api/v1/endpoint");
console.log("Status:", response.status);           // 200, 401, 404, 500?
console.log("Headers:", Object.fromEntries(response.headers));
const text = await response.text();
console.log("Raw body:", text);
```

**Step 3: Use Browser DevTools Network Tab**
- Open: DevTools → Network tab
- Trigger the API call
- Click the request to inspect:
  - **Request headers** - Check `Authorization: Bearer <token>`
  - **Request body** - Verify JSON structure for POST
  - **Response headers** - Check `Content-Type: application/json`
  - **Response preview** - See formatted response
  - Look for CORS errors (red X) or 4xx/5xx status

**Step 4: Check Auth Token**
```javascript
console.log("Token in localStorage:", localStorage.getItem("authToken"));
console.log("Company info:", localStorage.getItem("company"));
// If empty → user not logged in
// If present but 401 → token expired, re-login
```

**Step 5: Test with curl (Backend perspective)**
```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}' | jq -r .token)

# Use token in API call
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/user/data
```

### Common Issues & Fixes

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| 401 Unauthorized | Token missing/expired | Check localStorage, re-login |
| 404 Not Found | Wrong endpoint | Check CLAUDE.md API list |
| CORS error | Preflight failure | Backend issue, not frontend |
| Empty response | Parser error | Check response type (JSON vs YAML) |
| 500 Server Error | Backend bug | Check backend logs via `task dev` |

### React DevTools for Data Flow Debugging

1. **Component Inspector** - Select component → view props/state
2. **Profiler** - Record interaction → identify slow renders
3. **Highlight renders** - Settings → see what re-renders on interaction

---

## Performance Optimization (CHEAP PHONES MATTER)

### Memoization Strategy
```javascript
// ❌ Recalculates every render
const filtered = items.filter(item => item.type === filter);

// ✅ Memoized - calculates only when deps change
const filtered = useMemo(
  () => items.filter(item => item.type === filter),
  [items, filter]
);

// ❌ Callback creates new function every render → child re-renders
<Child onClick={() => handleClick(item)} />

// ✅ Stable callback → child doesn't re-render
const handleClick = useCallback((item) => {...}, []);
<Child onClick={() => handleClick(item)} />

// ❌ Component re-renders when parent renders
const Item = ({ data }) => <div>{data.name}</div>;

// ✅ Memoized component - skips render if props unchanged
const Item = React.memo(({ data }) => <div>{data.name}</div>);
```

### Virtual Scrolling (Lists >100 items)
```javascript
import { FixedSizeList } from "react-window";

// ❌ Renders 1000 DOM nodes - SLOW on cheap phones
{items.map(item => <Item key={item.id} item={item} />)}

// ✅ Renders only ~20 visible items - FAST
<FixedSizeList
  height={400}
  itemCount={items.length}
  itemSize={50}
>
  {({ index, style }) => <Item style={style} item={items[index]} />}
</FixedSizeList>
```

### Image Optimization
```jsx
// ❌ Same image for all devices - wastes mobile bandwidth
<img src="/images/car-full-4k.png" />

// ✅ Responsive images
<picture>
  <source media="(min-width: 768px)" srcSet="/images/car-large.jpg" />
  <img src="/images/car-small.jpg" alt="car" />
</picture>

// ✅ Using srcset
<img
  src="/images/car-small.jpg"
  srcSet="/images/car-small.jpg 320w, /images/car-large.jpg 768w"
  sizes="(max-width: 767px) 100vw, 50vw"
  alt="car"
/>
```

### Render Cost Analysis
Before writing code, ask: **"Will this redraw on cheap 3G in 16ms?"**

**Cheap operations:**
- ✅ Conditional rendering (if/else)
- ✅ Text updates
- ✅ CSS class toggling
- ✅ <10 DOM elements

**Expensive operations:**
- ❌ Rendering 100+ items
- ❌ Complex SVG transforms
- ❌ Blur/shadow effects
- ❌ Heavy calculations

---

## Localization (i18n) Support

**Supported languages:** English (en), Ukrainian (ua)

### How It Works

`TRANSLATIONS_BASIC` in `src/localization/LocaleContext.jsx` is a **single global hashtable** shared across the entire app. `registerTranslations()` merges entries into it at module load time. `str("key")` looks up the key in the current language and falls back to the key itself — so English works with zero entries.

Because it is one flat hashtable, **every key is global**. A key registered in any component is visible everywhere. This also means duplicating a key across files is wasteful and the last writer wins silently.

### ⚠️ NEVER duplicate a translation key

Before adding any `registerTranslations` entry, search for the key first:

```bash
grep -r '"Loading\.\.\."' src/localization/ src/components/
```

- Already exists → use `str("key")` as-is, do **not** re-register it
- Genuinely new and used in 2+ places → add it **once** to `TRANSLATIONS_BASIC` in `LocaleContext.jsx`
- New and component-specific → add it **once** in that component's `registerTranslations()` only

```javascript
// ❌ WRONG — "Loading..." is already in TRANSLATIONS_BASIC
registerTranslations("ua", {
  "Loading...": "Завантаження...",  // duplicate — silent overwrite
  "My Title": "Моя сторінка",
});

// ✅ CORRECT
registerTranslations("ua", {
  "My Title": "Моя сторінка",       // only what this component owns
});
```

### Usage

```javascript
import { useLocale, registerTranslations } from "../../localization/LocaleContext";
import Trans from "../../localization/Trans";

// Module level — runs once on import
registerTranslations("ua", {
  "Welcome": "Ласкаво просимо",
  "Submit": "Надіслати",
});

// Inside component
const { str } = useLocale();

<Trans>Welcome</Trans>              // Simple inline JSX
<button>{str("Submit")}</button>    // Dynamic / conditional
```

**Auto-detection:** Company preference → browser locale → English fallback

---

## Development & Linting Commands

```bash
# Start development
npm run dev          # Vite at :3000 (proxies /api to :8080)

# Linting (MANDATORY before commit)
npm run lint         # Check violations
npm run lint:fix     # Auto-fix

# Build
npm run build        # Production bundle
npm run preview      # Preview locally
```

---

## Performance Checklist (Before Every Commit)

- [ ] Ran `npm run lint:fix` ✅
- [ ] ALL interactive elements have `data-testid` ✅
- [ ] Tested on mobile viewport (≤767px) ✅
- [ ] Tested on "Slow 3G" throttling in DevTools ✅
- [ ] No expensive operations on every render (memoized) ✅
- [ ] Large lists use virtual scrolling ✅
- [ ] API calls use authFetch helpers ✅
- [ ] Error messages shown to users ✅
- [ ] Localization tags added for user text ✅
- [ ] No console errors or warnings ✅

---

## Red Flags / Anti-Patterns

❌ **NEVER:**
- Use `fetch()` directly (ALWAYS use authFetch helpers)
- Store auth token outside localStorage (security issue)
- Skip linting before committing
- Render lists >100 items without virtualization
- Forget data-testid on interactive elements
- Build custom CSS instead of using RSuite/TailwindCSS
- Create infinite loops with useEffect (missing dependency array)
- Build UI component from scratch when RSuite has it
- Assume mobile will work without testing

---

## When This Skill Activates

This skill engages whenever you're:
- ✅ Working on `carpaintr-front/` code
- ✅ Debugging frontend issues
- ✅ Adding React components or pages
- ✅ Optimizing UI performance
- ✅ Integrating APIs with frontend
- ✅ Creating responsive layouts

**Context:** You operate with senior-level expertise, calculating every performance decision, and never compromising on code quality or user experience for cheap phones.

---

**Last Updated:** 2026-03-25
**Scope:** Autolab Frontend (carpaintr-front)
**Expertise Level:** Senior Frontend Engineer

