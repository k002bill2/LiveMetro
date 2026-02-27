jest.mock('lucide-react-native', () => ({
  Users: 'Users',
  AlertTriangle: 'AlertTriangle',
}));

jest.mock('@/models/congestion', () => ({
  CongestionLevel: {
    COMFORTABLE: 'COMFORTABLE',
    NORMAL: 'NORMAL',
    CROWDED: 'CROWDED',
  },
  getCongestionLevelName: (level: string): string => {
    const names: Record<string, string> = {
      COMFORTABLE: '여유',
      NORMAL: '보통',
      CROWDED: '혼잡',
    };
    return names[level] || '알 수 없음';
  },
  getCongestionLevelColor: (level: string): string => {
    const colors: Record<string, string> = {
      COMFORTABLE: '#34C759',
      NORMAL: '#FF9500',
      CROWDED: '#FF3B30',
    };
    return colors[level] || '#8E8E93';
  },
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CongestionBadge, CongestionDot, CongestionInline } from '../CongestionBadge';
import { CongestionLevel } from '@/models/congestion';

describe('CongestionBadge', () => {
  it('renders congestion level name', () => {
    const { getByText } = render(
      <CongestionBadge level={CongestionLevel.COMFORTABLE} />,
    );
    expect(getByText('여유')).toBeTruthy();
  });

  it('renders custom label when provided', () => {
    const { getByText } = render(
      <CongestionBadge level={CongestionLevel.NORMAL} label="커스텀" />,
    );
    expect(getByText('커스텀')).toBeTruthy();
  });

  it('renders CROWDED level', () => {
    const { getByText } = render(
      <CongestionBadge level={CongestionLevel.CROWDED} />,
    );
    expect(getByText('혼잡')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <CongestionBadge level={CongestionLevel.NORMAL} onPress={onPress} />,
    );
    fireEvent.press(getByText('보통'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without onPress (no TouchableOpacity wrapper)', () => {
    const { getByText } = render(
      <CongestionBadge level={CongestionLevel.NORMAL} />,
    );
    expect(getByText('보통')).toBeTruthy();
  });
});

describe('CongestionDot', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(
      <CongestionDot level={CongestionLevel.COMFORTABLE} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom size', () => {
    const { toJSON } = render(
      <CongestionDot level={CongestionLevel.NORMAL} size={12} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});

describe('CongestionInline', () => {
  it('renders congestion level text', () => {
    const { getByText } = render(
      <CongestionInline level={CongestionLevel.CROWDED} />,
    );
    expect(getByText('혼잡')).toBeTruthy();
  });

  it('renders COMFORTABLE level text', () => {
    const { getByText } = render(
      <CongestionInline level={CongestionLevel.COMFORTABLE} />,
    );
    expect(getByText('여유')).toBeTruthy();
  });
});
