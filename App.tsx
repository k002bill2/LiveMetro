/**
 * LiveMetro App Entry Point
 * Real-time Seoul subway notification app
 */

import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from './src/services/auth/AuthContext';
import { I18nProvider } from './src/services/i18n';
import { ThemeProvider, useTheme } from './src/services/theme';
import { RootNavigator } from './src/navigation/RootNavigator';

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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
};

export default App;
