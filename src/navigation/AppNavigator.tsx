/**
 * Main App Navigation
 * Bottom tab navigation with Seoul Metro design + Auth flow
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../services/auth/AuthContext';
import { useTheme } from '../services/theme';
import { LoadingScreen } from '../components/common/LoadingScreen';

import HomeScreen from '@screens/home/HomeScreen';
import FavoritesScreen from '@screens/favorites/FavoritesScreen';
import AlertsScreen from '@screens/alerts/AlertsScreen';
import SettingsNavigator from '@/navigation/SettingsNavigator';
import StationDetailScreen from '@screens/station/StationDetailScreen';
import StationNavigatorScreen from '@screens/station/StationNavigatorScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { AppTabParamList, AppStackParamList } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

const MainTabs: React.FC = () => {
  const { colors } = useTheme();

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
              iconName = focused ? 'star' : 'star-outline';
              break;
            case 'Alerts':
              iconName = focused ? 'notifications' : 'notifications-outline';
              break;
            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'help-circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderMedium,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomColor: colors.borderMedium,
          borderBottomWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: 'bold',
          color: colors.textPrimary,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: '홈',
          headerTitle: '🚇 LiveMetro',
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          title: '즐겨찾기',
          headerTitle: '⭐ 즐겨찾기',
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          title: '알림',
          headerTitle: '🔔 알림',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsNavigator}
        options={{
          title: '설정',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  // Show loading screen while checking auth state
  if (loading) {
    return <LoadingScreen message="앱을 로딩중입니다..." />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // Authenticated Stack
        <>
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
          />
          <Stack.Screen
            name="StationDetail"
            component={StationDetailScreen}
            options={({ route }) => ({
              headerShown: true,
              title: `${route.params.stationName}역 정보`,
              headerStyle: {
                backgroundColor: colors.surface,
              },
              headerTitleStyle: {
                fontSize: 18,
                fontWeight: 'bold',
                color: colors.textPrimary,
              },
            })}
          />
          <Stack.Screen
            name="StationNavigator"
            component={StationNavigatorScreen}
            options={{
              headerShown: false,
              title: '역 탐색',
              headerStyle: {
                backgroundColor: colors.surface,
              },
              headerTitleStyle: {
                fontSize: 18,
                fontWeight: 'bold',
                color: colors.textPrimary,
              },
            }}
          />
        </>
      ) : (
        // Unauthenticated Stack
        <>
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
          />
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{
              headerShown: true,
              title: '',
              headerStyle: {
                backgroundColor: colors.backgroundSecondary,
              },
              headerShadowVisible: false,
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
