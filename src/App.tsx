/**
 * Main application entry point
 * Sets up navigation, providers, and global app configuration
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import providers and navigation
import { AuthProvider } from './services/auth/AuthContext';
import { RootNavigator } from './navigation/RootNavigator';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Import production monitoring
import { monitoringManager } from './services/monitoring';

const App: React.FC = () => {
  useEffect(() => {
    // Initialize production monitoring services
    const initializeMonitoring = async () => {
      try {
        // Record app startup
        monitoringManager.recordAppStart();

        // Initialize monitoring services
        await monitoringManager.initialize({
          crashReporting: { enabled: !__DEV__ },
          performance: { enabled: !__DEV__ },
          healthCheck: { enabled: true },
        });

        // Add app initialization breadcrumb
        monitoringManager.addBreadcrumb('App initialized', 'app_lifecycle');
      } catch (error) {
        console.error('Failed to initialize monitoring:', error);
      }
    };

    initializeMonitoring();

    // Cleanup on unmount
    return () => {
      monitoringManager.shutdown();
    };
  }, []);

  const handleNavigationStateChange = () => {
    // Track navigation for performance monitoring
    monitoringManager.addBreadcrumb('Navigation changed', 'navigation');
  };

  const handleGlobalError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Report errors to monitoring service
    monitoringManager.reportError(error, {
      componentStack: errorInfo.componentStack,
      action: 'global_error_boundary',
    });
  };

  return (
    <ErrorBoundary onError={handleGlobalError}>
      <SafeAreaProvider>
        <NavigationContainer onStateChange={handleNavigationStateChange}>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
          <StatusBar style="auto" />
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

export default App;