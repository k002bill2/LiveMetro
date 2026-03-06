/**
 * AccessibilitySection Component Tests
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { AccessibilitySection } from '../AccessibilitySection';
import type { AccessibilityInfo } from '@/models/publicData';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
    },
  }),
}));

const mockInfo: AccessibilityInfo = {
  stationCode: 'ST001',
  stationName: '강남',
  lineName: '2호선',
  elevator: { available: true, count: 3, status: 'normal' },
  escalator: { available: true, count: 5, status: 'maintenance' },
  wheelchairLift: true,
  tactilePaving: true,
  accessibleRestroom: false,
};

describe('AccessibilitySection', () => {
  it('renders loading state', () => {
    const { getByText } = render(
      <AccessibilitySection info={null} loading={true} testID="acc-section" />
    );
    expect(getByText('교통약자 정보 로딩 중...')).toBeTruthy();
  });

  it('returns null when info is null and not loading', () => {
    const { toJSON } = render(
      <AccessibilitySection info={null} loading={false} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders facility items with correct labels', () => {
    const { getByText } = render(
      <AccessibilitySection info={mockInfo} testID="acc-section" />
    );
    expect(getByText('교통약자 편의시설')).toBeTruthy();
    expect(getByText('엘리베이터')).toBeTruthy();
    expect(getByText('에스컬레이터')).toBeTruthy();
    expect(getByText('휠체어리프트')).toBeTruthy();
    expect(getByText('점자블록')).toBeTruthy();
    expect(getByText('장애인화장실')).toBeTruthy();
  });

  it('displays facility counts when available', () => {
    const { getByText } = render(
      <AccessibilitySection info={mockInfo} />
    );
    expect(getByText('3대')).toBeTruthy();
    expect(getByText('5대')).toBeTruthy();
  });

  it('renders with all facilities unavailable', () => {
    const noFacilities: AccessibilityInfo = {
      stationCode: 'ST002',
      stationName: '역삼',
      lineName: '2호선',
      elevator: { available: false, count: 0, status: 'normal' },
      escalator: { available: false, count: 0, status: 'normal' },
      wheelchairLift: false,
      tactilePaving: false,
      accessibleRestroom: false,
    };
    const { getByText } = render(
      <AccessibilitySection info={noFacilities} />
    );
    expect(getByText('엘리베이터')).toBeTruthy();
  });
});
