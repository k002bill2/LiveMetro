import {
  scheduleBoardingAlert,
  cancelBoardingAlert,
} from '../boardingAlertService';
import { notificationService } from '../notificationService';

// notificationService는 expo-notifications를 감싸므로 통째로 mock —
// boardingAlertService의 오케스트레이션(권한 게이트 + dedup)만 검증한다.
jest.mock('../notificationService', () => ({
  notificationService: {
    requestPermissions: jest.fn(),
    scheduleArrivalAlert: jest.fn(),
    cancelNotification: jest.fn(),
  },
}));

const mockNotif = notificationService as jest.Mocked<typeof notificationService>;

const arrival = new Date('2026-05-19T11:05:00.000Z');

describe('boardingAlertService', () => {
  beforeEach(async () => {
    mockNotif.cancelNotification.mockResolvedValue(undefined);
    // 이전 테스트의 모듈 레벨 lastId 잔재 제거
    await cancelBoardingAlert();
    jest.clearAllMocks();
    mockNotif.requestPermissions.mockResolvedValue({ granted: true } as Awaited<
      ReturnType<typeof notificationService.requestPermissions>
    >);
    mockNotif.scheduleArrivalAlert.mockResolvedValue('alert-id');
    mockNotif.cancelNotification.mockResolvedValue(undefined);
  });

  it('returns null and does not schedule when arrivalTime is null', async () => {
    const id = await scheduleBoardingAlert({
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: null,
    });
    expect(id).toBeNull();
    expect(mockNotif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('returns null and does not schedule when permission is denied', async () => {
    mockNotif.requestPermissions.mockResolvedValue({ granted: false } as Awaited<
      ReturnType<typeof notificationService.requestPermissions>
    >);
    const id = await scheduleBoardingAlert({
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
    });
    expect(id).toBeNull();
    expect(mockNotif.scheduleArrivalAlert).not.toHaveBeenCalled();
  });

  it('schedules with station/destination copy when permission is granted', async () => {
    const id = await scheduleBoardingAlert({
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
    });
    expect(id).toBe('alert-id');
    expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledWith(
      arrival,
      expect.objectContaining({
        secondsBefore: 30,
        title: expect.stringContaining('잠실'),
        body: expect.stringContaining('강남'),
        data: expect.objectContaining({ stationName: '강남', finalDestination: '잠실' }),
      })
    );
  });

  it('honors a custom secondsBefore', async () => {
    await scheduleBoardingAlert({
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
      secondsBefore: 60,
    });
    expect(mockNotif.scheduleArrivalAlert).toHaveBeenCalledWith(
      arrival,
      expect.objectContaining({ secondsBefore: 60 })
    );
  });

  it('cancels the previously scheduled boarding alert before scheduling a new one', async () => {
    mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('first-id');
    await scheduleBoardingAlert({ stationName: '강남', finalDestination: '잠실', arrivalTime: arrival });
    // 첫 예약 시점엔 취소할 이전 알림 없음
    expect(mockNotif.cancelNotification).not.toHaveBeenCalled();

    mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('second-id');
    await scheduleBoardingAlert({ stationName: '강남', finalDestination: '성수', arrivalTime: arrival });
    // 두 번째 예약 전, 첫 알림(first-id)을 취소
    expect(mockNotif.cancelNotification).toHaveBeenCalledWith('first-id');
  });

  it('cancelBoardingAlert cancels the tracked id once and is a no-op afterwards', async () => {
    mockNotif.scheduleArrivalAlert.mockResolvedValueOnce('tracked-id');
    await scheduleBoardingAlert({ stationName: '강남', finalDestination: '잠실', arrivalTime: arrival });

    await cancelBoardingAlert();
    expect(mockNotif.cancelNotification).toHaveBeenCalledWith('tracked-id');

    mockNotif.cancelNotification.mockClear();
    await cancelBoardingAlert();
    expect(mockNotif.cancelNotification).not.toHaveBeenCalled();
  });

  it('returns null when scheduling rejects (never throws to caller)', async () => {
    mockNotif.scheduleArrivalAlert.mockRejectedValue(new Error('boom'));
    const id = await scheduleBoardingAlert({
      stationName: '강남',
      finalDestination: '잠실',
      arrivalTime: arrival,
    });
    expect(id).toBeNull();
  });
});
