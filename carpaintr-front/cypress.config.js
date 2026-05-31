import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/e2e.js",
  },
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 15000,
  video: true,
  screenshotOnRunFailure: true,
});
