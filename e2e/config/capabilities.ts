/**
 * Device capabilities for Appium E2E testing
 * Use these presets for different testing scenarios
 */

export const androidEmulator = {
  'platformName': 'Android',
  'appium:platformVersion': '13.0',
  'appium:deviceName': 'emulator-5554',
  'appium:automationName': 'UiAutomator2',
  'appium:autoGrantPermissions': true,
};

export const androidDevice = {
  'platformName': 'Android',
  'appium:udid': 'auto',
  'appium:automationName': 'UiAutomator2',
  'appium:autoGrantPermissions': true,
};

export const iosSimulator = {
  'platformName': 'iOS',
  'appium:platformVersion': '17.2',
  'appium:deviceName': 'iPhone 15',
  'appium:automationName': 'XCUITest',
  'appium:autoAcceptAlerts': true,
};

export const iosDevice = {
  'platformName': 'iOS',
  'appium:udid': 'auto',
  'appium:automationName': 'XCUITest',
  'appium:xcodeOrgId': 'YOUR_TEAM_ID',
  'appium:xcodeSigningId': 'iPhone Developer',
};

// BrowserStack capabilities (for cloud testing)
export const browserStackAndroid = {
  'bstack:options': {
    deviceName: 'Samsung Galaxy S23',
    platformVersion: '13.0',
    platformName: 'android',
  },
};

export const browserStackIOS = {
  'bstack:options': {
    deviceName: 'iPhone 14 Pro',
    platformVersion: '16',
    platformName: 'ios',
  },
};
