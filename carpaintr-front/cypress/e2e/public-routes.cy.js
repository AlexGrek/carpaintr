import { PUBLIC_ROUTES } from "../support/app-routes";

describe("Public routes", () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  PUBLIC_ROUTES.forEach(({ path, expect: pageTestId }) => {
    it(`loads ${path}`, () => {
      cy.visit(path);
      cy.getByTestId(pageTestId, { timeout: 20000 }).should("be.visible");
    });
  });

  it("navigates login ↔ register", () => {
    cy.visit("/app/login");
    cy.getByTestId("login-register-link").click();
    cy.url().should("include", "/app/register");
    cy.getByTestId("register-page").should("be.visible");

    cy.getByTestId("register-login-link").click();
    cy.url().should("include", "/app/login");
    cy.getByTestId("login-page").should("be.visible");
  });

  it("opens login from landing", () => {
    cy.visit("/");
    cy.getByTestId("landing-login-link").click();
    cy.url().should("include", "/app/login");
    cy.getByTestId("login-page").should("be.visible");
  });

  it("opens register from landing", () => {
    cy.visit("/");
    cy.getByTestId("landing-register-link").click();
    cy.url().should("include", "/app/register");
    cy.getByTestId("register-page").should("be.visible");
  });
});
