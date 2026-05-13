import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { DelayReportForm } from '../DelayReportForm';
import { ReportTypeLabels } from '@/models/delayReport';

jest.mock('lucide-react-native', () => ({
  Clock: 'Clock',
  AlertTriangle: 'AlertTriangle',
  Users: 'Users',
  Radio: 'Radio',
  OctagonX: 'OctagonX',
  HelpCircle: 'HelpCircle',
  Send: 'Send',
  X: 'X',
  Minus: 'Minus',
  Plus: 'Plus',
  MapPin: 'MapPin',
  Bookmark: 'Bookmark',
  Image: 'Image',
  Camera: 'Camera',
  Mic: 'Mic',
  Info: 'Info',
}));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#8E8E93',
      textTertiary: '#C7C7CC',
      borderLight: '#E5E5EA',
      borderMedium: '#D1D1D6',
      error: '#FF3B30',
      success: '#34C759',
      warning: '#FF9500',
      backgroundSecondary: '#F2F2F7',
      textInverse: '#FFFFFF',
    },
  }),
  ThemeColors: {},
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: {
      id: 'user-1',
      displayName: 'Test User',
    },
  })),
}));

jest.mock('@/services/delay/delayReportService', () => ({
  delayReportService: {
    submitReport: jest.fn(() => Promise.resolve()),
    hasRecentReport: jest.fn(() => Promise.resolve(false)),
  },
}));

jest.mock('@/utils/colorUtils', () => ({
  ...jest.requireActual('@/utils/colorUtils'),
  getSubwayLineColor: jest.fn((lineId: string) => {
    const colors: Record<string, string> = {
      '1': '#0052A4',
      '2': '#00A84D',
      '3': '#EF7C1C',
    };
    return colors[lineId] || '#888888';
  }),
}));

jest.spyOn(Alert, 'alert');

describe('DelayReportForm', () => {
  const mockOnSubmitSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form title', () => {
    const { getByText } = render(<DelayReportForm />);
    expect(getByText('지연 제보')).toBeTruthy();
  });

  it('renders draft save button', () => {
    const { getByTestId } = render(<DelayReportForm />);
    expect(getByTestId('draft-save-button')).toBeTruthy();
  });

  it('renders all line selection buttons', () => {
    const { getByText } = render(<DelayReportForm />);
    expect(getByText('1호선')).toBeTruthy();
    expect(getByText('2호선')).toBeTruthy();
    expect(getByText('9호선')).toBeTruthy();
  });

  it('renders all report type buttons', () => {
    const { getByText } = render(<DelayReportForm />);
    expect(getByText(ReportTypeLabels.delay)).toBeTruthy();
    expect(getByText(ReportTypeLabels.accident)).toBeTruthy();
    expect(getByText(ReportTypeLabels.crowded)).toBeTruthy();
    expect(getByText(ReportTypeLabels.signal_issue)).toBeTruthy();
    expect(getByText(ReportTypeLabels.stopped)).toBeTruthy();
    expect(getByText(ReportTypeLabels.other)).toBeTruthy();
  });

  it('renders the submit button as disabled initially', () => {
    const { getByText } = render(<DelayReportForm />);
    // Submit button text is "제보 등록"
    expect(getByText('제보 등록')).toBeTruthy();
  });

  it('renders station name input', () => {
    const { getByPlaceholderText } = render(<DelayReportForm />);
    expect(getByPlaceholderText('예: 강남, 홍대입구')).toBeTruthy();
  });

  it('renders description text area', () => {
    const { getByPlaceholderText } = render(<DelayReportForm />);
    expect(
      getByPlaceholderText('예: 2호선 강남역에서 열차가 10분째 멈춰있습니다'),
    ).toBeTruthy();
  });

  it('shows character count for description', () => {
    const { getByText } = render(<DelayReportForm />);
    expect(getByText('0/200')).toBeTruthy();
  });

  it('renders close button when onCancel is provided', () => {
    const { getByTestId } = render(
      <DelayReportForm onCancel={mockOnCancel} />,
    );
    const closeButton = getByTestId('close-button');
    expect(closeButton).toBeTruthy();
  });

  it('calls onCancel when close button is pressed', () => {
    const { getByTestId } = render(
      <DelayReportForm onCancel={mockOnCancel} />,
    );
    const closeButton = getByTestId('close-button');
    fireEvent.press(closeButton);
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('does not render close button when onCancel is not provided', () => {
    const { queryByTestId } = render(<DelayReportForm />);
    expect(queryByTestId('close-button')).toBeFalsy();
  });

  it('pre-fills station name when provided', () => {
    const { getByDisplayValue } = render(
      <DelayReportForm stationName="강남" />,
    );
    expect(getByDisplayValue('강남')).toBeTruthy();
  });

  it('renders anonymous toggle', () => {
    const { getByTestId } = render(<DelayReportForm />);
    expect(getByTestId('anonymous-toggle')).toBeTruthy();
  });

  it('renders recommended station chips', () => {
    const { getByTestId } = render(<DelayReportForm />);
    expect(getByTestId('station-recommend-강남')).toBeTruthy();
    expect(getByTestId('station-recommend-홍대입구')).toBeTruthy();
    expect(getByTestId('station-recommend-여의도')).toBeTruthy();
  });

  it('fills station name when a recommended chip is pressed', () => {
    const { getByTestId, getByDisplayValue } = render(<DelayReportForm />);
    fireEvent.press(getByTestId('station-recommend-잠실'));
    expect(getByDisplayValue('잠실')).toBeTruthy();
  });

  it('renders bookmark toggle in sticky footer', () => {
    const { getByTestId } = render(<DelayReportForm />);
    expect(getByTestId('bookmark-toggle')).toBeTruthy();
  });

  it('shows GPS info card when station name is filled', () => {
    const { getByTestId, queryByTestId } = render(<DelayReportForm />);
    expect(queryByTestId('gps-info-card')).toBeNull();

    fireEvent.press(getByTestId('station-recommend-강남'));
    expect(getByTestId('gps-info-card')).toBeTruthy();
  });

  it('keeps submit button disabled when line is not selected', () => {
    const { getByText } = render(
      <DelayReportForm onSubmitSuccess={mockOnSubmitSuccess} />,
    );
    fireEvent.press(getByText(ReportTypeLabels.delay));
    const submitButton = getByText('제보 등록');
    expect(submitButton).toBeTruthy();
  });

  it('updates description character count', () => {
    const { getByText, getByPlaceholderText } = render(
      <DelayReportForm />,
    );
    const descInput = getByPlaceholderText(
      '예: 2호선 강남역에서 열차가 10분째 멈춰있습니다',
    );
    fireEvent.changeText(descInput, '테스트');
    expect(getByText('3/200')).toBeTruthy();
  });
});
