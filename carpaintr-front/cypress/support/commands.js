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
