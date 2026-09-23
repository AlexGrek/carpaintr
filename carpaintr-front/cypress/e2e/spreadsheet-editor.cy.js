/**
 * E2E: Excel-like CSV table editor (SpreadsheetEditor).
 *
 * Uploads a small per-user CSV, opens it directly via FilesystemBrowser's
 * `?path=` deep link (the browser's tab/breadcrumb navigation has no
 * data-testids to hook into, but it already resolves a `path` query param
 * straight to the target file — see FilesystemBrowser.jsx effect 4), then
 * exercises a representative slice of the editor's Excel-like behavior:
 * formula-bar editing with strict "Enter moves down" semantics, Ctrl+D fill,
 * Find & Replace all, a column AutoFilter, and the Data-cleanup menu's
 * "Remove duplicate rows" — ending with a save whose exact byte content is
 * checked via the editor's own read API.
 *
 * Requires: backend + frontend (task cypress), seed users populated.
 */

const TEST_USER_INDEX = 26;
const TABLE_PATH = "tables/spreadsheet-editor-test.csv";

// A duplicate row ("Banana" twice) so "Remove duplicate rows" has something
// concrete and deterministic to remove.
const INITIAL_CSV = "Name,Qty,Price\nApple,1,10\nBanana,2,20\nBanana,2,20\n";

// Expected content after every step below, byte-for-byte (Papa.unparse's
// default CRLF line endings, unchanged from before this feature).
const EXPECTED_SAVED_CSV = "Name,Qty,Price\r\nWidget,1,10\r\nCherry,1,20";

describe("Excel-like CSV table editor", () => {
  let token;

  before(() => {
    cy.ensureSeedUserLicensed(TEST_USER_INDEX);
    cy.getAuthToken(TEST_USER_INDEX).then((t) => {
      token = t;
    });
  });

  beforeEach(() => {
    // Delete first: the backend's git-backed writer 500s on an upload whose
    // content is byte-identical to what's already committed ("nothing to
    // commit"), which a fresh `beforeEach` re-upload of the same fixture
    // would otherwise hit whenever the previous test didn't change it.
    cy.deleteUserFile({ token, path: TABLE_PATH });
    cy.uploadUserFile({ token, path: TABLE_PATH, content: INITIAL_CSV })
      .its("status")
      .should("eq", 200);
  });

  after(() => {
    cy.deleteUserFile({ token, path: TABLE_PATH });
  });

  it("edits via the formula bar, fills down, finds & replaces, filters, and dedupes, then saves exactly", () => {
    cy.loginAsSeedUser(TEST_USER_INDEX);
    cy.visit(`/app/fileeditor?path=${encodeURIComponent(TABLE_PATH)}`);
    cy.getByTestId("file-editor-open-table", { timeout: 20000 })
      .should("be.visible")
      .click();
    cy.getByTestId("sheet-scroll").should("be.visible");

    // --- Remove duplicate rows (Data ▾ menu) -------------------------------
    cy.getByTestId("sheet-data-menu").click();
    cy.getByTestId("menu-remove-duplicates").click({ force: true });
    cy.getByTestId("sheet-cell-2-0").should("not.exist"); // 2 data rows left

    // --- Formula bar edit + strict "Enter moves down" ----------------------
    cy.getByTestId("sheet-cell-0-0").click();
    cy.getByTestId("sheet-formulabar-input").clear().type("Widget{enter}");
    cy.getByTestId("sheet-cell-0-0").should("contain.text", "Widget");
    cy.getByTestId("sheet-active-address").should("have.text", "A2");

    // --- Ctrl+D fill down on the Qty column ---------------------------------
    cy.getByTestId("sheet-cell-0-1").click();
    cy.getByTestId("sheet-cell-1-1").click({ shiftKey: true });
    cy.getByTestId("sheet-scroll").type("{ctrl}d");
    cy.getByTestId("sheet-cell-1-1").should("contain.text", "1");

    // --- Find & Replace all -------------------------------------------------
    cy.getByTestId("sheet-find-toggle").click();
    cy.getByTestId("find-query-input").type("Banana");
    cy.getByTestId("find-toggle-replace").click();
    cy.getByTestId("find-replace-input").type("Cherry");
    cy.getByTestId("find-replace-all").click();
    cy.getByTestId("find-close").click();
    cy.getByTestId("sheet-cell-1-0").should("contain.text", "Cherry");

    // --- Column AutoFilter: isolate "Cherry" then clear it again -----------
    cy.getByTestId("sheet-col-menu-0").click();
    cy.getByTestId("colmenu-select-all-0")
      .find("input[type=checkbox]")
      .should("be.checked");
    cy.getByTestId("colmenu-select-all-0").click(); // uncheck everything
    cy.getByTestId("colmenu-select-all-0")
      .find("input[type=checkbox]")
      .should("not.be.checked");
    cy.getByTestId("colmenu-search-0").type("Cherry");
    cy.getByTestId("colmenu-value-0")
      .find("input[type=checkbox]")
      .should("not.be.checked");
    cy.getByTestId("colmenu-value-0").click(); // check just "Cherry"
    cy.getByTestId("colmenu-value-0")
      .find("input[type=checkbox]")
      .should("be.checked");
    cy.getByTestId("colmenu-ok-0").click();
    cy.getByTestId("sheet-cell-1-0").should("not.exist"); // only 1 row visible
    cy.getByTestId("sheet-cell-0-0").should("contain.text", "Cherry");

    cy.getByTestId("sheet-col-menu-0").click();
    cy.getByTestId("colmenu-clear-filter-0").click();
    cy.getByTestId("sheet-cell-1-0").should("be.visible"); // both rows back

    // --- Save and verify exact persisted content ----------------------------
    cy.getByTestId("sheet-save").click();
    cy.request({
      method: "GET",
      url: `/api/v1/editor/read_user_file/${encodeURIComponent(TABLE_PATH)}`,
      headers: { Authorization: `Bearer ${token}` },
    })
      .its("body")
      .should("eq", EXPECTED_SAVED_CSV);
  });

  it("warns instead of closing on Escape and prompts to save on Cancel with unsaved changes", () => {
    cy.loginAsSeedUser(TEST_USER_INDEX);
    cy.visit(`/app/fileeditor?path=${encodeURIComponent(TABLE_PATH)}`);
    cy.getByTestId("file-editor-open-table", { timeout: 20000 })
      .should("be.visible")
      .click();
    cy.getByTestId("sheet-scroll").should("be.visible");

    cy.getByTestId("sheet-cell-0-0").click();
    cy.getByTestId("sheet-formulabar-input").clear().type("Changed{enter}");

    // Escape must never close the drawer (Drawer keyboard={false}).
    cy.getByTestId("sheet-scroll").type("{esc}");
    cy.getByTestId("sheet-scroll").should("be.visible");

    // Cancel with unsaved changes prompts instead of discarding silently.
    cy.getByTestId("sheet-cancel").click();
    cy.getByTestId("sheet-unsaved-dialog").should("be.visible");
    cy.getByTestId("sheet-unsaved-cancel").click();
    cy.getByTestId("sheet-scroll").should("be.visible");

    cy.getByTestId("sheet-cancel").click();
    cy.getByTestId("sheet-unsaved-discard").click();
    cy.getByTestId("sheet-scroll").should("not.exist");
  });
});
