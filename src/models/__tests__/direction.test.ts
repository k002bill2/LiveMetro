/**
 * Tests for Direction display adapters (`directionToDisplay`, `updnLineToDisplay`).
 *
 * Convention (per src/services/api/seoulSubwayApi.ts:641 and
 * src/styles/modernTheme.ts:361-362):
 *   up   = 상행 / 내선 (Line 2 inner ring)
 *   down = 하행 / 외선 (Line 2 outer ring)
 */
import { directionToDisplay, updnLineToDisplay } from '@/models/route';

describe('directionToDisplay', () => {
  it('maps Line 2 up → 내선순환 (inner circular)', () => {
    expect(directionToDisplay('up', '2')).toBe('내선순환');
  });

  it('maps Line 2 down → 외선순환 (outer circular)', () => {
    expect(directionToDisplay('down', '2')).toBe('외선순환');
  });

  it('maps non-circular line up → 상행 / down → 하행', () => {
    expect(directionToDisplay('up', '1')).toBe('상행');
    expect(directionToDisplay('down', '1')).toBe('하행');
    expect(directionToDisplay('up', '9')).toBe('상행');
    expect(directionToDisplay('down', '9')).toBe('하행');
  });

  it('falls back to 상행 / 하행 for unknown line ids', () => {
    expect(directionToDisplay('up', 'unknown-line')).toBe('상행');
    expect(directionToDisplay('down', '')).toBe('하행');
  });
});

describe('updnLineToDisplay', () => {
  it('expands circular tokens to 순환 labels', () => {
    expect(updnLineToDisplay('내선')).toBe('내선순환');
    expect(updnLineToDisplay('외선')).toBe('외선순환');
  });

  it('passes through 상행 / 하행 unchanged', () => {
    expect(updnLineToDisplay('상행')).toBe('상행');
    expect(updnLineToDisplay('하행')).toBe('하행');
  });

  it('passes through already-expanded and unknown values unchanged', () => {
    expect(updnLineToDisplay('내선순환')).toBe('내선순환');
    expect(updnLineToDisplay('외선순환')).toBe('외선순환');
    expect(updnLineToDisplay('급행')).toBe('급행');
    expect(updnLineToDisplay('')).toBe('');
  });
});
