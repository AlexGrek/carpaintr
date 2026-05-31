/**
 * App routes covered by Cypress (see cypress/e2e/*-routes.cy.js).
 * `expect` is a stable data-testid on the loaded page.
 */

export const PUBLIC_ROUTES = [
  { path: "/", expect: "landing-page" },
  { path: "/app/login", expect: "login-page" },
  { path: "/app/register", expect: "register-page" },
];

/** Direct navigation (seed user with license). */
export const AUTHENTICATED_ROUTES = [
  { path: "/app/dashboard", expect: "dashboard-page" },
  { path: "/app/calc2", expect: "calc-main-create-new-button" },
  { path: "/app/fileeditor", expect: "fileeditor-page" },
  { path: "/app/catalog", urlIncludes: "/app/catalog/cars", expect: "catalog-page" },
  { path: "/app/catalog/cars", expect: "catalog-page" },
  { path: "/app/catalog/parts", expect: "catalog-page" },
  { path: "/app/catalog/processors", expect: "catalog-page" },
  { path: "/app/templates", expect: "templates-page" },
  { path: "/app/cabinet", expect: "cabinet-page" },
  { path: "/app/notifications", expect: "notifications-page" },
  { path: "/app/wip", expect: "wip-page" },
  { path: "/app/license", expect: "license-page" },
  { path: "/app/history", expect: "history-page" },
  { path: "/app/aboutus", expect: "about-page" },
  { path: "/app/company", expect: "company-info-page" },
  { path: "/app/report", expect: "report-page" },
  { path: "/app/create-proc", expect: "create-proc-page" },
];

/** Dashboard app cards (UsersDashboard). */
export const DASHBOARD_APP_CARDS = [
  { testId: "dashboard-app-calc2", path: "/app/calc2", expect: "calc-main-create-new-button" },
  { testId: "dashboard-app-fileeditor", path: "/app/fileeditor", expect: "fileeditor-page" },
  { testId: "dashboard-app-catalog", path: "/app/catalog", urlIncludes: "/app/catalog", expect: "catalog-page" },
  { testId: "dashboard-app-templates", path: "/app/templates", expect: "templates-page" },
  { testId: "dashboard-app-cabinet", path: "/app/cabinet", expect: "cabinet-page" },
  { testId: "dashboard-app-notifications", path: "/app/notifications", expect: "notifications-page" },
  { testId: "dashboard-app-wip-tasks", path: "/app/wip", expect: "wip-page" },
];

export const CATALOG_TABS = ["cars", "parts", "processors", "data"];
