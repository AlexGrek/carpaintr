/**
 * End-to-end test: login → full calculation wizard → PDF via mock server
 *
 * Covers:
 *  - Login via seed user
 *  - Car class/body/year selection (Stage 1)
 *  - Color and paint-type selection (Stage 2)
 *  - Selecting 4+ body parts, each with an explicit action (Stage 3)
 *  - Verifying more than 3 calculation table sections in the final stage
 *  - Opening the print drawer, selecting a template
 *  - HTML preview generation (GET /api/v1/user/generate_html_table)
 *  - PDF download (POST /api/v1/user/generate_pdf_table) — verified via intercept
 *
 * Requires: backend + mock-pdf-server running (task dev).
 */

describe("Full path: login → 4-part calculation → PDF via mock", () => {
  before(() => {
    cy.ensureSeedUserLicensed();
    cy.loginAsSeedUser();
  });

  it("completes wizard with >3 tables and downloads a valid PDF", () => {
    // ------------------------------------------------------------------ //
    // Stage 0: Navigate to calc2 and open a new calculation               //
    // ------------------------------------------------------------------ //
    cy.getByTestId("dashboard-app-calc2").should("be.visible").click();
    cy.url({ timeout: 20000 }).should("include", "/app/calc2");
    cy.openNewCalculation();
    cy.ensureVehicleClassPickerMode();

    // ------------------------------------------------------------------ //
    // Stage 1: Car selection — class B, first body type, first year       //
    // ------------------------------------------------------------------ //
    cy.getByTestId("calc-vehicle-class-picker-option-B").click();
    cy.get('[data-testid^="calc-vehicle-body-type-picker-option-"]')
      .should("have.length.at.least", 1)
      .first()
      .click();

    cy.getByTestId("calc-vehicle-year-select").click();
    cy.get(".rs-picker-select-menu-item").first().click();

    cy.getByTestId("calc-car-stage-accept-button").should("not.be.disabled").click();

    // ------------------------------------------------------------------ //
    // Stage 2: Color and paint type                                        //
    // ------------------------------------------------------------------ //
    cy.getByTestId("calc-color-picker", { timeout: 20000 }).should("be.visible");
    cy.get(
      '[data-testid^="calc-color-grid-"][data-testid*="-color-"]:not([data-testid$="-container"])'
    )
      .should("have.length.at.least", 1)
      .first()
      .click();

    cy.getByTestId("calc-paint-type-select-option-simple").click();
    cy.getByTestId("calc-color-stage-accept-button")
      .should("not.be.disabled")
      .click();

    // ------------------------------------------------------------------ //
    // Stage 3: Select 4+ body parts, each with an action                  //
    //                                                                      //
    // We try 6 common parts to ensure at least 4 are enabled for the      //
    // selected body type (some parts may be disabled if no T2 data).      //
    // ------------------------------------------------------------------ //
    cy.getByTestId("calc-car-part-hood", { timeout: 20000 }).should("be.visible");

    cy.selectPartWithAction("calc-car-part-hood");
    cy.selectPartWithAction("calc-car-part-frontBumper");
    cy.selectPartWithAction("calc-car-part-rearBumper");
    cy.selectPartWithAction("calc-car-part-frontFenderLeft");
    cy.selectPartWithAction("calc-car-part-frontDoorLeft");
    cy.selectPartWithAction("calc-car-part-roof");

    // Verify at least 4 parts ended up selected with actions
    cy.get('[data-testid^="calc-body-part-item-"]', { timeout: 15000 }).should(
      "have.length.at.least",
      4
    );

    // Accept stage — move to final
    cy.getByTestId("calc-body-parts-stage-accept-button")
      .should("not.be.disabled")
      .click();

    // ------------------------------------------------------------------ //
    // Stage 4: Final stage — verify >3 calculation table sections         //
    // ------------------------------------------------------------------ //
    cy.getByTestId("calc-final-order-date-input", { timeout: 20000 }).should(
      "be.visible"
    );

    cy.getByTestId("calc-final-order-number-input").clear().type("E2E-PDF-001");

    // Wait for processor evaluations to produce table entries
    cy.getByTestId("calc-final-tables-panel", { timeout: 20000 }).should(
      "be.visible"
    );
    cy.get('[data-testid^="calc-final-table-"]', { timeout: 20000 }).should(
      "have.length.greaterThan",
      3
    );

    // ------------------------------------------------------------------ //
    // Print / PDF flow                                                     //
    // ------------------------------------------------------------------ //

    // Open the print drawer
    cy.getByTestId("calc-final-stage-print-button").click();
    cy.getByTestId("print-calculation-drawer", { timeout: 15000 }).should(
      "be.visible"
    );

    // Wait for template list to load, then select the first template.
    // RSuite Checkbox wraps its input in a label; click the label to fire onChange.
    cy.get('[data-testid^="print-template-checkbox-"]', { timeout: 15000 })
      .should("have.length.at.least", 1)
      .first()
      .find("label")
      .click();

    // -- HTML preview (mock returns minimal HTML — just verify 200 and iframe appears) --
    cy.intercept("POST", "/api/v1/user/generate_html_table").as("htmlGen");
    cy.getByTestId("print-generate-preview-button", { timeout: 10000 })
      .should("be.visible")
      .click();
    cy.wait("@htmlGen", { timeout: 20000 }).its("response.statusCode").should("eq", 200);
    cy.getByTestId("print-html-preview-iframe", { timeout: 10000 }).should("exist");

    // -- PDF download (validated via network intercept, not file system) --
    cy.intercept("POST", "/api/v1/user/generate_pdf_table").as("pdfGen");
    cy.getByTestId("print-download-pdf-button").click();
    cy.wait("@pdfGen", { timeout: 20000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.headers["content-type"]).to.include(
        "application/pdf"
      );
      // Mock server returns minimal but structurally valid PDF bytes
      const body = interception.response.body;
      if (typeof body === "string") {
        expect(body).to.include("%PDF");
      }
    });
  });
});
