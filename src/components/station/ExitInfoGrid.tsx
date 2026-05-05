/**
 * ExitInfoGrid — 2-column exit landmarks grid (Wanted Design System).
 *
 * Mirrors the design handoff: white card with subtle border, exit-number badge
 * on `blue-50` + `blue-700` text, comma-joined landmark names beside.
 */
import React, { memo, useMemo } from 'react';
import { Text, View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { WANTED_TOKENS, typeStyle } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';
import type { ExitInfo } from '@/models/publicData';

interface ExitInfoGridProps {
  exits: readonly ExitInfo[];
  /** Cap how many exits to render (default: render all). */
  max?: number;
  testID?: string;
}

const ExitInfoGridImpl: React.FC<ExitInfoGridProps> = ({ exits, max, testID }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  const visible = useMemo(
    () => (typeof max === 'number' ? exits.slice(0, max) : exits),
    [exits, max]
  );

  if (visible.length === 0) {
    return (
      <View
        testID={testID ? `${testID}-empty` : undefined}
        style={[styles.card, styles.empty, { backgroundColor: semantic.bgBase, borderColor: semantic.lineSubtle }]}
      >
        <Text style={[styles.emptyText, { color: semantic.labelAlt }]}>
          출구 안내 정보가 없습니다
        </Text>
      </View>
    );
  }

  const cardStyle: ViewStyle = {
    ...styles.card,
    backgroundColor: semantic.bgBase,
    borderColor: semantic.lineSubtle,
  };

  const badgeStyle: ViewStyle = {
    ...styles.badge,
    backgroundColor: WANTED_TOKENS.blue[50],
  };

  const badgeText: TextStyle = {
    ...typeStyle('label2', '800'),
    color: WANTED_TOKENS.blue[700],
  };

  const landmarkText: TextStyle = {
    ...typeStyle('caption1'),
    color: semantic.labelNeutral,
    flexShrink: 1,
  };

  return (
    <View testID={testID} style={cardStyle}>
      <View style={styles.grid}>
        {visible.map((exit) => {
          const names = exit.landmarks.map((l) => l.landmarkName).join(', ');
          return (
            <View key={exit.exitNumber} style={styles.row}>
              <View style={badgeStyle}>
                <Text style={badgeText}>{exit.exitNumber}</Text>
              </View>
              <Text style={landmarkText} numberOfLines={1}>
                {names}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: WANTED_TOKENS.radius.r8,
    borderWidth: 1,
    padding: WANTED_TOKENS.spacing.s4,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: WANTED_TOKENS.spacing.s6,
  },
  emptyText: {
    ...typeStyle('body2'),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  row: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: WANTED_TOKENS.spacing.s2,
    paddingVertical: WANTED_TOKENS.spacing.s1,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: WANTED_TOKENS.radius.r4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const ExitInfoGrid = memo(ExitInfoGridImpl);
ExitInfoGrid.displayName = 'ExitInfoGrid';
