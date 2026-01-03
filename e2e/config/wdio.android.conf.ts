import { config as sharedConfig } from './wdio.shared.conf';
import type { Options } from '@wdio/types';
import { join } from 'path';

const androidConfig: Options.Testrunner = {
  ...sharedConfig,

  capabilities: [
    {
      'platformName': 'Android',
      'appium:platformVersion': '16',
      'appium:deviceName': 'Pixel 6',
      'appium:automationName': 'UiAutomator2',
      'appium:app': join(process.cwd(), 'apps/android/app-debug.apk'),
      'appium:appPackage': 'com.livemetro.app',
      'appium:appActivity': '.MainActivity',
      'appium:autoGrantPermissions': true,
      'appium:noReset': false,
      'appium:fullReset': false,
      'appium:newCommandTimeout': 240,
      // For Expo apps
      'appium:appWaitActivity': '*',
      'appium:appWaitDuration': 60000,
    },
  ],

  port: 4723,
} as Options.Testrunner;

export { androidConfig as config };
