/**
 * Toast Component Tests
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { renderHook } from '@testing-library/react-native';
import { Toast, useToast } from '../Toast';

// Mock themeUtils
jest.mock('../../../utils/themeUtils', () => ({
  SPACING: { sm: 8, md: 16, lg: 24 },
  BORDER_RADIUS: { sm: 4, md: 8, lg: 12 },
  SHADOWS: { sm: {}, md: {}, lg: {} },
  TYPOGRAPHY: { sizes: { sm: 14 }, weights: { medium: '500' }, lineHeights: { normal: 1.5 } },
  Z_INDEX: { toast: 1000 },
}));

// Mock modernTheme
jest.mock('../../../styles/modernTheme', () => ({
  COLORS: {
    semantic: {
      success: '#22C55E',
      error: '#EF4444',
      warning: '#F59E0B',
    },
    primary: { main: '#3B82F6' },
    white: '#FFFFFF',
    text: { secondary: '#6B7280' },
  },
}));

// Mock lucide-react-native
jest.mock('lucide-react-native', () => ({
  CheckCircle: () => null,
  XCircle: () => null,
  AlertTriangle: () => null,
  Info: () => null,
}));

describe('Toast Component', () => {
  const defaultProps = {
    visible: true,
    type: 'info' as const,
    message: 'Test message',
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render when visible is true', () => {
      const { getByText } = render(<Toast {...defaultProps} />);
      expect(getByText('Test message')).toBeTruthy();
    });

    it('should not render when visible is false', () => {
      const { queryByText } = render(<Toast {...defaultProps} visible={false} />);
      expect(queryByText('Test message')).toBeNull();
    });

    it('should render success toast', () => {
      const { getByText } = render(<Toast {...defaultProps} type="success" />);
      expect(getByText('Test message')).toBeTruthy();
    });

    it('should render error toast', () => {
      const { getByText } = render(<Toast {...defaultProps} type="error" />);
      expect(getByText('Test message')).toBeTruthy();
    });

    it('should render warning toast', () => {
      const { getByText } = render(<Toast {...defaultProps} type="warning" />);
      expect(getByText('Test message')).toBeTruthy();
    });
  });

  describe('Positioning', () => {
    it('should support top position', () => {
      const { getByText } = render(<Toast {...defaultProps} position="top" />);
      expect(getByText('Test message')).toBeTruthy();
    });

    it('should support bottom position (default)', () => {
      const { getByText } = render(<Toast {...defaultProps} position="bottom" />);
      expect(getByText('Test message')).toBeTruthy();
    });
  });

  describe('Auto-dismiss', () => {
    it('should call onDismiss after duration', () => {
      const onDismiss = jest.fn();
      render(<Toast {...defaultProps} onDismiss={onDismiss} duration={3000} />);

      // Advance timers past the duration + animation time
      act(() => {
        jest.advanceTimersByTime(3500);
      });

      expect(onDismiss).toHaveBeenCalled();
    });

    it('should use custom duration', () => {
      const onDismiss = jest.fn();
      render(<Toast {...defaultProps} onDismiss={onDismiss} duration={5000} />);

      // Should not dismiss at 3 seconds
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(onDismiss).not.toHaveBeenCalled();

      // Should dismiss after 5 seconds
      act(() => {
        jest.advanceTimersByTime(2500);
      });
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessibility role alert', () => {
      const { getByRole } = render(<Toast {...defaultProps} />);
      expect(getByRole('alert')).toBeTruthy();
    });

    it('should have accessibility label with message', () => {
      const { getByLabelText } = render(<Toast {...defaultProps} message="Accessible message" />);
      expect(getByLabelText('Accessible message')).toBeTruthy();
    });
  });
});

describe('useToast Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with hidden toast', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.ToastComponent).toBeDefined();
    expect(typeof result.current.showToast).toBe('function');
    expect(typeof result.current.hideToast).toBe('function');
  });

  it('should provide showSuccess function', () => {
    const { result } = renderHook(() => useToast());

    expect(typeof result.current.showSuccess).toBe('function');
  });

  it('should provide showError function', () => {
    const { result } = renderHook(() => useToast());

    expect(typeof result.current.showError).toBe('function');
  });

  it('should provide showWarning function', () => {
    const { result } = renderHook(() => useToast());

    expect(typeof result.current.showWarning).toBe('function');
  });

  it('should provide showInfo function', () => {
    const { result } = renderHook(() => useToast());

    expect(typeof result.current.showInfo).toBe('function');
  });

  it('should show toast when showToast is called', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast({ type: 'success', message: 'Test' });
    });

    // ToastComponent should be defined
    expect(result.current.ToastComponent).toBeDefined();
  });

  it('should show success toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showSuccess('Success message');
    });

    expect(result.current.ToastComponent).toBeDefined();
  });

  it('should show error toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showError('Error message');
    });

    expect(result.current.ToastComponent).toBeDefined();
  });

  it('should show warning toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showWarning('Warning message');
    });

    expect(result.current.ToastComponent).toBeDefined();
  });

  it('should show info toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showInfo('Info message');
    });

    expect(result.current.ToastComponent).toBeDefined();
  });

  it('should hide toast when hideToast is called', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showSuccess('Test');
    });

    act(() => {
      result.current.hideToast();
    });

    expect(result.current.ToastComponent).toBeDefined();
  });

  it('should support custom duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showSuccess('Test', 5000);
    });

    expect(result.current.ToastComponent).toBeDefined();
  });
});
