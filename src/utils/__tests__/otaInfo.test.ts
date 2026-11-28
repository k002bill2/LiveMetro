/**
 * otaInfo — 실행 중 OTA 번들 정보 표시 문자열 (#418)
 */
import { formatOtaInfo, type OtaSource } from '@/utils/otaInfo';

// 네이티브 모듈 로드 방지 — formatOtaInfo는 주입된 source만 읽는다 (jest.mock은 hoist됨).
jest.mock('expo-updates', () => ({}));

const base: OtaSource = {
  isEnabled: true,
  isEmbeddedLaunch: false,
  updateId: '0195f2a1-7c3e-7b10-9d2a-4e5f6a7b8c9d',
  channel: 'preview',
  runtimeVersion: '1.1.0',
  // 2026-11-28 01:05 UTC = 10:05 KST
  createdAt: new Date(Date.UTC(2026, 10, 28, 1, 5, 0)),
};

describe('formatOtaInfo', () => {
  it('정상 OTA: channel · runtimeVersion · updateId 전체 + createdAt(KST)', () => {
    const info = formatOtaInfo(base, 'ko');
    expect(info.text).toBe(
      'OTA preview · 1.1.0 · 0195f2a1-7c3e-7b10-9d2a-4e5f6a7b8c9d\n2026-11-28 10:05 KST',
    );
    expect(info.accessibilityLabel).toBe(
      'OTA 업데이트 ID 0195f2a1-7c3e-7b10-9d2a-4e5f6a7b8c9d, 채널 preview, 런타임 1.1.0, 생성 2026-11-28 10:05 KST',
    );
  });

  it('en 접근성 라벨에도 createdAt 포함', () => {
    const info = formatOtaInfo(base, 'en');
    expect(info.accessibilityLabel).toBe(
      'OTA update ID 0195f2a1-7c3e-7b10-9d2a-4e5f6a7b8c9d, channel preview, runtime 1.1.0, created 2026-11-28 10:05 KST',
    );
  });

  it('createdAt null이면 접근성 라벨에서도 생성 시각 생략', () => {
    const info = formatOtaInfo({ ...base, createdAt: null }, 'ko');
    expect(info.accessibilityLabel).toBe(
      'OTA 업데이트 ID 0195f2a1-7c3e-7b10-9d2a-4e5f6a7b8c9d, 채널 preview, 런타임 1.1.0',
    );
  });

  it('웹(platform web)은 OTA 대상이 아니므로 스텁 값과 무관하게 disabled', () => {
    // expo-updates 웹 스텁: isEnabled true, channel '', runtimeVersion '', updateId undefined
    const webStub = {
      ...base,
      isEnabled: true,
      channel: '',
      runtimeVersion: '',
      updateId: undefined,
      createdAt: null,
    } as unknown as OtaSource;
    const info = formatOtaInfo(webStub, 'ko', 'web');
    expect(info.text).toBe('OTA disabled');
    expect(info.accessibilityLabel).toBe('OTA 업데이트 비활성');
  });

  it('platform ios/android는 기존 표시 유지', () => {
    expect(formatOtaInfo({ ...base, createdAt: null }, 'ko', 'android').text).toBe(
      'OTA preview · 1.1.0 · 0195f2a1-7c3e-7b10-9d2a-4e5f6a7b8c9d',
    );
  });

  it('createdAt null이면 날짜 줄을 생략', () => {
    const info = formatOtaInfo({ ...base, createdAt: null }, 'ko');
    expect(info.text).toBe('OTA preview · 1.1.0 · 0195f2a1-7c3e-7b10-9d2a-4e5f6a7b8c9d');
  });

  it('내장 번들(isEmbeddedLaunch)이면 updateId 대신 embedded', () => {
    const info = formatOtaInfo({ ...base, isEmbeddedLaunch: true, createdAt: null }, 'en');
    expect(info.text).toBe('OTA preview · 1.1.0 · embedded');
    expect(info.accessibilityLabel).toBe('OTA update ID embedded, channel preview, runtime 1.1.0');
  });

  it('updateId null이면 embedded, null 필드는 - 로 표기', () => {
    const info = formatOtaInfo(
      { ...base, updateId: null, channel: null, runtimeVersion: null, createdAt: null },
      'ko',
    );
    expect(info.text).toBe('OTA - · - · embedded');
  });

  it('expo-updates 비활성(개발 모드 등)이면 disabled', () => {
    const info = formatOtaInfo({ ...base, isEnabled: false }, 'ko');
    expect(info.text).toBe('OTA disabled');
    expect(info.accessibilityLabel).toBe('OTA 업데이트 비활성');
  });

  it('property access throw is absorbed — getter 예외는 unavailable로 흡수', () => {
    const throwing = {
      get isEnabled(): boolean {
        throw new Error('native module missing');
      },
    } as unknown as OtaSource;
    const info = formatOtaInfo(throwing, 'en');
    expect(info.text).toBe('OTA unavailable');
    expect(info.accessibilityLabel).toBe('OTA update info unavailable');
  });

  it('createdAt이 Invalid Date면 날짜 줄 생략', () => {
    const info = formatOtaInfo({ ...base, createdAt: new Date('nope') }, 'ko');
    expect(info.text).toBe('OTA preview · 1.1.0 · 0195f2a1-7c3e-7b10-9d2a-4e5f6a7b8c9d');
  });
});
