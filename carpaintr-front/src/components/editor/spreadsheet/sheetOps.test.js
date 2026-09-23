import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  colLabel,
  colIndexFromLabel,
  parseAddress,
  parseCsv,
  serializeCsv,
  buildClipboardText,
  parseClipboard,
  fillSeries,
  dataEdge,
  findDuplicateRows,
  selectionStats,
  findMatches,
  replaceInCell,
  isNumeric,
  advanceActiveInBlock,
  estimateColumnWidth,
  computeFillRect,
} from "./sheetOps.js";

describe("colLabel / colIndexFromLabel", () => {
  it("round-trips single and double letters", () => {
    assert.equal(colLabel(0), "A");
    assert.equal(colLabel(25), "Z");
    assert.equal(colLabel(26), "AA");
    assert.equal(colLabel(27), "AB");
    assert.equal(colIndexFromLabel("A"), 0);
    assert.equal(colIndexFromLabel("Z"), 25);
    assert.equal(colIndexFromLabel("AA"), 26);
    assert.equal(colIndexFromLabel("ab"), 27);
  });

  it("rejects invalid labels", () => {
    assert.equal(colIndexFromLabel("1A"), -1);
    assert.equal(colIndexFromLabel(""), -1);
  });
});

describe("parseAddress", () => {
  it("parses a single cell", () => {
    assert.deepEqual(parseAddress("B12"), { r1: 11, r2: 11, c1: 1, c2: 1 });
  });

  it("parses a range and normalizes order", () => {
    assert.deepEqual(parseAddress("C5:A1"), { r1: 0, r2: 4, c1: 0, c2: 2 });
  });

  it("returns null for garbage", () => {
    assert.equal(parseAddress("hello"), null);
    assert.equal(parseAddress(""), null);
  });
});

