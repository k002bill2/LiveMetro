/**
 * CongestionBadge Component
 * Simple badge showing congestion level
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Users, AlertTriangle } from 'lucide-react-native';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import {
  CongestionLevel,
  getCongestionLevelName,
  getCongestionLevelColor,
} from '@/models/congestion';

// ============================================================================
// Types
// ============================================================================

interface CongestionBadgeProps {
  /** Congestion level to display */
  level: CongestionLevel;
  /** Optional label text override */
  label?: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Show icon */
  showIcon?: boolean;
  /** Called when badge is pressed */
  onPress?: () => void;
  /** Style overrides */
  style?: ViewStyle;
  /** Outlined variant */
  outlined?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const CongestionBadge: React.FC<CongestionBadgeProps> = ({
  level,
  label,
  size = 'medium',
  showIcon = true,
  onPress,
  style,
  outlined = false,
}) => {
  const congestionColor = getCongestionLevelColor(level);
  const displayLabel = label || getCongestionLevelName(level);
  const isCrowded = level === CongestionLevel.CROWDED;

  // Size-specific styles
  const sizeStyles = {
    small: {
      paddingHorizontal: SPACING.xs,
      paddingVertical: 2,
      iconSize: 10,
      fontSize: TYPOGRAPHY.fontSize.xs,
    },
    medium: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      iconSize: 12,
      fontSize: TYPOGRAPHY.fontSize.xs,
    },
    large: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      iconSize: 14,
      fontSize: TYPOGRAPHY.fontSize.sm,
    },
  };

  const currentSize = sizeStyles[size];

  const content = (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
          backgroundColor: outlined ? 'transparent' : congestionColor,
          borderColor: congestionColor,
          borderWidth: outlined ? 1 : 0,
        },
        style,
      ]}
    >
      {showIcon && (
        isCrowded ? (
          <AlertTriangle
            size={currentSize.iconSize}
            color={outlined ? congestionColor : '#FFFFFF'}
          />
        ) : (
          <Users
            size={currentSize.iconSize}
            color={outlined ? congestionColor : '#FFFFFF'}
          />
        )
      )}
      <Text
        style={[
          styles.label,
          {
            fontSize: currentSize.fontSize,
            color: outlined ? congestionColor : '#FFFFFF',
          },
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

// ============================================================================
// Compact Badge Variant
// ============================================================================

interface CongestionDotProps {
  /** Congestion level to display */
  level: CongestionLevel;
  /** Size in pixels */
  size?: number;
  /** Style overrides */
  style?: ViewStyle;
}

/**
 * Simple dot indicator for congestion level
 */
export const CongestionDot: React.FC<CongestionDotProps> = ({
  level,
  size = 8,
  style,
}) => {
  const congestionColor = getCongestionLevelColor(level);

  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: congestionColor,
        },
        style,
      ]}
    />
  );
};

// ============================================================================
// Inline Badge Variant
// ============================================================================

interface CongestionInlineProps {
  /** Congestion level to display */
  level: CongestionLevel;
  /** Style overrides */
  style?: ViewStyle;
}

/**
 * Inline text display for congestion level
 */
export const CongestionInline: React.FC<CongestionInlineProps> = ({
  level,
  style,
}) => {
  const congestionColor = getCongestionLevelColor(level);
  const displayLabel = getCongestionLevelName(level);

  return (
    <View style={[styles.inlineContainer, style]}>
      <View
        style={[
          styles.inlineDot,
          { backgroundColor: congestionColor },
        ]}
      />
      <Text style={[styles.inlineText, { color: congestionColor }]}>
        {displayLabel}
      </Text>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.sm,
  },
  label: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold as '600',
  },
  dot: {},
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  inlineText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.medium as '500',
  },
});

export default CongestionBadge;
