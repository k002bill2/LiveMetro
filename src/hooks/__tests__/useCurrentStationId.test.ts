/**
 * useCurrentStationId tests — maps useNearbyStations.closestStation into a
 * SubwayMapView-compatible internal slug + an honest location status.
 */
import { renderHook } from '@testing-library/react-native';
import { useNearbyStations } from '@hooks/useNearbyStations';
import { resolveInternalStationId } from '@utils/stationIdResolver';
import { useCurrentStationId } from '../useCurrentStationId';

jest.mock('@hooks/useNearbyStations', () => ({ useNearbyStations: jest.fn() }));
jest.mock('@utils/stationIdResolver', () => ({
  resolveInternalStationId: jest.fn((id?: string | null) => id ?? null),
}));

const mockNearby = useNearbyStations as jest.Mock;
const mockResolve = resolveInternalStationId as jest.Mock;
const base = { loading: false, error: null, hasLocation: true, refresh: jest.fn() };

describe('useCurrentStationId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockImplementation((id?: string | null) => id ?? null);
  });

  it('returns located + resolved slug when a closest station exists', () => {
    mockNearby.mockReturnValue({
      ...base,
      closestStation: { id: 'gangnam', name: '강남', distance: 120 },
    });
    const { result } = renderHook(() => useCurrentStationId());
    expect(result.current.status).toBe('located');
    expect(result.current.currentStationId).toBe('gangnam');
    expect(result.current.currentStationName).toBe('강남');
    expect(result.current.distanceM).toBe(120);
  });

  it('is locating while the nearby search is loading', () => {
    mockNearby.mockReturnValue({ ...base, loading: true, hasLocation: false, closestStation: null });
    const { result } = renderHook(() => useCurrentStationId());
    expect(result.current.status).toBe('locating');
  });

  it('is unavailable when there is no location and no closest station', () => {
    mockNearby.mockReturnValue({ ...base, hasLocation: false, closestStation: null });
    const { result } = renderHook(() => useCurrentStationId());
    expect(result.current.status).toBe('unavailable');
    expect(result.current.currentStationId).toBeNull();
  });

  it('returns a null station id (but keeps the name) when the id cannot be resolved', () => {
    mockResolve.mockReturnValue(null);
    mockNearby.mockReturnValue({
      ...base,
      closestStation: { id: '0222', name: '강남', distance: 50 },
    });
    const { result } = renderHook(() => useCurrentStationId());
    expect(result.current.currentStationId).toBeNull();
    expect(result.current.currentStationName).toBe('강남');
  });

  it('triggers a location refresh once on mount (ungated)', () => {
    const refresh = jest.fn();
    mockNearby.mockReturnValue({
      ...base,
      refresh,
      closestStation: null,
      hasLocation: false,
      loading: true,
    });
    renderHook(() => useCurrentStationId());
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
