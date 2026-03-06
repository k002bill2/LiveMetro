import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CongestionBadge, CongestionDot, CongestionInline } from '../CongestionBadge';
import { CongestionLevel } from '@/models/congestion';

jest.mock('lucide-react-native', () => ({
  Users: 'Users',
  AlertTriangle: 'AlertTriangle',
}));

jest.mock('@/models/congestion', () => ({
  CongestionLevel: {
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
    CROWDED: 'crowded',
  },
  getCongestionLevelName: (level: string): string => {
    const names: Record<string, string> = {
      low: '여유',
      moderate: '보통',
      high: '혼잡',
      crowded: '매우 혼잡',
    };
    return names[level] || '알 수 없음';
  },
  getCongestionLevelColor: (level: string): string => {
    const colors: Record<string, string> = {
      low: '#34C759',
      moderate: '#FF9500',
      high: '#FF3B30',
      crowded: '#8B0000',
    };
    return colors[level] || '#8E8E93';
  },
}));

describe('CongestionBadge', () => {
  it('renders congestion level name', () => {
    const { getByText } = render(
      <CongestionBadge level={CongestionLevel.LOW} />,
    );
    expect(getByText('여유')).toBeTruthy();
  });

  it('renders custom label when provided', () => {
    const { getByText } = render(
      <CongestionBadge level={CongestionLevel.MODERATE} label="커스텀" />,
    );
    expect(getByText('커스텀')).toBeTruthy();
  });

  it('renders CROWDED level', () => {
    const { getByText } = render(
      <CongestionBadge level={CongestionLevel.CROWDED} />,
    );
    expect(getByText('매우 혼잡')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <CongestionBadge level={CongestionLevel.MODERATE} onPress={onPress} />,
    );
    fireEvent.press(getByText('보통'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without onPress (no TouchableOpacity wrapper)', () => {
    const { getByText } = render(
      <CongestionBadge level={CongestionLevel.MODERATE} />,
    );
    expect(getByText('보통')).toBeTruthy();
  });
});

describe('CongestionDot', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(
      <CongestionDot level={CongestionLevel.LOW} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with custom size', () => {
    const { toJSON } = render(
      <CongestionDot level={CongestionLevel.MODERATE} size={12} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});

describe('CongestionInline', () => {
  it('renders congestion level text', () => {
    const { getByText } = render(
      <CongestionInline level={CongestionLevel.CROWDED} />,
    );
    expect(getByText('매우 혼잡')).toBeTruthy();
  });

  it('renders LOW level text', () => {
    const { getByText } = render(
      <CongestionInline level={CongestionLevel.LOW} />,
    );
    expect(getByText('여유')).toBeTruthy();
  });
});
