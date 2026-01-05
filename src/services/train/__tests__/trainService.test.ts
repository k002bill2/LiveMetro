/**
 * Train Service Tests
 * Tests for Firebase-based train service functionality
 */

import { trainService } from '../trainService';
import { Train, Station, SubwayLine, TrainDelay, TrainStatus, DelaySeverity } from '../../../models/train';

import { seoulSubwayApi } from '../../api/seoulSubwayApi';
import { getLocalStation, getLocalStationsByLine } from '../../data/stationsDataService';

// Mock Firebase
jest.mock('../../firebase/config', () => ({
  firestore: {},
}));

// Mock Firestore functions
const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: (...args: any[]) => mockLimit(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

// Mock Seoul API
jest.mock('../../api/seoulSubwayApi', () => ({
  seoulSubwayApi: {
    getStationTimetable: jest.fn(),
  },
}));

// Mock local stations data service
jest.mock('../../data/stationsDataService', () => ({
  getLocalStation: jest.fn(),
  getLocalStationsByLine: jest.fn(),
}));

const mockSeoulApi = seoulSubwayApi as jest.Mocked<typeof seoulSubwayApi>;
const mockGetLocalStation = getLocalStation as jest.MockedFunction<typeof getLocalStation>;
const mockGetLocalStationsByLine = getLocalStationsByLine as jest.MockedFunction<typeof getLocalStationsByLine>;

describe('TrainService', () => {
  const mockStation: Station = {
    id: 'gangnam',
    name: '강남역',
    nameEn: 'Gangnam',
    lineId: '2',
    coordinates: {
      latitude: 37.5665,
      longitude: 126.9780,
    },
    transfers: ['9'],
  };

  const mockStations: Station[] = [
    mockStation,
    {
      id: 'seolleung',
      name: '선릉역',
      nameEn: 'Seolleung',
      lineId: '2',
      coordinates: {
        latitude: 37.5048,
        longitude: 127.0489,
      },
      transfers: [],
    },
  ];

  const mockSubwayLines: SubwayLine[] = [
    {
      id: '2',
      name: '2호선',
      nameEn: 'Line 2',
      color: '#00a84d',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.mockReturnValue('mockCollection');
    mockQuery.mockReturnValue('mockQuery');
    mockWhere.mockReturnValue('mockWhere');
    mockOrderBy.mockReturnValue('mockOrderBy');
    mockLimit.mockReturnValue('mockLimit');
    mockDoc.mockReturnValue('mockDoc');
  });

  describe('getSubwayLines', () => {
    it('should fetch subway lines from Firebase', async () => {
      mockGetDocs.mockResolvedValue({
        docs: mockSubwayLines.map(line => ({
          id: line.id,
          data: () => ({ name: line.name, nameEn: line.nameEn, color: line.color }),
        })),
      });

      const result = await trainService.getSubwayLines();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '2',
        name: '2호선',
      });
    });

    it('should return empty array on Firebase error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firebase error'));

      const result = await trainService.getSubwayLines();

      expect(result).toEqual([]);
    });
  });

  describe('getStationsByLine', () => {
    it('should fetch stations from Firebase', async () => {
      mockGetDocs.mockResolvedValue({
        docs: mockStations.map(station => ({
          id: station.id,
          data: () => ({
            name: station.name,
            nameEn: station.nameEn,
            lineId: station.lineId,
            coordinates: station.coordinates,
            transfers: station.transfers,
          }),
        })),
      });

      const result = await trainService.getStationsByLine('2');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('강남역');
    });

    it('should fallback to local data when Firebase returns empty', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const result = await trainService.getStationsByLine('2');

      expect(result).toHaveLength(2);
      expect(mockGetLocalStationsByLine).toHaveBeenCalledWith('2');
    });

    it('should fallback to local data on Firebase error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firebase error'));
      mockGetLocalStationsByLine.mockReturnValue(mockStations);

      const result = await trainService.getStationsByLine('2');

      expect(result).toHaveLength(2);
      expect(mockGetLocalStationsByLine).toHaveBeenCalledWith('2');
    });
  });

  describe('getStation', () => {
    it('should fetch station from Firebase', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'gangnam',
        data: () => ({
          name: '강남역',
          nameEn: 'Gangnam',
          lineId: '2',
          coordinates: { latitude: 37.5665, longitude: 126.9780 },
          transfers: ['9'],
        }),
      });

      const result = await trainService.getStation('gangnam');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('강남역');
    });

    it('should fallback to local data when not found in Firebase', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGetLocalStation.mockReturnValue(mockStation);

      const result = await trainService.getStation('gangnam');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('강남역');
      expect(mockGetLocalStation).toHaveBeenCalledWith('gangnam');
    });

    it('should return null when station not found anywhere', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockGetLocalStation.mockReturnValue(null);

      const result = await trainService.getStation('nonexistent');

      expect(result).toBeNull();
    });

    it('should fallback to local data on Firebase error', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firebase error'));
      mockGetLocalStation.mockReturnValue(mockStation);

      const result = await trainService.getStation('gangnam');

      expect(result).not.toBeNull();
      expect(mockGetLocalStation).toHaveBeenCalledWith('gangnam');
    });
  });

  describe('subscribeToTrainUpdates', () => {
    it('should create subscription and call callback', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();

      const mockTrains: Train[] = [
        {
          id: 'train-1',
          lineId: '2',
          direction: 'up',
          currentStationId: 'gangnam',
          nextStationId: 'seolleung',
          finalDestination: '성수',
          status: TrainStatus.NORMAL,
          arrivalTime: new Date(),
          delayMinutes: 0,
          lastUpdated: new Date(),
        },
      ];

      mockOnSnapshot.mockImplementation((query, onNext) => {
        onNext({
          docs: mockTrains.map(train => ({
            id: train.id,
            data: () => ({
              lineId: train.lineId,
              direction: train.direction,
              currentStationId: train.currentStationId,
              nextStationId: train.nextStationId,
              finalDestination: train.finalDestination,
              status: train.status,
              arrivalTime: { toDate: () => train.arrivalTime },
              delayMinutes: train.delayMinutes,
              lastUpdated: { toDate: () => train.lastUpdated },
            }),
          })),
        });
        return mockUnsubscribe;
      });

      const unsubscribe = trainService.subscribeToTrainUpdates('gangnam', mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'train-1',
            currentStationId: 'gangnam',
          }),
        ])
      );

      // Test unsubscribe
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle subscription errors gracefully', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();

      mockOnSnapshot.mockImplementation((query, onNext, onError) => {
        onError(new Error('Subscription error'));
        return mockUnsubscribe;
      });

      trainService.subscribeToTrainUpdates('gangnam', mockCallback);

      expect(mockCallback).toHaveBeenCalledWith([]);
    });
  });

  describe('subscribeToDelayAlerts', () => {
    it('should create delay alerts subscription', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();

      const mockDelays: TrainDelay[] = [
        {
          lineId: '2',
          severity: DelaySeverity.MODERATE,
          affectedStations: ['gangnam', 'seolleung'],
          message: '운행 지연',
          reportedAt: new Date(),
          estimatedResolutionTime: null,
        },
      ];

      mockOnSnapshot.mockImplementation((query, onNext) => {
        onNext({
          docs: mockDelays.map(delay => ({
            data: () => ({
              lineId: delay.lineId,
              severity: delay.severity,
              affectedStations: delay.affectedStations,
              message: delay.message,
              reportedAt: { toDate: () => delay.reportedAt },
              estimatedResolutionTime: null,
            }),
          })),
        });
        return mockUnsubscribe;
      });

      const unsubscribe = trainService.subscribeToDelayAlerts(['2'], mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            lineId: '2',
            severity: DelaySeverity.MODERATE,
          }),
        ])
      );

      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('getTrainCongestion', () => {
    it('should fetch train congestion data', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            data: () => ({
              trainId: 'train-1',
              carNumber: 1,
              congestionLevel: 'NORMAL',
              lastUpdated: { toDate: () => new Date() },
            }),
          },
        ],
      });

      const result = await trainService.getTrainCongestion('train-1');

      expect(result).toHaveLength(1);
      expect(result[0].trainId).toBe('train-1');
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firebase error'));

      const result = await trainService.getTrainCongestion('train-1');

      expect(result).toEqual([]);
    });
  });

  describe('searchStations', () => {
    it('should search stations by name', async () => {
      mockGetDocs.mockResolvedValue({
        docs: mockStations.map(station => ({
          id: station.id,
          data: () => ({
            name: station.name,
            nameEn: station.nameEn,
            lineId: station.lineId,
            coordinates: station.coordinates,
            transfers: station.transfers,
          }),
        })),
      });

      const result = await trainService.searchStations('강남');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toContain('강남');
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firebase error'));

      const result = await trainService.searchStations('강남');

      expect(result).toEqual([]);
    });
  });

  describe('getNearbyStations', () => {
    it('should return nearby stations within radius', async () => {
      mockGetDocs.mockResolvedValue({
        docs: mockStations.map(station => ({
          id: station.id,
          data: () => ({
            name: station.name,
            nameEn: station.nameEn,
            lineId: station.lineId,
            coordinates: station.coordinates,
            transfers: station.transfers,
          }),
        })),
      });

      const result = await trainService.getNearbyStations(37.5665, 126.978, 2);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firebase error'));

      const result = await trainService.getNearbyStations(37.5665, 126.978, 2);

      expect(result).toEqual([]);
    });
  });

  describe('getStationSchedule', () => {
    it('should fetch station timetable from Seoul API', async () => {
      const mockSchedule = [
        {
          STATION_CD: '0222',
          STATION_NM: '강남',
          ARRIVETIME: '05:30:00',
        },
      ];

      mockSeoulApi.getStationTimetable.mockResolvedValue(mockSchedule);

      const result = await trainService.getStationSchedule('0222', '1', '1');

      expect(result).toEqual(mockSchedule);
      expect(mockSeoulApi.getStationTimetable).toHaveBeenCalledWith('0222', '1', '1');
    });

    it('should return empty array on API error', async () => {
      mockSeoulApi.getStationTimetable.mockRejectedValue(new Error('API error'));

      const result = await trainService.getStationSchedule('0222');

      expect(result).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should cleanup all subscriptions', () => {
      const mockUnsubscribe1 = jest.fn();
      const mockUnsubscribe2 = jest.fn();

      mockOnSnapshot.mockReturnValueOnce(mockUnsubscribe1).mockReturnValueOnce(mockUnsubscribe2);

      trainService.subscribeToTrainUpdates('station1', jest.fn());
      trainService.subscribeToDelayAlerts(['2'], jest.fn());

      trainService.cleanup();

      expect(mockUnsubscribe1).toHaveBeenCalled();
      expect(mockUnsubscribe2).toHaveBeenCalled();
    });
  });
});
