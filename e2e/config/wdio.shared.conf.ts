import type { Options } from '@wdio/types';
import { browser } from '@wdio/globals';
import { join } from 'path';

export const config: Partial<Options.Testrunner> = {
  // Test specs location
  specs: [join(__dirname, '../specs/**/*.spec.ts')],
  exclude: [],

  // Max parallel test execution
  maxInstances: 1,

  // Log level
  logLevel: 'info',

  // Retry failed tests
  specFileRetries: 1,
  specFileRetriesDeferred: false,

  // Base URL for mock server
  baseUrl: 'http://localhost:3001',

  // Timeout configurations
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // Services
  services: [
    [
      'appium',
      {
        args: {
          address: 'localhost',
          port: 4723,
        },
        logPath: './e2e/logs/',
      },
    ],
  ],

  // Test framework
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },

  // TypeScript support via autoCompileOpts
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: join(__dirname, '../tsconfig.json'),
    },
  },

  // Reporters
  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'e2e/reports/allure-results',
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],

  // Hooks
  beforeSession: async function (): Promise<void> {
    // Start mock server if needed
  },

  afterTest: async function (
    test: { parent?: string; title?: string },
    _context: unknown,
    { error }: { error?: Error }
  ): Promise<void> {
    if (error) {
      // Take screenshot on failure
      const testParent = test.parent || 'unknown';
      const testTitle = test.title || 'unknown';
      await browser.saveScreenshot(
        `./e2e/screenshots/${testParent}-${testTitle}-${Date.now()}.png`
      );
    }
  },

  onComplete: function (): void {
    // Cleanup actions
  },
};
