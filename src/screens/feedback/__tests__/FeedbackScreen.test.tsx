import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { FeedbackScreen } from '../FeedbackScreen';
import { FeedbackCategory } from '@/models/feedback';

const mockSubmitFeedback = jest.fn();

jest.mock('lucide-react-native', () => ({
  Star: 'Star',
  X: 'X',
  Send: 'Send',
  Info: 'Info',
}));

jest.mock('@/services/theme', () => ({
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'u-1', email: 'tester@example.com', displayName: 'Tester' },
  })),
}));

jest.mock('@/services/feedback/feedbackService', () => ({
  feedbackService: {
    submitFeedback: (...args: unknown[]) => mockSubmitFeedback(...args),
  },
}));

jest.spyOn(Alert, 'alert');

describe('FeedbackScreen', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmitSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitFeedback.mockResolvedValue('feedback-id');
  });

  it('renders title, rating prompt, and section headers', () => {
    const { getByText, getByTestId } = render(<FeedbackScreen onClose={mockOnClose} />);
    expect(getByTestId('feedback-header-title')).toBeTruthy();
    expect(getByText('LiveMetro는 어떠셨나요?')).toBeTruthy();
    expect(getByText('어떤 점이 좋았/아쉬웠나요?')).toBeTruthy();
    expect(getByText('분류')).toBeTruthy();
  });

  it('renders all 5 star buttons and starts unrated', () => {
    const { getByTestId, queryByTestId } = render(<FeedbackScreen />);
    [1, 2, 3, 4, 5].forEach(n => expect(getByTestId(`feedback-star-${n}`)).toBeTruthy());
    expect(queryByTestId('feedback-rating-label')).toBeNull();
  });

  it('selecting a star shows the rating label', () => {
    const { getByTestId } = render(<FeedbackScreen />);
    fireEvent.press(getByTestId('feedback-star-4'));
    expect(getByTestId('feedback-rating-label').props.children).toBe('좋아요');
  });

  it('renders all 4 category tiles', () => {
    const { getByTestId } = render(<FeedbackScreen />);
    expect(getByTestId(`feedback-category-${FeedbackCategory.BUG}`)).toBeTruthy();
    expect(getByTestId(`feedback-category-${FeedbackCategory.FEATURE}`)).toBeTruthy();
    expect(getByTestId(`feedback-category-${FeedbackCategory.INFO_ERROR}`)).toBeTruthy();
    expect(getByTestId(`feedback-category-${FeedbackCategory.OTHER}`)).toBeTruthy();
  });

  it('renders all 6 tag chips', () => {
    const { getByText } = render(<FeedbackScreen />);
    expect(getByText('예측이 정확해요')).toBeTruthy();
    expect(getByText('디자인이 좋아요')).toBeTruthy();
    expect(getByText('알림이 부정확')).toBeTruthy();
    expect(getByText('느려요')).toBeTruthy();
    expect(getByText('광고 많아요')).toBeTruthy();
    expect(getByText('다크모드')).toBeTruthy();
  });

  it('shows description char count and updates', () => {
    const { getByText, getByTestId } = render(<FeedbackScreen />);
    expect(getByText('0/500')).toBeTruthy();
    fireEvent.changeText(getByTestId('feedback-description-input'), 'hello');
    expect(getByText('5/500')).toBeTruthy();
  });

  it('renders diagnostics toggle defaulted to true and reveals meta', () => {
    const { getByTestId } = render(<FeedbackScreen />);
    expect(getByTestId('feedback-diagnostics-toggle').props.value).toBe(true);
    expect(getByTestId('feedback-diagnostics-meta')).toBeTruthy();
  });

  it('hides diagnostics meta when toggle is off', () => {
    const { getByTestId, queryByTestId } = render(<FeedbackScreen />);
    fireEvent(getByTestId('feedback-diagnostics-toggle'), 'valueChange', false);
    expect(queryByTestId('feedback-diagnostics-meta')).toBeNull();
  });

  it('submit button is disabled until rating and category are picked', () => {
    const { getByTestId } = render(<FeedbackScreen />);
    expect(getByTestId('feedback-submit').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(getByTestId('feedback-star-3'));
    expect(getByTestId('feedback-submit').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(getByTestId(`feedback-category-${FeedbackCategory.BUG}`));
    expect(getByTestId('feedback-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('toggling a tag selects then deselects it', () => {
    const { getByTestId } = render(<FeedbackScreen />);
    const chip = getByTestId('feedback-tag-디자인이 좋아요');
    fireEvent.press(chip);
    expect(chip.props.accessibilityState.selected).toBe(true);
    fireEvent.press(chip);
    expect(chip.props.accessibilityState.selected).toBe(false);
  });

  it('calls submitFeedback with collected inputs and triggers success callback', async () => {
    const { getByTestId } = render(
      <FeedbackScreen onClose={mockOnClose} onSubmitSuccess={mockOnSubmitSuccess} />,
    );

    fireEvent.press(getByTestId('feedback-star-5'));
    fireEvent.press(getByTestId(`feedback-category-${FeedbackCategory.FEATURE}`));
    fireEvent.press(getByTestId('feedback-tag-디자인이 좋아요'));
    fireEvent.changeText(getByTestId('feedback-description-input'), '좋은 앱이에요');

    fireEvent.press(getByTestId('feedback-submit'));

    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledTimes(1);
    });

    const [input, ctx] = mockSubmitFeedback.mock.calls[0]!;
    expect(input).toMatchObject({
      rating: 5,
      category: FeedbackCategory.FEATURE,
      tags: ['디자인이 좋아요'],
      description: '좋은 앱이에요',
      includeDiagnostics: true,
    });
    expect(input.diagnostics).toMatchObject({ appVersion: '1.0.0' });
    expect(ctx).toEqual({ userId: 'u-1', userEmail: 'tester@example.com' });

    await waitFor(() => {
      expect(mockOnSubmitSuccess).toHaveBeenCalled();
    });
  });

  it('handles submission failure with alert and resets submitting state', async () => {
    mockSubmitFeedback.mockRejectedValueOnce(new Error('network down'));
    const { getByTestId } = render(<FeedbackScreen />);

    fireEvent.press(getByTestId('feedback-star-3'));
    fireEvent.press(getByTestId(`feedback-category-${FeedbackCategory.BUG}`));
    fireEvent.press(getByTestId('feedback-submit'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('오류', expect.stringContaining('실패'));
    });
    expect(getByTestId('feedback-submit').props.accessibilityState.disabled).toBe(false);
  });

  it('calls onClose when close button is pressed', () => {
    const { getByTestId } = render(<FeedbackScreen onClose={mockOnClose} />);
    fireEvent.press(getByTestId('feedback-close'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
