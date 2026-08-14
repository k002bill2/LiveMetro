import type { Options } from '@wdio/types';
import { browser } from '@wdio/globals';
import { join } from 'path';
import { mkdirSync } from 'fs';

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
          // 'localhost'는 Node 17+에서 ::1(IPv6)로 우선 해석돼 Appium이 ::1에만
          // 바인드되는데, wdio는 127.0.0.1(IPv4)로 접속해 ECONNREFUSED가 난다
          // (CI run 31701317587 실측). IPv4 리터럴로 바인드를 고정한다.
          address: '127.0.0.1',
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
    // 240s: 진입 흐름(enterMainAsAnonymous)의 원소 데드라인이 120s라,
    // mocha 테스트 예산이 같은 120s면 데드라인이 발동하기 전에 mocha가
    // 테스트를 죽여 진단 메시지가 사라진다 (run 31761026818 실증 —
    // "Timeout of 120000ms exceeded"로 균일 실패). 진입 + 탭 이동 + 화면
    // 대기가 한 테스트에 겹치는 before-all까지 감안해 2배 여유를 둔다.
    timeout: 240000,
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
      // Take screenshot on failure. 디렉토리는 gitignored라 CI 체크아웃에
      // 존재하지 않으므로 먼저 만들어야 저장이 성공한다 (run 31722635217 실증).
      mkdirSync('./e2e/screenshots', { recursive: true });
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
