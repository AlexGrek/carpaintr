# data-testid reference (frontend E2E)

Stable ids for Cypress. Grep source when unsure: `rg 'data-testid|dataTestId|testId' carpaintr-front/src`.

Route → testid mapping: `cypress/support/app-routes.js`.

## Page roots (smoke tests)

| testid | Route |
|--------|-------|
| `landing-page` | `/` |
| `login-page` | `/app/login` |
| `register-page` | `/app/register` |
| `dashboard-page` | `/app/dashboard` |
| `calc2-page` | `/app/calc2` (wrapper; menu uses `calc-main-create-new-button`) |
| `fileeditor-page` | `/app/fileeditor` |
| `catalog-page` | `/app/catalog/*` |
| `templates-page` | `/app/templates` |
| `cabinet-page` | `/app/cabinet` |
| `notifications-page` | `/app/notifications` |
| `wip-page` | `/app/wip` |
| `license-page` | `/app/license` |
| `history-page` | `/app/history` |
| `about-page` | `/app/aboutus` |
| `company-info-page` | `/app/company` |
| `report-page` | `/app/report` |
| `create-proc-page` | `/app/create-proc` |
| `not-found-page` | unknown paths |

## Landing (`landing/Landing.jsx`)

| testid | Element |
|--------|---------|
| `landing-login-link` | Header log in |
| `landing-register-link` | Header join |

## Login (`LoginPage.jsx`)

| testid | Element |
|--------|---------|
| `login-email-input` | Email |
| `login-password-input` | Password |
| `login-password-toggle` | Show/hide password |
| `login-submit-button` | Submit |
| `login-register-link` | Register link |
| `login-back-home-link` | Back to marketing |

## Dashboard (`UsersDashboard.jsx`)

| testid | Element |
|--------|---------|
| `dashboard-app-calc2` | Open calc v2 (link `/app/calc2`) |
| `dashboard-app-{slug}` | Other apps: slug from path, `/` → `-` |
| `dashboard-view-mode-*` | View mode toggles |

## Calc main menu (`CalcMainMenuStage.jsx`, `CreateCard.jsx`)

| testid | Element |
|--------|---------|
| `calc-main-create-new-button` | New calculation |
| `calc-main-resume-previous-button` | Continue unsaved |
| `calc-main-open-project-button` | Open drawer |
| `calc-main-open-project-drawer` | Saved projects drawer |

## Car select stage (`CarSelectStage.jsx`, `VehicleSelect.jsx`)

| testid | Element |
|--------|---------|
| `calc-car-select-stage` | Stage root |
| `calc-car-stage-accept-button` | Accept (needs class + body + year) |
| `calc-vehicle-class-picker` | Class `MenuPickerV2` |
| `calc-vehicle-class-picker-option-{class}` | e.g. `option-A` |
| `calc-vehicle-body-type-picker` | Body type picker |
| `calc-vehicle-body-type-picker-option-{value}` | Body option |
| `calc-vehicle-year-select` | Year `SelectPicker` |
| `calc-vehicle-switch-to-class-mode-link` | Manual class mode |
| `calc-vehicle-switch-to-model-mode-link` | Model mode |
| `calc-vehicle-make-select` | Make (model mode) |
| `calc-vehicle-model-select` | Model |
| `calc-vehicle-body-type-select` | Body (model mode) |
| `calc-vehicle-open-vin-decoder-link` | VIN decoder |
| `calc-vehicle-vin-decoder-modal` | VIN modal |
| `calc-vehicle-vin-input` | VIN field |
| `calc-vehicle-vin-decode-button` | Decode |
| `calc-vehicle-vin-close-button` | Close modal |
| `calc-car-make-input` | Extra make (after year set) |
| `calc-car-model-input` | Extra model |
| `calc-car-license-plate-input` | Plate |
| `calc-car-vin-input` | VIN optional |
| `calc-car-notes-input` | Notes |

## Color stage (`ColorSelectStage.jsx`, `ColorPicker.jsx`, `ColorGrid.jsx`)

| testid | Element |
|--------|---------|
| `calc-color-stage-back-button` | Back |
| `calc-color-stage-accept-button` | Accept (needs color + paintType) |
| `calc-color-picker` | Picker root (placeholder while loading) |
| `calc-color-grid-{n}-color-{slug}` | Color swatch |
| `calc-color-grid-{n}-container` | Grid wrapper — **not clickable for selection** |
| `calc-paint-type-select` | Paint type bubbles container |
| `calc-paint-type-select-option-{key}` | e.g. `simple`, `metallic` |

## Body parts (`BodyPartsStage.jsx`, `CarBodyMain.jsx`, `CarPart.jsx`, `ContextMenu.jsx`)

| testid | Element |
|--------|---------|
| `calc-body-parts-stage-back-button` | Back |
| `calc-body-parts-stage-accept-button` | Accept |
| `calc-car-part-{id}` | SVG part (e.g. `hood`) |
| `calc-car-part-context-menu` | Context menu |
| `calc-car-part-context-menu-close` | Close menu |
| `calc-car-part-menu-item-{slug}` | Menu action |
| `calc-car-part-menu-group-{slug}` | Menu group |
| `calc-body-debug-toggle-button` | Debug |
| `calc-body-tech-data-toggle-button` | Tech data |
| `calc-body-part-details-button-{slug}` | Part details |
| `calc-body-part-remove-button-{slug}` | Remove part |
| `calc-body-part-details-drawer` | Details drawer |
| `calc-body-part-details-cancel-button` | Cancel |
| `calc-body-part-details-save-button` | Save |
| `calc-body-part-damage-level-{value}` | Damage level |
| `calc-body-part-original-checkbox` | Original |
| `calc-body-part-replace-checkbox` | Replace |
| `calc-body-part-delete-modal` | Delete confirm |
| `calc-body-part-delete-confirm-button` | Confirm delete |
| `calc-body-part-delete-cancel-button` | Cancel delete |

## Final stage (`TableFinalStage.jsx`)

| testid | Element |
|--------|---------|
| `calc-final-stage-back-button` | Back |
| `calc-final-stage-save-button` | Save |
| `calc-final-stage-print-button` | Print |
| `calc-final-order-date-input` | Order date |
| `calc-final-order-number-input` | Order number |
