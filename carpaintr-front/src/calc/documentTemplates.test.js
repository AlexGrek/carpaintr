import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DOCUMENT_TEMPLATE_LABELS,
  getTemplateLabel,
} from "./documentTemplates.js";

describe("getTemplateLabel", () => {
  it("never returns the storage filename for a known template", () => {
    for (const filename of Object.keys(DOCUMENT_TEMPLATE_LABELS)) {
      const label = getTemplateLabel(filename);
      assert.notEqual(label, filename);
      assert.doesNotMatch(label, /\.html|_ua/);
    }
  });

  it("routes the label through the localization function", () => {
    const label = getTemplateLabel("calculation_ua.html", (s) => `[${s}]`);
    assert.equal(label, "[Calculation]");
  });

  it("strips the extension and underscores for unknown templates", () => {
    assert.equal(getTemplateLabel("my_custom_doc.html"), "my custom doc");
  });
});
