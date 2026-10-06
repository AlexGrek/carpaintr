// Run against a production build served by `npm run preview`, not Vite dev.
// A real controlled browser navigation is essential: cy.request/cy.visit alone
// bypass the installed service worker and missed the OAuth app-shell 404.
const visitControlledApp = () => {
  cy.intercept('GET', '/api/v1/notifications/unread-count', { count: 0 });
  cy.visit('/app/login');
  cy.window().then({ timeout: 30000 }, win => win.navigator.serviceWorker.ready);
  cy.window().should(win => expect(win.navigator.serviceWorker.controller).not.to.be.null);
};

describe('Production PWA navigation boundaries', () => {
  before(function () {
    // Ordinary Vite dev runs have no production worker. Keep this regression
    // in the full suite, but exercise it only when a built worker is served.
    cy.request({ url: '/sw.js', failOnStatusCode: false }).then(response => {
      if (!response.headers['content-type']?.includes('javascript')) this.skip();
    });
  });
  it('lets OAuth redirect to the consent screen while the service worker controls the page', () => {
    cy.intercept('GET', '/oauth/authorize*', { statusCode: 303, headers: { location: '/app/mcp/authorize?request=pwa-test' } }).as('authorize');
    cy.intercept('POST', '/api/v1/mcp/authorize', {
      client_name: 'Codex PWA regression',
      scopes: 'company:read calculations:read',
      redirect_uri: 'http://127.0.0.1:59006/callback',
    });
    visitControlledApp();
    cy.window().then(win => {
      win.localStorage.setItem('authToken', 'pwa-test');
      win.localStorage.setItem('preferred_language', 'en');
      win.location.assign('/oauth/authorize?response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A59006%2Fcallback');
    });
    cy.wait('@authorize');
    cy.location('pathname').should('eq', '/app/mcp/authorize');
    cy.get('[data-testid="mcp-authorize-page"]').should('contain', 'Codex PWA regression');
    cy.get('[data-testid="mcp-approve"]').should('be.visible');
  });

  for (const path of ['/mcp', '/api/v1/health', '/.well-known/oauth-protected-resource/mcp', `/public/pdfs/${'a'.repeat(43)}`]) {
    it(`sends ${path} navigation to the backend`, () => {
      cy.intercept('GET', path, { statusCode: 200, headers: { 'content-type': 'text/html' }, body: '<html><body>Backend navigation response</body></html>' }).as('backend');
      visitControlledApp();
      cy.window().then(win => win.location.assign(path));
      cy.wait('@backend');
      cy.get('body').should('contain', 'Backend navigation response');
      cy.location('pathname').should('eq', path);
    });
  }

  it('keeps application routes available from the cached shell', () => {
    visitControlledApp();
    cy.intercept('GET', '/app/login?offline-check=1', { forceNetworkError: true });
    cy.window().then(win => win.location.assign('/app/login?offline-check=1'));
    cy.location('search').should('eq', '?offline-check=1');
    cy.get('body').should('contain', 'Autolab');
    cy.get('input[type="password"]').should('be.visible');
  });
});
