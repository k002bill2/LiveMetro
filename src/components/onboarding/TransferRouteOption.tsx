/**
 * TransferRouteOption — single radio-style card for the onboarding step 2/4
 * "환승역 추천" list.
 *
 * Each option represents either a direct route (no transfer) or a route via
 * a single transfer station. The UI follows the Wanted handoff:
 *  - Active: 2px primaryNormal border, primaryBg-tinted background
 *  - Inactive: 1px lineSubtle border, bgBase background
 *  - Right-side circle indicator (filled when selected, outlined otherwise)
 *  - Optional "추천" pill (primary tone) and "가장 빠름" muted tag
 *
 * Lines are rendered as small numeric badges with line color, with the
 * "↔" connector for transfer routes or zap icon for direct routes.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Zap } from 'lucide-react-native';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { LineBadge } from '@/components/design/LineBadge';
import { Radio } from '@/components/design/Radio';

export interface TransferRouteOptionData {
  readonly id: string;
  readonly label: string; // "직행 (환승 없음)" or transfer station name
  readonly isDirect: boolean;
  readonly fromLineId?: string;
  readonly toLineId?: string;
  // Estimated minutes from the route algorithm. Undefined when the graph
  // can't compute it (e.g. peripheral station without dataset coverage) —
  // the renderer suppresses the "X분" suffix in that case.
  readonly minutes?: number;
  readonly recommended?: boolean;
  readonly fastest?: boolean;
}

interface TransferRouteOptionProps {
  option: TransferRouteOptionData;
  selected: boolean;
  onPress: (id: string) => void;
  isDark: boolean;
}

export const TransferRouteOption: React.FC<TransferRouteOptionProps> = ({
  option,
  selected,
  onPress,
  isDark,
}) => {
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const hasMinutes = typeof option.minutes === 'number' && option.minutes > 0;

  return (
    <TouchableOpacity
      testID={`route-option-${option.id}`}
      onPress={() => onPress(option.id)}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={
        typeof option.minutes === 'number' && option.minutes > 0
          ? `${option.label}, ${option.minutes}분`
          : option.label
      }
      style={[
        styles.row,
        {
          backgroundColor: selected ? semantic.primaryBg : semantic.bgBase,
          borderColor: selected ? semantic.primaryNormal : semantic.lineSubtle,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.leadIcon,
          {
            backgroundColor: option.isDirect
              ? 'rgba(0,191,64,0.14)'
              : 'rgba(0,102,255,0.10)',
          },
        ]}
      >
        {option.isDirect ? (
          <Zap size={16} color={WANTED_TOKENS.status.green500} strokeWidth={2.4} />
        ) : (
          <Text
            style={[
              styles.leadDigit,
              { color: semantic.primaryNormal, fontFamily: weightToFontFamily('800') },
            ]}
          >
            {option.fromLineId ?? '·'}
          </Text>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.title,
              { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') },
            ]}
            numberOfLines={1}
          >
            {option.label}
          </Text>
          {option.recommended ? (
            <View
              style={[
                styles.tag,
                {
                  backgroundColor: isDark
                    ? 'rgba(51,133,255,0.14)'
                    : 'rgba(0,102,255,0.08)',
                },
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  { color: semantic.primaryNormal, fontFamily: weightToFontFamily('800') },
                ]}
              >
                추천
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          {option.isDirect ? (
            <Text
              style={[
                styles.metaMuted,
                { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
              ]}
            >
              {option.fastest && hasMinutes ? '추천 · 가장 빠름 · ' : ''}
              {hasMinutes ? `${option.minutes}분` : '소요 시간 미상'}
            </Text>
          ) : (
            <>
              {option.fromLineId ? (
                <LineBadge line={option.fromLineId} size={14} />
              ) : null}
              <Text
                style={[
                  styles.metaConnector,
                  { color: semantic.labelAlt, fontFamily: weightToFontFamily('700') },
                ]}
              >
                ↔
              </Text>
              {option.toLineId ? (
                <LineBadge line={option.toLineId} size={14} />
              ) : null}
              {hasMinutes ? (
                <Text
                  style={[
                    styles.metaMuted,
                    { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
                  ]}
                >
                  · {option.minutes}분
                </Text>
              ) : null}
            </>
          )}
        </View>
      </View>

      <Radio
        testID={`route-option-${option.id}-radio`}
        selected={selected}
        size="sm"
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 12,
  },
  leadIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadDigit: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    flexShrink: 1,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 10.5,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
    letterSpacing: 0.2,
  },
  metaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaConnector: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  metaMuted: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
});

export default TransferRouteOption;
