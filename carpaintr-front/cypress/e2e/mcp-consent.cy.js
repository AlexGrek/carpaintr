const scopes = 'company:read company:write calculations:read calculations:write pdfs:publish';
const consent = { client_name: 'Codex', scopes, redirect_uri: 'http://127.0.0.1:59868/callback' };

const visitConsent = (lang = 'en') => {
  cy.intercept('GET', '/api/v1/notifications/unread-count', { count: 0 });
  cy.visit('/app/mcp/authorize?request=consent-ui-test', {
    onBeforeLoad(win) {
      win.localStorage.setItem('authToken', 'consent-ui-test');
      win.localStorage.setItem('preferred_language', lang);
      win.localStorage.removeItem('company');
    },
  });
};

describe('MCP consent presentation', () => {
  [
    { width: 1280, lang: 'en', heading: 'Connect an AI assistant' },
    { width: 1280, lang: 'ua', heading: 'Підключення AI-асистента' },
    { width: 320, lang: 'ua', heading: 'Підключення AI-асистента' },
  ].forEach(({ width, lang, heading }) => {
    it(`keeps the ${lang} consent readable at ${width}px`, () => {
      cy.viewport(width, 1000);
      cy.intercept('POST', '/api/v1/mcp/authorize', consent);
      visitConsent(lang);
      cy.get('#mcp-consent-title').should('contain', heading).and('have.css', 'font-size', '24px');
      cy.getByTestId('mcp-permissions').find('li').should('have.length', 5);
      cy.getByTestId('mcp-authorize-page').should('contain', 'Codex');
      cy.getByTestId('mcp-callback-address').then($code => {
        expect($code[0].checkVisibility()).to.eq(false);
      });
      cy.getByTestId('mcp-approve').scrollIntoView().should('be.visible').then($button => {
        expect($button[0].getBoundingClientRect().height).to.be.at.least(44);
      });
      cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(width));
      cy.screenshot(`consent-${lang}-${width}`, { capture: 'fullPage' });
      cy.getByTestId('mcp-connection-toggle').click();
      cy.getByTestId('mcp-callback-address').should('be.visible').and('contain', consent.redirect_uri);
    });
  });

  ['approve', 'deny'].forEach(decision => {
    it(`submits only the ${decision} decision and redirects`, () => {
      cy.intercept('POST', '/api/v1/mcp/authorize', req => {
        if (req.body.decision) {
          expect(req.body).to.deep.eq({ request: 'consent-ui-test', decision });
          req.reply({ redirect: `/app/mcp/authorize?done=${decision}` });
        } else req.reply(consent);
      }).as('consent');
      visitConsent();
      cy.getByTestId(`mcp-${decision === 'approve' ? 'approve' : 'deny'}`).click();
      cy.url().should('include', `done=${decision}`);
    });
  });

  it('keeps failed consent actionable and shows the error', () => {
    cy.intercept('POST', '/api/v1/mcp/authorize', req => {
      if (req.body.decision) req.reply({ statusCode: 400, body: { message: 'This request has expired.' } });
      else req.reply(consent);
    });
    visitConsent();
    cy.getByTestId('mcp-approve').click();
    cy.getByTestId('mcp-authorize-page').should('contain', 'This request has expired.');
    cy.getByTestId('mcp-approve').should('not.be.disabled');
    cy.getByTestId('mcp-deny').should('not.be.disabled');
  });
});
