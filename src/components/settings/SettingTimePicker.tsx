/**
 * Setting Time Picker Component
 * Reusable time picker for settings screens
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
// @ts-ignore - expo-datetimepicker wraps @react-native-community/datetimepicker
import DateTimePicker from '@react-native-community/datetimepicker';
import { Clock } from 'lucide-react-native';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';

interface SettingTimePickerProps {
  label: string;
  value: string; // HH:mm format (e.g., "08:00")
  onValueChange: (time: string) => void;
  icon?: React.ElementType;
  minTime?: string;
  maxTime?: string;
}

export const SettingTimePicker: React.FC<SettingTimePickerProps> = ({
  label,
  value,
  onValueChange,
  icon: Icon,
}) => {
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
          {Icon && (
            <View style={styles.iconContainer}>
              <Icon size={20} color={COLORS.black} />
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
            color={COLORS.gray[400]}
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.surface.card,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
  },
  value: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  icon: {
    marginLeft: SPACING.sm,
  },
  iosPickerContainer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  doneButton: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.black,
  },
  iosPicker: {
    height: 200,
  },
});

export default SettingTimePicker;
