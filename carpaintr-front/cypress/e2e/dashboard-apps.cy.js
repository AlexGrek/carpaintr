import { DASHBOARD_APP_CARDS } from "../support/app-routes";

describe("Dashboard app navigation", () => {
  beforeEach(() => {
    cy.loginAsSeedUser();
  });

  DASHBOARD_APP_CARDS.forEach(({ testId, path, expect: pageTestId, urlIncludes }) => {
    it(`opens ${path} from dashboard card`, () => {
      cy.visit("/app/dashboard");
      cy.getByTestId("dashboard-page").should("be.visible");
      cy.getByTestId(testId).should("be.visible").click();
      const expectedUrl = urlIncludes || path;
      cy.url({ timeout: 20000 }).should("include", expectedUrl);
      cy.getByTestId(pageTestId, { timeout: 20000 }).should("be.visible");
    });
  });

  it("opens license page from dashboard marker", () => {
    cy.visit("/app/dashboard");
    cy.getByTestId("license-status-marker", { timeout: 20000 })
      .should("be.visible")
      .click();
    cy.url().should("include", "/app/license");
    cy.getByTestId("license-page").should("be.visible");
  });
});
