/**
 * nearbySearchPreference Test Suite
 * 자동 주변 역 검색 preference — 기본값/저장/구독/오류 폴백
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getNearbyAutoSearchEnabled,
  setNearbyAutoSearchEnabled,
  subscribeNearbyAutoSearch,
  __resetNearbySearchPreferenceForTests,
} from '../nearbySearchPreference';

describe('nearbySearchPreference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetNearbySearchPreferenceForTests();
  });

  it('defaults to true when nothing is stored', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    await expect(getNearbyAutoSearchEnabled()).resolves.toBe(true);
  });

  it('reads a stored false value', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('false');

    await expect(getNearbyAutoSearchEnabled()).resolves.toBe(false);
  });

  it('caches the value after first read (single storage hit)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');

    await getNearbyAutoSearchEnabled();
    await getNearbyAutoSearchEnabled();

    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
  });

  it('persists and returns the new value after set', async () => {
    await setNearbyAutoSearchEnabled(false);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@livemetro:nearby_auto_search',
      'false',
    );
    await expect(getNearbyAutoSearchEnabled()).resolves.toBe(false);
  });

  it('notifies subscribers on change and stops after unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeNearbyAutoSearch(listener);

    await setNearbyAutoSearchEnabled(false);
    expect(listener).toHaveBeenCalledWith(false);

    unsubscribe();
    await setNearbyAutoSearchEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('falls back to default true when storage read fails', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    await expect(getNearbyAutoSearchEnabled()).resolves.toBe(true);
  });

  it('keeps the in-memory value when storage write fails', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));

    await setNearbyAutoSearchEnabled(false);

    await expect(getNearbyAutoSearchEnabled()).resolves.toBe(false);
  });
});
