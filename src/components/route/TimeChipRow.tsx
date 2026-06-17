import React, { useState, useCallback, useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

export type DepartureMode = 'now' | 'depart' | 'arrive';

interface Props {
  mode: DepartureMode;
  time: Date | null;
  onChangeMode: (mode: DepartureMode) => void;
  onChangeTime: (time: Date) => void;
}

function formatHm(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const period = h < 12 ? '오전' : '오후';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${h12}:${m}`;
}

export const TimeChipRow: React.FC<Props> = ({ mode, time, onChangeMode, onChangeTime }) => {
  const semantic = useSemanticTokens();
  // Memoize the StyleSheet and the chip color variants so they are not
  // reallocated on every parent re-render (the row re-renders on each keystroke
  // when departure mode/time change). Keyed on `semantic` (theme) only.
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const chipStyles = useMemo(
    () => ({
      active: { backgroundColor: semantic.primaryNormal, borderColor: semantic.primaryNormal },
      inactive: { backgroundColor: semantic.bgBase, borderColor: semantic.lineNormal },
      activeText: { color: semantic.labelOnColor },
      inactiveText: { color: semantic.labelStrong },
      activeFont: { fontFamily: weightToFontFamily('700') },
    }),
    [semantic]
  );
  const [pickerVisible, setPickerVisible] = useState(false);

  const handleChipPress = useCallback(
    (next: DepartureMode): void => {
      onChangeMode(next);
      if (next === 'depart' || next === 'arrive') {
        setPickerVisible(true);
      }
    },
    [onChangeMode]
  );

  const renderChip = (chipMode: DepartureMode, label: string, testID: string): React.ReactElement => {
    const active = mode === chipMode;
    return (
      <Pressable
        onPress={(): void => handleChipPress(chipMode)}
        testID={testID}
        style={[styles.chip, active ? chipStyles.active : chipStyles.inactive]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
      >
        <Text
          style={[
            styles.chipText,
            active ? chipStyles.activeText : chipStyles.inactiveText,
            active && chipStyles.activeFont,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const departLabel = mode === 'depart' && time ? formatHm(time) : '시간 지정';
  const arriveLabel = mode === 'arrive' && time ? `${formatHm(time)} 도착` : '도착 시간 지정';

  return (
    <View style={styles.row}>
      {renderChip('now', '지금 출발', 'time-chip-now')}
      {renderChip('depart', departLabel, 'time-chip-depart')}
      {renderChip('arrive', arriveLabel, 'time-chip-arrive')}

      {pickerVisible && (
        <DateTimePicker
          value={time ?? new Date()}
          mode="time"
          onChange={(_, selectedDate): void => {
            setPickerVisible(false);
            if (selectedDate) {
              onChangeTime(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
};

TimeChipRow.displayName = 'TimeChipRow';

const createStyles = (_semantic: WantedSemanticTheme): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: WANTED_TOKENS.spacing.s2,
      paddingVertical: WANTED_TOKENS.spacing.s3,
    },
    chip: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 1,
    },
    chipText: {
      fontSize: WANTED_TOKENS.type.label2.size,
      fontFamily: weightToFontFamily('500'),
    },
  });
