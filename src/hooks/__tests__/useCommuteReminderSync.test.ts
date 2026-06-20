/**
 * useCommuteReminderSync Tests
 */
import { renderHook } from '@testing-library/react-native';
import { useAuth } from '@/services/auth/AuthContext';
import { useFirestoreMorningCommute } from '@/hooks/useFirestoreMorningCommute';
import { commuteReminderService } from '@/services/notification';
import { useCommuteReminderSync } from '../useCommuteReminderSync';

jest.mock('@/services/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useFirestoreMorningCommute', () => ({ useFirestoreMorningCommute: jest.fn() }));
jest.mock('@/services/notification', () => ({
  commuteReminderService: { reconcileCommuteReminders: jest.fn() },
}));

describe('useCommuteReminderSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (commuteReminderService.reconcileCommuteReminders as jest.Mock).mockResolvedValue(undefined);
  });

  it('reconciles on mount with the user intent (enabled + departureTime + activeDays)', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'user-1',
        preferences: {
          commuteSchedule: { alertEnabled: true, activeDays: [true, true, true, true, true, false, false] },
        },
      },
    });
    (useFirestoreMorningCommute as jest.Mock).mockReturnValue({ departureTime: '08:00', stationId: 's1' });

    renderHook(() => useCommuteReminderSync());

    expect(commuteReminderService.reconcileCommuteReminders).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        alertEnabled: true,
        departureTime: '08:00',
        activeDays: expect.any(Array),
      }),
    );
  });

  it('does not reconcile when signed out', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    (useFirestoreMorningCommute as jest.Mock).mockReturnValue(null);

    renderHook(() => useCommuteReminderSync());

    expect(commuteReminderService.reconcileCommuteReminders).not.toHaveBeenCalled();
  });

  it('reconciles with alertEnabled=false (→ cancel path) when the toggle is off', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'user-1',
        preferences: {
          commuteSchedule: { alertEnabled: false, activeDays: [true, true, true, true, true, false, false] },
        },
      },
    });
    (useFirestoreMorningCommute as jest.Mock).mockReturnValue({ departureTime: '08:00' });

    renderHook(() => useCommuteReminderSync());

    expect(commuteReminderService.reconcileCommuteReminders).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ alertEnabled: false }),
    );
  });
});
