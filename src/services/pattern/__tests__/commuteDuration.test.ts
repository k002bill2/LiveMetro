/**
 * commuteDuration — measured travel duration derived from commute logs.
 */
import {
  commuteDurationMinutes,
  averageCommuteDurationFor,
} from '../commuteDuration';
import type { CommuteLog } from '@/models/pattern';

const log = (
  departureStationName: string,
  arrivalStationName: string,
  departureTime: string,
  arrivalTime?: string
): CommuteLog =>
  ({
    id: `${departureStationName}-${departureTime}`,
    userId: 'user-1',
    date: '2026-08-11',
    dayOfWeek: 1,
    departureTime,
    arrivalTime,
    departureStationId: 'x',
    departureStationName,
    arrivalStationId: 'y',
    arrivalStationName,
    lineIds: ['1'],
    wasDelayed: false,
    isManual: false,
    createdAt: new Date('2026-08-11T08:05:00'),
  }) as CommuteLog;

// Mirrors the shape of the real account's data: a morning leg that is
// consistently ~11min faster than the evening leg back. Averaging the two
// together is what made the displayed "measured" duration wrong.
const MORNING = [
  log('산곡', '선릉', '08:05', '09:14'), // 69
  log('산곡', '선릉', '08:06', '09:16'), // 70
  log('산곡', '선릉', '08:07', '09:15'), // 68
];
const EVENING = [
  log('선릉', '산곡', '18:47', '20:08'), // 81
  log('선릉', '산곡', '18:48', '20:08'), // 80
  log('선릉', '산곡', '18:46', '20:08'), // 82
];

describe('commuteDurationMinutes', () => {
  it('returns the measured minutes between departure and arrival', () => {
    expect(commuteDurationMinutes(log('산곡', '선릉', '08:05', '09:14'))).toBe(69);
  });

  it('wraps past midnight rather than going negative', () => {
    expect(commuteDurationMinutes(log('산곡', '선릉', '23:50', '00:20'))).toBe(30);
  });

  it('returns null for an open log (no arrivalTime)', () => {
    expect(commuteDurationMinutes(log('산곡', '선릉', '08:05'))).toBeNull();
  });

  it('returns null when departure and arrival are the same minute', () => {
    expect(commuteDurationMinutes(log('산곡', '선릉', '08:05', '08:05'))).toBeNull();
  });

  it('returns null for an unparseable time', () => {
    expect(commuteDurationMinutes(log('산곡', '선릉', '아침', '09:14'))).toBeNull();
  });
});

describe('averageCommuteDurationFor', () => {
  it('averages only the requested leg — 산곡→선릉 is 69, not the 75 mixed average', () => {
    const all = [...MORNING, ...EVENING];

    expect(averageCommuteDurationFor(all, '산곡', '선릉')).toBe(69);
    // The regression: before OD scoping this returned the mixed mean.
    expect(averageCommuteDurationFor(all, '산곡', '선릉')).not.toBe(75);
  });

  it('averages the reverse leg independently — 선릉→산곡 is 81', () => {
    expect(averageCommuteDurationFor([...MORNING, ...EVENING], '선릉', '산곡')).toBe(81);
  });

  it('returns null when the requested leg has no logs', () => {
    expect(averageCommuteDurationFor(MORNING, '신도림', '강남')).toBeNull();
  });

  it('returns null when the OD is not resolved yet', () => {
    expect(averageCommuteDurationFor(MORNING, undefined, '선릉')).toBeNull();
    expect(averageCommuteDurationFor(MORNING, '산곡', undefined)).toBeNull();
  });

  it('ignores open logs on the requested leg', () => {
    const withOpen = [...MORNING, log('산곡', '선릉', '08:10')];
    expect(averageCommuteDurationFor(withOpen, '산곡', '선릉')).toBe(69);
  });

  it('never matches a destination-less stub', () => {
    const withStub = [log('산곡', '', '08:05', '09:14')];
    expect(averageCommuteDurationFor(withStub, '산곡', '선릉')).toBeNull();
  });

  it('returns null for an empty log set', () => {
    expect(averageCommuteDurationFor([], '산곡', '선릉')).toBeNull();
  });
});
