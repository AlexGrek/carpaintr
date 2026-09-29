import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decodeVinPartial,
  matchCatalogMake,
  matchCatalogModel,
  normalizeVinInput,
} from "./vindecoder.js";

describe("decodeVinPartial", () => {
  it("knows nothing from a single character", () => {
    const r = decodeVinPartial("J");
    assert.equal(r.make, null);
    assert.equal(r.model, null);
    assert.equal(r.year, null);
  });

  it("recognizes a 2-char WMI immediately", () => {
    assert.equal(decodeVinPartial("JM").make, "Mazda");
  });

  it("recognizes a make from 2 chars when all 3-char WMIs agree", () => {
    assert.equal(decodeVinPartial("WV").make, "Volkswagen");
    assert.equal(decodeVinPartial("WA").make, "Audi");
  });

  it("stays unknown when 2-char prefix is ambiguous", () => {
    // WDB (Mercedes-Benz) vs WBA (BMW) share only "W"; "SA" → Land Rover/Jaguar
    assert.equal(decodeVinPartial("SA").make, null);
    assert.equal(decodeVinPartial("SAL").make, "Land Rover");
  });

  it("guesses the model as soon as chassis chars are typed", () => {
    assert.equal(decodeVinPartial("JMZKF").model, "cx-5");
    assert.equal(decodeVinPartial("JMZK").model, null);
    assert.equal(decodeVinPartial("WAUZZZ8V").model, "a3");
  });

  it("decodes year from the 10th character", () => {
    assert.equal(decodeVinPartial("JMZKF1234").year, null);
    assert.equal(decodeVinPartial("JMZKF1234K").year, "2019");
  });

  it("normalizes input and flags invalid characters", () => {
    assert.equal(normalizeVinInput(" wvw zzz-1jz "), "WVWZZZ1JZ");
    assert.deepEqual(decodeVinPartial("WVWIO").invalidChars, ["I", "O"]);
    assert.equal(decodeVinPartial("JMZKF12345K123456789").vin.length, 17);
    assert.equal(decodeVinPartial("JMZKF12345K123456").complete, true);
  });
});

describe("catalog matching", () => {
  const makes = ["alfa-romeo", "land-rover", "mazda", "subaru", "volkswagen"];

  it("maps decoded make names to catalog keys", () => {
    assert.equal(matchCatalogMake("Land Rover", makes), "land-rover");
    assert.equal(matchCatalogMake("Alfa Romeo", makes), "alfa-romeo");
    assert.equal(matchCatalogMake("MAZDA", makes), "mazda");
    assert.equal(matchCatalogMake("BMW", makes), null);
  });

  it("maps decoded model names to catalog keys", () => {
    const models = ["cx-5", "mazda3", "mx-5"];
    assert.equal(matchCatalogModel("CX-5", models), "cx-5");
    assert.equal(matchCatalogModel("cx5", models), "cx-5");
    assert.equal(matchCatalogModel("Mazda3", models), "mazda3");
    assert.equal(matchCatalogModel("CX-50", models), null);
  });
});
