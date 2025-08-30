/**
 * Main application entry point
 * Sets up navigation, providers, and global app configuration
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import providers and navigation
import { AuthProvider } from './services/auth/AuthContext';
import { RootNavigator } from './navigation/RootNavigator';

const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;