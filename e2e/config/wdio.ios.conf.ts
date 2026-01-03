import { config as sharedConfig } from './wdio.shared.conf';
import type { Options } from '@wdio/types';
import { join } from 'path';

const iosConfig: Options.Testrunner = {
  ...sharedConfig,

  capabilities: [
    {
      'platformName': 'iOS',
      'appium:platformVersion': '17.2',
      'appium:deviceName': 'iPhone 15',
      'appium:automationName': 'XCUITest',
      'appium:app': join(process.cwd(), 'apps/ios/LiveMetro.app'),
      'appium:bundleId': 'com.livemetro.app',
      'appium:noReset': false,
      'appium:fullReset': false,
      'appium:newCommandTimeout': 240,
      // Permission auto-accept
      'appium:autoAcceptAlerts': true,
      // For better element finding
      'appium:useNewWDA': true,
      'appium:wdaLaunchTimeout': 120000,
    },
  ],

  port: 4723,
} as Options.Testrunner;

export { iosConfig as config };
