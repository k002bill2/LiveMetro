/**
 * TimePickerCard — Wanted handoff (image 17) commute time selector.
 *
 * Layout:
 *   - Section title + small subtitle ("평일 기준") sit OUTSIDE the card
 *     so the layout matches sibling SettingSection blocks visually.
 *   - Card (subtle gray background) holds a big "HH 시 | MM 분 출발"
 *     display + a chip row of common departure times.
 *
 * The large HH/MM display is directly adjustable with compact steppers:
 * hour changes in 1-hour steps and minute changes in 1-minute steps. Preset
 * chips remain as quick picks for common commute times.
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
import React, { useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

import { WANTED_TOKENS, weightToFontFamily } from '@/styles/modernTheme';

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
  const parsed = parseHHMM(hhmm);
  if (!parsed) return ['--', '--'];
  return [String(parsed.hour).padStart(2, '0'), String(parsed.minute).padStart(2, '0')];
};

const parseHHMM = (hhmm: string): { hour: number; minute: number } | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

const formatTotalMinutes = (totalMinutes: number): string => {
  const minutesInDay = 24 * 60;
  const wrapped = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const shiftTime = (hhmm: string, deltaMinutes: number): string => {
  const parsed = parseHHMM(hhmm) ?? { hour: 0, minute: 0 };
  return formatTotalMinutes(parsed.hour * 60 + parsed.minute + deltaMinutes);
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
  const semantic = useSemanticTokens();
  const [hh, mm] = splitHHMM(value);
  const baseTestID = testID ?? 'time-picker';

  // Memoize the per-chip color variants (keyed on theme) so the chip row does
  // not allocate fresh style objects for every chip on each parent re-render.
  const chipVariants = useMemo(
    () => ({
      activeContainer: { backgroundColor: semantic.primaryNormal, borderColor: semantic.primaryNormal },
      inactiveContainer: { backgroundColor: semantic.bgBase, borderColor: semantic.lineNormal },
      activeText: { color: semantic.labelOnColor, fontFamily: weightToFontFamily('800') },
      inactiveText: { color: semantic.labelStrong, fontFamily: weightToFontFamily('700') },
    }),
    [semantic]
  );

  const stepperStyle = [
    styles.stepperButton,
    { backgroundColor: semantic.bgBase, borderColor: semantic.lineNormal },
    disabled ? styles.stepperButtonDisabled : null,
  ];
  const stepperIconColor = disabled ? semantic.labelAlt : semantic.primaryNormal;

  const adjustHour = (delta: 1 | -1): void => {
    onChange(shiftTime(value, delta * 60));
  };

  const adjustMinute = (delta: 1 | -1): void => {
    onChange(shiftTime(value, delta));
  };

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
              testID={`${baseTestID}-hh`}
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
              testID={`${baseTestID}-mm`}
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

        <View style={styles.stepperRow}>
          <View style={styles.stepperGroup}>
            <TouchableOpacity
              testID={`${baseTestID}-hour-decrement`}
              onPress={() => adjustHour(-1)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${title} 시간 1시간 감소`}
              accessibilityState={{ disabled }}
              hitSlop={8}
              style={stepperStyle}
            >
              <Minus size={16} color={stepperIconColor} strokeWidth={2.6} />
            </TouchableOpacity>
            <TouchableOpacity
              testID={`${baseTestID}-hour-increment`}
              onPress={() => adjustHour(1)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${title} 시간 1시간 증가`}
              accessibilityState={{ disabled }}
              hitSlop={8}
              style={stepperStyle}
            >
              <Plus size={16} color={stepperIconColor} strokeWidth={2.6} />
            </TouchableOpacity>
          </View>
          <View style={styles.stepperDividerSpacer} />
          <View style={styles.stepperGroup}>
            <TouchableOpacity
              testID={`${baseTestID}-minute-decrement`}
              onPress={() => adjustMinute(-1)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${title} 분 1분 감소`}
              accessibilityState={{ disabled }}
              hitSlop={8}
              style={stepperStyle}
            >
              <Minus size={16} color={stepperIconColor} strokeWidth={2.6} />
            </TouchableOpacity>
            <TouchableOpacity
              testID={`${baseTestID}-minute-increment`}
              onPress={() => adjustMinute(1)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`${title} 분 1분 증가`}
              accessibilityState={{ disabled }}
              hitSlop={8}
              style={stepperStyle}
            >
              <Plus size={16} color={stepperIconColor} strokeWidth={2.6} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Chip row — wraps to multiple lines when count > 4-5 */}
        <View style={styles.chipsWrap}>
          {options.map((opt) => {
            const active = opt === value;
            return (
              <TouchableOpacity
                key={opt}
                testID={`${baseTestID}-chip-${opt}`}
                onPress={() => onChange(opt)}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled }}
                accessibilityLabel={opt}
                style={[
                  styles.chip,
                  active ? chipVariants.activeContainer : chipVariants.inactiveContainer,
                  disabled ? styles.chipDisabled : null,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    active ? chipVariants.activeText : chipVariants.inactiveText,
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
  stepperRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  stepperGroup: {
    width: 92,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  stepperDividerSpacer: {
    width: 1,
    height: 30,
  },
  stepperButton: {
    width: 36,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.45,
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
  chipDisabled: {
    opacity: 0.5,
  },
});

export default TimePickerCard;
