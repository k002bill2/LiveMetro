/**
 * usePushRegistration Tests
 */
import { renderHook } from '@testing-library/react-native';
import { useAuth } from '@/services/auth/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { pushTokenService } from '@/services/notification';
import { usePushRegistration } from '../usePushRegistration';

jest.mock('@/services/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useFavorites', () => ({ useFavorites: jest.fn() }));
jest.mock('@/services/notification', () => ({
  pushTokenService: { registerPushToken: jest.fn(), unregisterPushToken: jest.fn() },
}));

describe('usePushRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (pushTokenService.registerPushToken as jest.Mock).mockResolvedValue(undefined);
  });

  it('registers with deduped favorite lineIds when signed in', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' } });
    (useFavorites as jest.Mock).mockReturnValue({
      favorites: [
        { stationId: 's1', lineId: '2' },
        { stationId: 's2', lineId: '2' },
        { stationId: 's3', lineId: '7' },
      ],
    });

    renderHook(() => usePushRegistration());

    expect(pushTokenService.registerPushToken).toHaveBeenCalledWith(
      'user-1',
      expect.arrayContaining(['2', '7']),
    );
    const linesArg = (pushTokenService.registerPushToken as jest.Mock).mock.calls[0][1];
    expect(linesArg).toHaveLength(2); // deduped
  });

  it('does not register when signed out', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    (useFavorites as jest.Mock).mockReturnValue({ favorites: [] });
    renderHook(() => usePushRegistration());
    expect(pushTokenService.registerPushToken).not.toHaveBeenCalled();
  });
});
