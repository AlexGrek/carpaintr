import { AUTHENTICATED_ROUTES } from "../support/app-routes";

describe("Authenticated app routes (direct visit)", () => {
  beforeEach(() => {
    cy.loginAsSeedUser();
  });

  AUTHENTICATED_ROUTES.forEach(({ path, expect: pageTestId, urlIncludes }) => {
    it(`loads ${path}`, () => {
      cy.visit(path);
      const expectedUrl = urlIncludes || path;
      cy.url({ timeout: 20000 }).should("include", expectedUrl);
      cy.url().should("not.include", "/app/login");
      cy.getByTestId(pageTestId, { timeout: 20000 }).should("be.visible");
    });
  });

  it("shows 404 for unknown app path", () => {
    cy.visit("/app/this-route-does-not-exist-e2e", { failOnStatusCode: false });
    cy.getByTestId("not-found-page", { timeout: 20000 }).should("be.visible");
  });
});
