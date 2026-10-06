// Car model photos: shown in the model picker, the selected-model row and on
// the calc2 parts picker; models without a photo render no image at all.
const expectLoaded = ($img) =>
  expect($img[0].naturalWidth, "image decoded").to.be.greaterThan(0);

describe("Car model images", () => {
  before(() => {
    cy.ensureSeedUserLicensed();
  });

  beforeEach(() => {
    cy.loginAsSeedUser();
  });

  it("shows the model photo while picking the car and on the parts picker", () => {
    cy.visit("/app/calc2");
    cy.getByTestId("calc-main-create-by-brand-button", { timeout: 20000 }).click();
    cy.getByTestId("calc-car-select-stage", { timeout: 20000 }).should("be.visible");

    cy.getByTestId("calc-vehicle-make-select-option-bmw", { timeout: 20000 }).click();

    // Thumbnails in the model list, only for models that have a photo
    cy.getByTestId("calc-vehicle-model-image-x5", { timeout: 20000 })
      .scrollIntoView()
      .should("be.visible")
      .and(expectLoaded);
    cy.getByTestId("calc-vehicle-model-select-option-1-series").should("exist");
    cy.getByTestId("calc-vehicle-model-image-1-series").should("not.exist");

    cy.getByTestId("calc-vehicle-model-select-option-x5").click();
    cy.getByTestId("calc-vehicle-model-select-selected")
      .find('[data-testid="calc-vehicle-model-image-x5"]')
      .should("be.visible");

    cy.get('[data-testid^="calc-vehicle-body-type-select-option-"]').first().click();
    cy.getByTestId("calc-vehicle-year-select").click();
    cy.get(".rs-picker-select-menu-item").first().click();
    cy.getByTestId("calc-car-stage-accept-button").should("not.be.disabled").click();

    cy.getByTestId("calc-color-picker", { timeout: 20000 }).should("be.visible");
    cy.get('[data-testid^="calc-color-grid-"][data-testid*="-color-"]:not([data-testid$="-container"])')
      .should("have.length.at.least", 1)
      .first()
      .click();
    cy.getByTestId("calc-paint-type-select-option-simple").click();
    cy.getByTestId("calc-color-stage-accept-button", { timeout: 20000 })
      .should("not.be.disabled")
      .click();

    cy.getByTestId("calc-body-car-model-image", { timeout: 20000 })
      .should("be.visible")
      .and(expectLoaded)
      .and(($img) => {
        const css = getComputedStyle($img[0]);
        expect(css.boxShadow).to.not.equal("none");
        expect(parseFloat(css.borderTopLeftRadius)).to.be.greaterThan(0);
      });
  });

  it("shows model photos in the car catalog", () => {
    cy.visit("/app/catalog/cars");
    cy.getByTestId("catalog-page", { timeout: 20000 }).should("be.visible");
    cy.getByTestId("catalog-car-make-select", { timeout: 20000 }).click();
    cy.contains(".rs-picker-select-menu-item", /^bmw$/i).click();
    cy.getByTestId("catalog-car-model-image-x5", { timeout: 20000 })
      .scrollIntoView()
      .should("be.visible")
      .and(expectLoaded);
  });
});
