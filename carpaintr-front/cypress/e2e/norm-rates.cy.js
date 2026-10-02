const fixture = () => ({
  car: { carClass: "B", bodyType: "sedan", year: 2020 },
  paint: { color: "White" },
  tableMode: "detailed",
  normRates: { base: 100, currency: "UAH", additional: [
    { id: "paint", name: "Painting", amount: 250 },
    { id: "arm", name: "Assembly", amount: 150 },
  ] },
  parts: { selectedParts: [{ name: "Hood", action: "repair" }] },
  calculations: {
    Hood: [
      { name: "Painting", result: [{ name: "Paint hood", estimation: 2, priceSource: "norm", category: "paint" }] },
      { name: "Assembly", result: [{ name: "Remove hood", estimation: 1, priceSource: "norm", category: "arm" }] },
    ],
  },
});

describe("Calc2 named labor rates", () => {
  before(() => cy.ensureSeedUserLicensed(26));

  const resumeOnFinalStage = () => {
    cy.getByTestId("calc-main-resume-previous-button").should("be.visible");
    // CalcPage installs a history entry when it mounts; set the stage after
    // that effect, before the wizard reads its initial URL.
    cy.window().then((win) => win.history.replaceState(null, "", "/app/calc2?stage=tableStage"));
    cy.getByTestId("calc-main-resume-previous-button").click();
  };

  const openCalculation = () => {
    cy.loginAsSeedUser(26);
    cy.window().then((win) => win.localStorage.setItem("unsaved_calculation", JSON.stringify(fixture())));
    cy.visit("/app/calc2?stage=tableStage");
    resumeOnFinalStage();
    cy.getByTestId("calc-final-grand-total").should("contain", "300.00");
  };

  const inputAmount = (id, amount) => cy.getByTestId(id).find("input").clear().type(String(amount)).blur();

  [1280, 320].forEach((width) => {
    it(`prices part/table overrides, edits and reopening at ${width}px`, () => {
      cy.viewport(width, 900);
      openCalculation();
      cy.getByTestId("calc-part-rate-Hood").select("paint");
      cy.getByTestId("calc-final-grand-total").should("contain", "750.00");
      cy.getByTestId("calc-table-rate-Assembly").select("arm");
      cy.getByTestId("calc-final-grand-total").should("contain", "650.00");
      inputAmount("calc-norm-rates-amount-0", 300);
      cy.getByTestId("calc-final-grand-total").should("contain", "750.00");

      // Persist the exact calculation JSON through the save API.
      cy.intercept("POST", "/api/v1/user/calculationstore", (request) => {
        expect(request.body.normRates.additional[0].amount).to.eq(300);
        const assemblyId = request.body.calculations.Hood.find(table => table.name === "Assembly").id;
        expect(request.body.normRateOverrides.Hood.tables[assemblyId]).to.eq("arm");
        expect(request.body.calculations.Hood[0].result[0].price).to.eq(300);
        request.reply({ saved_file_path: "rate-test.json" });
      }).as("saveRates");
      cy.getByTestId("calc-final-stage-save-button").click();
      cy.wait("@saveRates");
      cy.reload();
      resumeOnFinalStage();
      cy.getByTestId("calc-final-grand-total").should("contain", "750.00");
      cy.getByTestId("calc-part-rate-Hood").should("have.value", "paint");
      cy.getByTestId("calc-table-rate-Assembly").should("have.value", "arm");

      // Returning to the parts stage uses the final stage's latest prices.
      cy.getByTestId("calc-final-stage-back-button").click();
      cy.getByTestId("calc-norm-rates-amount-0").find("input").should("have.value", "300");
      cy.getByTestId("calc-body-parts-stage-accept-button").click();
      cy.getByTestId("calc-final-grand-total").should("contain", "750.00");

      cy.getByTestId("calc-norm-rates-add").click();
      cy.getByTestId("calc-norm-rates-name-2").clear().type("Special");
      inputAmount("calc-norm-rates-amount-2", 500);
      cy.getByTestId("calc-part-rate-Hood").find("option").last().then((option) => {
        cy.getByTestId("calc-part-rate-Hood").select(option.val());
      });
      cy.getByTestId("calc-final-grand-total").should("contain", "1150.00");
      cy.getByTestId("calc-norm-rates-remove-2").click();
      cy.getByTestId("calc-final-grand-total").should("contain", "350.00");
      cy.getByTestId("calc-table-rate-Assembly").select("base");
      inputAmount("calc-norm-rates-base", 0);
      cy.getByTestId("calc-final-grand-total").should("contain", "0.00");
      cy.getByTestId("calc-table-rate-Assembly").select("arm");
      cy.getByTestId("calc-final-grand-total").should("contain", "150.00");
    });
  });
});
