/**
 * CurrentLocationMapScreen tests — renders the schematic subway map with the
 * user's current station highlighted, and stays honest when location is
 * unavailable (map still shown, no fake highlight).
 *
 * SubwayMapView is mocked to a stub that surfaces selectedStation via its
 * accessibilityLabel so we can assert what the screen passes.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { useCurrentStationId } from '@hooks/useCurrentStationId';
import CurrentLocationMapScreen from '../CurrentLocationMapScreen';

jest.mock('@hooks/useCurrentStationId', () => ({ useCurrentStationId: jest.fn() }));
jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() =>
    jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light,
  ),
}));
jest.mock('@components/map', () => {
  const ReactRef = require('react');
  const { View } = require('react-native');
  return {
    SubwayMapView: (props: { selectedStation?: string; initialScale?: number }) =>
      ReactRef.createElement(View, {
        testID: 'subway-map-view',
        accessibilityLabel: props.selectedStation ?? 'none',
        initialScale: props.initialScale,
      }),
  };
});

const mockUseCurrent = useCurrentStationId as jest.Mock;

describe('CurrentLocationMapScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the current station header and highlights it when located', () => {
    mockUseCurrent.mockReturnValue({
      currentStationId: 'gangnam',
      currentStationName: '강남',
      distanceM: 120,
      status: 'located',
    });
    const { getByTestId, getByText } = render(<CurrentLocationMapScreen />);
    expect(getByTestId('subway-map-view').props.accessibilityLabel).toBe('gangnam');
    expect(getByTestId('subway-map-view').props.initialScale).toBe(2.2);
    expect(getByText(/강남/)).toBeTruthy();
  });

  it('renders the map without a highlight and an honest message when unavailable', () => {
    mockUseCurrent.mockReturnValue({
      currentStationId: null,
      currentStationName: null,
      distanceM: null,
      status: 'unavailable',
    });
    const { getByTestId, getByText } = render(<CurrentLocationMapScreen />);
    expect(getByTestId('subway-map-view').props.accessibilityLabel).toBe('none');
    expect(getByText('위치를 확인할 수 없어요')).toBeTruthy();
  });

  it('shows a locating state while resolving position', () => {
    mockUseCurrent.mockReturnValue({
      currentStationId: null,
      currentStationName: null,
      distanceM: null,
      status: 'locating',
    });
    const { getByText } = render(<CurrentLocationMapScreen />);
    expect(getByText('위치 확인 중…')).toBeTruthy();
  });
});
