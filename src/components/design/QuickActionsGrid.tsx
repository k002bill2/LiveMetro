/**
 * QuickActionsGrid — 4-button quick-action grid for the redesigned HomeScreen.
 *
 * Mirrors main.jsx HomeScreen lines 71–88: equal-width tiles in one row,
 * each with a centered Lucide icon above a short Korean label.
 */
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS } from '@/styles/modernTheme';

export interface QuickAction {
  /** Stable id for keying & testID */
  id: string;
  Icon: LucideIcon;
  label: string;
  onPress?: () => void;
}

interface QuickActionsGridProps {
  actions: QuickAction[];
  testID?: string;
}

const QuickActionsGridImpl: React.FC<QuickActionsGridProps> = ({ actions, testID }) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  return (
    <View testID={testID ?? 'quick-actions-grid'} style={styles.row}>
      {actions.map((action) => {
        const { Icon } = action;
        return (
          <Pressable
            key={action.id}
            testID={`quick-action-${action.id}`}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: semantic.bgBase,
                borderColor: semantic.lineSubtle,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Icon size={20} color={semantic.labelNeutral} strokeWidth={1.8} />
            <Text style={[styles.label, { color: semantic.labelNeutral }]}>{action.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const QuickActionsGrid = memo(QuickActionsGridImpl);
QuickActionsGrid.displayName = 'QuickActionsGrid';

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
});
