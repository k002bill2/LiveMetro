/**
 * Official Delay Service — 실데이터 통합(A2) 테스트
 *
 * data.go.kr 알림(`publicDataApi.getActiveAlerts`)을 OfficialDelay로 매핑하는
 * 순수 헬퍼 + 통합 + 웹 정직성 가드. 알고리즘/데이터 통합 관심사를 기존
 * officialDelayService.test.ts(기본 동작)와 분리한다.
 */

import {
  OfficialDelayService,
  classifyAlertStatus,
  lineNameToLineId,
  mergeWithBaseline,
  type OfficialDelay,
} from '../officialDelayService';
import { publicDataApi } from '@/services/api';
import { Platform } from 'react-native';
import type { SubwayAlert } from '@/models/publicData';

jest.mock('@/services/api', () => ({
  publicDataApi: {
    getActiveAlerts: jest.fn().mockResolvedValue([]),
  },
}));

// react-native를 Platform만으로 mock(서비스는 Platform.OS만 사용). inline 객체라
// 호이스팅 TDZ 없음 — require 1회로 단일 객체가 되어 런타임 OS 변이가 서비스에 전파된다.
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const mockGetActiveAlerts = publicDataApi.getActiveAlerts as jest.Mock;
const platform = Platform as unknown as { OS: string };

function makeAlert(partial: Partial<SubwayAlert> = {}): SubwayAlert {
  return {
    alertId: 'a1',
    title: '제목',
    content: '내용',
    lineName: '2호선',
    alertType: 'delay',
    startTime: new Date('2026-06-25T08:00:00+09:00'),
    endTime: null,
    isActive: true,
    affectedStations: [],
    ...partial,
  };
}

function makeDelayed(lineId: string): OfficialDelay {
  return {
    lineId,
    lineName: `${lineId}호선`,
    status: 'delayed',
    updatedAt: new Date(),
    source: 'seoul_metro',
  };
}

/** cold 캐시 fresh 인스턴스(테스트 간 캐시 공유 차단, isolateModules 불필요). */
function makeService(): OfficialDelayService {
  return new OfficialDelayService();
}

beforeEach(() => {
  mockGetActiveAlerts.mockReset();
  mockGetActiveAlerts.mockResolvedValue([]);
});

describe('classifyAlertStatus', () => {
  it('maps delay alert to delayed status', () => {
    expect(classifyAlertStatus('delay')).toBe('delayed');
  });

  it('maps accident alert to delayed (not suspended — accident=MAJOR, service continues)', () => {
    expect(classifyAlertStatus('accident')).toBe('delayed');
  });

  it('returns null for maintenance (planned, not a live disruption)', () => {
    expect(classifyAlertStatus('maintenance')).toBeNull();
  });

  it('returns null for crowded (congestion is a separate axis, not a delay)', () => {
    expect(classifyAlertStatus('crowded')).toBeNull();
  });

  it('returns null for weather', () => {
    expect(classifyAlertStatus('weather')).toBeNull();
  });

  it('returns null for other', () => {
    expect(classifyAlertStatus('other')).toBeNull();
  });
});

describe('lineNameToLineId', () => {
  it('maps "2호선" to "2"', () => {
    expect(lineNameToLineId('2호선')).toBe('2');
  });

  it('maps "9호선" to "9"', () => {
    expect(lineNameToLineId('9호선')).toBe('9');
  });

  it('maps "1호선" to "1"', () => {
    expect(lineNameToLineId('1호선')).toBe('1');
  });

  it('returns null for non-1~9 lines (out of service domain)', () => {
    expect(lineNameToLineId('경의중앙선')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(lineNameToLineId('')).toBeNull();
  });
});

describe('mergeWithBaseline', () => {
  it('returns all 9 lines normal when there are no disruptions', () => {
    const merged = mergeWithBaseline([]);
    expect(merged).toHaveLength(9);
    expect(merged.every(l => l.status === 'normal')).toBe(true);
    expect(merged.map(l => l.lineId).sort()).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9']
    );
  });

  it('overlays a delayed line onto the all-normal baseline', () => {
    const merged = mergeWithBaseline([makeDelayed('2')]);
    expect(merged).toHaveLength(9);
    expect(merged.find(l => l.lineId === '2')?.status).toBe('delayed');
    expect(merged.find(l => l.lineId === '1')?.status).toBe('normal');
    expect(merged.filter(l => l.status === 'delayed')).toHaveLength(1);
  });

  it('deduplicates multiple disruptions on the same line', () => {
    const merged = mergeWithBaseline([makeDelayed('2'), makeDelayed('2')]);
    expect(merged).toHaveLength(9);
    expect(merged.filter(l => l.lineId === '2')).toHaveLength(1);
    expect(merged.find(l => l.lineId === '2')?.status).toBe('delayed');
  });
});

