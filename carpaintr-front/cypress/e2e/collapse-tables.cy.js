/**
 * E2E: collapse tables on calc2 final stage
 *
 * Covers:
 *  - Collapse checkbox toggle
 *  - Read-only info note visibility
 *  - Processor header hiding in collapsed view
 *  - HTML payload shape (collapsed vs expanded)
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

  it("shows read-only note and hides processor headers when collapsed", () => {
    cy.getByTestId("calc-final-collapse-readonly-note").should("not.exist");

    cy.get('[data-testid^="calc-final-table-"]')
      .first()
      .find("h4")
      .its("length")
      .then((expandedCount) => {
        expect(expandedCount).to.be.greaterThan(1);
      });

    cy.setCollapseTables(true);

    cy.getByTestId("calc-final-collapse-readonly-note")
      .should("be.visible")
      .and("contain.text", "read-only");

    cy.get('[data-testid^="calc-final-table-"]')
      .first()
      .find("h4")
      .should("have.length", 1);
  });

  it("restores expanded view and hides read-only note when unchecked", () => {
    cy.setCollapseTables(true);
    cy.getByTestId("calc-final-collapse-readonly-note").should("be.visible");

    cy.setCollapseTables(false);

    cy.getByTestId("calc-final-collapse-readonly-note").should("not.exist");
    cy.get('[data-testid^="calc-final-table-"]')
      .first()
      .find("h4")
      .its("length")
      .should("be.greaterThan", 1);
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
});
