/**
 * Tests for congestionService.getHourlyForecast
 *
 * Phase 2 of ML prediction Sections 6-9 (spec: 2026-05-12).
 *
 * Note: tests bypass Firestore by spying on the private `fetchSlotAverage` helper,
 * keeping the unit test focused on slot-window math + percent→level mapping.
 */

import { congestionService } from '../congestionService';

// Mock Firebase config (the service imports it at module load time)
jest.mock('@/services/firebase/config', () => ({
  firestore: {},
}));

// Mock firebase/firestore so the module loads without a live SDK
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mockCollectionRef'),
  doc: jest.fn(() => 'mockDocRef'),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn((...args) => args),
  where: jest.fn((...args) => ({ type: 'where', args })),
  orderBy: jest.fn((...args) => ({ type: 'orderBy', args })),
  limit: jest.fn((n) => ({ type: 'limit', value: n })),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
  },
  writeBatch: jest.fn(() => ({
    commit: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
  })),
}));

// Use real CongestionLevel enum values from @/models/congestion
// (LOW='low', MODERATE='moderate', HIGH='high', CROWDED='crowded')

type FetchSlotAverageHost = {
  fetchSlotAverage(
    slotStart: Date,
    lineId: string,
    direction: 'up' | 'down'
  ): Promise<number | null>;
};

const asHost = (svc: typeof congestionService): FetchSlotAverageHost =>
  svc as unknown as FetchSlotAverageHost;

describe('congestionService.getHourlyForecast', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 7×15min slots centered ±1h around currentTime (2 before, 4 after)', async () => {
    const spy = jest
      .spyOn(asHost(congestionService), 'fetchSlotAverage')
      .mockResolvedValue(60);
    const now = new Date('2026-05-12T08:30:00+09:00');

    const slots = await congestionService.getHourlyForecast('2', 'up', now);

    expect(slots).toHaveLength(7);
    expect(slots[0]?.slotTime).toBe('08:00');
    expect(slots[2]?.slotTime).toBe('08:30');
    expect(slots[6]?.slotTime).toBe('09:30');
    expect(spy).toHaveBeenCalledTimes(7);
  });

  it('maps congestion % to 4 CongestionLevel values', async () => {
    jest
      .spyOn(asHost(congestionService), 'fetchSlotAverage')
      .mockResolvedValueOnce(40) // < 50  -> low
      .mockResolvedValueOnce(60) // < 70  -> moderate
      .mockResolvedValueOnce(80) // < 85  -> high
      .mockResolvedValueOnce(90) // >= 85 -> crowded
      .mockResolvedValue(60);
    const now = new Date('2026-05-12T08:30:00+09:00');

    const slots = await congestionService.getHourlyForecast('2', 'up', now);

    expect(slots[0]?.level).toBe('low');
    expect(slots[1]?.level).toBe('moderate');
    expect(slots[2]?.level).toBe('high');
    expect(slots[3]?.level).toBe('crowded');

    expect(slots[0]?.congestionPercent).toBe(40);
    expect(slots[1]?.congestionPercent).toBe(60);
    expect(slots[2]?.congestionPercent).toBe(80);
    expect(slots[3]?.congestionPercent).toBe(90);
  });

  it('returns "unknown" level and 0% for slots with no historical data', async () => {
    jest
      .spyOn(asHost(congestionService), 'fetchSlotAverage')
      .mockResolvedValue(null);
    const now = new Date('2026-05-12T08:30:00+09:00');

    const slots = await congestionService.getHourlyForecast('2', 'up', now);

    expect(slots).toHaveLength(7);
    slots.forEach((s) => {
      expect(s.level).toBe('unknown');
      expect(s.congestionPercent).toBe(0);
    });
  });
});
