/**
 * E2E regressions for the Excel-like CSV table editor (SpreadsheetEditor):
 * frozen-column layout, column-keyed filters surviving column deletes, cut
 * safety, Cmd/Ctrl+Shift+Z redo, formula-bar focus, name-box addressing in a
 * sorted view, Ctrl+S from the cell editor, selection clamping after deleting
 * the last rows, and a "select everything" value filter being a no-op.
 *
 * Same setup as spreadsheet-editor.cy.js (per-user CSV opened through the
 * FilesystemBrowser `?path=` deep link). Requires backend + frontend
 * (task cypress), seed users populated.
 */

const TEST_USER_INDEX = 27;
const TABLE_PATH = "tables/spreadsheet-editor-regress.csv";

const SMALL_CSV = "Name,Qty,Price\nApple,1,10\nBanana,2,20\nCherry,3,30\n";

// 12 wide columns x 40 rows: enough to scroll in both directions.
const WIDE_CSV = [
  Array.from({ length: 12 }, (_, c) => `Col${c}`).join(","),
  ...Array.from({ length: 40 }, (_, r) =>
    Array.from({ length: 12 }, (_, c) => `r${r}c${c}`).join(","),
  ),
].join("\n");

describe("Excel-like CSV table editor: regressions", () => {
  let token;

  before(() => {
    cy.ensureSeedUserLicensed(TEST_USER_INDEX);
    cy.getAuthToken(TEST_USER_INDEX).then((t) => {
      token = t;
    });
  });

  after(() => {
    cy.deleteUserFile({ token, path: TABLE_PATH });
  });

  const openEditor = (csv) => {
    // Delete first: re-uploading byte-identical content 500s in the backend's
    // git-backed writer (see spreadsheet-editor.cy.js).
    cy.deleteUserFile({ token, path: TABLE_PATH });
    cy.uploadUserFile({ token, path: TABLE_PATH, content: csv })
      .its("status")
      .should("eq", 200);
    cy.loginAsSeedUser(TEST_USER_INDEX);
    cy.visit(`/app/fileeditor?path=${encodeURIComponent(TABLE_PATH)}`);
    cy.getByTestId("file-editor-open-table", { timeout: 20000 })
      .should("be.visible")
      .click();
    cy.getByTestId("sheet-scroll").should("be.visible");
  };

  const readSaved = () =>
    cy
      .request({
        method: "GET",
        url: `/api/v1/editor/read_user_file/${encodeURIComponent(TABLE_PATH)}`,
        headers: { Authorization: `Bearer ${token}` },
      })
      .its("body");

  const topOf = (testId) =>
    cy.getByTestId(testId).then(($e) => $e[0].getBoundingClientRect().top);

  it("keeps frozen columns in their row band and pinned while scrolling", () => {
    openEditor(WIDE_CSV);

    cy.getByTestId("sheet-freeze-menu").click();
    cy.getByTestId("menu-freeze-first").click({ force: true });

    // Frozen header/cell share the same band as their scrolling neighbours.
    topOf("sheet-head-1").then((headTop) => {
      topOf("sheet-head-0").should("eq", headTop);
    });
    topOf("sheet-cell-0-1").then((rowTop) => {
      topOf("sheet-cell-0-0").should("eq", rowTop);
    });
    topOf("sheet-cell-3-0").then((rowTop) => {
      topOf("sheet-cell-3-1").should("eq", rowTop);
    });

    // Horizontal scroll: frozen column stays, the rest moves under it.
    cy.getByTestId("sheet-cell-0-0").then(($c) => {
      const before = $c[0].getBoundingClientRect().left;
      cy.getByTestId("sheet-scroll").scrollTo(400, 0);
      cy.getByTestId("sheet-cell-0-0").should(($now) => {
        expect($now[0].getBoundingClientRect().left).to.eq(before);
      });
    });

    // Vertical scroll keeps the frozen column aligned with its row.
    cy.getByTestId("sheet-scroll").scrollTo(400, 300);
    cy.getByTestId("sheet-cell-15-0").should("exist");
    cy.getByTestId("sheet-cell-15-4").should("exist");
    topOf("sheet-cell-15-4").then((rowTop) => {
      topOf("sheet-cell-15-0").should("eq", rowTop);
    });
  });

  it("edits a frozen cell in place after scrolling", () => {
    openEditor(WIDE_CSV);
    cy.getByTestId("sheet-freeze-menu").click();
    cy.getByTestId("menu-freeze-first").click({ force: true });
    cy.getByTestId("sheet-scroll").scrollTo(400, 0);
    cy.getByTestId("sheet-cell-0-0").dblclick();
    cy.getByTestId("sheet-cell-input").should(($input) => {
      const cell = Cypress.$('[data-testid="sheet-cell-0-0"]')[0].getBoundingClientRect();
      const box = $input[0].getBoundingClientRect();
      expect(box.left).to.eq(cell.left);
      expect(box.top).to.eq(cell.top);
    });
  });

  it("keeps a column filter on its column after another column is deleted", () => {
    openEditor("A,B,C\n1,x,p\n2,y,q\n3,x,r\n");
    cy.getByTestId("sheet-toggle-filters").click();
    cy.getByTestId("sheet-filter-1").type("x");
    cy.getByTestId("sheet-cell-1-1").should("contain.text", "x");
    cy.getByTestId("sheet-cell-2-0").should("not.exist"); // 2 rows match

    // Select column A and delete it.
    cy.getByTestId("sheet-head-0").click();
    cy.getByTestId("sheet-delete-menu").click();
    cy.getByTestId("sheet-delete-columns").click({ force: true });

    cy.getByTestId("sheet-filter-0").should("have.value", "x");
    cy.getByTestId("sheet-filter-1").should("have.value", "");
    cy.getByTestId("sheet-cell-1-0").should("contain.text", "x");
    cy.getByTestId("sheet-cell-2-0").should("not.exist"); // still 2 rows
  });

  it("does not wipe a cut source when the clipboard changed or the cell was edited", () => {
    openEditor(SMALL_CSV);
    const dt = new DataTransfer();

    // Cut A1, then paste foreign clipboard text: the source must survive.
    cy.getByTestId("sheet-cell-0-0").click();
    cy.getByTestId("sheet-scroll").trigger("cut", { clipboardData: dt });
    cy.getByTestId("sheet-cell-1-1").click();
    const foreign = new DataTransfer();
    foreign.setData("text/plain", "from elsewhere");
    cy.getByTestId("sheet-scroll").trigger("paste", { clipboardData: foreign });
    cy.getByTestId("sheet-cell-1-1").should("contain.text", "from elsewhere");
    cy.getByTestId("sheet-cell-0-0").should("contain.text", "Apple");

    // Cut A3, overwrite it, then paste the old clipboard: new value survives.
    const dt2 = new DataTransfer();
    cy.getByTestId("sheet-cell-2-0").click();
    cy.getByTestId("sheet-scroll").trigger("cut", { clipboardData: dt2 });
    cy.getByTestId("sheet-formulabar-input").clear().type("Mango{enter}");
    cy.getByTestId("sheet-cell-0-2").click();
    cy.getByTestId("sheet-scroll").trigger("paste", { clipboardData: dt2 });
    cy.getByTestId("sheet-cell-2-0").should("contain.text", "Mango");

    // Genuine cut + paste still moves the value.
    const dt3 = new DataTransfer();
    cy.getByTestId("sheet-cell-0-1").click();
    cy.getByTestId("sheet-scroll").trigger("cut", { clipboardData: dt3 });
    cy.getByTestId("sheet-cell-0-2").click();
    cy.getByTestId("sheet-scroll").trigger("paste", { clipboardData: dt3 });
    cy.getByTestId("sheet-cell-0-2").should("have.text", "1");
    cy.getByTestId("sheet-cell-0-1").should("have.text", "");
  });

  it("redoes with Ctrl+Shift+Z instead of undoing again", () => {
    openEditor(SMALL_CSV);
    cy.getByTestId("sheet-cell-0-0").click();
    cy.getByTestId("sheet-formulabar-input").clear().type("One{enter}");
    cy.getByTestId("sheet-cell-1-0").click();
    cy.getByTestId("sheet-formulabar-input").clear().type("Two{enter}");

    cy.getByTestId("sheet-scroll").type("{ctrl}z");
    cy.getByTestId("sheet-cell-1-0").should("contain.text", "Banana");
    cy.getByTestId("sheet-scroll").type("{ctrl}{shift}z");
    cy.getByTestId("sheet-cell-1-0").should("contain.text", "Two");
    cy.getByTestId("sheet-cell-0-0").should("contain.text", "One");
  });

  it("lets the formula bar keep focus when it starts an edit", () => {
    openEditor(SMALL_CSV);
    cy.getByTestId("sheet-cell-0-0").click();
    cy.getByTestId("sheet-formulabar-input").click();
    cy.focused().should("have.attr", "data-testid", "sheet-formulabar-input");
    cy.focused().type("X");
    cy.getByTestId("sheet-formulabar-input").should("contain.value", "X");
    cy.focused().should("have.attr", "data-testid", "sheet-formulabar-input");
  });

  it("jumps by original row number from the name box in a sorted view", () => {
    openEditor(SMALL_CSV);
    cy.getByTestId("sheet-cell-0-0").rightclick();
    cy.getByTestId("ctx-sort-desc").click();
    cy.getByTestId("sheet-cell-0-0").should("contain.text", "Cherry");

    cy.getByTestId("sheet-namebox").clear().type("A1{enter}");
    cy.getByTestId("sheet-active-address").should("have.text", "A1");
    cy.getByTestId("sheet-cell-2-0").should("contain.text", "Apple");
  });

  it("saves with Ctrl+S from inside the cell editor", () => {
    openEditor(SMALL_CSV);
    cy.getByTestId("sheet-cell-0-0").dblclick();
    cy.getByTestId("sheet-cell-input").clear().type("Saved{ctrl}s");
    cy.getByTestId("sheet-scroll").should("not.exist"); // drawer closed
    readSaved().should("eq", "Name,Qty,Price\r\nSaved,1,10\r\nBanana,2,20\r\nCherry,3,30");
  });

  it("keeps the selection on the sheet after deleting the last rows", () => {
    openEditor(SMALL_CSV);
    cy.getByTestId("sheet-rownum-1").click();
    cy.getByTestId("sheet-rownum-2").click({ shiftKey: true });
    cy.getByTestId("sheet-delete-menu").click();
    cy.getByTestId("sheet-delete-rows").click({ force: true });
    cy.getByTestId("sheet-cell-1-0").should("not.exist");
    cy.getByTestId("sheet-active-address").should("have.text", "A1");
  });

  it("treats a value filter with everything ticked as no filter", () => {
    openEditor(SMALL_CSV);
    cy.getByTestId("sheet-col-menu-0").click();
    const toggle = () =>
      cy
        .getByTestId("colmenu-value-0")
        .first()
        .find("input[type=checkbox]")
        .click({ force: true });
    toggle(); // untick the first value
    toggle(); // tick it again
    cy.getByTestId("colmenu-ok-0").click();

    // Not flagged as filtered, so appending a row is allowed.
    cy.getByTestId("sheet-add-row").click();
    cy.getByTestId("sheet-cell-3-0").should("exist");
  });
});
