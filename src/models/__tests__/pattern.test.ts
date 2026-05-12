import { computeArrivalTime } from '@/models/pattern';

describe('computeArrivalTime', () => {
  it('adds minutes within the same day', () => {
    expect(computeArrivalTime('08:30', 45)).toBe('09:15');
  });

  it('handles 24h wrap-around past midnight', () => {
    expect(computeArrivalTime('23:50', 30)).toBe('00:20');
  });

  it('returns the same time when minutes is 0', () => {
    expect(computeArrivalTime('07:00', 0)).toBe('07:00');
  });

  it('pads single-digit hours and minutes', () => {
    expect(computeArrivalTime('00:05', 4)).toBe('00:09');
  });

  it('handles full-day wrap (24h * 60 = 1440)', () => {
    expect(computeArrivalTime('09:30', 1440)).toBe('09:30');
  });
});
