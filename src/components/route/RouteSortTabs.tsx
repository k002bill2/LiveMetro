/**
 * RouteSortTabs — 네이버 스타일 4-way 정렬 세그먼트 (최적/최소시간/최소환승/
 * 최소요금). Generalizes the 2-way DirectionSegment pattern to N options,
 * reusing the Wanted design tokens (bg-subtle track + bg-base active pill).
 *
 * Pure presentational: the screen owns `sortTab` state and re-orders the
 * route list via `sortRoutesByTab(routes, tab)` — no re-search on tab change.
 */
import React, { memo, useCallback } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { Text, TouchableOpacity, View, ViewStyle, TextStyle } from 'react-native';
import { WANTED_TOKENS, typeStyle } from '@/styles/modernTheme';

import type { RouteSortTab } from '@/models/route';

interface RouteSortTabsProps {
  value: RouteSortTab;
  onChange: (next: RouteSortTab) => void;
  testID?: string;
}

const OPTIONS: readonly { value: RouteSortTab; label: string }[] = [
  { value: 'optimal', label: '최적' },
  { value: 'fastest', label: '최소시간' },
  { value: 'min-transfer', label: '최소환승' },
  { value: 'min-fare', label: '최소요금' },
];

const RouteSortTabsImpl: React.FC<RouteSortTabsProps> = ({ value, onChange, testID }) => {
  const semantic = useSemanticTokens();

  const trackStyle: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: semantic.bgSubtle,
    borderRadius: WANTED_TOKENS.radius.r6,
    padding: WANTED_TOKENS.spacing.s1,
    marginBottom: WANTED_TOKENS.spacing.s4,
  };

  const pressOption = useCallback(
    (next: RouteSortTab) => {
      if (next !== value) onChange(next);
    },
    [onChange, value]
  );

  const renderOption = (option: RouteSortTab, label: string): React.ReactElement => {
    const active = value === option;
    const optionStyle: ViewStyle = {
      flex: 1,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      paddingHorizontal: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.r5 - 1,
      backgroundColor: active ? semantic.bgBase : 'transparent',
      alignItems: 'center',
      ...(active
        ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 2,
            elevation: 1,
          }
        : {}),
    };

    const labelStyle: TextStyle = {
      ...typeStyle('label2', '700'),
      color: active ? semantic.labelStrong : semantic.labelAlt,
    };

    return (
      <TouchableOpacity
        key={option}
        testID={testID ? `${testID}-${option}` : undefined}
        onPress={() => pressOption(option)}
        style={optionStyle}
        accessible
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        activeOpacity={0.7}
      >
        <Text style={labelStyle} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View testID={testID} style={trackStyle} accessibilityRole="tablist">
      {OPTIONS.map((o) => renderOption(o.value, o.label))}
    </View>
  );
};

export const RouteSortTabs = memo(RouteSortTabsImpl);
RouteSortTabs.displayName = 'RouteSortTabs';
