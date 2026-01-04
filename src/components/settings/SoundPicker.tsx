/**
 * Sound Picker Component
 * Modal-based picker for selecting notification sounds with preview
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/styles/modernTheme';
import { NotificationSoundId } from '@/models/user';
import { SoundOption, soundService } from '@/services/sound/soundService';

interface SoundPickerProps {
  label: string;
  options: readonly SoundOption[];
  value: NotificationSoundId;
  volume: number;
  onValueChange: (value: NotificationSoundId) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

export const SoundPicker: React.FC<SoundPickerProps> = ({
  label,
  options,
  value,
  volume,
  onValueChange,
  icon,
  disabled = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [playingId, setPlayingId] = useState<NotificationSoundId | null>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  const handleSelect = (newValue: NotificationSoundId): void => {
    onValueChange(newValue);
    setModalVisible(false);
    // Stop any playing sound when selection is made
    soundService.stopSound();
    setPlayingId(null);
  };

  const handlePreview = async (soundId: NotificationSoundId): Promise<void> => {
    if (playingId === soundId) {
      // Stop if already playing this sound
      await soundService.stopSound();
      setPlayingId(null);
    } else {
      setPlayingId(soundId);
      await soundService.previewSound(soundId, volume);
      // Reset after sound finishes (approximate duration)
      setTimeout(() => {
        setPlayingId(null);
      }, 3000);
    }
  };

  const handleCloseModal = async (): Promise<void> => {
    await soundService.stopSound();
    setPlayingId(null);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, disabled && styles.disabled]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        <View style={styles.leftContent}>
          {icon && (
            <View style={styles.iconContainer}>
              <Ionicons
                name={icon}
                size={20}
                color={disabled ? COLORS.gray[400] : COLORS.black}
              />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={[styles.label, disabled && styles.disabledText]}>
              {label}
            </Text>
            {selectedOption && (
              <Text style={styles.selectedValue}>{selectedOption.label}</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.gray[400]} />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <SafeAreaView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{label}</Text>
                <TouchableOpacity
                  onPress={handleCloseModal}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={COLORS.black} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.optionsList}>
                {options.map((option) => (
                  <View key={option.id} style={styles.optionRow}>
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => handleSelect(option.id)}
                    >
                      <View style={styles.optionContent}>
                        <Text style={styles.optionLabel}>{option.label}</Text>
                        <Text style={styles.optionDescription}>
                          {option.description}
                        </Text>
                      </View>
                      {value === option.id && (
                        <Ionicons
                          name="checkmark"
                          size={24}
                          color={COLORS.black}
                        />
                      )}
                    </TouchableOpacity>

                    {option.id !== 'silent' && (
                      <TouchableOpacity
                        style={styles.playButton}
                        onPress={() => handlePreview(option.id)}
                      >
                        {playingId === option.id ? (
                          <ActivityIndicator size="small" color={COLORS.black} />
                        ) : (
                          <Ionicons
                            name="play-circle"
                            size={32}
                            color={COLORS.black}
                          />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>
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
  disabled: {
    opacity: 0.5,
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
  disabledText: {
    color: COLORS.gray[400],
  },
  selectedValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.surface.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  optionsList: {
    paddingVertical: SPACING.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  optionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  optionContent: {
    flex: 1,
    marginRight: SPACING.md,
  },
  optionLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  optionDescription: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.tertiary,
    marginTop: 4,
  },
  playButton: {
    padding: SPACING.md,
    marginRight: SPACING.sm,
  },
});

export default SoundPicker;
