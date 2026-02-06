/**
 * OnboardingContext Tests
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingProvider, useOnboarding } from '../OnboardingContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const createWrapper = (userId: string | undefined) => {
  return ({ children }: { children: React.ReactNode }) => (
    <OnboardingProvider userId={userId}>{children}</OnboardingProvider>
  );
};

describe('OnboardingContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('should throw when used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    expect(() => {
      renderHook(() => useOnboarding());
    }).toThrow('useOnboarding must be used within an OnboardingProvider');
    consoleSpy.mockRestore();
  });

  it('should initialize with null when no userId', async () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(undefined),
    });

    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false);
    });

    expect(result.current.hasCompletedOnboarding).toBeNull();
  });

  it('should check onboarding status on mount', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper('user123'),
    });

    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false);
    });

    expect(result.current.hasCompletedOnboarding).toBe(true);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(
      '@livemetro/onboarding_complete_user123'
    );
  });

  it('should set false when no saved status', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper('user123'),
    });

    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false);
    });

    expect(result.current.hasCompletedOnboarding).toBe(false);
  });

  it('should complete onboarding', async () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper('user123'),
    });

    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false);
    });

    await act(async () => {
      await result.current.completeOnboarding();
    });

    expect(result.current.hasCompletedOnboarding).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@livemetro/onboarding_complete_user123',
      'true'
    );
  });

  it('should skip onboarding', async () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper('user123'),
    });

    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false);
    });

    await act(async () => {
      await result.current.skipOnboarding();
    });

    expect(result.current.hasCompletedOnboarding).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@livemetro/onboarding_complete_user123',
      'true'
    );
  });

  it('should reset onboarding', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper('user123'),
    });

    await waitFor(() => {
      expect(result.current.hasCompletedOnboarding).toBe(true);
    });

    await act(async () => {
      await result.current.resetOnboarding();
    });

    expect(result.current.hasCompletedOnboarding).toBe(false);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      '@livemetro/onboarding_complete_user123'
    );
  });

  it('should not call storage methods without userId', async () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper(undefined),
    });

    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false);
    });

    await act(async () => {
      await result.current.completeOnboarding();
    });

    // setItem should not be called (only getItem from initialization check)
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.skipOnboarding();
    });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.resetOnboarding();
    });

    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it('should handle storage error on status check', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Read error'));

    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper('user123'),
    });

    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false);
    });

    expect(result.current.hasCompletedOnboarding).toBe(false);
    consoleSpy.mockRestore();
  });

  it('should handle storage error on complete', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Write error'));

    const { result } = renderHook(() => useOnboarding(), {
      wrapper: createWrapper('user123'),
    });

    await waitFor(() => {
      expect(result.current.isCheckingStatus).toBe(false);
    });

    await act(async () => {
      await result.current.completeOnboarding();
    });

    // Should not crash
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
