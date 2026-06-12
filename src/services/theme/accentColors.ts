/**
 * 강조 색상(Accent Color) 8종 — 테마 설정 화면 Wanted 핸드오프.
 *
 * '클래식 블루'(기본)는 기존 팔레트를 그대로 사용해 시각 변화가 없고,
 * 다른 색상 선택 시 ThemeColors의 primary 계열만 오버라이드한다.
 * (정적 WANTED_TOKENS를 쓰는 화면 전면 적용은 후속 작업 — PR 참고)
 */

export type AccentColorId =
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'red'
  | 'orange'
  | 'green'
  | 'teal';

export interface AccentColorOption {
  id: AccentColorId;
  labelKo: string;
  labelEn: string;
  /** 라이트 모드 강조색 */
  light: string;
  /** 다크 모드 강조색 (저조도 가독성 위해 한 단계 밝게) */
  dark: string;
}

export const DEFAULT_ACCENT_COLOR_ID: AccentColorId = 'blue';

const DEFAULT_ACCENT_OPTION: AccentColorOption = {
  id: 'blue',
  labelKo: '클래식 블루',
  labelEn: 'Classic Blue',
  light: '#0066FF',
  dark: '#3385FF',
};

/** 시안 스와치 순서 그대로 */
export const ACCENT_COLORS: readonly AccentColorOption[] = [
  DEFAULT_ACCENT_OPTION,
  { id: 'indigo', labelKo: '인디고', labelEn: 'Indigo', light: '#4F46E5', dark: '#6366F1' },
  { id: 'purple', labelKo: '퍼플', labelEn: 'Purple', light: '#8B5CF6', dark: '#A78BFA' },
  { id: 'pink', labelKo: '핑크', labelEn: 'Pink', light: '#EC4899', dark: '#F472B6' },
  { id: 'red', labelKo: '레드', labelEn: 'Red', light: '#EF4444', dark: '#F87171' },
  { id: 'orange', labelKo: '오렌지', labelEn: 'Orange', light: '#F97316', dark: '#FB923C' },
  { id: 'green', labelKo: '그린', labelEn: 'Green', light: '#10B981', dark: '#34D399' },
  { id: 'teal', labelKo: '틸', labelEn: 'Teal', light: '#0D9488', dark: '#2DD4BF' },
];

export const isAccentColorId = (value: unknown): value is AccentColorId =>
  typeof value === 'string' &&
  ACCENT_COLORS.some((option) => option.id === value);

export const getAccentColorOption = (id: AccentColorId): AccentColorOption =>
  ACCENT_COLORS.find((option) => option.id === id) ?? DEFAULT_ACCENT_OPTION;

/** '#RRGGBB' → 'rgba(r,g,b,a)' — 강조색 틴트 배경 파생용 */
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** ThemeColors 중 강조색 오버라이드 대상 필드 (구조적 타입 — 순환 import 회피) */
interface AccentAwareColors {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  blue: string;
  info: string;
  infoLight: string;
}

/**
 * 기본('blue')이면 베이스 팔레트 그대로, 아니면 primary 계열을
 * 강조색으로 교체한 새 객체를 반환한다 (불변).
 */
export const applyAccentToColors = <T extends AccentAwareColors>(
  base: T,
  accentId: AccentColorId,
  isDark: boolean
): T => {
  if (accentId === DEFAULT_ACCENT_COLOR_ID) {
    return base;
  }

  const accent = getAccentColorOption(accentId);
  const accentHex = isDark ? accent.dark : accent.light;
  const accentTint = hexToRgba(accentHex, isDark ? 0.24 : 0.12);

  return {
    ...base,
    primary: accentHex,
    primaryHover: accentHex,
    primaryLight: accentTint,
    blue: accentHex,
    info: accentHex,
    infoLight: accentTint,
  };
};
