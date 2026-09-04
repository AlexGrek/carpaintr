/**
 * E2E: changing a norm-hours table value changes the calculated result
 *
 * This is the test the category/grouping refactor needed: it proves the full
 * chain — CSV table cell -> processor `evaluate` -> `estimation` -> collapsed
 * per-part view -> by-category view -> print/document payload — actually
 * reacts to a real data change, not just to code that *should* propagate it.
 *
 * Strategy: upload a one-row per-user override of "Арматурные работы.csv"
 * (the only norm-hours table currently shipped in common/, see
 * docs/missing_tables.md) for a single, fully-known (class, body, part)
 * combination — B / СЕДАН / Бампер задній — with distinctive test values.
 * Run the calc wizard against a fixed part + repair action, read the
 * generated document payload, and check the resulting rows carry exactly
 * those values. Then overwrite the same table with *different* values and
 * repeat: the result must change to match, proving this isn't a cached or
 * hardcoded number.
 *
 * Deterministic wiring (see class_body_mapping.yaml / t2.csv / repair_types.csv):
 *  - Class "B" + UI body-type option "sedan" -> T1 "Список Тип" = "СЕДАН"
 *    (backend/src/calc/constants.rs: BODY_TYPE_SEDAN -> T1_ENTRY_SEDAN).
 *  - Diagram zone "rearBumper" -> T2 zone/part name "Бампер задній", which
 *    has exactly one *ungrouped* T2 sub-component named identically (T2 row
 *    with an empty деталь 2) alongside many named sub-parts — selecting the
 *    ungrouped item is what makes `carPart.name` equal "Бампер задній",
 *    matching the "Список деталь укр" column in the norm-hours table.
 *  - repair_types.csv lists "Ремонт з зовнішнім фарбуванням" for this part,
 *    which activates exactly two processors reading this table
 *    (`СНЯТИЕ_УСТАНОВКА_ДЛЯ_РЕМОНТА`, `Роботи_арматурні_зібрати_для_ремонту_`,
 *    both category "arm") plus one always-on constant processor
 *    (`АНТИКОРОЗІЯ_ПІСЛЯ_РЕМОНТУ`, category "extra", fixed 0.3) that is
 *    unaffected by the table and used here as a control value.
 *
 * Uses a dedicated seed user (index 25) so the per-user table override never
 * touches the shared common catalog or other specs' default user (index 1).
 *
 * Requires: backend + frontend (task cypress).
 */

const TEST_USER_INDEX = 25;
const TABLE_PATH = "tables/Арматурные работы.csv";
const PART_NAME = "Бампер задній";
const REPAIR_ACTION = "Ремонт з зовнішнім фарбуванням";
// Fixed, table-independent row every run must also show — proves the test
// isn't accidentally matching on "any row changed".
const CONSTANT_ESTIMATION = 0.3;

const CSV_HEADER =
  "Список Класс,Список Тип,Список деталь укр,РАЗОБРАТЬ ДЛЯ РЕМОНТА,СОБРАТЬ ДЛЯ РЕМОНТА," +
  "СНЯТИЕ ДЛЯ РЕМОНТА,УСТАНОВКА ДЛЯ РЕМОНТА,ВСЕГО ДЛЯ РЕМОНТА ГРН,РАЗОБРАТЬ ДЛЯ ЗАМЕНЫ," +
  "СОБРАТЬ ДЛЯ ЗАМЕНЫ,СНЯТИЕ ДЛЯ ЗАМЕНЫ,УСТАНОВКА ДЛЯ ЗАМЕНЫ,ВСЕГО ДЛЯ ЗАМЕНЫ";

const buildCsv = ({ disassemble, reassemble, remove, install }) =>
  `${CSV_HEADER}\n` +
  `B,СЕДАН,${PART_NAME},"${disassemble.csv}","${reassemble.csv}","${remove.csv}","${install.csv}",9999,"0,54","0,9","0,72","1,44",1800\n`;

// Comma-decimal strings as they'd appear in the CSV, and the numeric value
// `eval(evaluate.replace(",", "."))` is expected to produce.
const VALUE_SET_A = {
  disassemble: { csv: "3,25", num: 3.25 },
  reassemble: { csv: "4,5", num: 4.5 },
  remove: { csv: "2,75", num: 2.75 },
  install: { csv: "5,1", num: 5.1 },
};
const VALUE_SET_B = {
  disassemble: { csv: "9,99", num: 9.99 },
  reassemble: { csv: "1,11", num: 1.11 },
  remove: { csv: "6,66", num: 6.66 },
  install: { csv: "0,22", num: 0.22 },
};

