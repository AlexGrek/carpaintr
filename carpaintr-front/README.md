# Carpaintr Frontend

React 19 SPA for Carpaintr (Autolab): car paint calculation and management. Part of the three-service stack (Frontend -> Backend API -> PDF Service).

## Tech Stack

- **Framework**: React 19
- **Build**: Vite 7
- **UI**: RSuite, TailwindCSS 4
- **Icons**: lucide-react
- **Responsive**: react-responsive
- **Routing**: React Router DOM
- **Localization**: English and Ukrainian (custom LocaleContext)

## Prerequisites

- Node.js v24+
- Backend running at `localhost:8080` for full app (or use `task dev` from repo root)

## Quick Start

From the **repository root** (recommended):

```bash
# Full stack (frontend + backend with hot reload)
task dev
```

From this directory:

```bash
npm install
npm run dev
```

App: http://localhost:3000. The dev server proxies `/api` to `http://localhost:8080`.

## Commands

| Command            | Description              |
| ------------------ | ------------------------ |
| `npm run dev`      | Start Vite dev server    |
| `npm run build`    | Production build         |
| `npm run preview`  | Preview production build |
| `npm run lint`     | Run ESLint               |
| `npm run lint:fix` | Fix ESLint issues        |
| `npx tsc --noEmit` | Type check               |

From repo root: `task frontend` runs the dev server; `task dev` runs frontend + backend.

## Project Structure

```
src/
├── pages/               # Top-level pages (lazy-loaded)
├── components/
│   ├── layout/          # StageView, BottomStickyLayout
│   ├── calc/            # CarBodyMain, ColorPicker, etc.
│   └── ColorGrid.jsx    # Shared color grid
├── localization/        # LocaleContext, Trans (custom)
├── utils/
│   ├── authFetch.js     # API wrappers with JWT
│   └── storage.js       # localStorage helpers
└── App.jsx              # Root and routing
```

## Key Patterns

### API calls

All API calls use `authFetch.js`; JWT is added automatically.

```javascript
import { authFetchJson, authFetchYaml } from "../utils/authFetch";

const data = await authFetchJson("/api/v1/user/endpoint");
const config = await authFetchYaml("/api/v1/user/config.yaml");
```

### Localization (custom)

- **Files**: `src/localization/LocaleContext.jsx`, `Trans.jsx`
- **Languages**: `en`, `ua`

```javascript
import { useLocale, registerTranslations } from "../localization/LocaleContext";
import Trans from "../localization/Trans";

registerTranslations("ua", { "My button": "..." });

const MyComponent = () => {
  const { str } = useLocale();
  return (
    <>
      <Trans>Welcome</Trans>
      <button>{str("My button")}</button>
    </>
  );
};
```

### Error feedback

Use RSuite `Message` and `toaster`:

```javascript
import { Message, toaster } from "rsuite";

toaster.push(
  <Message type="error" showIcon closable>Error message</Message>,
  { placement: "topCenter", duration: 5000 }
);
```

### Responsive

```javascript
import { useMediaQuery } from "react-responsive";

const isMobile = useMediaQuery({ maxWidth: 767 });
```

## Layout Components

### StageView (`src/components/layout/StageView.jsx`)

Multi-step wizard with transitions. Stages receive `stageData`, `setStageData`, `onMoveForward`, `onMoveBack`, `onMoveTo`, etc.

```javascript
<StageView
  stages={[
    { name: "step1", component: Step1 },
    { name: "step2", component: Step2 },
  ]}
  initialState={{}}
  animationDelay={300}
  onSave={(data) => {}}
/>
```

### BottomStickyLayout (`src/components/layout/BottomStickyLayout.jsx`)

Sticky bottom panel on mobile (<=767px), static with margin on desktop. Use for nav buttons.

```javascript
<BottomStickyLayout bottomPanel={<HStack>...</HStack>}>
  {content}
</BottomStickyLayout>
```

## Calculation Components

- **CarBodyMain** – Car body diagram; fetches `/api/v1/user/carparts/{class}/{body}` and `carparts_t2/...`.
- **ColorPicker** – Color grid; fetches `/api/v1/user/global/colors.json`, uses `ColorGrid`.
- **ColorGrid** – 4-column grid for color swatches (shared component).
- etc.

## Adding a New Page

1. Add a component under `src/pages/`.
2. In `App.jsx`, lazy-load and add a route:

```javascript
const NewPage = React.lazy(() => import("./pages/NewPage"));

<Route path="/new-feature" element={<NewPage />} />
```

Prefer RSuite for forms/buttons/modals and TailwindCSS for layout/spacing. Avoid `React.lazy()` for nested components inside StageView to prevent extra loading delays.

## Styling

- **RSuite** – Buttons, panels, forms, modals.
- **TailwindCSS** – Layout, spacing, utilities.
- **Custom CSS** – e.g. `ColorGrid.css`, `BottomStickyLayout.css` for complex layouts.
- **Inline styles** – For component-specific tweaks.

## Documentation

- **Development (full stack)**: [docs/development.md](../docs/development.md)
- **Deployment**: [docs/deployment.md](../docs/deployment.md)
- **Project overview**: [README.md](../README.md)
- **AI / contributor context**: [CLAUDE.md](../CLAUDE.md)

## Troubleshooting

- **Build/lint errors**: From `carpaintr-front`, run `rm -rf node_modules package-lock.json && npm install`.
- **API 404/network**: Ensure backend is running on port 8080 and Vite proxy is used (dev server proxies `/api` to 8080).
- **Node**: Use Node v24+ (`node --version`).
