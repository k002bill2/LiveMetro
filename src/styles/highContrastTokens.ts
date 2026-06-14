/**
 * High-contrast semantic token variants for the Wanted design system.
 *
 * The standard `WANTED_TOKENS.light` / `.dark` semantic sets are the color source
 * for the whole app (components select `isDark ? dark : light`). These HC variants
 * spread the standard set — so every field is present, and the
 * `Record<keyof …, string>` annotation makes the compiler enforce completeness —
 * then override the contrast-critical fields (text, background, border, primary,
 * status) with maximum-contrast values for low-vision users.
 *
 * Consumed only through `useSemanticTokens()` (selects HC when the accessibility
 * "high contrast" setting is on). Not referenced directly by screens.
 */
import { WANTED_TOKENS } from './modernTheme';

type SemanticTokenKey = keyof typeof WANTED_TOKENS.light;
type SemanticTokenSet = Record<SemanticTokenKey, string>;

/** High-contrast light: pure-black text/borders on pure white, darkened accents. */
export const WANTED_TOKENS_LIGHT_HC: SemanticTokenSet = {
  ...WANTED_TOKENS.light,
  bgBase: '#FFFFFF',
  bgSubtle: 'rgba(0,0,0,0.07)',
  bgSubtlePage: '#FFFFFF',
  bgElevated: '#FFFFFF',
  labelStrong: '#000000',
  labelNormal: '#000000',
  labelNeutral: '#1A1A1A',
  labelAlt: '#3A3A3A',
  labelDisabled: '#6B6B6B',
  lineNormal: '#000000',
  lineSubtle: 'rgba(0,0,0,0.35)',
  lineStrong: '#000000',
  primaryNormal: '#0044BB',
  primaryHover: '#002D7A',
  primaryPress: '#002D7A',
  primaryBg: '#D4E3FE',
  statusPositive: '#008F30',
  statusNegative: '#C42727',
  statusCautionary: '#A06A00',
  statusInfo: '#006B7A',
};

/** High-contrast dark: pure-white text/borders on pure black, brightened accents. */
export const WANTED_TOKENS_DARK_HC: SemanticTokenSet = {
  ...WANTED_TOKENS.dark,
  bgBase: '#000000',
  bgSubtle: 'rgba(255,255,255,0.10)',
  bgSubtlePage: '#000000',
  bgElevated: '#000000',
  labelStrong: '#FFFFFF',
  labelNormal: '#FFFFFF',
  labelNeutral: '#FFFFFF',
  labelAlt: '#D8D8D8',
  labelDisabled: '#A0A0A0',
  lineNormal: '#FFFFFF',
  lineSubtle: 'rgba(255,255,255,0.35)',
  lineStrong: '#FFFFFF',
  primaryNormal: '#6FA8FF',
  primaryHover: '#3385FF',
  primaryPress: '#3385FF',
  primaryBg: 'rgba(111,168,255,0.24)',
  statusPositive: '#00E050',
  statusNegative: '#FF6B6B',
  statusCautionary: '#FFC04D',
  statusInfo: '#4DD0E1',
};
