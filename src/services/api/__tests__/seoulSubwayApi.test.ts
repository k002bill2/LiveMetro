/**
 * Seoul Subway API Service Tests
 *
 * Note: This tests the actual implementation, not the mock from setup.ts
 * We need to reset modules and set env vars before importing the real module.
 */

// Set environment variable for API key BEFORE module import
process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY = 'test-api-key-1';
process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY_2 = 'test-api-key-2';
process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY = 'test-data-portal-key';

// Reset module registry BEFORE any imports
jest.resetModules();

// Unmock the seoulSubwayApi module to test actual implementation
jest.unmock('../seoulSubwayApi');

// Mock fetch globally - must be const since module captures reference at load time
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Now require the actual module (after reset and unmock)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { seoulSubwayApi, RateLimiter } = jest.requireActual('../seoulSubwayApi');

// Type for test use
interface SeoulRealtimeArrival {
  rowNum: string;
  selectedCount: string;
  totalCount: string;
  subwayId: string;
  updnLine: string;
  trainLineNm: string;
  subwayHeading: string;
  statnFid: string;
  statnTid: string;
  statnId: string;
  statnNm: string;
  trainCo: string;
  ordkey: string;
  subwayList: string;
  statnList: string;
  btrainSttus: string;
  barvlDt: string;
  btrainNo: string;
  bstatnId: string;
  bstatnNm: string;
  recptnDt: string;
  arvlMsg2: string;
  arvlMsg3: string;
  arvlCd: string;
}

// Increase timeout for retry delay tests (3 retries × 3s backoff = ~9s)
jest.setTimeout(30000);

