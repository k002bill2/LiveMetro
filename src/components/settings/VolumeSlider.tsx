/**
 * Volume Slider Component
 * Single-row volume control: [Volume1 icon] [Slider] [Volume2 icon].
 *
 * The percentage label is rendered by the enclosing SettingSection header
 * (trailing), not here — keeping this component focused on the control row.
 * Card padding is provided by SettingSection, so the row carries its own s4.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Volume1, Volume2 } from 'lucide-react-native';
import {
  WANTED_TOKENS,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { useSemanticTokens } from '@/services/theme';

interface VolumeSliderProps {
  value: number;
  onValueChange: (v: number) => void;
  disabled?: boolean;
}

const VolumeSliderComponent: React.FC<VolumeSliderProps> = ({
  value,
  onValueChange,
  disabled = false,
}) => {
  const semantic = useSemanticTokens();
  const styles = useMemo(() => createStyles(semantic), [semantic]);

  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <Volume1 size={20} color={semantic.labelAlt} strokeWidth={2} />
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={100}
        step={10}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        minimumTrackTintColor={WANTED_TOKENS.blue[500]}
        maximumTrackTintColor={semantic.lineNormal}
        thumbTintColor={WANTED_TOKENS.blue[500]}
        accessibilityLabel="알림 볼륨"
      />
      <Volume2 size={20} color={semantic.labelAlt} strokeWidth={2} />
    </View>
  );
};

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: WANTED_TOKENS.spacing.s4,
      backgroundColor: semantic.bgBase,
    },
    disabled: {
      opacity: 0.5,
    },
    slider: {
      flex: 1,
      height: 40,
      marginHorizontal: WANTED_TOKENS.spacing.s3,
    },
  });

export const VolumeSlider = React.memo(VolumeSliderComponent);
VolumeSlider.displayName = 'VolumeSlider';

export default VolumeSlider;
