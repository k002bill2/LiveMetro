import { TYPOGRAPHY, WANTED_TOKENS, typeStyle } from '../modernTheme';

describe('modernTheme typography', () => {
  it('matches the iOS-readable role scale', () => {
    const legacySizes = Object.values(TYPOGRAPHY.fontSize);
    const wantedSizes = Object.values(WANTED_TOKENS.type).map((token) => token.size);

    expect(Math.min(...legacySizes)).toBeGreaterThanOrEqual(12);
    expect(Math.min(...wantedSizes)).toBeGreaterThanOrEqual(12);
    expect(WANTED_TOKENS.type.body1.size).toBe(17);
    expect(WANTED_TOKENS.type.body2.size).toBe(16);
    expect(WANTED_TOKENS.type.label1.size).toBe(17);
    expect(WANTED_TOKENS.type.label2.size).toBe(16);
    expect(WANTED_TOKENS.type.caption1.size).toBe(14);
    expect(typeStyle('caption2').fontSize).toBe(12);
    expect(typeStyle('caption2').lineHeight).toBe(16);
    expect(WANTED_TOKENS.type.title3.size).toBe(24);
    expect(WANTED_TOKENS.type.display2.size).toBe(34);
  });
});
