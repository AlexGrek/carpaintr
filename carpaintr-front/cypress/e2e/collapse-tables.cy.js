/**
 * E2E: collapse tables on calc2 final stage
 *
 * Covers:
 *  - Collapsed/Detailed mode switch (collapsed is the default)
 *  - Default selected mode reflected on the switch
 *  - Read-only info note visibility
 *  - Processor header hiding in collapsed view
 *  - HTML payload shape (collapsed by default, and collapsed vs expanded)
 *
 * Requires: backend + frontend (task cypress).
 */

describe("Calc2 final stage: collapse tables", () => {
  before(() => {
    cy.ensureSeedUserLicensed();
    cy.loginAsSeedUser();
  });

  beforeEach(() => {
    cy.loginAsSeedUser();
    cy.reachCalcFinalStage();
  });

  it("selects the Collapsed mode on the switch by default", () => {
    cy.getByTestId("calc-final-mode-collapsed")
      .find('input[type="radio"]')
      .should("be.checked");
    cy.getByTestId("calc-final-mode-detailed")
      .find('input[type="radio"]')
      .should("not.be.checked");
  });

  it("defaults to collapsed view with read-only note and merged tables", () => {
    cy.getByTestId("calc-final-collapse-readonly-note").should("be.visible");

    cy.get('[data-testid^="calc-final-table-"]')
      .first()
      .find("h4")
      .should("have.length", 1);

    cy.setCollapseTables(false);

    cy.getByTestId("calc-final-collapse-readonly-note").should("not.exist");

    cy.get('[data-testid^="calc-final-table-"]')
      .first()
      .find("h4")
      .its("length")
      .then((expandedCount) => {
        expect(expandedCount).to.be.greaterThan(1);
      });
  });

  it("switches to detailed view and back to collapsed", () => {
    cy.setCollapseTables(false);
    cy.getByTestId("calc-final-collapse-readonly-note").should("not.exist");
    cy.get('[data-testid^="calc-final-table-"]')
      .first()
      .find("h4")
      .its("length")
      .should("be.greaterThan", 1);

    cy.setCollapseTables(true);

    cy.getByTestId("calc-final-collapse-readonly-note").should("be.visible");
    cy.get('[data-testid^="calc-final-table-"]')
      .first()
      .find("h4")
      .should("have.length", 1);
  });

  it("sends a collapsed calc payload for document generation by default", () => {
    // Do NOT touch the mode switch — collapsed must be the default.
    cy.getByTestId("calc-final-stage-print-button").click();
    cy.getByTestId("print-calculation-drawer", { timeout: 15000 }).should(
      "be.visible",
    );

    cy.get('[data-testid^="print-template-checkbox-"]', { timeout: 15000 })
      .should("have.length.at.least", 1)
      .first()
      .find("label")
      .click();

    cy.intercept("POST", "/api/v1/user/generate_html_table", (req) => {
      const calc = req.body?.calculation?.calc;
      expect(calc).to.be.an("object");
      Object.values(calc).forEach((sections) => {
        expect(sections).to.have.length(1);
        expect(sections[0].name).to.be.undefined;
        expect(sections[0].result).to.be.an("array");
      });
    }).as("htmlGenDefault");

    cy.getByTestId("print-generate-preview-button", { timeout: 10000 })
      .should("be.visible")
      .click();
    cy.wait("@htmlGenDefault", { timeout: 20000 })
      .its("response.statusCode")
      .should("eq", 200);
  });

  it("sends collapsed calc payload when collapse is enabled", () => {
    cy.setCollapseTables(true);

    cy.getByTestId("calc-final-stage-print-button").click();
    cy.getByTestId("print-calculation-drawer", { timeout: 15000 }).should(
      "be.visible",
    );

    cy.get('[data-testid^="print-template-checkbox-"]', { timeout: 15000 })
      .should("have.length.at.least", 1)
      .first()
      .find("label")
      .click();

    cy.intercept("POST", "/api/v1/user/generate_html_table", (req) => {
      const calc = req.body?.calculation?.calc;
      expect(calc).to.be.an("object");
      Object.values(calc).forEach((sections) => {
        expect(sections).to.have.length(1);
        expect(sections[0].name).to.be.undefined;
        expect(sections[0].result).to.be.an("array");
      });
    }).as("htmlGenCollapsed");

    cy.getByTestId("print-generate-preview-button", { timeout: 10000 })
      .should("be.visible")
      .click();
    cy.wait("@htmlGenCollapsed", { timeout: 20000 })
      .its("response.statusCode")
      .should("eq", 200);
  });

  it("sends per-processor calc payload when collapse is disabled", () => {
    cy.setCollapseTables(false);

    cy.getByTestId("calc-final-stage-print-button").click();
    cy.getByTestId("print-calculation-drawer", { timeout: 15000 }).should(
      "be.visible",
    );

    cy.get('[data-testid^="print-template-checkbox-"]', { timeout: 15000 })
      .should("have.length.at.least", 1)
      .first()
      .find("label")
      .click();

    cy.intercept("POST", "/api/v1/user/generate_html_table", (req) => {
      const calc = req.body?.calculation?.calc;
      expect(calc).to.be.an("object");
      const allSections = Object.values(calc).flat();
      expect(allSections.length).to.be.greaterThan(0);
      expect(allSections.some((group) => group.name)).to.eq(true);
    }).as("htmlGenExpanded");

    cy.getByTestId("print-generate-preview-button", { timeout: 10000 })
      .should("be.visible")
      .click();
    cy.wait("@htmlGenExpanded", { timeout: 20000 })
      .its("response.statusCode")
      .should("eq", 200);
  });

  it("shows the generation JSON payload with collapsed, real-number data", () => {
    // Default mode (collapsed) — no switch interaction.
    cy.getByTestId("calc-final-stage-print-button").click();
    cy.getByTestId("print-calculation-drawer", { timeout: 15000 }).should(
      "be.visible",
    );

    cy.get('[data-testid^="print-template-checkbox-"]', { timeout: 15000 })
      .should("have.length.at.least", 1)
      .first()
      .find("label")
      .click();

    cy.getByTestId("print-toggle-payload-button").should("be.visible").click();
    cy.getByTestId("print-payload-panel").scrollIntoView().should("exist");

    cy.getByTestId("print-payload-json")
      .invoke("text")
      .then((text) => {
        const payload = JSON.parse(text);
        const calc = payload?.calculation?.calc;
        expect(calc).to.be.an("object");
        Object.values(calc).forEach((sections) => {
          // Collapsed by default: one merged table per part.
          expect(sections).to.have.length(1);
          expect(sections[0].total).to.be.a("number");
          sections[0].result.forEach((row) => {
            // Unfilled cells are coerced to real numbers, never null.
            expect(row.estimation, "estimation").to.be.a("number");
            expect(row.price, "price").to.be.a("number");
            expect(row.sum, "sum").to.be.a("number");
          });
        });
      });

    // Toggling again hides the payload panel.
    cy.getByTestId("print-toggle-payload-button").click();
    cy.getByTestId("print-payload-panel").should("not.exist");
  });
});
