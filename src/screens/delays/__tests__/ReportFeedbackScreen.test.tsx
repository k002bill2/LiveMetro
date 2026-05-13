import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ReportFeedbackScreen } from '../ReportFeedbackScreen';
import { ReportType, ReportSeverity } from '@/models/delayReport';

const mockListComments = jest.fn();
const mockAddComment = jest.fn();
const mockSetReaction = jest.fn();
const mockClearReaction = jest.fn();

jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  Bell: 'Bell',
  Send: 'Send',
}));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'u-me', displayName: '나' },
  })),
}));

jest.mock('@/services/delay/reportCommentService', () => ({
  reportCommentService: {
    listComments: (...args: unknown[]) => mockListComments(...args),
    addComment: (...args: unknown[]) => mockAddComment(...args),
    toggleCommentLike: jest.fn(),
  },
}));

jest.mock('@/services/delay/delayReportService', () => ({
  delayReportService: {
    setReaction: (...args: unknown[]) => mockSetReaction(...args),
    clearReaction: (...args: unknown[]) => mockClearReaction(...args),
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
  description: '교대역 사이 신호장애',
  estimatedDelayMinutes: 5,
  timestamp: new Date('2026-05-14T14:20:00Z'),
  upvotes: 3,
  upvotedBy: [],
  verified: true,
  active: true,
  updatedAt: new Date(),
  reactions: { helped: 23, same: 14, recovered: 6, differ: 2 },
  reactedBy: {},
  commentCount: 0,
};

describe('ReportFeedbackScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListComments.mockResolvedValue([]);
    mockAddComment.mockResolvedValue('c-new');
    mockSetReaction.mockResolvedValue(undefined);
    mockClearReaction.mockResolvedValue(undefined);
  });

  it('renders header and summary', () => {
    const { getByTestId } = render(<ReportFeedbackScreen report={baseReport} />);
    expect(getByTestId('feedback-header-title')).toBeTruthy();
    expect(getByTestId('feedback-summary')).toBeTruthy();
  });

  it('renders total participants from reactions', () => {
    const { getByTestId } = render(<ReportFeedbackScreen report={baseReport} />);
    const total = getByTestId('feedback-total-participants');
    expect(total.props.children.join('')).toContain('45');
  });

  it('renders 4 reaction bar segments + tiles', () => {
    const { getByTestId } = render(<ReportFeedbackScreen report={baseReport} />);
    ['helped', 'same', 'recovered', 'differ'].forEach(k => {
      expect(getByTestId(`reaction-bar-${k}`)).toBeTruthy();
      expect(getByTestId(`reaction-tile-${k}`)).toBeTruthy();
    });
  });

  it('shows empty hint when comments list is empty', async () => {
    const { findByTestId } = render(<ReportFeedbackScreen report={baseReport} />);
    expect(await findByTestId('comments-empty')).toBeTruthy();
  });

  it('calls setReaction with previousKind=null when first tap', async () => {
    const { getByTestId } = render(<ReportFeedbackScreen report={baseReport} />);
    fireEvent.press(getByTestId('reaction-tile-helped'));
    await waitFor(() => expect(mockSetReaction).toHaveBeenCalled());
    expect(mockSetReaction).toHaveBeenCalledWith('r-1', 'u-me', null, 'helped');
  });

  it('calls clearReaction when same tile is tapped twice', async () => {
    const { getByTestId } = render(<ReportFeedbackScreen report={baseReport} />);
    fireEvent.press(getByTestId('reaction-tile-helped'));
    await waitFor(() => expect(mockSetReaction).toHaveBeenCalled());
    fireEvent.press(getByTestId('reaction-tile-helped'));
    await waitFor(() => expect(mockClearReaction).toHaveBeenCalled());
    expect(mockClearReaction).toHaveBeenCalledWith('r-1', 'u-me', 'helped');
  });

  it('switches reaction passing previousKind', async () => {
    const { getByTestId } = render(<ReportFeedbackScreen report={baseReport} />);
    fireEvent.press(getByTestId('reaction-tile-helped'));
    await waitFor(() => expect(mockSetReaction).toHaveBeenCalledTimes(1));
    fireEvent.press(getByTestId('reaction-tile-recovered'));
    await waitFor(() => expect(mockSetReaction).toHaveBeenCalledTimes(2));
    expect(mockSetReaction.mock.calls[1]).toEqual(['r-1', 'u-me', 'helped', 'recovered']);
  });

  it('changes comment sort when sort chip is tapped', async () => {
    const { getByTestId } = render(<ReportFeedbackScreen report={baseReport} />);
    await waitFor(() => expect(mockListComments).toHaveBeenCalledWith('r-1', 'newest'));
    fireEvent.press(getByTestId('comments-sort-popular'));
    await waitFor(() => expect(mockListComments).toHaveBeenCalledWith('r-1', 'popular'));
  });

  it('submits a new comment', async () => {
    const { getByTestId } = render(<ReportFeedbackScreen report={baseReport} />);
    fireEvent.changeText(getByTestId('comment-input'), '저도 그래요');
    fireEvent.press(getByTestId('comment-submit'));
    await waitFor(() => expect(mockAddComment).toHaveBeenCalled());
    expect(mockAddComment.mock.calls[0]![0]).toMatchObject({
      reportId: 'r-1',
      userId: 'u-me',
      text: '저도 그래요',
    });
  });

  it('disables comment submit when input is empty', () => {
    const { getByTestId } = render(<ReportFeedbackScreen report={baseReport} />);
    const submit = getByTestId('comment-submit');
    expect(submit.props.accessibilityState?.disabled ?? false).toBe(true);
  });

  it('calls onBack when back button is pressed', () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<ReportFeedbackScreen report={baseReport} onBack={onBack} />);
    fireEvent.press(getByTestId('feedback-back'));
    expect(onBack).toHaveBeenCalled();
  });
});
