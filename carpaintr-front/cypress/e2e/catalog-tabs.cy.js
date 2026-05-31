import { CATALOG_TABS } from "../support/app-routes";

describe("Catalog tabs", () => {
  beforeEach(() => {
    cy.loginAsSeedUser();
    cy.visit("/app/catalog/cars");
    cy.getByTestId("catalog-page", { timeout: 20000 }).should("be.visible");
  });

  CATALOG_TABS.forEach((slug) => {
    it(`switches to ${slug} tab`, () => {
      cy.getByTestId(`catalog-tab-${slug}`).click();
      cy.url().should("include", `/app/catalog/${slug}`);
      cy.getByTestId(`catalog-tab-${slug}`).should(
        "have.attr",
        "aria-selected",
        "true",
      );
      if (slug === "data") {
        cy.getByTestId("catalog-data-panel", { timeout: 20000 }).should(
          "be.visible",
        );
      }
    });
  });
});
