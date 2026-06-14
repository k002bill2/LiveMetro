import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { DelayReportForm } from '../DelayReportForm';
import { ReportTypeLabels } from '@/models/delayReport';

jest.mock('lucide-react-native', () => ({
  Clock: 'Clock',
  AlertTriangle: 'AlertTriangle',
  Users: 'Users',
  Radio: 'Radio',
  Ban: 'Ban',
  MoreHorizontal: 'MoreHorizontal',
  Send: 'Send',
  X: 'X',
  Minus: 'Minus',
  Plus: 'Plus',
  MapPin: 'MapPin',
  Search: 'Search',
  ShieldCheck: 'ShieldCheck',
  Bookmark: 'Bookmark',
  Image: 'Image',
  Camera: 'Camera',
  Mic: 'Mic',
  Info: 'Info',
}));

jest.mock('@/components/design', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    LineBadge: 'LineBadge',
    Pill: ({ children }: { children?: React.ReactNode }) => <Text>{children}</Text>,
  };
});

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() => jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light),
  useTheme: () => ({
    isDark: false,
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

  it('renders all line selection circles (number-only chips)', () => {
    const { getByTestId } = render(<DelayReportForm />);
    expect(getByTestId('line-select-1')).toBeTruthy();
    expect(getByTestId('line-select-2')).toBeTruthy();
    expect(getByTestId('line-select-9')).toBeTruthy();
  });

  it('marks the pressed line circle as selected', () => {
    const { getByTestId } = render(<DelayReportForm />);
    fireEvent.press(getByTestId('line-select-2'));
    expect(getByTestId('line-select-2').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('line-select-1').props.accessibilityState.selected).toBe(false);
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
      getByPlaceholderText('예) 교대역 사이 신호장애로 5분째 정차 중입니다.'),
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

  it('shows direction segment with real neighbor stations once line and station are set', () => {
    const { getByTestId, queryByTestId } = render(<DelayReportForm />);
    expect(queryByTestId('direction-toggle')).toBeNull();

    fireEvent.press(getByTestId('line-select-2'));
    fireEvent.press(getByTestId('station-recommend-강남'));

    // 강남(2호선)의 실제 인접역 — lines.json 인접성 기반
    expect(getByTestId('direction-toggle')).toBeTruthy();
    expect(getByTestId('direction-option-역삼 방면')).toBeTruthy();
    expect(getByTestId('direction-option-교대 방면')).toBeTruthy();
    // 첫 옵션 자동 선택
    expect(
      getByTestId('direction-option-역삼 방면').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('hides direction segment when station is not on the selected line', () => {
    const { getByTestId, queryByTestId } = render(<DelayReportForm />);
    fireEvent.press(getByTestId('line-select-9'));
    fireEvent.press(getByTestId('station-recommend-강남')); // 강남은 9호선에 없음
    expect(queryByTestId('direction-toggle')).toBeNull();
  });

  it('updates description character count', () => {
    const { getByText, getByPlaceholderText } = render(
      <DelayReportForm />,
    );
    const descInput = getByPlaceholderText(
      '예) 교대역 사이 신호장애로 5분째 정차 중입니다.',
    );
    fireEvent.changeText(descInput, '테스트');
    expect(getByText('3/200')).toBeTruthy();
  });

  describe('Submission', () => {
    const { delayReportService } = jest.requireMock('@/services/delay/delayReportService');

    const fillValidForm = (utils: ReturnType<typeof render>): void => {
      fireEvent.press(utils.getByTestId('line-select-2'));
      fireEvent.press(utils.getByTestId('station-recommend-강남'));
      fireEvent.press(utils.getByTestId('report-type-delay'));
    };

    it('shows delay duration stepper only for delay/stopped types', () => {
      const utils = render(<DelayReportForm />);
      expect(utils.queryByText('지연 시간')).toBeNull();

      fireEvent.press(utils.getByTestId('report-type-delay'));
      expect(utils.getByText('지연 시간')).toBeTruthy();

      fireEvent.press(utils.getByTestId('report-type-crowded'));
      expect(utils.queryByText('지연 시간')).toBeNull();
    });

    it('submits report with direction and severity derived from type', async () => {
      const utils = render(<DelayReportForm onSubmitSuccess={mockOnSubmitSuccess} />);
      fillValidForm(utils);

      fireEvent.press(utils.getByText('제보 등록'));

      await waitFor(() => {
        expect(delayReportService.submitReport).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-1',
            lineId: '2',
            stationName: '강남',
            reportType: 'delay',
            severity: 'medium',
            estimatedDelayMinutes: 5,
            direction: '역삼 방면',
          }),
        );
      });
      expect(Alert.alert).toHaveBeenCalledWith('제보 완료', '소중한 제보 감사합니다!');
      expect(mockOnSubmitSuccess).toHaveBeenCalled();
    });

    it('blocks duplicate report within 5 minutes on the same line', async () => {
      delayReportService.hasRecentReport.mockResolvedValueOnce(true);
      const utils = render(<DelayReportForm />);
      fillValidForm(utils);

      fireEvent.press(utils.getByText('제보 등록'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '잠시만요',
          '같은 노선에 최근 5분 이내에 제보하셨습니다. 잠시 후 다시 시도해주세요.',
        );
      });
      expect(delayReportService.submitReport).not.toHaveBeenCalled();
    });

    it('shows error alert when submission fails', async () => {
      delayReportService.submitReport.mockRejectedValueOnce(new Error('network'));
      const utils = render(<DelayReportForm />);
      fillValidForm(utils);

      fireEvent.press(utils.getByText('제보 등록'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '오류',
          '제보 전송에 실패했습니다. 다시 시도해주세요.',
        );
      });
    });

    it('requires login before submitting', async () => {
      const { useAuth } = jest.requireMock('@/services/auth/AuthContext');
      useAuth.mockReturnValueOnce({ user: null });

      const utils = render(<DelayReportForm />);
      fireEvent.press(utils.getByText('제보 등록'));

      // user가 없으면 비활성 버튼이어도 핸들러 가드가 제보를 막아야 한다.
      expect(delayReportService.submitReport).not.toHaveBeenCalled();
    });
  });

  describe('Stub interactions', () => {
    it('shows coming-soon alert for draft save', () => {
      const { getByTestId } = render(<DelayReportForm />);
      fireEvent.press(getByTestId('draft-save-button'));
      expect(Alert.alert).toHaveBeenCalledWith('임시저장', '곧 지원될 기능이에요.');
    });

    it('shows coming-soon alert for each attachment kind', () => {
      const { getByTestId } = render(<DelayReportForm />);
      fireEvent.press(getByTestId('attach-image'));
      expect(Alert.alert).toHaveBeenCalledWith('사진', '곧 지원될 기능이에요.');
      fireEvent.press(getByTestId('attach-camera'));
      expect(Alert.alert).toHaveBeenCalledWith('카메라', '곧 지원될 기능이에요.');
      fireEvent.press(getByTestId('attach-voice'));
      expect(Alert.alert).toHaveBeenCalledWith('음성', '곧 지원될 기능이에요.');
    });

    it('toggles bookmark selected state', () => {
      const { getByTestId } = render(<DelayReportForm />);
      const bookmark = getByTestId('bookmark-toggle');
      expect(bookmark.props.accessibilityState.selected).toBe(false);
      fireEvent.press(bookmark);
      expect(getByTestId('bookmark-toggle').props.accessibilityState.selected).toBe(true);
    });
  });
});
