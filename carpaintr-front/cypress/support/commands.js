const seededUserIndex = () =>
  Number(Cypress.env("E2E_SEEDED_USER_INDEX") || 1);

const seedCredentials = (index = seededUserIndex()) => ({
  email:
    Cypress.env("E2E_EMAIL") ||
    Cypress.env("CYPRESS_E2E_EMAIL") ||
    `user${index}@example.com`,
  password:
    Cypress.env("E2E_PASSWORD") ||
    Cypress.env("CYPRESS_E2E_PASSWORD") ||
    `test${index}`,
});

Cypress.Commands.add("getByTestId", (testId, options = {}) => {
  return cy.get(`[data-testid="${testId}"]`, options);
});

/**
 * Register a seed user via API (idempotent — 409 = already exists), then
 * generate a 365-day license via the bootstrap admin.
 * Call this once in a `before` block before `loginAsSeedUser`.
 */
Cypress.Commands.add("ensureSeedUserLicensed", (userIndex) => {
  const { email, password } = seedCredentials(
    userIndex != null ? Number(userIndex) : undefined,
  );
  const adminEmail = Cypress.env("ADMIN_EMAIL") || "admin@admin.com";
  const adminPassword = Cypress.env("ADMIN_PASSWORD") || "admin123";

  // Register seed user (ignore 409 conflict)
  cy.request({
    method: "POST",
    url: "/api/v1/register",
    body: { email, password, company_name: "Seed Company E2E" },
    failOnStatusCode: false,
  });

  // Register admin (ignore 409)
  cy.request({
    method: "POST",
    url: "/api/v1/register",
    body: { email: adminEmail, password: adminPassword, company_name: "Admin" },
    failOnStatusCode: false,
  });

  // Get admin token
  cy.request({
    method: "POST",
    url: "/api/v1/login",
    body: { email: adminEmail, password: adminPassword },
  }).then((resp) => {
    const adminToken = resp.body.token;
    // Generate license
    cy.request({
      method: "POST",
      url: "/api/v1/admin/license/generate",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { email, days: 365 },
      failOnStatusCode: false,
    });
  });
});

/**
 * Get a bearer token for a seed user via direct API login (no UI).
 * Used for setup/teardown requests (e.g. uploading a per-user table
 * override) that shouldn't go through the browser session.
 */
Cypress.Commands.add("getAuthToken", (userIndex) => {
  const { email, password } = seedCredentials(
    userIndex != null ? Number(userIndex) : undefined,
  );
  return cy
    .request({ method: "POST", url: "/api/v1/login", body: { email, password } })
    .then((resp) => resp.body.token);
});

/**
 * Upload a file to a user's catalog via the editor API
 * (`POST /api/v1/editor/upload_user_file/{path}`), which expects
 * multipart/form-data. `cy.request` has no native multipart support, so the
 * body is hand-built with an explicit boundary.
 */
Cypress.Commands.add(
  "uploadUserFile",
  ({ token, path, content, filename = "file.csv", mimeType = "text/csv" }) => {
    const boundary = `----cypressBoundary${Date.now()}`;
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--\r\n`;
    return cy.request({
      method: "POST",
      url: `/api/v1/editor/upload_user_file/${encodeURIComponent(path)}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
  },
);

/** Delete a per-user catalog file (teardown after a table-override test). */
Cypress.Commands.add("deleteUserFile", ({ token, path }) => {
  return cy.request({
    method: "DELETE",
    url: `/api/v1/editor/delete_user_file/${encodeURIComponent(path)}`,
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false,
  });
});

/** Log in via UI as a populated seed user (requires backend + licenses). */
Cypress.Commands.add("loginAsSeedUser", (userIndex) => {
  const { email, password } = seedCredentials(
    userIndex != null ? Number(userIndex) : undefined,
  );
  cy.clearLocalStorage();
  cy.visit("/app/login");
  cy.getByTestId("login-email-input").should("be.visible").type(email);
  cy.getByTestId("login-password-input").type(password, { log: false });
  cy.getByTestId("login-submit-button").click();
  cy.url({ timeout: 20000 }).should("include", "/app/dashboard");
  cy.getByTestId("dashboard-page", { timeout: 20000 }).should("be.visible");
});

/**
 * Visit an authenticated route after login; assert page marker and no auth redirect.
 */
Cypress.Commands.add("visitAppRoute", (path, pageTestId) => {
  cy.visit(path);
  cy.url({ timeout: 20000 }).should("include", path.replace(/\/$/, ""));
  cy.url().should("not.include", "/app/login");
  if (pageTestId) {
    cy.getByTestId(pageTestId, { timeout: 20000 }).should("be.visible");
  }
});

/** Open calc wizard from main menu and wait for car-select stage. */
Cypress.Commands.add("openNewCalculation", () => {
  cy.getByTestId("calc-main-create-new-button", { timeout: 20000 })
    .should("be.visible")
    .click();
  cy.getByTestId("calc-car-select-stage", { timeout: 20000 }).should("be.visible");
});

/**
 * Click a body-part on the car diagram, select the first sub-component from
 * the context menu, then open the part's detail drawer and assign the first
 * available repair action. Silently skips disabled parts (no T2 data).
 */
Cypress.Commands.add("selectPartWithAction", (partTestId) => {
  cy.get(`[data-testid="${partTestId}"]`).then(($el) => {
    if ($el.attr("aria-disabled") === "true") return;

    cy.wrap($el).click();
    cy.getByTestId("calc-car-part-context-menu").should("be.visible");
    cy.get('[data-testid^="calc-car-part-menu-item-"]').first().click();
    cy.get("body").type("{esc}");

    cy.get('[data-testid^="calc-body-part-details-button-"]', { timeout: 10000 })
      .last()
      .click();

    cy.getByTestId("calc-body-part-action-picker", { timeout: 10000 }).should("be.visible");
    cy.get('[data-testid^="calc-body-part-action-picker-option-"]').first().click();

    cy.getByTestId("calc-body-part-details-save-button").click();
    cy.getByTestId("calc-body-part-details-save-button").should("not.exist");
  });
});

