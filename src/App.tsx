/**
 * Main application entry point
 * Sets up navigation, providers, and global app configuration
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// TODO: Import providers once implemented
// import { AuthProvider } from '@services/auth/AuthContext';
// import { NotificationProvider } from '@services/notification/NotificationContext';
// import { ThemeProvider } from '@utils/theme/ThemeContext';

// TODO: Import main navigator once implemented
// import { RootNavigator } from './navigation/RootNavigator';

// Placeholder component for initial setup
import { View, Text, StyleSheet } from 'react-native';

const PlaceholderScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>LiveMetro</Text>
      <Text style={styles.subtitle}>실시간 전철 알림</Text>
      <Text style={styles.description}>
        Seoul metropolitan area real-time subway notification app
      </Text>
      <Text style={styles.status}>✅ Project foundation setup complete</Text>
      <Text style={styles.next}>Next: Implement navigation and core screens</Text>
    </View>
  );
};

const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {/* TODO: Replace with providers and proper navigation */}
        {/* 
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <RootNavigator />
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
        */}
        <PlaceholderScreen />
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2563eb',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 24,
    color: '#6b7280',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    color: '#9ca3af',
    lineHeight: 20,
  },
  status: {
    fontSize: 16,
    color: '#059669',
    marginBottom: 8,
  },
  next: {
    fontSize: 14,
    color: '#7c3aed',
    fontStyle: 'italic',
  },
});

export default App;