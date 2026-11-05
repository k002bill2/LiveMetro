/**
 * app.config.ts — Firebase 서비스 파일(googleServicesFile) 분기 회귀 테스트.
 *
 * GitHub runner(EAS_BUILD 미설정)에서 `eas build`가 config를 introspect할 때 iOS
 * Info.plist mod가 GoogleService-Info.plist를 readFileSync해 ENOENT로 죽었다.
 * runner/로컬에서는 파일이 없으면 키를 생략하고, EAS 빌드 서버(EAS_BUILD 설정)에서는
 * 기존처럼 경로를 그대로 넘겨 누락이 빌드 실패로 드러나게 한다.
 *
 * 파일 픽스처는 OS 임시 디렉터리를 projectRoot로 주입해 만든다(워크트리에 서비스
 * 파일을 만들지 않는다). 루트 파일에는 path alias가 없으므로 상대 import를 쓴다.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

import appConfig from '../app.config';

const ENV_KEYS = ['EAS_BUILD', 'GOOGLE_SERVICES_JSON', 'GOOGLE_SERVICES_INFO_PLIST'] as const;
const PLIST = 'GoogleService-Info.plist';
const JSON_FILE = 'google-services.json';

const baseConfig = (): ExpoConfig => ({
  name: 'LiveMetro',
  slug: 'livemetro-subway-app',
  // app.json에는 android 정적 키가 남아 있다 — 생략 분기가 이를 지워야 한다.
  android: { package: 'com.livemetro.app', googleServicesFile: './google-services.json' },
  ios: { bundleIdentifier: 'com.livemetro.app' },
});

const run = (projectRoot: string): ExpoConfig =>
  appConfig({
    config: baseConfig(),
    projectRoot,
    staticConfigPath: path.join(projectRoot, 'app.json'),
    packageJsonPath: path.join(projectRoot, 'package.json'),
  } as ConfigContext);

describe('app.config googleServicesFile', () => {
  const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
  let root: string;

  beforeEach(() => {
    ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    });
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'livemetro-appconfig-'));
  });

  afterEach(() => {
    ENV_KEYS.forEach((key) => {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('runner + 파일 없음 → 두 플랫폼 모두 키를 생략한다(app.json 정적 키 포함)', () => {
    const config = run(root);

    expect(config.ios).not.toHaveProperty('googleServicesFile');
    expect(config.android).not.toHaveProperty('googleServicesFile');
    // 다른 플랫폼 필드는 보존
    expect(config.ios?.bundleIdentifier).toBe('com.livemetro.app');
    expect(config.android?.package).toBe('com.livemetro.app');
  });

  it('runner + env 경로가 실재 → env 경로를 쓴다', () => {
    const plistPath = path.join(root, 'env', PLIST);
    const jsonPath = path.join(root, 'env', JSON_FILE);
    fs.mkdirSync(path.dirname(plistPath));
    fs.writeFileSync(plistPath, 'fixture');
    fs.writeFileSync(jsonPath, 'fixture');
    process.env.GOOGLE_SERVICES_INFO_PLIST = plistPath;
    process.env.GOOGLE_SERVICES_JSON = jsonPath;

    const config = run(root);

    expect(config.ios?.googleServicesFile).toBe(plistPath);
    expect(config.android?.googleServicesFile).toBe(jsonPath);
  });

  it('runner + env 경로가 이 머신에 없음 → 생략한다', () => {
    process.env.GOOGLE_SERVICES_INFO_PLIST = path.join(root, 'missing', PLIST);
    process.env.GOOGLE_SERVICES_JSON = path.join(root, 'missing', JSON_FILE);

    const config = run(root);

    expect(config.ios).not.toHaveProperty('googleServicesFile');
    expect(config.android).not.toHaveProperty('googleServicesFile');
  });

  it('로컬 + 루트에 파일 있음 → 기존 상대 경로를 쓴다', () => {
    fs.writeFileSync(path.join(root, PLIST), 'fixture');
    fs.writeFileSync(path.join(root, JSON_FILE), 'fixture');

    const config = run(root);

    expect(config.ios?.googleServicesFile).toBe('./GoogleService-Info.plist');
    expect(config.android?.googleServicesFile).toBe('./google-services.json');
  });

  it('EAS_BUILD=true + 파일 없음 → 기존 경로를 그대로 넘긴다(누락은 EAS 빌드 실패로 드러남)', () => {
    process.env.EAS_BUILD = 'true';

    const config = run(root);

    expect(config.ios?.googleServicesFile).toBe('./GoogleService-Info.plist');
    expect(config.android?.googleServicesFile).toBe('./google-services.json');
  });

  it('EAS_BUILD=true + env 있음 → 존재 확인 없이 env 경로를 쓴다', () => {
    process.env.EAS_BUILD = 'true';
    process.env.GOOGLE_SERVICES_INFO_PLIST = '/eas/tmp/GoogleService-Info.plist';
    process.env.GOOGLE_SERVICES_JSON = '/eas/tmp/google-services.json';

    const config = run(root);

    expect(config.ios?.googleServicesFile).toBe('/eas/tmp/GoogleService-Info.plist');
    expect(config.android?.googleServicesFile).toBe('/eas/tmp/google-services.json');
  });

  it('EAS_BUILD 판정은 fail-closed — "true" 외 비어있지 않은 값도 엄격 모드', () => {
    process.env.EAS_BUILD = '1';

    const config = run(root);

    expect(config.ios?.googleServicesFile).toBe('./GoogleService-Info.plist');
  });
});
