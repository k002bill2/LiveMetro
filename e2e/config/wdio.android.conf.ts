import { config as sharedConfig } from './wdio.shared.conf';
import type { Options } from '@wdio/types';
import { join } from 'path';

const androidConfig: Options.Testrunner = {
  ...sharedConfig,

  capabilities: [
    {
      'platformName': 'Android',
      'appium:platformVersion': '13.0',
      'appium:deviceName': 'Pixel 6',
      'appium:automationName': 'UiAutomator2',
      // 기본값 = CI(expo prebuild + gradlew assembleRelease)가 생성하는 산출물 경로.
      // 로컬에서 별도 APK를 쓰려면 E2E_APK_PATH 로 오버라이드한다.
      // (이전 기본값 apps/android/app-debug.apk 는 gitignored 수동 산출물이라 CI에
      //  존재하지 않아 전 spec 이 세션 생성 단계에서 실패했다 — 2026-08-13 진단)
      'appium:app':
        process.env.E2E_APK_PATH ??
        join(process.cwd(), 'android/app/build/outputs/apk/release/app-release.apk'),
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
