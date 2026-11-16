import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:5176', headless: true },
  webServer: {
    command: 'python -m http.server 5176 --bind 127.0.0.1',
    url: 'http://127.0.0.1:5176',
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
});