const closeTo = (a, b) => Math.abs(a - b) < 1e-9;

describe("Table value changes propagate through to calculated results", () => {
  let token;

  before(() => {
    cy.ensureSeedUserLicensed(TEST_USER_INDEX);
    cy.getAuthToken(TEST_USER_INDEX).then((t) => {
      token = t;
    });
  });

  after(() => {
    // Leave the seed user's catalog as it started so repeated runs (and any
    // other spec that might one day use this user index) see common data.
    cy.deleteUserFile({ token, path: TABLE_PATH });
  });

  const uploadValueSet = (values) =>
    cy
      .uploadUserFile({ token, path: TABLE_PATH, content: buildCsv(values) })
      .its("status")
      .should("eq", 200);

  /** Full wizard walkthrough for the fixed part+action, ending with the
   * generation JSON payload parsed and returned. */
  const runCalculationAndGetPayload = () => {
    cy.loginAsSeedUser(TEST_USER_INDEX);
    cy.window().then((win) => win.localStorage.removeItem("unsaved_calculation"));

    cy.getByTestId("dashboard-app-calc2").should("be.visible").click();
    cy.url({ timeout: 20000 }).should("include", "/app/calc2");
    cy.openNewCalculation();
    cy.ensureVehicleClassPickerMode();

    // Class B, body type "sedan" -> T1 "СЕДАН" (matches the override row).
    cy.getByTestId("calc-vehicle-class-picker-option-B").click();
    cy.getByTestId("calc-vehicle-body-type-picker-option-sedan").click();
    cy.getByTestId("calc-vehicle-year-select").click();
    cy.get(".rs-picker-select-menu-item").first().click();
    cy.getByTestId("calc-car-stage-accept-button").should("not.be.disabled").click();

    cy.getByTestId("calc-color-picker", { timeout: 20000 }).should("be.visible");
    cy.get(
      '[data-testid^="calc-color-grid-"][data-testid*="-color-"]:not([data-testid$="-container"])',
    )
      .should("have.length.at.least", 1)
      .first()
      .click();
    cy.getByTestId("calc-paint-type-select-option-simple").click();
    cy.getByTestId("calc-color-stage-accept-button").should("not.be.disabled").click();

    cy.getByTestId("calc-car-part-hood", { timeout: 20000 }).should("be.visible");
    cy.get('[data-testid="calc-car-diagram-loading"]', { timeout: 20000 }).should(
      "not.exist",
    );

    // A decoy part is added first, ahead of the part under test. This isn't
    // needed for the table-value assertions (only "Бампер задній" is ever
    // inspected below) — it exists because selecting a lone part and
    // immediately opening its details drawer hits a narrow, load-dependent
    // UI race (its own bug, tracked separately); every other calc2 spec in
    // this suite avoids it the same way, by always having 2+ parts selected.
    cy.selectPartWithAction("calc-car-part-hood");
    cy.selectSpecificPartAction("calc-car-part-rearBumper", PART_NAME, REPAIR_ACTION);

    cy.get('[data-testid^="calc-body-part-item-"]', { timeout: 15000 }).should(
      "have.length",
      2,
    );
    cy.getByTestId("calc-body-parts-stage-accept-button")
      .should("not.be.disabled")
      .click();

    cy.getByTestId("calc-final-tables-panel", { timeout: 20000 }).should("be.visible");
    cy.get('[data-testid^="calc-final-table-"]', { timeout: 20000 }).should(
      "have.length.at.least",
      1,
    );

    cy.getByTestId("calc-final-stage-print-button").click();
    cy.getByTestId("print-calculation-drawer", { timeout: 15000 }).should("be.visible");
    cy.get('[data-testid^="print-template-card-"]', { timeout: 15000 })
      .should("have.length.at.least", 1)
      .first()
      .click();

    cy.getByTestId("print-toggle-payload-button").should("be.visible").click();
    cy.getByTestId("print-payload-panel").scrollIntoView().should("exist");

    return cy
      .getByTestId("print-payload-json")
      .invoke("text")
      .then((text) => JSON.parse(text));
  };

  /** Assert the collapsed per-part table and the by-category view both carry
   * exactly the rows implied by `values` (plus the fixed constant row). */
  const assertPayloadMatches = (payload, values) => {
    const partTables = payload.calculation.calc[PART_NAME];
    expect(partTables, `collapsed table for "${PART_NAME}"`).to.have.length(1);
    const rows = partTables[0].result;

    // Not asserting an exact row count: a local catalog may carry extra
    // ad-hoc processors (e.g. ones added via the Create Processor page for
    // manual testing) that also apply to this part/action. Those are
    // irrelevant here — what matters is that exactly these known rows are
    // present with the values implied by the currently-uploaded table.
    const findByEstimation = (num) => rows.find((r) => closeTo(r.estimation, num));

    const removeRow = findByEstimation(values.remove.num);
    const installRow = findByEstimation(values.install.num);
    const disassembleRow = findByEstimation(values.disassemble.num);
    const reassembleRow = findByEstimation(values.reassemble.num);
    const constantRow = findByEstimation(CONSTANT_ESTIMATION);

    [removeRow, installRow, disassembleRow, reassembleRow].forEach((row, i) => {
      expect(row, `table-driven row #${i} present with expected value`).to.exist;
      expect(row.category, "category").to.eq("arm");
      expect(row.unit || "", "labour row carries no unit").to.eq("");
      expect(row.name, "part name substituted into row name").to.include(PART_NAME);
      // sum must reflect estimation * price, not just echo estimation.
      expect(row.sum, "sum = estimation * price").to.be.closeTo(
        row.estimation * row.price,
        1e-6,
      );
    });

    expect(constantRow, "fixed control row present").to.exist;
    expect(constantRow.category, "control row category unaffected by table").to.eq(
      "extra",
    );

    // By-category view: the same 4 "arm" rows must appear together, each
    // stamped with the part they came from, regardless of category label
    // localization.
    const categoryTables = payload.calculation.calc_by_category;
    const armKey = Object.keys(categoryTables).find((key) =>
      (categoryTables[key]?.[0]?.result || []).some((r) =>
        closeTo(r.estimation, values.remove.num),
      ),
    );
    expect(armKey, "an 'arm' category bucket exists").to.exist;
    const armRows = categoryTables[armKey][0].result;
    [values.remove, values.install, values.disassemble, values.reassemble].forEach(
      (v) => {
        const row = armRows.find((r) => closeTo(r.estimation, v.num));
        expect(row, `category-view row for ${v.num}`).to.exist;
        expect(row.part, "row stamped with originating part").to.eq(PART_NAME);
      },
    );

    const extraKey = Object.keys(categoryTables).find((key) =>
      (categoryTables[key]?.[0]?.result || []).some((r) =>
        closeTo(r.estimation, CONSTANT_ESTIMATION),
      ),
    );
    expect(extraKey, "an 'extra' category bucket exists").to.exist;
    expect(extraKey, "'arm' and 'extra' are different buckets").to.not.eq(armKey);
  };

  it("recalculates norm-hours to match a freshly uploaded table value", () => {
    uploadValueSet(VALUE_SET_A);
    runCalculationAndGetPayload().then((payloadA) => {
      assertPayloadMatches(payloadA, VALUE_SET_A);

      // None of the second value set's numbers should appear yet.
      const rows = payloadA.calculation.calc[PART_NAME][0].result;
      [VALUE_SET_B.remove, VALUE_SET_B.install, VALUE_SET_B.disassemble, VALUE_SET_B.reassemble].forEach(
        (v) => {
          expect(rows.some((r) => closeTo(r.estimation, v.num))).to.eq(false);
        },
      );
    });
  });

  it("changes the calculated result again when the table value changes again", () => {
    uploadValueSet(VALUE_SET_B);
    runCalculationAndGetPayload().then((payloadB) => {
      assertPayloadMatches(payloadB, VALUE_SET_B);

      // The first value set's numbers must be gone now — this is not a
      // cached result from the previous test.
      const rows = payloadB.calculation.calc[PART_NAME][0].result;
      [VALUE_SET_A.remove, VALUE_SET_A.install, VALUE_SET_A.disassemble, VALUE_SET_A.reassemble].forEach(
        (v) => {
          expect(rows.some((r) => closeTo(r.estimation, v.num))).to.eq(false);
        },
      );
    });
  });
});
