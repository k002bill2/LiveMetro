/**
 * DelayStatsChart Component Tests
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import DelayStatsChart from '../DelayStatsChart';
import type { ChartDataPoint } from '@/services/statistics/statisticsService';

describe('DelayStatsChart', () => {
  it('renders empty state when no data', () => {
    const { getByText } = render(<DelayStatsChart data={[]} />);
    expect(getByText('데이터가 부족합니다')).toBeTruthy();
  });

  it('renders chart with data points', () => {
    const data: ChartDataPoint[] = [
      { x: '월', y: 2.5 },
      { x: '화', y: 5.0 },
      { x: '수', y: 8.0 },
    ];
    const { getByText } = render(<DelayStatsChart data={data} />);
    expect(getByText('2.5')).toBeTruthy();
    expect(getByText('5.0')).toBeTruthy();
    expect(getByText('8.0')).toBeTruthy();
    expect(getByText('월')).toBeTruthy();
    expect(getByText('화')).toBeTruthy();
    expect(getByText('수')).toBeTruthy();
  });

  it('renders summary with average and max', () => {
    const data: ChartDataPoint[] = [
      { x: '월', y: 2.0 },
      { x: '화', y: 4.0 },
      { x: '수', y: 6.0 },
    ];
    const { getByText } = render(<DelayStatsChart data={data} />);
    expect(getByText('평균: 4.0분')).toBeTruthy();
    expect(getByText('최대: 6.0분')).toBeTruthy();
  });

  it('renders legend items', () => {
    const data: ChartDataPoint[] = [{ x: '월', y: 1.0 }];
    const { getByText } = render(<DelayStatsChart data={data} />);
    expect(getByText('0-3분')).toBeTruthy();
    expect(getByText('4-7분')).toBeTruthy();
    expect(getByText('7분+')).toBeTruthy();
  });

  it('handles zero values correctly', () => {
    const data: ChartDataPoint[] = [
      { x: '월', y: 0 },
      { x: '화', y: 3.0 },
    ];
    const { getByText, queryByText } = render(<DelayStatsChart data={data} />);
    expect(getByText('3.0')).toBeTruthy();
    // Zero value bars do not show value text
    expect(queryByText('0.0')).toBeNull();
  });
});
