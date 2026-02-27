/**
 * StatsSummaryCard Component Tests
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import StatsSummaryCard from '../StatsSummaryCard';
import type { StatsSummary } from '@/services/statistics/statisticsService';

const baseSummary: StatsSummary = {
  totalTrips: 42,
  totalDelayMinutes: 15,
  avgDelayMinutes: 2.5,
  onTimeRate: 92,
  mostUsedLine: '2호선',
  mostUsedStation: '강남',
  mostDelayedLine: '1호선',
  streakDays: 7,
  lastTripDate: '2026-02-20',
  memberSince: '2025-01-01',
};

describe('StatsSummaryCard', () => {
  it('renders main stats', () => {
    const { getByText } = render(<StatsSummaryCard summary={baseSummary} />);
    expect(getByText('42')).toBeTruthy();
    expect(getByText('92%')).toBeTruthy();
    expect(getByText('7')).toBeTruthy();
    expect(getByText('총 이동')).toBeTruthy();
    expect(getByText('정시율')).toBeTruthy();
  });

  it('renders secondary stats', () => {
    const { getByText } = render(<StatsSummaryCard summary={baseSummary} />);
    expect(getByText('15분')).toBeTruthy();
    expect(getByText('2.5분')).toBeTruthy();
    expect(getByText('총 지연 시간')).toBeTruthy();
    expect(getByText('평균 지연')).toBeTruthy();
  });

  it('renders most used line and most delayed line', () => {
    const { getByText } = render(<StatsSummaryCard summary={baseSummary} />);
    expect(getByText('2호선')).toBeTruthy();
    expect(getByText('1호선')).toBeTruthy();
    expect(getByText('주요 노선')).toBeTruthy();
    expect(getByText('지연 잦은 노선')).toBeTruthy();
  });

  it('renders last trip date', () => {
    const { getByText } = render(<StatsSummaryCard summary={baseSummary} />);
    expect(getByText('마지막 기록: 2026-02-20')).toBeTruthy();
  });

  it('hides optional sections when data is null', () => {
    const summary: StatsSummary = {
      ...baseSummary,
      mostUsedLine: null,
      mostUsedStation: null,
      mostDelayedLine: null,
      lastTripDate: null,
    };
    const { queryByText } = render(<StatsSummaryCard summary={summary} />);
    expect(queryByText('주요 노선')).toBeNull();
    expect(queryByText('마지막 기록:')).toBeNull();
  });

  it('applies correct color for low on-time rate', () => {
    const lowRateSummary: StatsSummary = {
      ...baseSummary,
      onTimeRate: 60,
    };
    const { getByText } = render(<StatsSummaryCard summary={lowRateSummary} />);
    expect(getByText('60%')).toBeTruthy();
  });
});
