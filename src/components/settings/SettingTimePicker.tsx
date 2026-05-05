/**
 * Setting Time Picker Component
 * Reusable time picker for settings screens.
 *
 * Phase 45 — Wanted Design System migration.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
// @ts-ignore - expo-datetimepicker wraps @react-native-community/datetimepicker
import DateTimePicker from '@react-native-community/datetimepicker';
import { Clock } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';

interface SettingTimePickerProps {
  label: string;
  value: string; // HH:mm format (e.g., "08:00")
  onValueChange: (time: string) => void;
  icon?: LucideIcon;
  minTime?: string;
  maxTime?: string;
}

export const SettingTimePicker: React.FC<SettingTimePickerProps> = ({
  label,
  value,
  onValueChange,
  icon: IconComponent,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [showPicker, setShowPicker] = useState(false);

  // Convert HH:mm string to Date object
  const timeToDate = (timeString: string): Date => {
    const [hoursStr, minutesStr] = timeString.split(':');
    const hours = Number(hoursStr || 0);
    const minutes = Number(minutesStr || 0);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    return date;
  };

  // Convert Date object to HH:mm string
  const dateToTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Format time for display (12-hour format with AM/PM)
  const formatTimeForDisplay = (timeString: string): string => {
    const [hoursStr, minutesStr] = timeString.split(':');
    const hours = Number(hoursStr || 0);
    const minutes = Number(minutesStr || 0);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const handleTimeChange = (_event: any, selectedDate?: Date): void => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (selectedDate) {
      const newTime = dateToTime(selectedDate);
      onValueChange(newTime);
    }
  };

  const handleDismiss = (): void => {
    setShowPicker(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setShowPicker(true)}
      >
        <View style={styles.leftContent}>
          {IconComponent && (
            <View style={styles.iconContainer}>
              <IconComponent size={20} color={semantic.labelStrong} strokeWidth={2} />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={styles.label}>{label}</Text>
          </View>
        </View>
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{formatTimeForDisplay(value)}</Text>
          <Clock
            size={20}
            color={semantic.labelAlt}
            style={styles.icon}
          />
        </View>
      </TouchableOpacity>

      {showPicker && (
        Platform.OS === 'ios' ? (
          <View style={styles.iosPickerContainer}>
            <View style={styles.iosPickerHeader}>
              <TouchableOpacity onPress={handleDismiss}>
                <Text style={styles.doneButton}>완료</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={timeToDate(value)}
              mode="time"
              display="spinner"
              onChange={handleTimeChange}
              style={styles.iosPicker}
            />
          </View>
        ) : (
          <DateTimePicker
            value={timeToDate(value)}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )
      )}
    </>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    leftContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    iconContainer: {
      width: 36,
      height: 36,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.pill,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    textContainer: {
      flex: 1,
    },
    label: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    valueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: semantic.bgSubtle,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
      borderRadius: WANTED_TOKENS.radius.r4,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
    },
    value: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    icon: {
      marginLeft: WANTED_TOKENS.spacing.s2,
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

export default SettingTimePicker;
