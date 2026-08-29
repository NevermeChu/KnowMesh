import { defineConfig, devices } from '@playwright/test';

// Use process.env.PORT by default and fallback to port 3008
// to avoid conflicts with the Next.js default port 3000.
const PORT = process.env.PORT ?? '3008';

// Set webServer.url and use.baseURL with the location of the WebServer respecting the correct set port
const baseURL = `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  // Database integration tests run under Vitest; Playwright only collects E2E tests.
  testMatch: '*.e2e.?(c|m)[jt]s?(x)',
  // Timeout per test, test running locally are slower due to database connections with PGLite
  timeout: 30 * 1000,
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Reporter to use. See https://playwright.dev/docs/test-reporters
  reporter: process.env.CI ? 'github' : 'list',
  // Local Turbopack cold compilation and Windows Chromium are unstable under parallel startup.
  // CI also stays serial so collaboration sidecars are not shared across workers.
  workers: 1,

  expect: {
    // Set timeout for async expect matchers
    timeout: 15 * 1000,
  },

  // Run your local dev server before starting the tests:
  // https://playwright.dev/docs/test-advanced#launching-a-development-web-server-during-the-tests
  webServer: {
    command: process.env.CI
      ? 'node scripts/local-runtime.ts playwright-start'
      : 'node scripts/local-runtime.ts playwright-dev',
    url: baseURL,
    timeout: 180 * 1000,
    reuseExistingServer: !process.env.CI,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 2 * 1000 },
    env: {
      ...process.env,
      BROWSER_TO_TERMINAL_DISABLED: 'true',
      COLLABORATION_ADDRESS: '::',
      NEXT_PUBLIC_APP_URL: baseURL,
      PORT,
      WHITEBOARD_COLLABORATION_ADDRESS: '::',
    },
  },

  // Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions.
  use: {
    // Use baseURL so to make navigations relative.
    // More information: https://playwright.dev/docs/api/class-testoptions#test-options-base-url
    baseURL,

    // Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
    trace: process.env.CI ? 'on' : 'retain-on-failure',

    // Record videos when retrying the failed test.
    video: process.env.CI ? 'retain-on-failure' : undefined,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(process.env.CI
      ? [
          {
            name: 'firefox',
            // Homepage/auth markup and collaboration WebSocket are covered on
            // chromium; firefox only re-runs the cross-browser-relevant specs.
            testIgnore: [
              'DocumentCollaboration.e2e.ts',
              'TeamWhiteboardCollaboration.e2e.ts',
              'Sanity.e2e.ts',
            ],
            use: { ...devices['Desktop Firefox'] },
          },
        ]
      : []),
  ],
});
