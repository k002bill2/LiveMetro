/**
 * TimePickerCard — Wanted handoff (image 17) commute time selector.
 *
 * Layout:
 *   - Section title + small subtitle ("평일 기준") sit OUTSIDE the card
 *     so the layout matches sibling SettingSection blocks visually.
 *   - Card (subtle gray background) holds a big "HH 시 | MM 분 출발"
 *     display + a chip row of common departure times.
 *
 * The control is chip-only by design — the Wanted spec doesn't surface a
 * freeform time dialog, and the chip set covers ~95% of commute times in
 * 30-minute increments. Custom values via DateTimePicker can be added in
 * a follow-up if user research shows a need.
 *
 * Props:
 *   - value: "HH:MM" — current selected time. If not in `options`, the chip
 *     row falls back to no-active-chip but the big display still shows the
 *     parsed value, so user-set custom times don't visually disappear.
 *   - options: readonly time strings to render as chips. Caller controls
 *     ordering and count.
 *   - onChange: invoked with the picked chip's time. Wrap in saving guard
 *     externally — this component doesn't persist.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';

interface TimePickerCardProps {
  title: string;
  subtitle?: string;
  value: string; // "HH:MM"
  options: readonly string[];
  onChange: (time: string) => void;
  disabled?: boolean;
  testID?: string;
}

const splitHHMM = (hhmm: string): [string, string] => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return ['--', '--'];
  return [m[1]!.padStart(2, '0'), m[2]!];
};

export const TimePickerCard: React.FC<TimePickerCardProps> = ({
  title,
  subtitle,
  value,
  options,
  onChange,
  disabled = false,
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const [hh, mm] = splitHHMM(value);

  return (
    <View style={styles.section} testID={testID}>
      <Text
        style={[
          styles.title,
          { color: semantic.labelStrong, fontFamily: weightToFontFamily('800') },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            { color: semantic.labelAlt, fontFamily: weightToFontFamily('500') },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}

      <View
        style={[
          styles.card,
          {
            backgroundColor: semantic.bgSubtlePage,
            borderColor: semantic.lineSubtle,
          },
        ]}
      >
        {/* Big HH | MM display */}
        <View style={styles.displayRow}>
          <View style={styles.displayCol}>
            <Text
              style={[
                styles.displayDigits,
                {
                  color: semantic.primaryNormal,
                  fontFamily: weightToFontFamily('800'),
                },
              ]}
              testID={`${testID ?? 'time-picker'}-hh`}
            >
              {hh}
            </Text>
            <Text
              style={[
                styles.displayUnit,
                { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
              ]}
            >
              시
            </Text>
          </View>
          <View
            style={[styles.displayDivider, { backgroundColor: semantic.lineNormal }]}
          />
          <View style={styles.displayCol}>
            <Text
              style={[
                styles.displayDigits,
                {
                  color: semantic.primaryNormal,
                  fontFamily: weightToFontFamily('800'),
                },
              ]}
              testID={`${testID ?? 'time-picker'}-mm`}
            >
              {mm}
            </Text>
            <Text
              style={[
                styles.displayUnit,
                { color: semantic.labelAlt, fontFamily: weightToFontFamily('600') },
              ]}
            >
              분 출발
            </Text>
          </View>
        </View>

        {/* Chip row — wraps to multiple lines when count > 4-5 */}
        <View style={styles.chipsWrap}>
          {options.map((opt) => {
            const active = opt === value;
            return (
              <TouchableOpacity
                key={opt}
                testID={`${testID ?? 'time-picker'}-chip-${opt}`}
                onPress={() => onChange(opt)}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled }}
                accessibilityLabel={opt}
                style={[
                  styles.chip,
                  active
                    ? {
                        backgroundColor: semantic.primaryNormal,
                        borderColor: semantic.primaryNormal,
                      }
                    : {
                        backgroundColor: semantic.bgBase,
                        borderColor: semantic.lineNormal,
                      },
                  disabled ? { opacity: 0.5 } : null,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: active ? semantic.labelOnColor : semantic.labelStrong,
                      fontFamily: weightToFontFamily(active ? '800' : '700'),
                    },
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    paddingTop: WANTED_TOKENS.spacing.s4,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: weightToFontFamily('500'),
  },
  card: {
    marginTop: WANTED_TOKENS.spacing.s3,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  displayCol: {
    alignItems: 'center',
    minWidth: 64,
  },
  displayDigits: {
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
    fontWeight: '800',
    fontFamily: weightToFontFamily('800'),
  },
  displayUnit: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: weightToFontFamily('600'),
  },
  displayDivider: {
    width: 1,
    height: 36,
    opacity: 0.6,
  },
  chipsWrap: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
    minWidth: 64,
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
    letterSpacing: -0.1,
  },
});

export default TimePickerCard;
