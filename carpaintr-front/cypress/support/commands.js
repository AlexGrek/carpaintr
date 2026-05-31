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
