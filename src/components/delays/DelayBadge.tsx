/**
 * DelayBadge Component
 * Displays delay time in a red badge (네이버 지도 스타일)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';

interface DelayBadgeProps {
  /** Delay time in minutes */
  delayMinutes: number;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Show clock icon */
  showIcon?: boolean;
}

export const DelayBadge: React.FC<DelayBadgeProps> = ({
  delayMinutes,
  size = 'medium',
  showIcon = false,
}) => {
  const { colors } = useTheme();

  if (delayMinutes <= 0) {
    return null;
  }

  const sizeStyles = {
    small: {
      paddingHorizontal: SPACING.xs,
      paddingVertical: 2,
      fontSize: TYPOGRAPHY.fontSize.xs,
      iconSize: 10,
    },
    medium: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      fontSize: TYPOGRAPHY.fontSize.sm,
      iconSize: 12,
    },
    large: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontSize: TYPOGRAPHY.fontSize.base,
      iconSize: 14,
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.error,
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
        },
      ]}
    >
      {showIcon && (
        <Clock
          size={currentSize.iconSize}
          color="#FFFFFF"
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.text,
          { fontSize: currentSize.fontSize },
        ]}
      >
        +{delayMinutes}분
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default DelayBadge;
