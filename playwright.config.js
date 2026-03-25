const { defineConfig } = require('@playwright/test');
require('dotenv').config({ path: '.env.test' });

module.exports = defineConfig({
  testDir: './qa',
  timeout: 30_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'qa/report' }]],
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
