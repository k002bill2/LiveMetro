/**
 * ExitInfoSection Component Tests
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { ExitInfoSection } from '../ExitInfoSection';
import type { ExitInfo } from '@/models/publicData';

jest.mock('@/services/theme/themeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
    },
  }),
}));

describe('ExitInfoSection', () => {
  it('renders loading state', () => {
    const { getByText } = render(
      <ExitInfoSection exitInfo={[]} loading={true} testID="exit-section" />
    );
    expect(getByText('출구 정보 로딩 중...')).toBeTruthy();
  });

  it('renders empty state when no exit info', () => {
    const { getByText } = render(
      <ExitInfoSection exitInfo={[]} loading={false} testID="exit-section" />
    );
    expect(getByText('출구 정보')).toBeTruthy();
    expect(getByText('출구 정보가 없습니다')).toBeTruthy();
  });

  it('renders exit info with landmarks', () => {
    const exits: ExitInfo[] = [
      {
        exitNumber: '1',
        landmarks: [
          {
            stationCode: 'ST001',
            stationName: '강남',
            lineNum: '2',
            exitNumber: '1',
            landmarkName: '강남역 CGV',
            category: 'culture',
          },
          {
            stationCode: 'ST001',
            stationName: '강남',
            lineNum: '2',
            exitNumber: '1',
            landmarkName: '강남세브란스',
            category: 'hospital',
          },
        ],
      },
      {
        exitNumber: '2',
        landmarks: [],
      },
    ];

    const { getByText } = render(
      <ExitInfoSection exitInfo={exits} loading={false} testID="exit-section" />
    );
    expect(getByText('출구 정보')).toBeTruthy();
    expect(getByText('2개')).toBeTruthy();
    expect(getByText('강남역 CGV')).toBeTruthy();
    expect(getByText('강남세브란스')).toBeTruthy();
  });

  it('renders exit with no landmarks showing fallback text', () => {
    const exits: ExitInfo[] = [
      {
        exitNumber: '3',
        landmarks: [],
      },
    ];

    const { getByText } = render(
      <ExitInfoSection exitInfo={exits} loading={false} />
    );
    expect(getByText('주요 장소 정보 없음')).toBeTruthy();
  });

  it('groups landmarks by category', () => {
    const exits: ExitInfo[] = [
      {
        exitNumber: '1',
        landmarks: [
          {
            stationCode: 'ST001',
            stationName: '강남',
            lineNum: '2',
            exitNumber: '1',
            landmarkName: '서울병원',
            category: 'hospital',
          },
          {
            stationCode: 'ST001',
            stationName: '강남',
            lineNum: '2',
            exitNumber: '1',
            landmarkName: '강남병원',
            category: 'hospital',
          },
        ],
      },
    ];

    const { getByText } = render(
      <ExitInfoSection exitInfo={exits} loading={false} />
    );
    expect(getByText('서울병원, 강남병원')).toBeTruthy();
  });
});
