import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isValidTableEntry,
  collapsePartTables,
  buildTotalTables,
  totalTablesForTemplate,
  toRealNumber,
  sanitizeTableEntry,
  sanitizeCalcForTemplate,
} from "./collapseTables.js";

describe("isValidTableEntry", () => {
  it("accepts object with result array", () => {
    assert.equal(isValidTableEntry({ name: "p1", result: [] }), true);
  });

  it("rejects invalid entries", () => {
    assert.equal(isValidTableEntry(null), false);
    assert.equal(isValidTableEntry("error"), false);
    assert.equal(isValidTableEntry({ name: "p1" }), false);
  });
});

describe("collapsePartTables", () => {
  it("merges rows from multiple processors in order", () => {
    const tables = [
      {
        name: "procA",
        result: [{ name: "row1", estimation: 2, price: 10 }],
        total: 20,
      },
      {
        name: "procB",
        result: [{ name: "row2", estimation: 1, price: 5 }],
        total: 5,
      },
    ];

    const collapsed = collapsePartTables(tables);
    assert.equal(collapsed.result.length, 2);
    assert.equal(collapsed.result[0].name, "row1");
    assert.equal(collapsed.result[1].name, "row2");
    assert.equal(collapsed.total, 25);
  });

  it("skips invalid entries", () => {
    const tables = [
      "processor error",
      { name: "procA", result: [{ name: "row1", estimation: 1, price: 3 }] },
    ];

    const collapsed = collapsePartTables(tables);
    assert.equal(collapsed.result.length, 1);
    assert.equal(collapsed.total, 3);
  });

  it("uses basePrice when row price is missing", () => {
    const tables = [
      { name: "procA", result: [{ name: "row1", estimation: 2 }] },
    ];

    const collapsed = collapsePartTables(tables, 7);
    assert.equal(collapsed.total, 14);
  });
});

describe("buildTotalTables", () => {
  it("builds collapsed table per part", () => {
    const calculations = {
      Hood: [
        { name: "p1", result: [{ name: "a", estimation: 1, price: 2 }] },
      ],
      Bumper: [
        { name: "p2", result: [{ name: "b", estimation: 3, price: 4 }] },
      ],
    };

    const total = buildTotalTables(calculations);
    assert.equal(Object.keys(total).length, 2);
    assert.equal(total.Hood.total, 2);
    assert.equal(total.Bumper.total, 12);
  });
});

describe("totalTablesForTemplate", () => {
  it("wraps each part table in a single-element array", () => {
    const totalTables = {
      Hood: { result: [{ name: "a", estimation: 1, price: 2 }], total: 2 },
    };

    const calc = totalTablesForTemplate(totalTables);
    assert.deepEqual(calc.Hood, [totalTables.Hood]);
    assert.equal(calc.Hood[0].name, undefined);
  });
});

describe("toRealNumber", () => {
  it("returns 0 for unfilled values", () => {
    assert.equal(toRealNumber(null), 0);
    assert.equal(toRealNumber(undefined), 0);
    assert.equal(toRealNumber(""), 0);
    assert.equal(toRealNumber("Unfilled"), 0);
    assert.equal(toRealNumber(NaN), 0);
  });

  it("parses numeric values", () => {
    assert.equal(toRealNumber(3), 3);
    assert.equal(toRealNumber("4.5"), 4.5);
  });
});

describe("sanitizeTableEntry", () => {
  it("replaces unfilled numeric fields with zeroes and recomputes sum/total", () => {
    const table = {
      name: "p1",
      result: [
        { name: "a", estimation: null, price: 2 },
        { name: "b", estimation: 3, price: undefined },
      ],
      total: null,
    };

    const sanitized = sanitizeTableEntry(table);
    assert.equal(sanitized.result[0].estimation, 0);
    assert.equal(sanitized.result[0].sum, 0);
    // price missing falls back to basePrice (1)
    assert.equal(sanitized.result[1].price, 1);
    assert.equal(sanitized.result[1].sum, 3);
    assert.equal(sanitized.total, 3);
  });

  it("leaves non-table entries unchanged", () => {
    assert.equal(sanitizeTableEntry("error"), "error");
  });
});

describe("sanitizeCalcForTemplate", () => {
  it("never produces null numeric fields across all parts", () => {
    const calc = {
      Hood: [{ name: "p1", result: [{ name: "a", estimation: undefined }] }],
    };

    const sanitized = sanitizeCalcForTemplate(calc);
    assert.equal(sanitized.Hood[0].result[0].estimation, 0);
    assert.equal(sanitized.Hood[0].result[0].sum, 0);
    assert.equal(sanitized.Hood[0].total, 0);
  });

  it("returns empty object for invalid input", () => {
    assert.deepEqual(sanitizeCalcForTemplate(null), {});
  });
});