describe('fetchOfficialDelays via getActiveAlerts (integration)', () => {
  it('surfaces a real delay alert as a delayed line', async () => {
    mockGetActiveAlerts.mockResolvedValue([
      makeAlert({ lineName: '2호선', alertType: 'delay' }),
    ]);
    const delays = await makeService().getActiveDelays();
    expect(delays).toHaveLength(1);
    expect(delays[0]?.lineId).toBe('2');
    expect(delays[0]?.status).toBe('delayed');
  });

  it('surfaces an accident alert as delayed (not suspended)', async () => {
    mockGetActiveAlerts.mockResolvedValue([
      makeAlert({ lineName: '5호선', alertType: 'accident' }),
    ]);
    const delays = await makeService().getActiveDelays();
    expect(delays).toHaveLength(1);
    expect(delays[0]?.lineId).toBe('5');
    expect(delays[0]?.status).toBe('delayed');
  });

  it('never fabricates delayMinutes from free-text (stays undefined)', async () => {
    mockGetActiveAlerts.mockResolvedValue([
      makeAlert({ lineName: '2호선', alertType: 'delay', content: '약 5분 지연' }),
    ]);
    const delays = await makeService().getActiveDelays();
    expect(delays[0]?.delayMinutes).toBeUndefined();
  });

  it('ignores maintenance alerts (no delay surfaced)', async () => {
    mockGetActiveAlerts.mockResolvedValue([
      makeAlert({ lineName: '3호선', alertType: 'maintenance' }),
    ]);
    const delays = await makeService().getActiveDelays();
    expect(delays).toHaveLength(0);
  });

  it('drops alerts for non-1~9 lines', async () => {
    mockGetActiveAlerts.mockResolvedValue([
      makeAlert({ lineName: '경의중앙선', alertType: 'delay' }),
    ]);
    const delays = await makeService().getActiveDelays();
    expect(delays).toHaveLength(0);
  });

  it('returns no active delays when source has no alerts', async () => {
    mockGetActiveAlerts.mockResolvedValue([]);
    const delays = await makeService().getActiveDelays();
    expect(delays).toHaveLength(0);
  });

  it('degrades to no active delays when the source throws (error path)', async () => {
    mockGetActiveAlerts.mockRejectedValue(new Error('network'));
    const delays = await makeService().getActiveDelays();
    expect(delays).toHaveLength(0);
  });

  it('carries the alert reason onto the OfficialDelay', async () => {
    mockGetActiveAlerts.mockResolvedValue([
      makeAlert({ lineName: '2호선', alertType: 'delay', title: '신호 장애' }),
    ]);
    const status = await makeService().getLineStatus('2');
    expect(status?.reason).toBe('신호 장애');
  });
});

describe('web platform honesty guard', () => {
  afterEach(() => {
    platform.OS = 'ios';
  });

  it('does not assert genuine-normal on web (isRealtime false, source not called)', async () => {
    mockGetActiveAlerts.mockResolvedValue([]);
    platform.OS = 'web';
    const response = await makeService().getAllLineStatuses();
    expect(response.isRealtime).toBe(false);
    expect(mockGetActiveAlerts).not.toHaveBeenCalled();
  });
});