describe("parseCsv / serializeCsv", () => {
  it("round-trips a simple csv (serialized with CRLF, matching Papa's default)", () => {
    const csv = "a,b,c\n1,2,3\n4,5,6";
    const { headers, rows } = parseCsv(csv);
    assert.deepEqual(headers, ["a", "b", "c"]);
    assert.deepEqual(rows, [
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
    assert.equal(serializeCsv(headers, rows), "a,b,c\r\n1,2,3\r\n4,5,6");
  });

  it("preserves quoted values with embedded commas and newlines", () => {
    const csv = 'name,note\n"Smith, John","line1\nline2"';
    const { headers, rows } = parseCsv(csv);
    assert.deepEqual(rows[0], ["Smith, John", "line1\nline2"]);
    assert.equal(
      serializeCsv(headers, rows),
      'name,note\r\n"Smith, John","line1\nline2"',
    );
  });

  it("names blank headers using column letters", () => {
    const { headers } = parseCsv("a,,c\n1,2,3");
    assert.deepEqual(headers, ["a", "B", "c"]);
  });

  it("falls back to a single blank cell for empty input", () => {
    assert.deepEqual(parseCsv(""), { headers: ["Column A"], rows: [[""]] });
  });
});

describe("clipboard build / parse", () => {
  it("builds tab-separated text from a rectangular block", () => {
    const rows = [
      ["1", "2", "3"],
      ["4", "5", "6"],
    ];
    const viewOrder = [0, 1];
    assert.equal(buildClipboardText(rows, viewOrder, 0, 1, 0, 1), "1\t2\n4\t5");
  });

  it("quotes cells containing tabs or newlines when building", () => {
    const rows = [["a\tb", "c\nd"]];
    const text = buildClipboardText(rows, [0], 0, 0, 0, 1);
    assert.equal(text, '"a\tb"\t"c\nd"');
  });

  it("parses plain tsv into a matrix", () => {
    assert.deepEqual(parseClipboard("1\t2\n3\t4"), [
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("parses quoted multi-line Excel cells without splitting them", () => {
    const text = 'a\t"line1\nline2"\nb\tc';
    assert.deepEqual(parseClipboard(text), [
      ["a", "line1\nline2"],
      ["b", "c"],
    ]);
  });

  it("round-trips build -> parse", () => {
    const rows = [["x\ty", "plain"]];
    const built = buildClipboardText(rows, [0], 0, 0, 0, 1);
    assert.deepEqual(parseClipboard(built), [["x\ty", "plain"]]);
  });
});

describe("fillSeries", () => {
  it("continues an arithmetic progression from two numbers", () => {
    assert.deepEqual(fillSeries(["1", "2"], 4), ["1", "2", "3", "4"]);
  });

  it("continues a non-unit step", () => {
    assert.deepEqual(fillSeries(["5", "10"], 4), ["5", "10", "15", "20"]);
  });

  it("copies a single plain number instead of incrementing", () => {
    assert.deepEqual(fillSeries(["7"], 3), ["7", "7", "7"]);
  });

  it("increments a single text+trailing-number value", () => {
    assert.deepEqual(fillSeries(["Item 1"], 3), ["Item 1", "Item 2", "Item 3"]);
  });

  it("continues a text+number series and preserves zero-padding", () => {
    assert.deepEqual(fillSeries(["Row 01", "Row 02"], 4), [
      "Row 01",
      "Row 02",
      "Row 03",
      "Row 04",
    ]);
  });

  it("repeats a non-matching pattern cyclically", () => {
    assert.deepEqual(fillSeries(["a", "b"], 5), ["a", "b", "a", "b", "a"]);
  });

  it("returns the prefix unchanged when totalCount is not larger", () => {
    assert.deepEqual(fillSeries(["1", "2", "3"], 2), ["1", "2"]);
  });
});

describe("dataEdge", () => {
  // 5-row single column: [ "", "a", "b", "", "" ]
  const col = ["", "a", "b", "", ""];
  const getValue = (r) => col[r];

  it("jumps from an empty start cell to the first filled cell", () => {
    assert.deepEqual(dataEdge(getValue, 0, 0, 1, 0, 5, 1), { r: 1, c: 0 });
  });

  it("jumps across a run to the last filled cell before a gap", () => {
    assert.deepEqual(dataEdge(getValue, 1, 0, 1, 0, 5, 1), { r: 2, c: 0 });
  });

  it("jumps across a gap to the next filled run", () => {
    const col2 = ["a", "", "", "b", ""];
    const gv = (r) => col2[r];
    assert.deepEqual(dataEdge(gv, 0, 0, 1, 0, 5, 1), { r: 3, c: 0 });
  });

  it("stops at the edge when no further data exists", () => {
    assert.deepEqual(dataEdge(getValue, 2, 0, 1, 0, 5, 1), { r: 4, c: 0 });
  });

  it("does not move past the grid boundary", () => {
    assert.deepEqual(dataEdge(getValue, 4, 0, 1, 0, 5, 1), { r: 4, c: 0 });
  });
});

describe("findDuplicateRows", () => {
  it("flags exact repeats after the first occurrence", () => {
    const rows = [
      ["a", "1"],
      ["b", "2"],
      ["a", "1"],
      ["b", "2"],
      ["c", "3"],
    ];
    assert.deepEqual(findDuplicateRows(rows), [2, 3]);
  });

  it("treats null and empty string as equal", () => {
    const rows = [
      ["a", null],
      ["a", ""],
    ];
    assert.deepEqual(findDuplicateRows(rows), [1]);
  });
});

describe("selectionStats", () => {
  it("computes count/sum/min/max over a rectangle", () => {
    const rows = [
      ["1", "x"],
      ["2", "y"],
      ["", "z"],
    ];
    const viewOrder = [0, 1, 2];
    const stats = selectionStats(rows, viewOrder, 0, 2, 0, 0);
    assert.equal(stats.count, 2);
    assert.equal(stats.numCount, 2);
    assert.equal(stats.sum, 3);
    assert.equal(stats.min, 1);
    assert.equal(stats.max, 2);
  });

  it("respects the view order (sorted/filtered)", () => {
    const rows = [["3"], ["1"], ["2"]];
    const viewOrder = [1, 2, 0]; // sorted ascending
    const stats = selectionStats(rows, viewOrder, 0, 1, 0, 0);
    assert.equal(stats.sum, 3); // rows 1 and 2 -> values "1","2"
  });

  it("bails out past the limit without counting", () => {
    const rows = [["1"], ["2"]];
    const stats = selectionStats(rows, [0, 1], 0, 1, 0, 0, 1);
    assert.equal(stats.count, null);
    assert.equal(stats.total, 2);
  });
});

describe("findMatches / replaceInCell", () => {
  const rows = [
    ["Foo", "bar"],
    ["FOO", "baz"],
  ];
  const viewOrder = [0, 1];

  it("finds case-insensitive substring matches in row-major view order", () => {
    assert.deepEqual(findMatches(rows, viewOrder, 2, "foo"), [
      { vr: 0, c: 0 },
      { vr: 1, c: 0 },
    ]);
  });

  it("respects match case", () => {
    assert.deepEqual(
      findMatches(rows, viewOrder, 2, "foo", { matchCase: true }),
      [],
    );
  });

  it("respects whole-cell matching", () => {
    assert.deepEqual(
      findMatches(rows, viewOrder, 2, "ba", { wholeCell: true }),
      [],
    );
    assert.deepEqual(
      findMatches(rows, viewOrder, 2, "bar", { wholeCell: true }),
      [{ vr: 0, c: 1 }],
    );
  });

  it("replaces matched substrings, case-insensitively by default", () => {
    assert.equal(replaceInCell("Foo bar foo", "foo", "X"), "X bar X");
  });

  it("replaces whole-cell only when the entire value matches", () => {
    assert.equal(replaceInCell("bar", "bar", "X", { wholeCell: true }), "X");
    assert.equal(
      replaceInCell("bar2", "bar", "X", { wholeCell: true }),
      "bar2",
    );
  });

  it("escapes regex special characters in the query", () => {
    assert.equal(replaceInCell("a.b.c", ".", "-"), "a-b-c");
  });
});

describe("advanceActiveInBlock", () => {
  const rect = { r1: 0, r2: 1, c1: 0, c2: 1 }; // 2x2 block

  it("Enter advances down the column, wrapping to the next column", () => {
    assert.deepEqual(advanceActiveInBlock(rect, { r: 0, c: 0 }, "row", false), { r: 1, c: 0 });
    assert.deepEqual(advanceActiveInBlock(rect, { r: 1, c: 0 }, "row", false), { r: 0, c: 1 });
    assert.deepEqual(advanceActiveInBlock(rect, { r: 1, c: 1 }, "row", false), { r: 0, c: 0 });
  });

  it("Shift+Enter reverses direction", () => {
    assert.deepEqual(advanceActiveInBlock(rect, { r: 0, c: 0 }, "row", true), { r: 1, c: 1 });
  });

  it("Tab advances across the row, wrapping to the next row", () => {
    assert.deepEqual(advanceActiveInBlock(rect, { r: 0, c: 0 }, "col", false), { r: 0, c: 1 });
    assert.deepEqual(advanceActiveInBlock(rect, { r: 0, c: 1 }, "col", false), { r: 1, c: 0 });
    assert.deepEqual(advanceActiveInBlock(rect, { r: 1, c: 1 }, "col", false), { r: 0, c: 0 });
  });

  it("Shift+Tab reverses direction", () => {
    assert.deepEqual(advanceActiveInBlock(rect, { r: 0, c: 0 }, "col", true), { r: 1, c: 1 });
  });
});

describe("estimateColumnWidth", () => {
  it("grows with the longest value, clamped to min/max", () => {
    const narrow = estimateColumnWidth(["a", "bb"], { min: 40, max: 400 });
    const wide = estimateColumnWidth(["a very long value here"], { min: 40, max: 400 });
    assert.ok(narrow >= 40);
    assert.ok(wide > narrow);
  });

  it("respects the max clamp for very long values", () => {
    const huge = estimateColumnWidth(["x".repeat(200)], { min: 40, max: 200 });
    assert.equal(huge, 200);
  });

  it("falls back to min for empty columns", () => {
    assert.equal(estimateColumnWidth([], { min: 48, max: 400 }), 48);
  });
});

describe("computeFillRect", () => {
  const src = { r1: 2, r2: 3, c1: 2, c2: 3 }; // a 2x2 block

  it("extends downward when the drag is mostly vertical", () => {
    assert.deepEqual(computeFillRect(src, { r: 6, c: 3 }), {
      r1: 2,
      r2: 6,
      c1: 2,
      c2: 3,
      axis: "row",
      direction: 1,
    });
  });

  it("extends upward when dragged above the block", () => {
    assert.deepEqual(computeFillRect(src, { r: 0, c: 2 }), {
      r1: 0,
      r2: 3,
      c1: 2,
      c2: 3,
      axis: "row",
      direction: -1,
    });
  });

  it("extends rightward when the drag is mostly horizontal", () => {
    assert.deepEqual(computeFillRect(src, { r: 3, c: 6 }), {
      r1: 2,
      r2: 3,
      c1: 2,
      c2: 6,
      axis: "col",
      direction: 1,
    });
  });

  it("returns null when the target is inside the source rectangle", () => {
    assert.equal(computeFillRect(src, { r: 2, c: 3 }), null);
  });
});

describe("isNumeric", () => {
  it("accepts integers and decimals, including negatives", () => {
    assert.equal(isNumeric("42"), true);
    assert.equal(isNumeric("-3.5"), true);
  });

  it("rejects blanks and non-numeric text", () => {
    assert.equal(isNumeric(""), false);
    assert.equal(isNumeric(null), false);
    assert.equal(isNumeric("abc"), false);
  });
});