describe('SeoulSubwayApiService', () => {
  beforeEach(() => {
    // mockReset clears calls + once-implementations (specificMockImpls)
    mockFetch.mockReset();
    // Clear rate limiter and in-flight requests to avoid cross-test contamination
    seoulSubwayApi.getRateLimiter().clear();
    seoulSubwayApi.clearInflightRequests();
  });

  describe('getRealtimeArrival', () => {
    it('should return arrival data on successful API call', async () => {
      const mockData = {
        realtimeArrivalList: [
          {
            rowNum: '1',
            selectedCount: '1',
            totalCount: '10',
            subwayId: '1002',
            updnLine: '상행',
            trainLineNm: '2호선',
            subwayHeading: '시청',
            statnFid: '0221',
            statnTid: '0223',
            statnId: '0222',
            statnNm: '강남',
            trainCo: '',
            ordkey: '01',
            subwayList: '',
            statnList: '',
            btrainSttus: '일반',
            barvlDt: '',
            btrainNo: '2145',
            bstatnId: '0250',
            bstatnNm: '시청',
            recptnDt: '2024-01-01 12:00:00',
            arvlMsg2: '2분후[1번째전]',
            arvlMsg3: '홍대입구',
            arvlCd: '2',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await seoulSubwayApi.getRealtimeArrival('강남');

      expect(result).toHaveLength(1);
      expect(result[0]?.statnNm).toBe('강남');
      expect(result[0]?.arvlMsg2).toBe('2분후[1번째전]');
    });

    it('should return empty array when no arrival data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ realtimeArrivalList: null }),
      });

      const result = await seoulSubwayApi.getRealtimeArrival('강남');

      expect(result).toEqual([]);
    });

    it('should throw error on API error response', async () => {
      const mockError = {
        errorMessage: {
          status: 500,
          code: 'ERROR-300',
          message: 'Internal Server Error',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockError),
      });

      await expect(seoulSubwayApi.getRealtimeArrival('강남')).rejects.toThrow(
        '실시간 도착정보를 가져오는데 실패했습니다'
      );
    });

    it('should throw error on network failure after retries', async () => {
      // With retry logic, need to mock multiple failures (3 retries)
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(seoulSubwayApi.getRealtimeArrival('강남')).rejects.toThrow(
        '실시간 도착정보를 가져오는데 실패했습니다'
      );
    });

    it('should throw error on HTTP error status after retries', async () => {
      // Mock multiple HTTP errors for retry
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        });

      await expect(seoulSubwayApi.getRealtimeArrival('강남')).rejects.toThrow(
        '실시간 도착정보를 가져오는데 실패했습니다'
      );
    });
  });

  describe('getStationsByLine', () => {
    it('should return stations for a line on success', async () => {
      const mockData = {
        SearchInfoBySubwayNameService: {
          list_total_count: 2,
          RESULT: {
            CODE: 'INFO-000',
            MESSAGE: '정상 처리되었습니다.',
          },
          row: [
            {
              STATION_CD: '0222',
              STATION_NM: '강남',
              LINE_NUM: '02호선',
              FR_CODE: '222',
              XPOS: '127.0276',
              YPOS: '37.4979',
            },
            {
              STATION_CD: '0221',
              STATION_NM: '역삼',
              LINE_NUM: '02호선',
              FR_CODE: '221',
              XPOS: '127.0365',
              YPOS: '37.5007',
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await seoulSubwayApi.getStationsByLine('2');

      expect(result).toHaveLength(2);
      expect(result[0]?.STATION_NM).toBe('강남');
    });

    it('should throw error on API error response after retries', async () => {
      const mockError = {
        errorMessage: {
          status: 400,
          code: 'ERROR-100',
          message: 'Invalid parameter',
        },
      };

      // Mock 3 failures for retry exhaustion
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockError),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockError),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockError),
        });

      await expect(seoulSubwayApi.getStationsByLine('99')).rejects.toThrow(
        '역 정보를 가져오는데 실패했습니다'
      );
    });

    it('should throw error on non-success result code after retries', async () => {
      const mockData = {
        SearchInfoBySubwayNameService: {
          list_total_count: 0,
          RESULT: {
            CODE: 'INFO-200',
            MESSAGE: '해당하는 데이터가 없습니다.',
          },
          row: [],
        },
      };

      // Mock 3 failures for retry exhaustion
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        });

      await expect(seoulSubwayApi.getStationsByLine('99')).rejects.toThrow(
        '역 정보를 가져오는데 실패했습니다'
      );
    });
  });

  describe('getAllStations', () => {
    it('should return unique stations from all lines', async () => {
      const line2Stations = {
        SearchInfoBySubwayNameService: {
          list_total_count: 1,
          RESULT: { CODE: 'INFO-000', MESSAGE: 'OK' },
          row: [{ STATION_CD: '0222', STATION_NM: '강남', LINE_NUM: '02호선', FR_CODE: '222', XPOS: '127', YPOS: '37' }],
        },
      };

      const line3Stations = {
        SearchInfoBySubwayNameService: {
          list_total_count: 1,
          RESULT: { CODE: 'INFO-000', MESSAGE: 'OK' },
          row: [{ STATION_CD: '0333', STATION_NM: '교대', LINE_NUM: '03호선', FR_CODE: '333', XPOS: '127', YPOS: '37' }],
        },
      };

      // Mock for all 9 lines (some will return same data for simplicity)
      for (let i = 0; i < 9; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(i % 2 === 0 ? line2Stations : line3Stations),
        });
      }

      const result = await seoulSubwayApi.getAllStations();

      // Should have unique stations only
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle partial failures gracefully', async () => {
      const successResponse = {
        SearchInfoBySubwayNameService: {
          list_total_count: 1,
          RESULT: { CODE: 'INFO-000', MESSAGE: 'OK' },
          row: [{ STATION_CD: '0222', STATION_NM: '강남', LINE_NUM: '02호선', FR_CODE: '222', XPOS: '127', YPOS: '37' }],
        },
      };

      // With retry logic, failures will be retried 3 times
      // For lines 0, 3, 6 (i % 3 === 0), mock 3 failures each
      // For other lines, mock success
      for (let i = 0; i < 9; i++) {
        if (i % 3 === 0) {
          // Mock 3 failures for retry exhaustion
          mockFetch
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Network error'));
        } else {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(successResponse),
          });
        }
      }

      // Should not throw, just log warnings
      const result = await seoulSubwayApi.getAllStations();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('checkServiceStatus', () => {
    it('should return true when API is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ realtimeArrivalList: [] }),
      });

      const result = await seoulSubwayApi.checkServiceStatus();

      expect(result).toBe(true);
    });

    it('should return false when API is unavailable', async () => {
      // Mock 3 failures for retry exhaustion
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await seoulSubwayApi.checkServiceStatus();

      expect(result).toBe(false);
    });
  });

  describe('getStationTimetable', () => {
    it('should return timetable data on success', async () => {
      const mockData = {
        SearchSTNTimeTableByIDService: {
          list_total_count: 2,
          RESULT: { CODE: 'INFO-000', MESSAGE: 'OK' },
          row: [
            {
              STATION_CD: '0222',
              STATION_NM: '강남',
              TRAIN_NO: '2101',
              ARRIVETIME: '05:30:00',
              LEFTTIME: '05:30:30',
              ORIGIN_STATION_NM: '성수',
              DEST_STATION_NM: '시청',
              SUBWAYSNAME: '2호선',
              WEEK_TAG: '1',
              INOUT_TAG: '1',
              FLAG: '',
            },
          ],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await seoulSubwayApi.getStationTimetable('0222', '1', '1');

      expect(result).toHaveLength(1);
      expect(result[0]?.ARRIVETIME).toBe('05:30:00');
    });

    it('should return empty array for INFO-200 (no data)', async () => {
      const mockData = {
        SearchSTNTimeTableByIDService: {
          list_total_count: 0,
          RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' },
          row: [],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await seoulSubwayApi.getStationTimetable('9999', '1', '1');

      expect(result).toEqual([]);
    });

    it('should throw error on other error codes after retries', async () => {
      const mockData = {
        SearchSTNTimeTableByIDService: {
          list_total_count: 0,
          RESULT: { CODE: 'ERROR-500', MESSAGE: 'Server Error' },
          row: [],
        },
      };

      // Mock 3 failures for retry exhaustion
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        });

      await expect(seoulSubwayApi.getStationTimetable('0222', '1', '1')).rejects.toThrow(
        '시간표 정보를 가져오는데 실패했습니다'
      );
    });
  });

  describe('request deduplication', () => {
    it('should deduplicate concurrent requests for same station', async () => {
      const mockData = {
        realtimeArrivalList: [
          {
            rowNum: '1', selectedCount: '1', totalCount: '1',
            subwayId: '1002', updnLine: '상행', trainLineNm: '2호선',
            subwayHeading: '시청', statnFid: '0221', statnTid: '0223',
            statnId: '0222', statnNm: '강남', trainCo: '', ordkey: '01',
            subwayList: '', statnList: '', btrainSttus: '일반', barvlDt: '',
            btrainNo: '2145', bstatnId: '0250', bstatnNm: '시청',
            recptnDt: '2024-01-01 12:00:00', arvlMsg2: '2분후', arvlMsg3: '', arvlCd: '2',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      // Fire two concurrent requests for the same station
      const [result1, result2] = await Promise.all([
        seoulSubwayApi.getRealtimeArrival('강남'),
        seoulSubwayApi.getRealtimeArrival('강남'),
      ]);

      // Both should return same data
      expect(result1).toEqual(result2);
      // fetch should only be called once (deduplication)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should make new request after previous one completes', async () => {
      const mockData = {
        realtimeArrivalList: [],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });

      // First request
      await seoulSubwayApi.getRealtimeArrival('역삼');
      // Clear rate limiter between sequential calls to same station
      seoulSubwayApi.getRateLimiter().clear();
      // Second request (after first completes)
      await seoulSubwayApi.getRealtimeArrival('역삼');

      // Two separate fetches
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not deduplicate requests for different stations', async () => {
      const mockData = { realtimeArrivalList: [] };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockData) });

      await Promise.all([
        seoulSubwayApi.getRealtimeArrival('강남'),
        seoulSubwayApi.getRealtimeArrival('역삼'),
      ]);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('convertToAppTrain', () => {
    it('should convert Seoul API data to app format with minutes', () => {
      // arvlCd left empty: this fixture exercises the "X분후" text-fallback
      // path. Real API responses never combine "3분후" text with arvlCd='2'
      // (당역 출발) — the prior fixture had that contradictory pairing as
      // noise that only passed because text fallback ran before arvlCd.
      const seoulData: SeoulRealtimeArrival = {
        rowNum: '1',
        selectedCount: '1',
        totalCount: '10',
        subwayId: '1002',
        updnLine: '상행',
        trainLineNm: '2호선',
        subwayHeading: '시청',
        statnFid: '0221',
        statnTid: '0223',
        statnId: '0222',
        statnNm: '강남',
        trainCo: '',
        ordkey: '01',
        subwayList: '',
        statnList: '',
        btrainSttus: '일반',
        barvlDt: '',
        btrainNo: '2145',
        bstatnId: '0250',
        bstatnNm: '시청',
        recptnDt: '2024-01-01 12:00:00',
        arvlMsg2: '3분후[2번째전]',
        arvlMsg3: '홍대입구',
        arvlCd: '',
      };

      const result = seoulSubwayApi.convertToAppTrain(seoulData);

      expect(result.lineId).toBe('1002');
      expect(result.stationName).toBe('강남');
      expect(result.direction).toBe('up');
      expect(result.arrivalTime).toBe(180); // 3 minutes = 180 seconds
      expect(result.trainNumber).toBe('2145');
      expect(result.destinationStation).toBe('시청');
    });

    it('should handle "곧 도착" message', () => {
      const seoulData: SeoulRealtimeArrival = {
        rowNum: '1',
        selectedCount: '1',
        totalCount: '10',
        subwayId: '1002',
        updnLine: '하행',
        trainLineNm: '2호선',
        subwayHeading: '강남',
        statnFid: '0221',
        statnTid: '0223',
        statnId: '0222',
        statnNm: '강남',
        trainCo: '',
        ordkey: '01',
        subwayList: '',
        statnList: '',
        btrainSttus: '일반',
        barvlDt: '',
        btrainNo: '2146',
        bstatnId: '0201',
        bstatnNm: '성수',
        recptnDt: '2024-01-01 12:00:00',
        arvlMsg2: '곧 도착[0번째전]',
        arvlMsg3: '역삼',
        arvlCd: '0',
      };

      const result = seoulSubwayApi.convertToAppTrain(seoulData);

      expect(result.direction).toBe('down');
      expect(result.arrivalTime).toBe(30); // "곧 도착" = 30 seconds
    });

    it('should handle "진입" message', () => {
      const seoulData: SeoulRealtimeArrival = {
        rowNum: '1',
        selectedCount: '1',
        totalCount: '10',
        subwayId: '1002',
        updnLine: '상행',
        trainLineNm: '2호선',
        subwayHeading: '시청',
        statnFid: '0221',
        statnTid: '0223',
        statnId: '0222',
        statnNm: '강남',
        trainCo: '',
        ordkey: '01',
        subwayList: '',
        statnList: '',
        btrainSttus: '일반',
        barvlDt: '',
        btrainNo: '2147',
        bstatnId: '0250',
        bstatnNm: '시청',
        recptnDt: '2024-01-01 12:00:00',
        arvlMsg2: '강남 진입',
        arvlMsg3: '',
        arvlCd: '1',
      };

      const result = seoulSubwayApi.convertToAppTrain(seoulData);

      expect(result.arrivalTime).toBe(30); // "진입" = 30 seconds
    });

    it('should handle empty arrival message', () => {
      const seoulData: SeoulRealtimeArrival = {
        rowNum: '1',
        selectedCount: '1',
        totalCount: '10',
        subwayId: '1002',
        updnLine: '상행',
        trainLineNm: '2호선',
        subwayHeading: '시청',
        statnFid: '0221',
        statnTid: '0223',
        statnId: '0222',
        statnNm: '강남',
        trainCo: '',
        ordkey: '01',
        subwayList: '',
        statnList: '',
        btrainSttus: '일반',
        barvlDt: '',
        btrainNo: '',
        bstatnId: '',
        bstatnNm: '',
        recptnDt: '',
        arvlMsg2: '',
        arvlMsg3: '',
        arvlCd: '',
      };

      const result = seoulSubwayApi.convertToAppTrain(seoulData);

      expect(result.arrivalTime).toBeNull();
      expect(result.trainNumber).toBe('');
      expect(result.destinationStation).toBe('시청'); // Falls back to subwayHeading
    });

    // Regression: arvlCd is the authoritative signal for departure/前驛 states.
    // Text-only matches must not override the code semantics — a departed
    // train (arvlCd='2') was previously rendered as "도착" (0s).
    it('should filter departed trains (arvlCd 2) regardless of message text', () => {
      const seoulData: SeoulRealtimeArrival = {
        rowNum: '1', selectedCount: '1', totalCount: '10',
        subwayId: '1002', updnLine: '상행', trainLineNm: '2호선',
        subwayHeading: '시청', statnFid: '0221', statnTid: '0223',
        statnId: '0222', statnNm: '강남', trainCo: '', ordkey: '01',
        subwayList: '', statnList: '', btrainSttus: '일반',
        barvlDt: '',
        btrainNo: '2150', bstatnId: '0250', bstatnNm: '시청',
        recptnDt: '2024-01-01 12:00:00',
        arvlMsg2: '당역출발',
        arvlMsg3: '',
        arvlCd: '2',
      };

      const result = seoulSubwayApi.convertToAppTrain(seoulData);

      expect(result.arrivalTime).toBeNull();
    });

    it('should map 전역출발 (arvlCd 3) to ~120 seconds', () => {
      const seoulData: SeoulRealtimeArrival = {
        rowNum: '1', selectedCount: '1', totalCount: '10',
        subwayId: '1002', updnLine: '상행', trainLineNm: '2호선',
        subwayHeading: '시청', statnFid: '0221', statnTid: '0223',
        statnId: '0222', statnNm: '강남', trainCo: '', ordkey: '01',
        subwayList: '', statnList: '', btrainSttus: '일반',
        barvlDt: '',
        btrainNo: '2151', bstatnId: '0250', bstatnNm: '시청',
        recptnDt: '2024-01-01 12:00:00',
        arvlMsg2: '전역출발',
        arvlMsg3: '',
        arvlCd: '3',
      };

      const result = seoulSubwayApi.convertToAppTrain(seoulData);

      expect(result.arrivalTime).toBe(120);
    });

    it('strips trailing "역" from statnNm and bstatnNm to prevent double-suffix', () => {
      const seoulData: SeoulRealtimeArrival = {
        rowNum: '1', selectedCount: '1', totalCount: '10',
        subwayId: '1002', updnLine: '상행', trainLineNm: '2호선',
        subwayHeading: '시청', statnFid: '0221', statnTid: '0223',
        statnId: '0222',
        statnNm: '강남역',
        trainCo: '', ordkey: '01',
        subwayList: '', statnList: '', btrainSttus: '일반',
        barvlDt: '',
        btrainNo: '2160',
        bstatnId: '0250',
        bstatnNm: '시청역',
        recptnDt: '2024-01-01 12:00:00',
        arvlMsg2: '3분후',
        arvlMsg3: '',
        arvlCd: '',
      };

      const result = seoulSubwayApi.convertToAppTrain(seoulData);

      expect(result.stationName).toBe('강남');
      expect(result.destinationStation).toBe('시청');
    });

    it('leaves already-suffix-less names unchanged', () => {
      const seoulData: SeoulRealtimeArrival = {
        rowNum: '1', selectedCount: '1', totalCount: '10',
        subwayId: '1002', updnLine: '상행', trainLineNm: '2호선',
        subwayHeading: '시청', statnFid: '0221', statnTid: '0223',
        statnId: '0222',
        statnNm: '강남',
        trainCo: '', ordkey: '01',
        subwayList: '', statnList: '', btrainSttus: '일반',
        barvlDt: '',
        btrainNo: '2161',
        bstatnId: '0250',
        bstatnNm: '시청',
        recptnDt: '2024-01-01 12:00:00',
        arvlMsg2: '3분후',
        arvlMsg3: '',
        arvlCd: '',
      };

      const result = seoulSubwayApi.convertToAppTrain(seoulData);

      expect(result.stationName).toBe('강남');
      expect(result.destinationStation).toBe('시청');
    });

    it('should map 전역진입 (arvlCd 4) to ~180 seconds (not confused with 당역진입)', () => {
      const seoulData: SeoulRealtimeArrival = {
        rowNum: '1', selectedCount: '1', totalCount: '10',
        subwayId: '1002', updnLine: '상행', trainLineNm: '2호선',
        subwayHeading: '시청', statnFid: '0221', statnTid: '0223',
        statnId: '0222', statnNm: '강남', trainCo: '', ordkey: '01',
        subwayList: '', statnList: '', btrainSttus: '일반',
        barvlDt: '',
        btrainNo: '2152', bstatnId: '0250', bstatnNm: '시청',
        recptnDt: '2024-01-01 12:00:00',
        arvlMsg2: '전역진입',
        arvlMsg3: '',
        arvlCd: '4',
      };

      const result = seoulSubwayApi.convertToAppTrain(seoulData);

      expect(result.arrivalTime).toBe(180);
    });
  });

  describe('fetchWithTimeout', () => {
    it('should handle AbortError correctly after retries', async () => {
      // Simulate abort error (timeout) - needs 3 failures for retry exhaustion
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch
        .mockRejectedValueOnce(abortError)
        .mockRejectedValueOnce(abortError)
        .mockRejectedValueOnce(abortError);

      await expect(seoulSubwayApi.getRealtimeArrival('강남')).rejects.toThrow(
        '실시간 도착정보를 가져오는데 실패했습니다'
      );
    });
  });

  describe('RateLimiter', () => {
    it('should throttle requests within minimum interval', async () => {
      const rateLimiter = new RateLimiter(100); // 100ms for testing

      // First request should not wait
      const waited1 = await rateLimiter.throttle('test');
      expect(waited1).toBe(0);

      // Second request should wait
      const startTime = Date.now();
      const waited2 = await rateLimiter.throttle('test');
      const elapsed = Date.now() - startTime;

      expect(waited2).toBeGreaterThan(0);
      expect(elapsed).toBeGreaterThanOrEqual(waited2 - 10); // Allow some tolerance
    });

    it('should not throttle different keys', async () => {
      const rateLimiter = new RateLimiter(1000);

      const waited1 = await rateLimiter.throttle('key1');
      const waited2 = await rateLimiter.throttle('key2');

      expect(waited1).toBe(0);
      expect(waited2).toBe(0);
    });

    it('should report canRequest correctly', async () => {
      const rateLimiter = new RateLimiter(100);

      expect(rateLimiter.canRequest('test')).toBe(true);

      await rateLimiter.throttle('test');

      expect(rateLimiter.canRequest('test')).toBe(false);

      // Wait for interval to pass
      await new Promise(resolve => setTimeout(resolve, 110));

      expect(rateLimiter.canRequest('test')).toBe(true);
    });

    it('should clear rate limits', async () => {
      const rateLimiter = new RateLimiter(1000);

      await rateLimiter.throttle('test');
      expect(rateLimiter.canRequest('test')).toBe(false);

      rateLimiter.clear('test');
      expect(rateLimiter.canRequest('test')).toBe(true);
    });

    it('should get remaining cooldown', async () => {
      const rateLimiter = new RateLimiter(1000);

      expect(rateLimiter.getRemainingCooldown('test')).toBe(0);

      await rateLimiter.throttle('test');

      const remaining = rateLimiter.getRemainingCooldown('test');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(1000);
    });
  });
});
