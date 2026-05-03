/**
 * LiveMetro App Entry Point
 * Real-time Seoul subway notification app
 */

import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider } from './src/services/auth/AuthContext';
import { I18nProvider } from './src/services/i18n';
import { ThemeProvider, useTheme } from './src/services/theme';
import { RootNavigator } from './src/navigation/RootNavigator';

// Hold the native splash until fonts are ready — avoids the brief flash of
// system-font UI before Pretendard loads. Errors are swallowed because the
// splash will be hidden manually on the first render anyway.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* no-op — splash already hidden or not yet shown */
});

// Inner component that uses theme
const AppContent: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
};

const App: React.FC = () => {
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Thin': require('./assets/fonts/Pretendard-Thin.otf'),
    'Pretendard-ExtraLight': require('./assets/fonts/Pretendard-ExtraLight.otf'),
    'Pretendard-Light': require('./assets/fonts/Pretendard-Light.otf'),
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-ExtraBold': require('./assets/fonts/Pretendard-ExtraBold.otf'),
    'Pretendard-Black': require('./assets/fonts/Pretendard-Black.otf'),
  });

  // Hide splash once fonts load OR after an error (we don't want to block
  // forever on a corrupt font asset — fall back to system fonts).
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (fontError) {
      // eslint-disable-next-line no-console
      console.warn('[App] Pretendard font load failed; falling back to system fonts.', fontError);
    }
  }, [fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <View style={{ flex: 1 }}>
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </View>
    </GestureHandlerRootView>
  );
};

export default App;
