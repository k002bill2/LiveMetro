import { TYPOGRAPHY, WANTED_TOKENS, typeStyle } from '../modernTheme';

describe('modernTheme typography', () => {
  it('keeps app typography at the readable minimum or above', () => {
    const legacySizes = Object.values(TYPOGRAPHY.fontSize);
    const wantedSizes = Object.values(WANTED_TOKENS.type).map((token) => token.size);

    expect(Math.min(...legacySizes)).toBeGreaterThanOrEqual(12);
    expect(Math.min(...wantedSizes)).toBeGreaterThanOrEqual(12);
    expect(typeStyle('caption2').fontSize).toBe(12);
  });
});
