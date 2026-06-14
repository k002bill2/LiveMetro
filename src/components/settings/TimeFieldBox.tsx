/**
 * TimeFieldBox — labelled "HH:MM" time box (Wanted 알림 시간대 handoff).
 *
 * Renders a small label above a large 24-hour time value inside a rounded
 * card, matching the design's 시작 — 종료 box pair.
 *
 * Editability is encoded by the `onChange` prop:
 *   - provided  → editable: tapping opens a native time picker.
 *   - omitted   → read-only: a plain, muted box (no chevron, not pressable).
 *
 * The read-only mode exists for *derived* values (e.g. a commute alert
 * window's end, computed from the single editable departure time) — making
 * it non-pressable keeps the UI honest: only fields backed by a real,
 * persisted value can be edited.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
// @ts-ignore - wraps @react-native-community/datetimepicker
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSemanticTokens } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';

interface TimeFieldBoxProps {
  /** Small caption above the value, e.g. "시작" / "종료". */
  label: string;
  /** "HH:MM" 24-hour value. */
  value: string;
  /** When provided the box is editable; omit for a read-only derived value. */
  onChange?: (time: string) => void;
  /**
   * Locks the box: it stays tappable but, instead of opening the picker, a tap
   * fires `onLockedPress`. Use for an otherwise-editable field that can't be
   * edited yet (e.g. commute route not set) — the guard fires at *tap time*
   * rather than after the picker opens. `locked` wins over `onChange`.
   */
  locked?: boolean;
  /** Tap handler used when `locked` — surface a guidance message here. */
  onLockedPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

/** "HH:MM" → Date (today) for the native picker. */
const timeToDate = (value: string): Date => {
  const [h, m] = value.split(':');
  const date = new Date();
  date.setHours(Number(h ?? 0), Number(m ?? 0), 0, 0);
  return date;
};

/** Date → "HH:MM" (zero-padded, 24-hour). */
const dateToTime = (date: Date): string => {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
};

export const TimeFieldBox: React.FC<TimeFieldBoxProps> = ({
  label,
  value,
  onChange,
  locked = false,
  onLockedPress,
  disabled = false,
  accessibilityLabel,
  testID,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [showPicker, setShowPicker] = useState(false);

  // `locked` wins over `onChange`: a locked field never opens the picker.
  const editable = !!onChange && !disabled && !locked;
  // Locked-but-pressable: tapping surfaces guidance instead of the picker.
  const guidable = locked && !!onLockedPress && !disabled;
  const pressable = editable || guidable;

  const handlePress = (): void => {
    if (editable) {
      setShowPicker(true);
    } else if (guidable && onLockedPress) {
      onLockedPress();
    }
  };

  const handleTimeChange = (_event: unknown, selectedDate?: Date): void => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selectedDate && onChange) onChange(dateToTime(selectedDate));
  };

  const body = (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.value, !editable && styles.valueReadonly]}
        testID={testID ? `${testID}-value` : undefined}
      >
        {value}
      </Text>
    </>
  );

  return (
    <>
      {pressable ? (
        <TouchableOpacity
          style={[styles.box, editable && styles.boxEditable]}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? `${label} ${value}`}
          testID={testID}
        >
          {body}
        </TouchableOpacity>
      ) : (
        <View
          style={styles.box}
          accessibilityLabel={accessibilityLabel ?? `${label} ${value}`}
          testID={testID}
        >
          {body}
        </View>
      )}

      {showPicker &&
        !disabled &&
        (Platform.OS === 'ios' ? (
          <View style={styles.iosPickerContainer}>
            <View style={styles.iosPickerHeader}>
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                accessibilityRole="button"
                accessibilityLabel="시간 선택 완료"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.doneButton}>완료</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={timeToDate(value)}
              mode="time"
              is24Hour
              display="spinner"
              onChange={handleTimeChange}
              style={styles.iosPicker}
            />
          </View>
        ) : (
          <DateTimePicker
            value={timeToDate(value)}
            mode="time"
            is24Hour
            display="default"
            onChange={handleTimeChange}
          />
        ))}
    </>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    box: {
      flex: 1,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.r8,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s3,
    },
    boxEditable: {
      backgroundColor: semantic.bgBase,
      borderColor: semantic.lineNormal,
    },
    label: {
      fontSize: WANTED_TOKENS.type.caption2.size,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
    },
    value: {
      marginTop: 2,
      fontSize: 26,
      lineHeight: 32,
      letterSpacing: -0.6,
      fontFamily: weightToFontFamily('800'),
      color: semantic.labelStrong,
    },
    valueReadonly: {
      color: semantic.labelAlt,
    },
    iosPickerContainer: {
      backgroundColor: semantic.bgBase,
      borderTopWidth: 1,
      borderTopColor: semantic.lineSubtle,
    },
    iosPickerHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    doneButton: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: WANTED_TOKENS.blue[500],
    },
    iosPicker: {
      height: 200,
    },
  });

export default TimeFieldBox;
