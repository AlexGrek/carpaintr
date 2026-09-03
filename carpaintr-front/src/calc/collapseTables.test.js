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
  isMaterialRow,
  sortWorkRows,
  buildCategoryTables,
} from "./collapseTables.js";
import { UNCATEGORIZED } from "./workCategories.js";

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

describe("isMaterialRow", () => {
  it("treats a non-empty unit as the material marker", () => {
    assert.equal(isMaterialRow({ name: "Фарба", unit: "л" }), true);
    assert.equal(isMaterialRow({ name: "Грунт", unit: "мл" }), true);
  });

  it("treats missing/blank units as labour", () => {
    assert.equal(isMaterialRow({ name: "Зняти" }), false);
    assert.equal(isMaterialRow({ name: "Зняти", unit: "" }), false);
    assert.equal(isMaterialRow({ name: "Зняти", unit: "   " }), false);
    assert.equal(isMaterialRow(null), false);
  });
});

describe("sortWorkRows", () => {
  it("orders labour by orderingNum", () => {
    const rows = [
      { name: "paint", orderingNum: 1600 },
      { name: "remove", orderingNum: 100 },
      { name: "weld", orderingNum: 700 },
    ];

    assert.deepEqual(
      sortWorkRows(rows).map((r) => r.name),
      ["remove", "weld", "paint"],
    );
  });

  it("pushes materials after all labour, whatever their orderingNum", () => {
    const rows = [
      { name: "лак", orderingNum: 1600, unit: "л" },
      { name: "polish", orderingNum: 1750 },
      { name: "remove", orderingNum: 100 },
    ];

    assert.deepEqual(
      sortWorkRows(rows).map((r) => r.name),
      ["remove", "polish", "лак"],
    );
  });

  it("is stable within one processor and does not mutate the input", () => {
    const rows = [
      { name: "b", orderingNum: 100 },
      { name: "a", orderingNum: 100 },
    ];
    const sorted = sortWorkRows(rows);

    assert.deepEqual(sorted.map((r) => r.name), ["b", "a"]);
    assert.deepEqual(rows.map((r) => r.name), ["b", "a"]);
    assert.notEqual(sorted, rows);
  });

  it("treats a missing orderingNum as 0 so it sorts first", () => {
    const rows = [{ name: "late", orderingNum: 500 }, { name: "unnumbered" }];

    assert.deepEqual(
      sortWorkRows(rows).map((r) => r.name),
      ["unnumbered", "late"],
    );
  });
});

describe("collapsePartTables ordering", () => {
  it("reorders rows across processors by orderingNum, materials last", () => {
    const tables = [
      {
        name: "Фарбування",
        result: [
          { name: "paint", orderingNum: 1600, estimation: 1, price: 10 },
          { name: "лак", orderingNum: 1600, unit: "л", estimation: 1, price: 10 },
        ],
      },
      {
        name: "Зняти для ремонту",
        result: [{ name: "remove", orderingNum: 100, estimation: 1, price: 10 }],
      },
    ];

    const collapsed = collapsePartTables(tables);
    assert.deepEqual(
      collapsed.result.map((r) => r.name),
      ["remove", "paint", "лак"],
    );
    // Reordering must not change the money.
    assert.equal(collapsed.total, 30);
  });
});

describe("buildCategoryTables", () => {
  const calculations = {
    Hood: [
      {
        name: "Зняти для ремонту",
        result: [
          { name: "remove hood", category: "arm", orderingNum: 100, estimation: 2, price: 10 },
        ],
      },
      {
        name: "Фарбування",
        result: [
          { name: "paint hood", category: "paint", orderingNum: 1600, estimation: 3, price: 10 },
          { name: "лак hood", category: "paint", orderingNum: 1600, unit: "л", estimation: 1, price: 5 },
        ],
      },
    ],
    Bumper: [
      {
        name: "Зняти для ремонту",
        result: [
          { name: "remove bumper", category: "arm", orderingNum: 100, estimation: 1, price: 10 },
        ],
      },
    ],
  };

  it("groups rows across parts and returns categories in trade order", () => {
    const byCategory = buildCategoryTables(calculations);
    assert.deepEqual(Object.keys(byCategory), ["arm", "paint"]);
  });

  it("stamps each row with the part it came from", () => {
    const byCategory = buildCategoryTables(calculations);
    assert.deepEqual(
      byCategory.arm.result.map((r) => r.part),
      ["Hood", "Bumper"],
    );
  });

  it("totals per category", () => {
    const byCategory = buildCategoryTables(calculations);
    assert.equal(byCategory.arm.total, 30); // 2×10 + 1×10
    assert.equal(byCategory.paint.total, 35); // 3×10 + 1×5
  });

  it("keeps materials last within a category", () => {
    const byCategory = buildCategoryTables(calculations);
    assert.deepEqual(
      byCategory.paint.result.map((r) => r.name),
      ["paint hood", "лак hood"],
    );
  });

  it("preserves the grand total across the regrouping", () => {
    const byPart = buildTotalTables(calculations);
    const byCategory = buildCategoryTables(calculations);
    const sum = (tables) =>
      Object.values(tables).reduce((acc, t) => acc + t.total, 0);

    assert.equal(sum(byCategory), sum(byPart));
  });

  it("falls back to basePrice like the by-part view", () => {
    const byCategory = buildCategoryTables(
      { Hood: [{ name: "p", result: [{ name: "a", category: "arm", estimation: 2 }] }] },
      7,
    );
    assert.equal(byCategory.arm.total, 14);
  });

  it("collects rows with a missing or legacy category into a stable last bucket", () => {
    const byCategory = buildCategoryTables({
      Hood: [
        {
          name: "p",
          result: [
            { name: "legacy", category: "General", estimation: 1, price: 3 },
            { name: "blank", estimation: 1, price: 2 },
            { name: "known", category: "paint", estimation: 1, price: 1 },
          ],
        },
      ],
    });

    // Nothing vanishes, and the unknown bucket sorts after the known ones.
    assert.deepEqual(Object.keys(byCategory), ["paint", UNCATEGORIZED]);
    assert.equal(byCategory[UNCATEGORIZED].result.length, 2);
    assert.equal(byCategory[UNCATEGORIZED].total, 5);
  });

  it("skips invalid entries and returns {} for invalid input", () => {
    const byCategory = buildCategoryTables({
      Hood: ["processor error", { name: "p", result: [{ name: "a", category: "arm", estimation: 1, price: 4 }] }],
      Bumper: "not an array",
    });

    assert.deepEqual(Object.keys(byCategory), ["arm"]);
    assert.equal(byCategory.arm.total, 4);
    assert.deepEqual(buildCategoryTables(null), {});
  });
});
