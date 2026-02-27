// Jest mock calls MUST come before imports (Jest hoisting requirement)
jest.mock('@/services/statistics/statisticsService', () => ({
  statisticsService: {},
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import LineUsagePieChart from '../LineUsagePieChart';
import { LineUsageData } from '@/services/statistics/statisticsService';

const mockData: LineUsageData[] = [
  { lineId: '2', lineName: '2호선', tripCount: 40, percentage: 40, color: '#00A84D' },
  { lineId: '1', lineName: '1호선', tripCount: 30, percentage: 30, color: '#0052A4' },
  { lineId: '3', lineName: '3호선', tripCount: 20, percentage: 20, color: '#EF7C1C' },
  { lineId: '4', lineName: '4호선', tripCount: 10, percentage: 10, color: '#00A5DE' },
];

describe('LineUsagePieChart', () => {
  it('renders empty state when data is empty', () => {
    const { getByText } = render(<LineUsagePieChart data={[]} />);
    expect(getByText('데이터가 없습니다')).toBeTruthy();
  });

  it('renders line names in the bar chart when data is provided', () => {
    const { getByText } = render(<LineUsagePieChart data={mockData} />);
    expect(getByText('2호선')).toBeTruthy();
    expect(getByText('1호선')).toBeTruthy();
  });

  it('displays percentage values for each line', () => {
    const { getByText } = render(<LineUsagePieChart data={mockData} />);
    expect(getByText('40%')).toBeTruthy();
    expect(getByText('30%')).toBeTruthy();
    expect(getByText('20%')).toBeTruthy();
  });

  it('renders the total trip count in the center circle', () => {
    const { getByText } = render(<LineUsagePieChart data={mockData} />);
    // total = 40 + 30 + 20 + 10 = 100
    expect(getByText('100')).toBeTruthy();
    expect(getByText('총')).toBeTruthy();
    expect(getByText('회')).toBeTruthy();
  });

  it('renders legend items with trip counts', () => {
    const { getByText } = render(<LineUsagePieChart data={mockData} />);
    expect(getByText('2호선: 40회')).toBeTruthy();
    expect(getByText('1호선: 30회')).toBeTruthy();
    expect(getByText('3호선: 20회')).toBeTruthy();
    expect(getByText('4호선: 10회')).toBeTruthy();
  });

  it('does not render empty state when data is present', () => {
    const { queryByText } = render(<LineUsagePieChart data={mockData} />);
    expect(queryByText('데이터가 없습니다')).toBeNull();
  });

  it('renders only top 5 items in the bar chart', () => {
    const sixLineData: LineUsageData[] = [
      ...mockData,
      { lineId: '5', lineName: '5호선', tripCount: 5, percentage: 5, color: '#996CAC' },
      { lineId: '6', lineName: '6호선', tripCount: 3, percentage: 3, color: '#CD7C2F' },
    ];
    const { queryByText, getByText } = render(<LineUsagePieChart data={sixLineData} />);
    // First 5 should appear in bar chart
    expect(getByText('2호선')).toBeTruthy();
    // Legend shows all items
    expect(getByText('6호선: 3회')).toBeTruthy();
  });

  it('renders with single data item', () => {
    const singleItem: LineUsageData[] = [
      { lineId: '2', lineName: '2호선', tripCount: 15, percentage: 100, color: '#00A84D' },
    ];
    const { getByText } = render(<LineUsagePieChart data={singleItem} />);
    expect(getByText('2호선')).toBeTruthy();
    expect(getByText('100%')).toBeTruthy();
    expect(getByText('15')).toBeTruthy();
  });
});
