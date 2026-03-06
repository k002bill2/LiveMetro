import React from 'react';
import { render } from '@testing-library/react-native';
import WeeklyStatsChart from '../WeeklyStatsChart';
import { ChartDataPoint } from '@/services/statistics/statisticsService';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Dimensions.get = () => ({ width: 400, height: 800 });
  return RN;
});

describe('WeeklyStatsChart', () => {
  it('renders empty state when data is empty', () => {
    const { getByText } = render(<WeeklyStatsChart data={[]} />);
    expect(getByText('데이터가 부족합니다')).toBeTruthy();
  });

  it('renders bars with data points', () => {
    const data: ChartDataPoint[] = [
      { x: '월', y: 95 },
      { x: '화', y: 85 },
      { x: '수', y: 60 },
    ];
    const { getByText } = render(<WeeklyStatsChart data={data} />);
    expect(getByText('95%')).toBeTruthy();
    expect(getByText('85%')).toBeTruthy();
    expect(getByText('60%')).toBeTruthy();
  });

  it('renders x-axis labels', () => {
    const data: ChartDataPoint[] = [
      { x: '월', y: 90 },
      { x: '화', y: 80 },
    ];
    const { getByText } = render(<WeeklyStatsChart data={data} />);
    expect(getByText('월')).toBeTruthy();
    expect(getByText('화')).toBeTruthy();
  });

  it('renders y-axis labels', () => {
    const data: ChartDataPoint[] = [{ x: '월', y: 90 }];
    const { getByText } = render(<WeeklyStatsChart data={data} />);
    expect(getByText('100%')).toBeTruthy();
    expect(getByText('50%')).toBeTruthy();
    expect(getByText('0%')).toBeTruthy();
  });

  it('renders legend items', () => {
    const data: ChartDataPoint[] = [{ x: '월', y: 90 }];
    const { getByText } = render(<WeeklyStatsChart data={data} />);
    expect(getByText('90%+')).toBeTruthy();
    expect(getByText('70-89%')).toBeTruthy();
  });

  it('renders sub-labels when provided', () => {
    const data: ChartDataPoint[] = [
      { x: '월', y: 90, label: '1/1' },
    ];
    const { getByText } = render(<WeeklyStatsChart data={data} />);
    expect(getByText('1/1')).toBeTruthy();
  });
});
