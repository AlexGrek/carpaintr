const fixture = () => ({ schemaVersion: 2, car: { carClass: 'B', bodyType: 'sedan', year: '2020' }, paint: { color: 'White' }, tableMode: 'detailed', normRates: { base: 100, currency: 'EUR', additional: [] }, cellOverrides: {}, parts: { selectedParts: [{ name: 'Hood', action: 'repair' }] }, generatedCalculations: { Hood: [{ name: 'Painting', processorId: 'fixture', result: [{ key: 'coat', name: 'Paint hood', estimation: 2, category: 'paint' }, { key: 'unpriced', name: 'Material', estimation: 3, unit: 'л', category: 'materials' }] }] } });
const resume = () => { cy.getByTestId('calc-main-resume-previous-button').should('be.visible'); cy.window().then(win => win.history.replaceState(null, '', '/app/calc2?stage=tableStage')); cy.getByTestId('calc-main-resume-previous-button').click(); cy.getByTestId('calc-final-grand-total').should('be.visible'); };
const open = () => { cy.loginAsSeedUser(27); cy.window().then(win => win.localStorage.setItem('unsaved_calculation', JSON.stringify(fixture()))); cy.visit('/app/calc2?stage=tableStage'); resume(); };
const cell = (id, field) => cy.getByTestId(`calc-cell-${id}-${field}`);
const write = (id, field, value) => { cell(id, field).scrollIntoView().clear().type(value); cell(id, field).blur(); };
const current = () => cy.window().then(win => JSON.parse(win.localStorage.getItem('unsaved_calculation')));
describe('Editable calculation document', () => {
  before(() => cy.ensureSeedUserLicensed(27));
  [1280, 320].forEach(width => it(`preserves cells through views, navigation, real save/load and print at ${width}px`, () => {
    cy.viewport(width, 900); open();
    current().then(doc => {
      const tableId = doc.calculations.Hood[0].id, rowId = doc.calculations.Hood[0].result.find(row => row.key === 'coat').id;
      write(rowId, 'name', 'Custom paint'); write(rowId, 'estimation', '3,5'); write(rowId, 'price', '12,25'); write(rowId, 'sum', '17'); write(rowId, 'unit', 'custom');
      cy.getByTestId(`calc-row-options-${rowId}`).find('summary').click();
      write(rowId, 'category', 'Custom finishing'); write(rowId, 'orderingNum', '8'); write(rowId, 'tooltip', 'Saved note'); write(tableId, 'name', 'Custom table'); write(tableId, 'total', '19');
      cy.getByTestId('calc-grand-total-input').clear().type('23').blur();
      cy.getByTestId('calc-final-mode-collapsed').scrollIntoView().click(); cell(rowId, 'name').should('have.value', 'Custom paint'); cell(rowId, 'sum').should('have.value', '17');
      cy.getByTestId('calc-final-mode-by-category').scrollIntoView().click(); cell(rowId, 'price').should('have.value', '12,25'); cy.getByTestId('calc-final-category-Custom finishing').should('exist');
      cy.getByTestId(`calc-row-options-${rowId}`).find('summary').click(); write(rowId, 'category', 'constructor'); cy.getByTestId('calc-final-category-constructor').should('exist');
      write(rowId, 'price', '-'); cy.getByTestId('calc-final-stage-print-button').should('be.disabled'); cy.getByTestId(`calc-reset-${rowId}-price`).click(); cell(rowId, 'price').should('have.value', '100'); write(rowId, 'price', '12,25');
      cy.getByTestId('calc-final-stage-back-button').click(); cy.getByTestId('calc-body-parts-stage-accept-button').click(); cell(rowId, 'sum').should('have.value', '17'); cy.getByTestId('calc-grand-total-input').should('have.value', '23');
      cy.intercept('POST', '**/calculationstore').as('saveDocument'); cy.getByTestId('calc-final-stage-save-button').click();
      cy.wait('@saveDocument').then(({ request, response }) => {
        expect(response.statusCode).to.eq(200); expect(request.body.schemaVersion).to.eq(2);
        cy.getAuthToken(27).then(token => cy.request({ url: `/api/v1/user/calculationstore?filename=${encodeURIComponent(response.body.saved_file_path)}`, headers: { Authorization: `Bearer ${token}` } }).then(({ body }) => { expect(body.cellOverrides[rowId].sum.value).to.eq(17); expect(body.normRates.currency).to.eq('EUR'); cy.window().then(win => win.localStorage.setItem('unsaved_calculation', JSON.stringify(body))); }));
      });
      cy.reload(); resume(); cell(rowId, 'name').should('have.value', 'Custom paint'); cell(rowId, 'sum').should('have.value', '17');
      cy.getByTestId('calc-final-stage-print-button').click(); cy.get('[data-testid^="print-template-card-"]').first().click(); cy.getByTestId('print-toggle-payload-button').scrollIntoView().click();
      cy.getByTestId('print-payload-json').invoke('text').then(text => { const payload = JSON.parse(text).calculation, row = payload.calc.Hood[0].result.find(row => row.id === rowId); expect(row.name).to.eq('Custom paint'); expect(row.sum).to.eq(17); expect(row.price).to.eq(12.25); expect(row.tooltip).to.eq('Saved note'); expect(payload.grand_total).to.eq(23); expect(payload.currency).to.eq('EUR'); expect(Object.keys(payload.calc_by_category)).to.include('constructor'); });
      cy.intercept('POST', '**/generate_html_table').as('preview'); cy.getByTestId('print-generate-preview-button').scrollIntoView().click(); cy.wait('@preview').its('response.statusCode').should('eq', 200); cy.getByTestId('print-html-preview-iframe').should('exist');
    });
  }));
  it('reconciles processor reruns and restores removed parts with edits', () => {
    cy.intercept('GET', '**/processors_bundle', { body: `exports.default = [{ processorId: 'fixture', version: '1', name: 'Painting', requiredTables: ['fixture'], requiredFiles: [], requiredRepairTypes: [], shouldRun: () => true, run: (x, part, tables) => [{ key: 'coat', name: 'Paint hood', evaluate: tables.fixture.hours * (part.damageLevel + 1), category: 'paint' }, { key: 'unpriced', name: 'Material', evaluate: 3, unit: 'л', category: 'materials' }] }];` });
    cy.intercept('GET', '**/lookup_all_tables?*', { body: [['fixture.csv', { hours: '2' }]] });
    open();
    current().then(doc => {
      const rowId = doc.calculations.Hood[0].result.find(row => row.key === 'coat').id;
      write(rowId, 'name', 'Authored name'); write(rowId, 'price', '7');
      cy.getByTestId('calc-final-stage-back-button').click();
      cy.getByTestId('calc-body-part-details-button-hood').click();
      cy.getByTestId('calc-lookup-editor').find('summary').first().click();
      cy.getByTestId('calc-lookup-editor').contains('summary', 'fixture').click();
      cy.getByTestId('calc-lookup-fixture-hours').should('have.value', '2').clear().type('3');
      cy.getByTestId('calc-body-part-damage-level-5').click();
      cy.getByTestId('calc-body-part-details-save-button').click();
      cy.getByTestId('calc-body-parts-stage-accept-button').click();
      cell(rowId, 'estimation').should('have.value', '18'); cell(rowId, 'name').should('have.value', 'Authored name'); cell(rowId, 'price').should('have.value', '7'); cell(rowId, 'sum').should('have.value', '126');
      cy.getByTestId('calc-final-stage-back-button').click();
      cy.getByTestId('calc-body-part-remove-button-hood').click(); cy.getByTestId('calc-body-part-delete-confirm-button').click();
      cy.getByTestId('calc-stage-tab-tableStage').click(); cy.getByTestId('calc-final-grand-total').should('contain', '0.00');
      cy.getByTestId('calc-final-stage-back-button').click(); cy.getByTestId('calc-restore-part-Hood').click(); cy.getByTestId('calc-body-parts-stage-accept-button').click();
      cell(rowId, 'name').should('have.value', 'Authored name'); cell(rowId, 'price').should('have.value', '7'); cell(rowId, 'sum').should('have.value', '126');
    });
  });
  it('saves edited VIN and preserves filename acknowledgments while on vehicle stage', () => {
    open(); cy.getByTestId('calc-stage-tab-carSelectStage').click();
    cy.getByTestId('calc-car-vin-input').clear().type('WVWZZZ1JZXW000001');
    cy.getByTestId('calc-stage-tab-tableStage').click();
    cy.intercept('POST', '**/calculationstore', req => req.continue(res => res.setDelay(1000))).as('vehicleSave');
    cy.getByTestId('calc-final-stage-save-button').click(); cy.getByTestId('calc-stage-tab-carSelectStage').click();
    cy.wait('@vehicleSave').then(({request, response}) => {
      expect(request.body.car.vin).to.eq('WVWZZZ1JZXW000001'); expect(request.body.car).not.to.have.property('VIN');
      current().then(doc => { expect(doc.car.storeFileName).to.eq(response.body.saved_file_path); });
      cy.getAuthToken(27).then(token => cy.request({ url: `/api/v1/user/calculationstore?filename=${encodeURIComponent(response.body.saved_file_path)}`, headers: {Authorization: `Bearer ${token}`} }).its('body.car.vin').should('eq', 'WVWZZZ1JZXW000001'));
    });
  });
  it('retains save lock across stages and preserves edits made while saving', () => {
    open(); cy.intercept('POST', '**/calculationstore', req => req.continue(res => res.setDelay(2500))).as('slowSave'); cy.getByTestId('calc-final-stage-save-button').click(); cy.getByTestId('calc-final-stage-back-button').click(); cy.getByTestId('calc-body-parts-stage-accept-button').click(); cy.getByTestId('calc-final-stage-save-button').should('be.disabled'); cy.getByTestId('calc-norm-rates-base').find('input').clear().type('500').blur(); cy.wait('@slowSave'); cy.getByTestId('calc-final-stage-save-button').should('not.be.disabled'); cy.getByTestId('calc-norm-rates-base').find('input').should('have.value', '500'); current().then(doc => { expect(doc.normRates.base).to.eq(500); expect(doc.revision).to.be.greaterThan(doc.lastSavedRevision); });
  });
});
