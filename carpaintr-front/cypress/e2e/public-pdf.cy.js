const token = 'a'.repeat(43);
const pagePath = `/public/pdfs/${token}`;

for (const width of [1280, 320]) {
  it(`keeps the public download page visible at ${width}px`, () => {
    cy.viewport(width, 900);
    cy.readFile('../backend-service-rust/src/mcp/pdf_download.html').then(html => {
      cy.intercept('GET', pagePath, { statusCode: 200, headers: { 'content-type': 'text/html' }, body: html.replaceAll('{{token}}', token) });
      cy.intercept('GET', `${pagePath}.pdf`, {
        statusCode: 200,
        headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="mcp-test.pdf"' },
        body: '%PDF-1.4\n%%EOF\n',
      }).as('download');
      cy.visit(pagePath);
    });
    cy.wait('@download').then(({ request }) => {
      expect(request.headers.authorization).to.be.undefined;
    });
    cy.readFile('cypress/downloads/mcp-test.pdf').should('contain', '%PDF');
    cy.location('pathname').should('eq', pagePath);
    cy.get('[data-testid="pdf-download-page"]').should('be.visible').and('contain', 'Ваш PDF готовий').and('contain', 'Your PDF is ready');
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(width));
    cy.screenshot(`public-pdf-${width}`, { capture: 'viewport' });
    cy.get('[data-testid="pdf-download-button"]').click();
    cy.wait('@download');
    cy.location('pathname').should('eq', pagePath);
  });
}