/**
 * Like `selectPartWithAction`, but deterministic: picks the context-menu item
 * matching `subComponentName` exactly (not "first available") and assigns
 * `actionValue` exactly (not "first available"). Needed whenever a test
 * depends on which specific processor/table row ends up evaluated — e.g.
 * asserting a norm-hours value sourced from a specific table cell.
 *
 * Context-menu item testids are built from a slugifier that strips
 * non-ASCII characters (see `toTestIdValue` in ContextMenu.jsx), so Cyrillic
 * part names collide there — matching by the rendered text instead.
 */
Cypress.Commands.add(
  "selectSpecificPartAction",
  (partTestId, subComponentName, actionValue) => {
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    cy.get(`[data-testid="${partTestId}"]`).click();
    cy.getByTestId("calc-car-part-context-menu").should("be.visible");
    cy.getByTestId("calc-car-part-context-menu")
      .contains("span", new RegExp(`^${escapeRegExp(subComponentName)}$`))
      .click();
    cy.get("body").type("{esc}");

    cy.get('[data-testid^="calc-body-part-details-button-"]', { timeout: 10000 })
      .last()
      .click();

    cy.getByTestId("calc-body-part-action-picker", { timeout: 10000 }).should(
      "be.visible",
    );
    cy.get(`[data-testid="calc-body-part-action-picker-option-${actionValue}"]`).click();

    cy.getByTestId("calc-body-part-details-save-button").click();
    cy.getByTestId("calc-body-part-details-save-button").should("not.exist");
  },
);

/**
 * Vehicle form opens in model-by-default UI; switch to class/body manual mode when needed.
 */
Cypress.Commands.add("ensureVehicleClassPickerMode", () => {
  cy.get("body").then(($body) => {
    if ($body.find('[data-testid="calc-vehicle-switch-to-class-mode-link"]').length > 0) {
      cy.getByTestId("calc-vehicle-switch-to-class-mode-link").click();
    }
  });
  cy.getByTestId("calc-vehicle-class-picker", { timeout: 20000 }).should("be.visible");
});

/**
 * Navigate calc2 wizard through body-parts stage to the final tables stage.
 * Selects class B, first body/year, color, paint type, and several body parts.
 */
Cypress.Commands.add("reachCalcFinalStage", () => {
  cy.getByTestId("dashboard-app-calc2").should("be.visible").click();
  cy.url({ timeout: 20000 }).should("include", "/app/calc2");
  cy.openNewCalculation();
  cy.ensureVehicleClassPickerMode();

  cy.getByTestId("calc-vehicle-class-picker-option-B").click();
  cy.get('[data-testid^="calc-vehicle-body-type-picker-option-"]')
    .should("have.length.at.least", 1)
    .first()
    .click();
  cy.getByTestId("calc-vehicle-year-select").click();
  cy.get(".rs-picker-select-menu-item").first().click();
  cy.getByTestId("calc-car-stage-accept-button").should("not.be.disabled").click();

  cy.getByTestId("calc-color-picker", { timeout: 20000 }).should("be.visible");
  cy.get(
    '[data-testid^="calc-color-grid-"][data-testid*="-color-"]:not([data-testid$="-container"])',
  )
    .should("have.length.at.least", 1)
    .first()
    .click();
  cy.getByTestId("calc-paint-type-select-option-simple").click();
  cy.getByTestId("calc-color-stage-accept-button")
    .should("not.be.disabled")
    .click();

  cy.getByTestId("calc-car-part-hood", { timeout: 20000 }).should("be.visible");
  // Parts render (and look clickable) before T1/T2/processors finish loading; wait
  // for the loading overlay to clear so clicks land on a diagram that actually has data.
  cy.get('[data-testid="calc-car-diagram-loading"]', { timeout: 20000 }).should("not.exist");
  cy.selectPartWithAction("calc-car-part-hood");
  cy.selectPartWithAction("calc-car-part-frontBumper");
  cy.selectPartWithAction("calc-car-part-rearBumper");
  cy.selectPartWithAction("calc-car-part-frontFenderLeft");

  cy.get('[data-testid^="calc-body-part-item-"]', { timeout: 15000 }).should(
    "have.length.at.least",
    3,
  );

  cy.getByTestId("calc-body-parts-stage-accept-button")
    .should("not.be.disabled")
    .click();

  cy.getByTestId("calc-final-order-date-input", { timeout: 20000 }).should(
    "be.visible",
  );
  cy.getByTestId("calc-final-tables-panel", { timeout: 20000 }).should(
    "be.visible",
  );
  cy.get('[data-testid^="calc-final-table-"]', { timeout: 20000 }).should(
    "have.length.at.least",
    1,
  );
});

/** Switch the final-stage table view between collapsed and detailed modes. */
Cypress.Commands.add("setCollapseTables", (checked) => {
  const mode = checked ? "collapsed" : "detailed";
  cy.getByTestId(`calc-final-mode-${mode}`).scrollIntoView().click();
  // Wait for the actual mode change to take effect: the read-only note is
  // shown only in collapsed mode.
  cy.getByTestId("calc-final-collapse-readonly-note").should(
    checked ? "be.visible" : "not.exist",
  );
  // The active mode is highlighted via the primary appearance.
  cy.getByTestId(`calc-final-mode-${mode}`).should(
    "have.attr",
    "data-appearance",
    "primary",
  );
});
