/**
 * FaceIDButton — primary biometric CTA (Wanted Design System).
 *
 * Mirrors the Wanted handoff: blue-500 bg, white fg, custom Face ID glyph,
 * pulse indicator on the right edge that toggles every 1.4s.
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Fingerprint } from 'lucide-react-native';
import { WANTED_TOKENS } from '@/styles/modernTheme';
import { useTheme } from '@/services/theme/themeContext';

export type FaceIDVariant = 'face' | 'touch';

interface FaceIDButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: FaceIDVariant;
  testID?: string;
}

const PULSE_PERIOD_MS = 1400;

const FaceIDGlyph: React.FC<{ color: string }> = ({ color }) => (
  <View style={[styles.glyphFrame, { borderColor: color }]}>
    <View style={[styles.corner, styles.cornerTL, { borderColor: color }]} />
    <View style={[styles.corner, styles.cornerTR, { borderColor: color }]} />
    <View style={[styles.corner, styles.cornerBL, { borderColor: color }]} />
    <View style={[styles.corner, styles.cornerBR, { borderColor: color }]} />
    <View style={[styles.eye, styles.eyeLeft, { backgroundColor: color }]} />
    <View style={[styles.eye, styles.eyeRight, { backgroundColor: color }]} />
    <View style={[styles.mouth, { borderColor: color }]} />
  </View>
);

const FaceIDButtonImpl: React.FC<FaceIDButtonProps> = ({
  label,
  onPress,
  loading = false,
  variant = 'face',
  testID,
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const [pulse, setPulse] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setPulse((prev) => !prev);
    }, PULSE_PERIOD_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const buttonStyle: ViewStyle = {
    height: 56,
    borderRadius: WANTED_TOKENS.radius.r8,
    backgroundColor: semantic.primaryNormal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: WANTED_TOKENS.spacing.s4,
    shadowColor: WANTED_TOKENS.blue[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    opacity: loading ? 0.7 : 1,
  };

  const labelStyle: TextStyle = {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.16,
  };

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={loading}
      style={buttonStyle}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: loading }}
      activeOpacity={0.9}
    >
      {variant === 'face' ? (
        <FaceIDGlyph color="#FFFFFF" />
      ) : (
        <Fingerprint size={26} color="#FFFFFF" strokeWidth={2.4} />
      )}
      <Text style={labelStyle} numberOfLines={1}>
        {label}
      </Text>
      <View
        testID={testID ? `${testID}-pulse` : undefined}
        style={[
          styles.pulse,
          { opacity: pulse ? 1 : 0.4 },
        ]}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  glyphFrame: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2.4,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 7,
    height: 7,
  },
  cornerTL: { top: -2, left: -2, borderTopWidth: 2.4, borderLeftWidth: 2.4 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 2.4, borderRightWidth: 2.4 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 2.4, borderLeftWidth: 2.4 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 2.4, borderRightWidth: 2.4 },
  eye: { position: 'absolute', width: 3, height: 3, borderRadius: 2, top: 7 },
  eyeLeft: { left: 5 },
  eyeRight: { right: 5 },
  mouth: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    height: 2,
    borderBottomWidth: 2,
    borderRadius: 2,
  },
  pulse: {
    position: 'absolute',
    right: 18,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});

export const FaceIDButton = memo(FaceIDButtonImpl);
FaceIDButton.displayName = 'FaceIDButton';
