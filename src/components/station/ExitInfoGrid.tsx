/**
 * ExitInfoGrid — full-width exit landmark rows (Wanted Design System).
 *
 * White card with subtle border, then one block row per exit. Each row keeps
 * the exit-number badge on `blue-50` + `blue-700` text and comma-joined
 * landmark names beside it.
 */
import React, { memo, useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { Text, View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { WANTED_TOKENS, typeStyle } from '@/styles/modernTheme';

import type { ExitInfo } from '@/models/publicData';

interface ExitInfoGridProps {
  exits: readonly ExitInfo[];
  /** Cap how many exits to render (default: render all). */
  max?: number;
  testID?: string;
}

const ExitInfoGridImpl: React.FC<ExitInfoGridProps> = ({ exits, max, testID }) => {
  const semantic = useSemanticTokens();

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
    ...typeStyle('body2', '600'),
    color: semantic.labelNeutral,
    flexShrink: 1,
    flex: 1,
  };

  return (
    <View testID={testID} style={cardStyle}>
      <View style={styles.list}>
        {visible.map((exit) => {
          const names = exit.landmarks.map((l) => l.landmarkName).join(', ');
          return (
            <View
              key={exit.exitNumber}
              testID={testID ? `${testID}-exit-${exit.exitNumber}` : undefined}
              style={[styles.exitBlock, { backgroundColor: semantic.bgSubtle }]}
            >
              <View style={badgeStyle}>
                <Text style={badgeText}>{exit.exitNumber}</Text>
              </View>
              <Text style={landmarkText}>
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
  list: {
    gap: WANTED_TOKENS.spacing.s2,
  },
  exitBlock: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: WANTED_TOKENS.spacing.s3,
    paddingVertical: WANTED_TOKENS.spacing.s3,
    paddingHorizontal: WANTED_TOKENS.spacing.s3,
    borderRadius: WANTED_TOKENS.radius.r4,
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
