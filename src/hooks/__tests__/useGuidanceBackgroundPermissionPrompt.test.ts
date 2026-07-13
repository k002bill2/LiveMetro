/**
 * useGuidanceBackgroundPermissionPrompt — decides visibility of the "Always"
 * location nudge on the guidance screen and owns request/dismiss/settings.
 *
 * expo-location, AsyncStorage, locationService, and the background-location task
 * are mocked at their boundaries so each branch is driven deterministically.
 * Platform.OS is mutated per test (reset in afterEach); Linking.openSettings is
 * spied so the deep-link CTA can be asserted.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState, Platform, Linking, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { locationService } from '@/services/location/locationService';
import { startGuidanceBackgroundLocation } from '@/services/guidance/guidanceBackgroundLocationTask';
import {
  useGuidanceBackgroundPermissionPrompt,
  GUIDANCE_BG_PERM_PROMPT_DISMISSED_KEY,
} from '../useGuidanceBackgroundPermissionPrompt';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-location', () => ({
  getBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'undetermined' })),
}));

jest.mock('@/services/location/locationService', () => ({
  locationService: {
    requestBackgroundPermission: jest.fn(() => Promise.resolve(false)),
  },
}));

jest.mock('@/services/guidance/guidanceBackgroundLocationTask', () => ({
  startGuidanceBackgroundLocation: jest.fn(() => Promise.resolve(true)),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetBgPerm = Location.getBackgroundPermissionsAsync as jest.Mock;
const mockRequestBgPerm = locationService.requestBackgroundPermission as jest.Mock;
const mockStartBgLocation = startGuidanceBackgroundLocation as jest.Mock;

describe('useGuidanceBackgroundPermissionPrompt', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'ios';
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockGetBgPerm.mockResolvedValue({ status: 'undetermined' });
    mockRequestBgPerm.mockResolvedValue(false);
    mockStartBgLocation.mockResolvedValue(true);
    jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  });

  afterEach(() => {
    (Platform as { OS: string }).OS = originalOS;
    jest.restoreAllMocks();
  });

  describe('initial visibility', () => {
    it('stays hidden on web', async () => {
      (Platform as { OS: string }).OS = 'web';
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.status).toBe('hidden');
      expect(mockGetItem).not.toHaveBeenCalled();
    });

    it('stays hidden when the user previously dismissed it', async () => {
      mockGetItem.mockResolvedValue(String(Date.now()));
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockGetItem).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
      expect(mockGetBgPerm).not.toHaveBeenCalled();
    });

    it('stays hidden when background permission is already granted', async () => {
      mockGetBgPerm.mockResolvedValue({ status: 'granted' });
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockGetBgPerm).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
    });

    it('shows the prompt when not granted and not dismissed', async () => {
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
    });

    it('stays hidden when the permission check throws', async () => {
      mockGetBgPerm.mockRejectedValue(new Error('permission read failed'));
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockGetBgPerm).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
    });
  });

  describe('requestPermission', () => {
    it('starts background location and hides when permission is granted', async () => {
      mockRequestBgPerm.mockResolvedValue(true);
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(mockStartBgLocation).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('hidden');
    });

    it('switches to settings mode when permission is denied', async () => {
      mockRequestBgPerm.mockResolvedValue(false);
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(mockStartBgLocation).not.toHaveBeenCalled();
      expect(result.current.status).toBe('settings');
    });

    it('hides silently when the request throws', async () => {
      mockRequestBgPerm.mockRejectedValue(new Error('request failed'));
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      await act(async () => {
        await result.current.requestPermission();
      });

      expect(result.current.status).toBe('hidden');
    });
  });

  describe('dismiss', () => {
    it('persists the dismissal and hides', async () => {
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      await act(async () => {
        await result.current.dismiss();
      });

      expect(mockSetItem).toHaveBeenCalledWith(
        GUIDANCE_BG_PERM_PROMPT_DISMISSED_KEY,
        expect.any(String)
      );
      expect(result.current.status).toBe('hidden');
    });

    it('still hides when persisting the dismissal fails', async () => {
      mockSetItem.mockRejectedValue(new Error('storage full'));
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      await act(async () => {
        await result.current.dismiss();
      });

      expect(result.current.status).toBe('hidden');
    });
  });

  describe('openSettings', () => {
    it('deep-links to the OS settings app', async () => {
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));

      act(() => {
        result.current.openSettings();
      });

      expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('re-check on return from Settings (AppState)', () => {
    const spyAppState = (
      remove: jest.Mock
    ): { getHandler: () => ((s: AppStateStatus) => void) | undefined } => {
      let handler: ((s: AppStateStatus) => void) | undefined;
      jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
        handler = cb as unknown as (s: AppStateStatus) => void;
        return { remove } as ReturnType<typeof AppState.addEventListener>;
      });
      return { getHandler: () => handler };
    };

    const goBackgroundThenActive = (
      handler: ((s: AppStateStatus) => void) | undefined
    ): void => {
      handler?.('background');
      handler?.('active');
    };

    it('starts tracking and hides when permission is granted after returning from Settings', async () => {
      mockRequestBgPerm.mockResolvedValue(false); // denial → settings mode
      const { getHandler } = spyAppState(jest.fn());
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
      await act(async () => {
        await result.current.requestPermission();
      });
      expect(result.current.status).toBe('settings');

      // User grants "Always" in Settings and returns to the app.
      mockGetBgPerm.mockResolvedValue({ status: 'granted' });
      await act(async () => {
        goBackgroundThenActive(getHandler());
      });

      await waitFor(() => expect(result.current.status).toBe('hidden'));
      expect(mockStartBgLocation).toHaveBeenCalledTimes(1);
    });

    it('keeps the settings banner when permission is still not granted on return', async () => {
      mockRequestBgPerm.mockResolvedValue(false);
      const { getHandler } = spyAppState(jest.fn());
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
      await act(async () => {
        await result.current.requestPermission();
      });
      expect(result.current.status).toBe('settings');

      mockGetBgPerm.mockResolvedValue({ status: 'denied' });
      await act(async () => {
        goBackgroundThenActive(getHandler());
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockStartBgLocation).not.toHaveBeenCalled();
      expect(result.current.status).toBe('settings');
    });

    it('does not register an AppState listener while hidden', async () => {
      mockGetBgPerm.mockResolvedValue({ status: 'granted' }); // → hidden
      const addSpy = jest.spyOn(AppState, 'addEventListener');
      const { result } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(mockGetBgPerm).toHaveBeenCalled());
      expect(result.current.status).toBe('hidden');
      expect(addSpy).not.toHaveBeenCalled();
    });

    it('removes the AppState listener on unmount', async () => {
      const remove = jest.fn();
      spyAppState(remove);
      const { result, unmount } = renderHook(() => useGuidanceBackgroundPermissionPrompt());
      await waitFor(() => expect(result.current.status).toBe('prompt'));
      unmount();
      expect(remove).toHaveBeenCalled();
    });
  });
});
