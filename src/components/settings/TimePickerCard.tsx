/**
 * TimePickerCard — Wanted handoff (image 17) commute time selector.
 *
 * Layout:
 *   - Section title + small subtitle ("평일 기준") sit OUTSIDE the card
 *     so the layout matches sibling SettingSection blocks visually.
 *   - Card (subtle gray background) holds a big "HH 시 | MM 분 출발"
 *     display + a chip row of common departure times.
 *
 * Tapping the large HH/MM display opens the native time picker. Preset chips
 * remain as quick picks for common commute times.
 *
 * Props:
 *   - value: "HH:MM" — current selected time. If not in `options`, the chip
 *     row falls back to no-active-chip but the big display still shows the
 *     parsed value, so user-set custom times don't visually disappear.
 *   - options: readonly time strings to render as chips. Caller controls
 *     ordering and count.
 *   - onChange: invoked with the selected time. Wrap in saving guard
 *     externally; this component doesn't persist.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

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

const timeToDate = (hhmm: string): Date => {
  const parsed = parseHHMM(hhmm) ?? { hour: 0, minute: 0 };
  const date = new Date();
  date.setHours(parsed.hour, parsed.minute, 0, 0);
  return date;
};

const dateToHHMM = (date: Date): string => {
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${hour}:${minute}`;
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
  const [pickerVisible, setPickerVisible] = useState(false);
  const [hh, mm] = splitHHMM(value);
  const baseTestID = testID ?? 'time-picker';
  const pickerValue = useMemo(() => timeToDate(value), [value]);

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

  const openPicker = useCallback((): void => {
    if (!disabled) setPickerVisible(true);
  }, [disabled]);

  const closePicker = useCallback((): void => {
    setPickerVisible(false);
  }, []);

  const handlePickerChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date): void => {
      if (event.type === 'dismissed' || event.type === 'neutralButtonPressed') {
        setPickerVisible(false);
        return;
      }

      if (selectedDate) {
        onChange(dateToHHMM(selectedDate));
      }

      if (Platform.OS !== 'ios') {
        setPickerVisible(false);
      }
    },
    [onChange]
  );

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
        <TouchableOpacity
          testID={`${baseTestID}-display`}
          onPress={openPicker}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${title} ${hh}시 ${mm}분 선택`}
          accessibilityState={{ disabled, expanded: pickerVisible }}
          activeOpacity={0.82}
          style={styles.displayButton}
        >
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
        </TouchableOpacity>

        {pickerVisible && !disabled ? (
          <View
            testID={`${baseTestID}-picker-container`}
            style={[
              styles.pickerContainer,
              { backgroundColor: semantic.bgBase, borderColor: semantic.lineSubtle },
            ]}
          >
            {Platform.OS === 'ios' ? (
              <View
                style={[
                  styles.pickerHeader,
                  { borderBottomColor: semantic.lineSubtle },
                ]}
              >
                <TouchableOpacity
                  testID={`${baseTestID}-picker-done`}
                  onPress={closePicker}
                  accessibilityRole="button"
                  accessibilityLabel="시간 선택 완료"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={[
                      styles.pickerDoneText,
                      {
                        color: semantic.primaryNormal,
                        fontFamily: weightToFontFamily('700'),
                      },
                    ]}
                  >
                    완료
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <DateTimePicker
              testID={`${baseTestID}-native-picker`}
              value={pickerValue}
              mode="time"
              is24Hour
              minuteInterval={1}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handlePickerChange}
              style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
            />
          </View>
        ) : null}

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
    letterSpacing: 0,
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
  displayButton: {
    alignSelf: 'stretch',
    borderRadius: 12,
    paddingVertical: 2,
  },
  pickerContainer: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pickerDoneText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: weightToFontFamily('700'),
  },
  iosPicker: {
    alignSelf: 'stretch',
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
    letterSpacing: 0,
  },
  chipDisabled: {
    opacity: 0.5,
  },
});

export default TimePickerCard;
