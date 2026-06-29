import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isValidTableEntry,
  collapsePartTables,
  buildTotalTables,
  totalTablesForTemplate,
  toRealNumber,
  isUnfilledRow,
  rowSum,
  isZeroSumRow,
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

describe("isUnfilledRow", () => {
  it("flags rows whose estimation is not a real number", () => {
    assert.equal(isUnfilledRow({ estimation: "Unfilled" }), true);
    assert.equal(isUnfilledRow({ estimation: null }), true);
    assert.equal(isUnfilledRow({ estimation: undefined }), true);
    assert.equal(isUnfilledRow({ estimation: "" }), true);
    assert.equal(isUnfilledRow({}), true);
  });

  it("treats numeric estimations (including 0) as filled", () => {
    assert.equal(isUnfilledRow({ estimation: 0 }), false);
    assert.equal(isUnfilledRow({ estimation: 0.3 }), false);
    assert.equal(isUnfilledRow({ estimation: "2.5" }), false);
  });
});

describe("rowSum / isZeroSumRow", () => {
  it("computes estimation × price with basePrice fallback", () => {
    assert.equal(rowSum({ estimation: 2, price: 5 }), 10);
    assert.equal(rowSum({ estimation: 3 }, 4), 12);
    assert.equal(rowSum({ estimation: "Unfilled", price: 100 }), 0);
  });

  it("flags zero-sum rows (unfilled, zero estimation, or zero price)", () => {
    assert.equal(isZeroSumRow({ estimation: "Unfilled", price: 100 }), true);
    assert.equal(isZeroSumRow({ estimation: 0, price: 100 }), true);
    assert.equal(isZeroSumRow({ estimation: 5, price: 0 }), true);
    assert.equal(isZeroSumRow({ estimation: 0.3, price: 100 }), false);
  });
});

describe("sanitizeTableEntry", () => {
  it("drops zero-sum rows and recomputes sum/total from the rest", () => {
    const table = {
      name: "p1",
      result: [
        { name: "a", estimation: "Unfilled", price: 2 }, // unfilled → sum 0
        { name: "b", estimation: 3, price: undefined }, // price → basePrice 1
        { name: "c", estimation: 0, price: 100 }, // zero estimation → sum 0
        { name: "d", estimation: 5, price: 0 }, // zero price → sum 0
      ],
      total: null,
    };

    const sanitized = sanitizeTableEntry(table);
    // Only the non-zero-sum row "b" survives.
    assert.equal(sanitized.result.length, 1);
    assert.equal(sanitized.result[0].name, "b");
    assert.equal(sanitized.result[0].price, 1);
    assert.equal(sanitized.result[0].sum, 3);
    assert.equal(sanitized.total, 3);
  });

  it("leaves non-table entries unchanged", () => {
    assert.equal(sanitizeTableEntry("error"), "error");
  });
});

describe("sanitizeCalcForTemplate", () => {
  it("removes unfilled rows and never produces null numeric fields", () => {
    const calc = {
      Hood: [
        {
          name: "p1",
          result: [
            { name: "a", estimation: undefined },
            { name: "b", estimation: 2, price: 5 },
          ],
        },
      ],
    };

    const sanitized = sanitizeCalcForTemplate(calc);
    assert.equal(sanitized.Hood[0].result.length, 1);
    assert.equal(sanitized.Hood[0].result[0].name, "b");
    assert.equal(sanitized.Hood[0].result[0].sum, 10);
    assert.equal(sanitized.Hood[0].total, 10);
  });

  it("returns empty object for invalid input", () => {
    assert.deepEqual(sanitizeCalcForTemplate(null), {});
  });
});
