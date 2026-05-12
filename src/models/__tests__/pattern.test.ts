import { computeArrivalTime, sumPredictedMinutes, type PredictedCommute } from '@/models/pattern';

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

const baseP: PredictedCommute = {
  date: '2026-05-12',
  dayOfWeek: 2,
  predictedDepartureTime: '08:00',
  route: {
    departureStationId: 'a',
    departureStationName: 'A',
    arrivalStationId: 'b',
    arrivalStationName: 'B',
    lineIds: ['1'],
  },
  confidence: 0.8,
  suggestedAlertTime: '07:45',
};

describe('sumPredictedMinutes', () => {
  it('returns 0 when all derived fields are undefined', () => {
    expect(sumPredictedMinutes(baseP)).toBe(0);
  });

  it('sums walk + wait + walk when transitSegments is undefined', () => {
    const p: PredictedCommute = {
      ...baseP,
      walkToStationMinutes: 4,
      waitMinutes: 3,
      walkToDestinationMinutes: 3,
    };
    expect(sumPredictedMinutes(p)).toBe(10);
  });

  it('sums walk + wait + walk + transitSegments.estimatedMinutes', () => {
    const p: PredictedCommute = {
      ...baseP,
      walkToStationMinutes: 4,
      waitMinutes: 3,
      walkToDestinationMinutes: 3,
      transitSegments: [
        {
          fromStationId: 'a', fromStationName: 'A',
          toStationId: 'b', toStationName: 'B',
          lineId: '1', lineName: '1호선',
          estimatedMinutes: 20, isTransfer: false,
        },
        {
          fromStationId: 'b', fromStationName: 'B',
          toStationId: 'c', toStationName: 'C',
          lineId: '2', lineName: '2호선',
          estimatedMinutes: 15, isTransfer: true,
        },
      ],
    };
    expect(sumPredictedMinutes(p)).toBe(4 + 3 + 3 + 20 + 15);
  });

  it('ignores undefined walk fields and only sums what is present', () => {
    const p: PredictedCommute = {
      ...baseP,
      waitMinutes: 3,
    };
    expect(sumPredictedMinutes(p)).toBe(3);
  });
});
