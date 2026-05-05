/**
 * Setting Picker Component
 * Custom modal-based picker for settings selection.
 *
 * Phase 45 — Wanted Design System migration.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { ChevronRight, X, Check } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useTheme } from '@/services/theme';

export interface PickerOption {
  label: string;
  value: string;
  description?: string;
}

interface SettingPickerProps {
  label: string;
  options: PickerOption[];
  value: string;
  onValueChange: (value: string) => void;
  icon?: LucideIcon;
}

export const SettingPicker: React.FC<SettingPickerProps> = ({
  label,
  options,
  value,
  onValueChange,
  icon: IconComponent,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (newValue: string): void => {
    onValueChange(newValue);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.leftContent}>
          {IconComponent && (
            <View style={styles.iconContainer}>
              <IconComponent size={20} color={semantic.labelStrong} strokeWidth={2} />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={styles.label}>{label}</Text>
            {selectedOption && (
              <Text style={styles.selectedValue}>{selectedOption.label}</Text>
            )}
          </View>
        </View>
        <ChevronRight size={20} color={semantic.labelAlt} />
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
                  <TouchableOpacity
                    key={option.value}
                    style={styles.optionItem}
                    onPress={() => handleSelect(option.value)}
                  >
                    <View style={styles.optionContent}>
                      <Text style={styles.optionLabel}>{option.label}</Text>
                      {option.description && (
                        <Text style={styles.optionDescription}>
                          {option.description}
                        </Text>
                      )}
                    </View>
                    {value === option.value && (
                      <Check size={24} color={WANTED_TOKENS.blue[500]} />
                    )}
                  </TouchableOpacity>
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
    selectedValue: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 2,
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
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
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
  });

export default SettingPicker;
