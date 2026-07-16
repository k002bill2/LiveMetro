/**
 * useAppleAuthAvailability hook tests.
 *
 * The hook delegates to isAppleSignInAvailable (mocked at the service boundary,
 * so no native dynamic import is involved) and guards against setting state
 * after unmount. Covers resolve-true, resolve-false, reject, and the
 * unmount-before-resolve safety path.
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';

import { useAppleAuthAvailability } from '@/hooks/useAppleAuthAvailability';
import { isAppleSignInAvailable } from '@/services/auth/social/appleSignIn';

jest.mock('@/services/auth/social/appleSignIn', () => ({
  __esModule: true,
  isAppleSignInAvailable: jest.fn(),
}));

const mockIsAvailable = isAppleSignInAvailable as jest.Mock;

describe('useAppleAuthAvailability', () => {
  beforeEach(() => {
    mockIsAvailable.mockReset();
  });

  it('resolves to true when Apple sign-in is available', async () => {
    mockIsAvailable.mockResolvedValue(true);

    const { result } = renderHook(() => useAppleAuthAvailability());

    expect(result.current).toBe(false); // false until the async check settles
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays false when Apple sign-in is unavailable', async () => {
    mockIsAvailable.mockResolvedValue(false);

    const { result } = renderHook(() => useAppleAuthAvailability());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockIsAvailable).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(false);
  });

  it('stays false when the availability check rejects', async () => {
    mockIsAvailable.mockRejectedValue(new Error('availability check failed'));

    const { result } = renderHook(() => useAppleAuthAvailability());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(false);
  });

  it('does not update state (or log) when it resolves after unmount', async () => {
    let resolveAvailability: (value: boolean) => void = () => {};
    mockIsAvailable.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveAvailability = resolve;
      }),
    );
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() => useAppleAuthAvailability());
    unmount();

    await act(async () => {
      resolveAvailability(true);
      await Promise.resolve();
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
