import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ReportDetailScreen } from '../ReportDetailScreen';
import { ReportType, ReportSeverity } from '@/models/delayReport';

jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  MoreHorizontal: 'MoreHorizontal',
  MessageSquare: 'MessageSquare',
  MapPin: 'MapPin',
}));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@/services/delay/delayReportService', () => ({
  delayReportService: {
    getLineReports: jest.fn(() => Promise.resolve([])),
  },
}));

jest.mock('@/utils/colorUtils', () => ({
  ...jest.requireActual('@/utils/colorUtils'),
  getSubwayLineColor: jest.fn(() => '#00A84D'),
}));

const baseReport = {
  id: 'r-1',
  userId: 'u-1',
  userDisplayName: '김철수',
  lineId: '2',
  stationId: 's-1',
  stationName: '강남',
  reportType: ReportType.SIGNAL_ISSUE,
  severity: ReportSeverity.HIGH,
  description: '교대역 사이 신호장애로 5분 정차 중',
  estimatedDelayMinutes: 5,
  timestamp: new Date('2026-05-14T14:20:00Z'),
  upvotes: 3,
  upvotedBy: [],
  verified: true,
  active: true,
  updatedAt: new Date(),
};

describe('ReportDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders hero and header', () => {
    const { getByTestId } = render(<ReportDetailScreen report={baseReport} />);
    expect(getByTestId('report-detail-hero')).toBeTruthy();
    expect(getByTestId('report-detail-header-title')).toBeTruthy();
  });

  it('renders credibility meta line', () => {
    const { getByTestId } = render(<ReportDetailScreen report={baseReport} />);
    expect(getByTestId('report-detail-credibility')).toBeTruthy();
  });

  it('renders body text from description', () => {
    const { getByTestId } = render(<ReportDetailScreen report={baseReport} />);
    expect(getByTestId('report-detail-body').props.children).toBe(baseReport.description);
  });

  it('falls back to placeholder when description is empty', () => {
    const { getByTestId } = render(<ReportDetailScreen report={{ ...baseReport, description: '' }} />);
    expect(getByTestId('report-detail-body').props.children).toBe('추가 설명이 없는 제보입니다.');
  });

  it('renders 6 trend ticks', () => {
    const { getByTestId } = render(<ReportDetailScreen report={baseReport} />);
    [0, 1, 2, 3, 4, 5].forEach(i => expect(getByTestId(`trend-tick-${i}`)).toBeTruthy());
  });

  it('renders 4 impact rows', () => {
    const { getByTestId } = render(<ReportDetailScreen report={baseReport} />);
    [0, 1, 2, 3].forEach(i => expect(getByTestId(`impact-row-${i}`)).toBeTruthy());
  });

  it('shows empty hint when related reports list is empty', async () => {
    const { findByTestId } = render(<ReportDetailScreen report={baseReport} />);
    expect(await findByTestId('related-empty')).toBeTruthy();
  });

  it('calls onBack when back button is pressed', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<ReportDetailScreen report={baseReport} onBack={onBack} />);
    fireEvent.press(getByTestId('report-detail-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onOpenFeedback when feedback CTA is pressed', () => {
    const onOpenFeedback = jest.fn();
    const { getByTestId } = render(<ReportDetailScreen report={baseReport} onOpenFeedback={onOpenFeedback} />);
    fireEvent.press(getByTestId('report-detail-open-feedback'));
    expect(onOpenFeedback).toHaveBeenCalledWith(baseReport);
  });
});
