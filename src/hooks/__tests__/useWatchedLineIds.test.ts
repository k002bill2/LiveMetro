/**
 * useWatchedLineIds tests — derives the set of subway line ids the user cares
 * about (from favorites) for the foreground delay monitor to watch.
 */
import { renderHook } from '@testing-library/react-native';
import { useFavorites } from '@hooks/useFavorites';
import { useWatchedLineIds } from '../useWatchedLineIds';

jest.mock('@hooks/useFavorites', () => ({ useFavorites: jest.fn() }));
const mockUseFavorites = useFavorites as jest.Mock;

describe('useWatchedLineIds', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns unique, sorted line ids from favorites', () => {
    mockUseFavorites.mockReturnValue({
      favoritesWithDetails: [{ lineId: '2' }, { lineId: '4' }, { lineId: '2' }],
    });
    const { result } = renderHook(() => useWatchedLineIds());
    expect(result.current).toEqual(['2', '4']);
  });

  it('returns an empty array when there are no favorites', () => {
    mockUseFavorites.mockReturnValue({ favoritesWithDetails: [] });
    const { result } = renderHook(() => useWatchedLineIds());
    expect(result.current).toEqual([]);
  });

  it('skips favorites without a lineId', () => {
    mockUseFavorites.mockReturnValue({
      favoritesWithDetails: [{ lineId: '2' }, { lineId: undefined }, { lineId: '' }],
    });
    const { result } = renderHook(() => useWatchedLineIds());
    expect(result.current).toEqual(['2']);
  });
});
