# Cypress source map (testid → file)

Compact index for agents. **Read only the listed file** for the area you are testing. Full inventory: [`.cursor/skills/test/test-ids.md`](../test/test-ids.md).

## E2E specs → flows

| Spec | Entry | Key commands |
|------|-------|--------------|
| `cypress/e2e/main-path.cy.js` | `dashboard-app-calc2` | `openNewCalculation`, `ensureVehicleClassPickerMode` |
| `cypress/e2e/full-calc-to-pdf.cy.js` | same + print drawer | `setCollapseTables`, `print-template-checkbox-*` |
| `cypress/e2e/collapse-tables.cy.js` | `reachCalcFinalStage` | `setCollapseTables`, `calc-final-collapse-*` |
| `cypress/e2e/public-routes.cy.js` | `app-routes.js` PUBLIC_ROUTES | — |
| `cypress/e2e/authenticated-routes.cy.js` | AUTHENTICATED_ROUTES | `loginAsSeedUser` |
| `cypress/e2e/dashboard-apps.cy.js` | DASHBOARD_APP_CARDS | — |
| `cypress/e2e/catalog-tabs.cy.js` | `catalog-page` | tab testids in catalog components |

## Page / route → component file

| Area | Primary file(s) | Root testid |
|------|-----------------|-------------|
| Landing | `src/components/landing/Landing.jsx` | `landing-page` |
| Login | `src/components/pages/LoginPage.jsx` | `login-page` |
| Dashboard | `src/components/pages/UsersDashboard.jsx` | `dashboard-page` |
| Calc2 page | `src/components/pages/CalcPageV2.jsx` | `calc2-page` |
| Calc menu | `src/components/calc/CalcMainMenuStage.jsx` | `calc-main-create-new-button` |
| Car stage | `src/components/calc/CarSelectStage.jsx`, `VehicleSelect.jsx` | `calc-car-select-stage` |
| Color stage | `src/components/calc/ColorSelectStage.jsx`, `ColorPicker.jsx` | `calc-color-picker` |
| Body parts | `src/components/calc/BodyPartsStage.jsx`, `CarBodyMain.jsx` | `calc-body-parts-stage-*` |
| Final tables | `src/components/calc/TableFinalStage.jsx` | `calc-final-*` |
| Print drawer | `src/components/PrintCalculationDrawer.jsx` | `print-calculation-drawer` |
| Catalog | `src/components/catalog/*` | `catalog-page` |

Routes: `cypress/support/app-routes.js`.

## Calc2 wizard stages (in order)

| Stage | Component | Accept button testid |
|-------|-----------|----------------------|
| Menu | `CalcMainMenuStage.jsx` | `calc-main-create-new-button` |
| Car | `CarSelectStage.jsx` | `calc-car-stage-accept-button` |
| Color | `ColorSelectStage.jsx` | `calc-color-stage-accept-button` |
| Body | `BodyPartsStage.jsx` | `calc-body-parts-stage-accept-button` |
| Final | `TableFinalStage.jsx` | `calc-final-stage-save-button`, `calc-final-stage-print-button` |

Stage registry: `src/components/calc/CalcMain.jsx` (`stages` array).

## Calc2 body / diagram

| UI | File | testid pattern |
|----|------|----------------|
| SVG parts | `src/components/calc/diagram/CarDiagram.jsx`, `CarPart.jsx` | `calc-car-part-{id}` |
| Context menu | `src/components/calc/diagram/ContextMenu.jsx` | `calc-car-part-context-menu`, `calc-car-part-menu-item-*` |
| Part list row | `CarBodyMain.jsx` | `calc-body-part-item-*`, `calc-body-part-details-button-*` |
| Part drawer | `CarBodyMain.jsx` (Drawer) | `calc-body-part-details-drawer`, `calc-body-part-action-picker` |
| Collapse tables | `TableFinalStage.jsx` | `calc-final-collapse-tables-checkbox`, `calc-final-collapse-readonly-note` |

## Shared utilities

| File | Role |
|------|------|
| `cypress/support/commands.js` | Custom commands — read before adding new ones |
| `cypress/support/e2e.js` | Imports commands |
| `cypress.config.js` | `baseUrl: localhost:3000` |
| `src/utils/authFetch.js` | API calls (not Cypress — for understanding login state) |

## Adding a new testid

1. Grep existing: `rg 'calc-final' carpaintr-front/src` (adjust prefix).
2. Add `data-testid="..."` on the JSX element (RSuite: prop on component root).
3. Add one line to `test-ids.md` under the right section.
4. If reusable flow → add command in `commands.js`.

## Dynamic testids

| Pattern | Example | Notes |
|---------|---------|-------|
| `calc-car-part-{camelCase}` | `calc-car-part-hood` | From diagram part id |
| `calc-color-grid-{n}-color-{slug}` | color swatch | Click swatch, not `-container` |
| `calc-final-table-{slug}` | part name lowercased | From part name in calculations |
| `print-template-checkbox-{template}` | template filename | RSuite Checkbox — click `label` or use `check()` on input |
| `dashboard-app-{slug}` | `dashboard-app-calc2` | From app path in `UsersDashboard.jsx` |
