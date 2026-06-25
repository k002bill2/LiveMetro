/**
 * Official Delay Service Tests
 */

import {
  officialDelayService,
  API_BASE_URL,
} from '../officialDelayService';

// 실데이터 소스(data.go.kr)를 mock해 단위 테스트를 결정론적으로 유지(네트워크 차단).
// 기본 []는 무장애 → 전 노선 정상 baseline.
jest.mock('@/services/api', () => ({
  publicDataApi: {
    getActiveAlerts: jest.fn().mockResolvedValue([]),
  },
}));

describe('OfficialDelayService', () => {
  describe('getAllLineStatuses', () => {
    it('should return line statuses', async () => {
      const response = await officialDelayService.getAllLineStatuses();

      expect(response).toBeDefined();
      expect(response.lines).toBeDefined();
      expect(Array.isArray(response.lines)).toBe(true);
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('should include all subway lines', async () => {
      const response = await officialDelayService.getAllLineStatuses();

      // Should have lines 1-9
      const lineIds = response.lines.map(l => l.lineId);
      expect(lineIds).toContain('1');
      expect(lineIds).toContain('9');
    });

    it('should use cache on repeated calls', async () => {
      const response1 = await officialDelayService.getAllLineStatuses();
      const response2 = await officialDelayService.getAllLineStatuses();

      // Same timestamp means cache was used
      expect(response1.timestamp.getTime()).toBe(response2.timestamp.getTime());
    });
  });

  describe('getLineStatus', () => {
    it('should return status for specific line', async () => {
      const status = await officialDelayService.getLineStatus('2');

      expect(status).toBeDefined();
      expect(status?.lineId).toBe('2');
      expect(status?.lineName).toBe('2호선');
    });

    it('should return null for invalid line', async () => {
      const status = await officialDelayService.getLineStatus('invalid');

      expect(status).toBeNull();
    });
  });

  describe('getActiveDelays', () => {
    it('should return only delayed/suspended lines', async () => {
      const delays = await officialDelayService.getActiveDelays();

      expect(Array.isArray(delays)).toBe(true);
      delays.forEach(delay => {
        expect(['delayed', 'suspended']).toContain(delay.status);
      });
    });

    it('does not fabricate delays even when Math.random would trigger them', async () => {
      // 구버그: fetchOfficialDelays가 Math.random()<delayChance 로 가짜 지연을 만들어
      // ML 예측 UI에 허구 공식 지연을 노출했다. Math.random을 0으로 고정하면 구코드는
      // 전 노선을 'delayed'로 날조한다. 정직한 구현은 실소스 미통합 시 항상 [] 여야 한다.
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
      try {
        // 싱글톤 캐시 공유를 피하려 cold 캐시 fresh 인스턴스를 격리 로드한다.
        let svc!: typeof officialDelayService;
        jest.isolateModules(() => {
          svc = require('../officialDelayService').officialDelayService;
        });
        const delays = await svc.getActiveDelays();
        expect(delays).toHaveLength(0);
      } finally {
        randomSpy.mockRestore();
      }
    });
  });

  describe('hasActiveDelay', () => {
    it('should return boolean', async () => {
      const hasDelay = await officialDelayService.hasActiveDelay('1');

      expect(typeof hasDelay).toBe('boolean');
    });
  });

  describe('getDelayAlerts', () => {
    it('should return alerts array', async () => {
      const alerts = await officialDelayService.getDelayAlerts();

      expect(Array.isArray(alerts)).toBe(true);

      alerts.forEach(alert => {
        expect(alert.id).toBeDefined();
        expect(alert.lineId).toBeDefined();
        expect(['info', 'warning', 'critical']).toContain(alert.severity);
        expect(alert.title).toBeDefined();
        expect(alert.message).toBeDefined();
        expect(alert.createdAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('verifyReportedDelay', () => {
    it('should verify delay against official data', async () => {
      const result = await officialDelayService.verifyReportedDelay('2', 5);

      expect(result).toBeDefined();
      expect(typeof result.verified).toBe('boolean');
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.reason).toBeDefined();
    });

    it('should return low confidence for invalid line', async () => {
      const result = await officialDelayService.verifyReportedDelay('invalid', 10);

      expect(result.verified).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('getStatusLabel', () => {
    it('should return correct Korean labels', () => {
      expect(officialDelayService.getStatusLabel('normal')).toBe('정상 운행');
      expect(officialDelayService.getStatusLabel('delayed')).toBe('지연 운행');
      expect(officialDelayService.getStatusLabel('suspended')).toBe('운행 중단');
      expect(officialDelayService.getStatusLabel('modified')).toBe('우회 운행');
    });
  });

  describe('getStatusColor', () => {
    it('should return correct colors', () => {
      expect(officialDelayService.getStatusColor('normal')).toBe('#4CAF50');
      expect(officialDelayService.getStatusColor('delayed')).toBe('#FF9800');
      expect(officialDelayService.getStatusColor('suspended')).toBe('#F44336');
      expect(officialDelayService.getStatusColor('modified')).toBe('#2196F3');
    });
  });

  describe('API_BASE_URL', () => {
    it('should be exported', () => {
      expect(API_BASE_URL).toBe('http://swopenapi.seoul.go.kr/api/subway');
    });
  });
});
