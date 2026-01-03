/**
 * Root Navigator Component
 * Main navigation structure for the app
 */

import React, { useState, useCallback } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../services/auth/AuthContext';
import { LoadingScreen } from '../components/common/LoadingScreen';

// Import screens
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { FavoritesScreen } from '../screens/favorites/FavoritesScreen';
import { AlertsScreen } from '../screens/alerts/AlertsScreen';
import { SettingsNavigator } from './SettingsNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';

// Onboarding completion key
const ONBOARDING_COMPLETE_KEY = '@livemetro/onboarding_complete';

// DEBUG: Set to true to always show onboarding screen during development
const DEBUG_FORCE_ONBOARDING = __DEV__ && true;

// Navigation types
export type RootStackParamList = {
  Welcome: undefined;
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Favorites: undefined;
  Alerts: undefined;
  Settings: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Favorites':
              iconName = focused ? 'heart' : 'heart-outline';
              break;
            case 'Alerts':
              iconName = focused ? 'notifications' : 'notifications-outline';
              break;
            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: '#2563eb',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          title: '홈',
          tabBarLabel: '홈',
        }}
      />
      <Tab.Screen 
        name="Favorites" 
        component={FavoritesScreen}
        options={{
          title: '즐겨찾기',
          tabBarLabel: '즐겨찾기',
        }}
      />
      <Tab.Screen 
        name="Alerts" 
        component={AlertsScreen}
        options={{
          title: '알림',
          tabBarLabel: '알림',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsNavigator}
        options={{
          title: '설정',
          tabBarLabel: '설정',
          headerShown: false, // SettingsNavigator has its own header
        }}
      />
    </Tab.Navigator>
  );
};

// Custom hook to check onboarding completion status
const useOnboardingStatus = (userId: string | undefined) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  React.useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!userId) {
        setHasCompletedOnboarding(null);
        setCheckingStatus(false);
        return;
      }

      try {
        const key = `${ONBOARDING_COMPLETE_KEY}_${userId}`;
        const value = await AsyncStorage.getItem(key);
        setHasCompletedOnboarding(value === 'true');
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setHasCompletedOnboarding(false);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkOnboardingStatus();
  }, [userId]);

  const completeOnboarding = useCallback(async () => {
    if (!userId) return;
    try {
      const key = `${ONBOARDING_COMPLETE_KEY}_${userId}`;
      await AsyncStorage.setItem(key, 'true');
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  }, [userId]);

  const skipOnboarding = useCallback(async () => {
    if (!userId) return;
    try {
      const key = `${ONBOARDING_COMPLETE_KEY}_${userId}`;
      await AsyncStorage.setItem(key, 'true');
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  }, [userId]);

  return { hasCompletedOnboarding, checkingStatus, completeOnboarding, skipOnboarding };
};

export const RootNavigator: React.FC = () => {
  const { user, loading } = useAuth();
  const {
    hasCompletedOnboarding,
    checkingStatus,
    completeOnboarding,
    skipOnboarding,
  } = useOnboardingStatus(user?.id);

  if (loading || (user && checkingStatus)) {
    return <LoadingScreen message="앱을 로딩중입니다..." />;
  }

  // Not authenticated - show welcome/auth flow
  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
      </Stack.Navigator>
    );
  }

  // Authenticated but hasn't completed onboarding (or DEBUG mode)
  if (!hasCompletedOnboarding || DEBUG_FORCE_ONBOARDING) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding">
          {() => (
            <OnboardingNavigator
              onComplete={completeOnboarding}
              onSkip={skipOnboarding}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  // Authenticated and completed onboarding - show main app
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabNavigator} />
    </Stack.Navigator>
  );
};