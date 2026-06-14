/**
 * Vibration Picker Component
 * Modal-based picker for selecting vibration patterns with preview.
 *
 * Phase 45 — Wanted Design System migration.
 */

import React, { useMemo, useState } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { View, Text, TouchableOpacity, Modal, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { ChevronRight, X, Check } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';

import { VibrationPatternId } from '@/models/user';
import { VibrationOption, soundService } from '@/services/sound/soundService';
import VibrationPatternGlyph from '@/components/settings/VibrationPatternGlyph';

interface VibrationPickerProps {
  label: string;
  subtitle?: string;
  options: readonly VibrationOption[];
  value: VibrationPatternId;
  onValueChange: (value: VibrationPatternId) => void;
  icon?: LucideIcon;
  disabled?: boolean;
}

export const VibrationPicker: React.FC<VibrationPickerProps> = ({
  label,
  subtitle,
  options,
  value,
  onValueChange,
  icon: IconComponent,
  disabled = false,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find((opt) => opt.id === value);

  const handleSelect = (newValue: VibrationPatternId): void => {
    onValueChange(newValue);
    setModalVisible(false);
  };

  const handlePreview = (patternId: VibrationPatternId): void => {
    soundService.previewVibration(patternId);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, disabled && styles.disabled]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          selectedOption
            ? `${label}, 현재 ${selectedOption.label}`
            : label
        }
      >
        <View style={styles.leftContent}>
          {IconComponent && (
            <View style={styles.iconContainer}>
              <IconComponent
                size={20}
                color={disabled ? semantic.labelDisabled : WANTED_TOKENS.blue[500]}
                strokeWidth={2}
              />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={[styles.label, disabled && styles.disabledText]}>
              {label}
            </Text>
            {subtitle && (
              <Text
                style={[styles.subtitle, disabled && styles.disabledText]}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.rightContent}>
          {selectedOption && (
            <Text style={styles.selectedValue}>{selectedOption.label}</Text>
          )}
          <ChevronRight size={20} color={semantic.labelAlt} />
        </View>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <SafeAreaView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{label}</Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                >
                  <X size={24} color={semantic.labelStrong} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.optionsList}>
                {options.map((option) => (
                  <View key={option.id} style={styles.optionRow}>
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => handleSelect(option.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${option.label}, ${option.description}`}
                      accessibilityState={{ selected: value === option.id }}
                    >
                      <View style={styles.optionContent}>
                        <Text style={styles.optionLabel}>{option.label}</Text>
                        <Text style={styles.optionDescription}>
                          {option.description}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.optionTrailing}>
                      <View style={styles.checkSlot}>
                        {value === option.id && (
                          <Check size={24} color={WANTED_TOKENS.blue[500]} />
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.glyphButton}
                        onPress={() => handlePreview(option.id)}
                        testID={`vib-preview-${option.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${option.label} 진동 미리보기`}
                      >
                        <VibrationPatternGlyph patternId={option.id} />
                      </TouchableOpacity>
                    </View>
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
    disabled: {
      opacity: 0.5,
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
      backgroundColor: `${WANTED_TOKENS.blue[500]}1A`,
      borderRadius: WANTED_TOKENS.radius.r6,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    textContainer: {
      flex: 1,
    },
    label: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    disabledText: {
      color: semantic.labelDisabled,
    },
    rightContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
    },
    selectedValue: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelAlt,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: semantic.bgBase,
      borderTopLeftRadius: WANTED_TOKENS.radius.r10,
      borderTopRightRadius: WANTED_TOKENS.radius.r10,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    modalTitle: {
      fontSize: 16,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    closeButton: {
      padding: WANTED_TOKENS.spacing.s2,
    },
    optionsList: {
      paddingVertical: WANTED_TOKENS.spacing.s3,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    optionItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
    },
    optionContent: {
      flex: 1,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    optionLabel: {
      fontSize: 14,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelStrong,
    },
    optionDescription: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 4,
    },
    optionTrailing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      paddingRight: WANTED_TOKENS.spacing.s4,
    },
    checkSlot: {
      width: 24,
      alignItems: 'center',
    },
    glyphButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default VibrationPicker;
