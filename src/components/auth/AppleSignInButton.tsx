/**
 * AppleSignInButton — official "Continue with Apple" button.
 *
 * WHY the proprietary button (not a lucide-glyph SocialButton):
 * App Store Review Guidelines require Apple sign-in to be started from Apple's
 * own `AppleAuthenticationButton` (or a strictly HIG-compliant button); a custom
 * button risks rejection. The CONTINUE type is localized by the system to
 * "Apple로 계속하기" automatically.
 *
 * OTA safety: `expo-apple-authentication` is a native module absent from Expo Go
 * and older OTA-updated binaries. It is imported lazily inside an effect and
 * stored in state; before the load resolves (or if it fails) the component
 * renders nothing, so it can never crash on a binary that lacks the module.
 */
import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

type AppleAuthModule = typeof import('expo-apple-authentication');

interface AppleSignInButtonProps {
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

const AppleSignInButtonImpl: React.FC<AppleSignInButtonProps> = ({
  onPress,
  disabled = false,
  testID,
}) => {
  const [appleModule, setAppleModule] = useState<AppleAuthModule | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('expo-apple-authentication')
      .then((mod) => {
        if (!cancelled) {
          setAppleModule(mod);
        }
      })
      .catch(() => {
        // Native module unavailable (Expo Go / older OTA binary) — render nothing.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!appleModule) {
    return null;
  }

  const {
    AppleAuthenticationButton,
    AppleAuthenticationButtonType,
    AppleAuthenticationButtonStyle,
  } = appleModule;

  return (
    <View
      testID={testID}
      style={[styles.wrap, disabled ? styles.disabled : null]}
      pointerEvents={disabled ? 'none' : 'auto'}
      accessibilityState={{ disabled }}
    >
      <AppleAuthenticationButton
        buttonType={AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={14}
        style={styles.button}
        onPress={onPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  disabled: { opacity: 0.7 },
  button: { width: '100%', height: 52 },
});

export const AppleSignInButton = memo(AppleSignInButtonImpl);
AppleSignInButton.displayName = 'AppleSignInButton';
