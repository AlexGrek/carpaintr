describe("Main path: login -> dashboard -> calculation input", () => {
  beforeEach(() => {
    cy.loginAsSeedUser();
  });

  it("completes critical data-input flow against real API", () => {
    cy.getByTestId("dashboard-app-calc2").should("be.visible").click();

    cy.url({ timeout: 20000 }).should("include", "/app/calc2");
    cy.openNewCalculation();
    cy.ensureVehicleClassPickerMode();

    cy.getByTestId("calc-vehicle-class-picker-option-A").click();

    cy.getByTestId("calc-vehicle-body-type-picker").should("be.visible");
    cy.get('[data-testid^="calc-vehicle-body-type-picker-option-"]')
      .first()
      .click();

    cy.getByTestId("calc-vehicle-year-select").click();
    cy.get(".rs-picker-select-menu-item").first().click();

    cy.getByTestId("calc-car-stage-accept-button").should("not.be.disabled");
    cy.getByTestId("calc-car-stage-accept-button").click();

    cy.getByTestId("calc-color-picker", { timeout: 20000 }).should("be.visible");
    // Wait for real swatches (placeholder grid has no -color- testids).
    cy.get('[data-testid^="calc-color-grid-"][data-testid*="-color-"]:not([data-testid$="-container"])')
      .should("have.length.at.least", 1)
      .first()
      .click();
    cy.getByTestId("calc-paint-type-select-option-simple").click();

    cy.getByTestId("calc-color-stage-accept-button", { timeout: 20000 }).should(
      "not.be.disabled",
    );
    cy.getByTestId("calc-color-stage-accept-button").click();

    cy.getByTestId("calc-car-part-hood", { timeout: 20000 }).should("be.visible").click();
    cy.getByTestId("calc-car-part-context-menu").should("be.visible");
    cy.get('[data-testid^="calc-car-part-menu-item-"]').first().click();

    cy.getByTestId("calc-body-parts-stage-accept-button")
      .should("not.be.disabled")
      .click();

    cy.getByTestId("calc-final-order-date-input", { timeout: 20000 }).should(
      "be.visible",
    );
    cy.getByTestId("calc-final-order-number-input").clear().type("E2E-001");
    cy.getByTestId("calc-final-stage-save-button").should("be.visible");
    cy.getByTestId("calc-final-stage-print-button").should("be.visible");
  });
});
