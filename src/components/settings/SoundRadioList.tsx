/**
 * Sound Radio List Component
 * Inline radio list for selecting notification sounds with per-row preview.
 * Replaces the modal-based SoundPicker (시안 4번 섹션).
 *
 * Each row: circular avatar (Play preview) + label/description + radio button.
 * Row tap = select; avatar tap = preview the sound.
 */

import React, { useMemo } from 'react';
import { useSemanticTokens } from '@/services/theme';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Play } from 'lucide-react-native';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { NotificationSoundId } from '@/models/user';
import { SoundOption, soundService } from '@/services/sound/soundService';

interface SoundRadioListProps {
  options: readonly SoundOption[];
  value: NotificationSoundId;
  volume: number;
  onValueChange: (id: NotificationSoundId) => void;
  disabled?: boolean;
}

const SoundRadioListComponent: React.FC<SoundRadioListProps> = ({
  options,
  value,
  volume,
  onValueChange,
  disabled = false,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <View style={[disabled && styles.containerDisabled]}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <View key={option.id} style={styles.row}>
            <TouchableOpacity
              testID={`sound-preview-${option.id}`}
              style={[styles.avatar, selected ? styles.avatarSelected : styles.avatarUnselected]}
              accessibilityRole="button"
              accessibilityLabel={`${option.label} 미리듣기`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={disabled}
              onPress={() => {
                if (disabled) return;
                void soundService.previewSound(option.id, volume);
              }}
            >
              <Play
                size={18}
                color={selected ? WANTED_TOKENS.blue[500] : semantic.labelAlt}
                strokeWidth={2}
                fill={selected ? WANTED_TOKENS.blue[500] : semantic.labelAlt}
              />
            </TouchableOpacity>

            <TouchableOpacity
              testID={`sound-row-${option.id}`}
              style={styles.content}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              disabled={disabled}
              onPress={() => {
                if (disabled) return;
                onValueChange(option.id);
              }}
            >
              <View style={styles.textContainer}>
                <Text style={styles.label}>{option.label}</Text>
                <Text style={styles.description}>{option.description}</Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  selected ? styles.radioOuterSelected : styles.radioOuterUnselected,
                ]}
              >
                {selected && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    containerDisabled: {
      opacity: 0.5,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: WANTED_TOKENS.radius.pill,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    avatarSelected: {
      // Token-derived: blue/500 at 10% alpha (1A hex) — not a hardcoded hex.
      backgroundColor: `${WANTED_TOKENS.blue[500]}1A`,
    },
    avatarUnselected: {
      backgroundColor: semantic.bgSubtle,
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: WANTED_TOKENS.spacing.s4,
    },
    textContainer: {
      flex: 1,
      marginRight: WANTED_TOKENS.spacing.s3,
    },
    label: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
    description: {
      fontSize: 13,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: 2,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: WANTED_TOKENS.radius.pill,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioOuterSelected: {
      borderColor: WANTED_TOKENS.blue[500],
    },
    radioOuterUnselected: {
      borderColor: semantic.lineNormal,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: WANTED_TOKENS.radius.pill,
      backgroundColor: WANTED_TOKENS.blue[500],
    },
  });

export const SoundRadioList = React.memo(SoundRadioListComponent);
SoundRadioList.displayName = 'SoundRadioList';

export default SoundRadioList;
