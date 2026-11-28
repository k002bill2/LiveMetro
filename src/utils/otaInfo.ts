/**
 * OTA 실행 정보 (#418)
 * 설정 > 앱 정보 아래에 실행 중인 expo-updates 번들(update ID 등)을 읽기 전용으로 노출한다.
 * QA 시 스크린샷 1장으로 서버 manifest update ID와 대조하기 위한 용도 — ID는 자르지 않는다.
 */
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

export interface OtaSource {
  readonly isEnabled: boolean;
  readonly isEmbeddedLaunch: boolean;
  readonly updateId: string | null;
  readonly channel: string | null;
  readonly runtimeVersion: string | null;
  readonly createdAt: Date | null;
}

export interface OtaInfo {
  readonly text: string;
  readonly accessibilityLabel: string;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** createdAt → 'YYYY-MM-DD HH:mm KST' (기기 타임존과 무관하게 고정) */
const formatKst = (date: Date | null): string | null => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const k = new Date(date.getTime() + KST_OFFSET_MS);
  return (
    `${k.getUTCFullYear()}-${pad2(k.getUTCMonth() + 1)}-${pad2(k.getUTCDate())} ` +
    `${pad2(k.getUTCHours())}:${pad2(k.getUTCMinutes())} KST`
  );
};

const orDash = (v: string | null): string => (v ? v : '-');

/**
 * @param platform Platform.OS. 웹은 OTA 대상이 아니다 — expo-updates 웹 스텁이
 *   isEnabled true를 돌려주므로 값이 아니라 플랫폼으로 판정한다.
 */
export const formatOtaInfo = (
  source: OtaSource,
  language: string,
  platform?: string,
): OtaInfo => {
  const ko = language === 'ko';
  try {
    if (platform === 'web' || !source.isEnabled) {
      return {
        text: 'OTA disabled',
        accessibilityLabel: ko ? 'OTA 업데이트 비활성' : 'OTA updates disabled',
      };
    }
    const channel = orDash(source.channel);
    const runtime = orDash(source.runtimeVersion);
    const id = source.isEmbeddedLaunch || !source.updateId ? 'embedded' : source.updateId;
    const created = formatKst(source.createdAt);
    const line = `OTA ${channel} · ${runtime} · ${id}`;
    return {
      text: created ? `${line}\n${created}` : line,
      accessibilityLabel: ko
        ? `OTA 업데이트 ID ${id}, 채널 ${channel}, 런타임 ${runtime}${created ? `, 생성 ${created}` : ''}`
        : `OTA update ID ${id}, channel ${channel}, runtime ${runtime}${created ? `, created ${created}` : ''}`,
    };
  } catch (error) {
    console.warn('[otaInfo] failed to read expo-updates info', error);
    return {
      text: 'OTA unavailable',
      accessibilityLabel: ko ? 'OTA 업데이트 정보 없음' : 'OTA update info unavailable',
    };
  }
};

/**
 * 실행 중인 expo-updates 런타임 정보를 표시용으로 읽는다.
 * 흡수 범위: 프로퍼티 접근·포맷 중 예외만 'OTA unavailable'로 흡수한다.
 * 범위 밖: expo-updates 모듈 import 실패 — iOS/Android/웹 모두 autolink·등록된다는 전제.
 */
export const getOtaInfo = (language: string): OtaInfo =>
  formatOtaInfo(Updates, language, Platform.OS);
