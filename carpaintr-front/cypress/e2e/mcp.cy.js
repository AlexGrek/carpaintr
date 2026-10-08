const authRequest = (method, url, body) => cy.window().then(win => cy.request({
  method, url, body, headers: { Authorization: `Bearer ${win.localStorage.getItem('authToken')}` },
}));

describe('MCP connections and saved PDFs', () => {
  before(() => cy.ensureSeedUserLicensed(26));
  beforeEach(() => cy.loginAsSeedUser(26));

  [1280, 320].forEach(width => {
    it(`creates and revokes a scoped key at ${width}px`, () => {
      cy.viewport(width, 900);
      cy.visit('/app/mcp');
      cy.getByTestId('mcp-url').should('contain', '/mcp');
      cy.getByTestId('mcp-key-name').type(`Browser key ${width}`);
      cy.intercept('POST', '/api/v1/mcp/keys').as('newKey');
      cy.getByTestId('mcp-create-key').click();
      cy.wait('@newKey').then(({ response }) => {
        cy.getByTestId('mcp-new-key').should('have.value', response.body.key);
        cy.getByTestId(`mcp-revoke-key-${response.body.id}`).click();
        cy.getByTestId(`mcp-revoke-key-${response.body.id}`).should('not.exist');
      });
    });
  });

  it('shows consent and returns the authorization code to the registered callback', () => {
    const base = Cypress.config('baseUrl');
    const challenge = 'a'.repeat(43);
    authRequest('GET', '/api/v1/mcp/keys').then(({ body: info }) => {
      cy.request('POST', '/oauth/register', { client_name: 'Browser test assistant', redirect_uris: [`${base}/app/mcp`], token_endpoint_auth_method: 'none' }).then(({ body: client }) => {
        const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: `${base}/app/mcp`, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', resource: info.mcp_url, scope: 'company:read', state: 'browser-state' });
        cy.request({ url: `/oauth/authorize?${query}`, followRedirect: false }).then(response => {
          const request = new URL(response.headers.location).searchParams.get('request');
          cy.visit(`/app/mcp/authorize?request=${request}`);
          cy.getByTestId('mcp-authorize-page').should('contain', 'Browser test assistant');
          cy.getByTestId('mcp-approve').click();
          cy.url().should('include', '/app/mcp?').and('include', 'code=').and('include', 'state=browser-state');
        });
      });
    });
  });

  it('saves PDFs, rotates links and revokes public access while keeping owner downloads', () => {
    const payload = { calculation: { car: { year: '2020', carClass: 'B', bodyType: 'sedan' }, calc: {}, currency: 'UAH', grand_total: 0 }, metadata: { order_number: `CYPRESS-MCP-${Date.now()}`, order_notes: null } };
    authRequest('POST', '/api/v1/pdfs', payload).then(({ body: pdf }) => {
      cy.request(pdf.public_url).its('headers.content-type').should('eq', 'application/pdf');
      cy.visit('/app/history');
      cy.getByTestId(`pdf-public-${pdf.document_id}`).should('have.attr', 'href', pdf.public_page_url);
      cy.intercept('POST', `/api/v1/pdfs/${pdf.document_id}/share`).as('reshare');
      cy.getByTestId(`pdf-share-${pdf.document_id}`).click();
      cy.wait('@reshare').then(({ response }) => {
        expect(response.body.public_url).not.to.eq(pdf.public_url);
        cy.request({ url: pdf.public_url, failOnStatusCode: false }).its('status').should('eq', 404);
        cy.getByTestId(`pdf-revoke-${pdf.document_id}`).click();
        cy.getByTestId(`pdf-public-${pdf.document_id}`).should('not.exist');
        cy.request({ url: response.body.public_url, failOnStatusCode: false }).its('status').should('eq', 404);
        authRequest('GET', `/api/v1/pdfs/${pdf.document_id}`).its('status').should('eq', 200);
      });
    });
  });
  it('opens an MCP estimate in Calc2 and saves browser edits back to MCP', () => {
    authRequest('POST', '/api/v1/mcp/keys', { name: 'Cross-client browser test' }).then(({ body: key }) => {
      const call = (name, args = {}) => cy.request({
        method: 'POST', url: key.mcp_url,
        headers: { Authorization: `Bearer ${key.key}`, Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' },
        body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
      }).then(({ body }) => {
        expect(body.result.isError).not.to.eq(true);
        return body.result.structuredContent;
      });
      call('search_catalog', { kind: 'parts', car_class: 'B', body_type: 'sedan', query: 'hood' }).then(parts => {
        const part = parts.items[0].name;
        call('search_catalog', { kind: 'repair_actions', part }).then(actions => {
          const action = actions.items.find(item => item.id.includes('з зовнішнім фарбуванням')).id;
          call('create_calculation', { inputs: { car: { carClass: 'B', bodyType: 'sedan', year: '2020' }, paint: { paintType: 'metallic' }, parts: [{ name: part, selectedAction: action }] } }).then(draft => {
            const row = draft.rows.find(entry => entry.row.kind === 'labor').row;
            // The assistant hands the user app_url; it opens the shared draft on the estimate table.
            const appUrl = new URL(draft.app_url);
            expect(appUrl.pathname).to.eq('/app/calc2');
            expect(appUrl.searchParams.get('stage')).to.eq('tableStage');
            cy.visit(appUrl.pathname + appUrl.search);
            cy.getByTestId(`calc-cell-${row.id}-sum`).scrollIntoView().clear().type('606,06').blur();
            cy.intercept('POST', '**/calculationstore').as('crossClientSave');
            cy.getByTestId('calc-final-stage-save-button').click();
            cy.wait('@crossClientSave').its('response.statusCode').should('eq', 200);
            call('get_calculation', { calculation_id: draft.calculation_id }).then(current => {
              expect(current.revision).to.be.greaterThan(draft.revision);
              expect(current.rows.find(entry => entry.row.id === row.id).row.sum).to.eq(606.06);
            });
            cy.getByTestId('calc-final-stage-print-button').click();
            cy.get('[data-testid^="print-template-card-"]').first().click();
            cy.intercept('POST', '/api/v1/pdfs').as('saveSharedPrint');
            cy.getByTestId('print-save-share-pdf-button').scrollIntoView().click();
            cy.wait('@saveSharedPrint').then(({ response }) => {
              expect(response.statusCode).to.eq(200);
              cy.getByTestId('print-saved-pdf-link').should('have.attr', 'href', response.body.public_page_url);
              cy.request(response.body.public_url).its('headers.content-type').should('eq', 'application/pdf');
            });
          });
        });
      });
    });
  });
  it('sends a signed-out user through login and back to the MCP estimate', () => {
    authRequest('POST', '/api/v1/mcp/keys', { name: 'App link browser test' }).then(({ body: key }) => {
      cy.request({
        method: 'POST', url: key.mcp_url,
        headers: { Authorization: `Bearer ${key.key}`, Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' },
        body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_calculation', arguments: { inputs: { car: { make: 'Linked brand', carClass: 'B', bodyType: 'sedan', year: '2020' } } } } },
      }).then(({ body }) => {
        const appUrl = new URL(body.result.structuredContent.app_url);
        cy.clearLocalStorage();
        cy.visit(appUrl.pathname + appUrl.search);
        cy.url().should('include', '/app/login?redirect=');
        cy.getByTestId('login-email-input').type('user26@example.com');
        cy.getByTestId('login-password-input').type('test26', { log: false });
        cy.getByTestId('login-submit-button').click();
        cy.url({ timeout: 20000 }).should('include', `id=${appUrl.searchParams.get('id')}`);
        cy.getByTestId('calc-final-stage-save-button', { timeout: 20000 }).should('be.visible');
      });
    });
  });

  it('reports a missing calculation and falls back to the start menu', () => {
    cy.visit('/app/calc2?id=does-not-exist&stage=tableStage');
    cy.getByTestId('calc-open-error').should('be.visible');
    cy.location('search').should('not.include', 'id=');
  });
});
