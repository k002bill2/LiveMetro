/**
 * Settings Stack Navigator
 * Handles navigation for all settings-related screens
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SettingsStackParamList } from './types';
import { COLORS, TYPOGRAPHY } from '@/styles/modernTheme';

// Import screens
import SettingsScreen from '@/screens/settings/SettingsScreen';
import CommuteSettingsScreen from '@/screens/settings/CommuteSettingsScreen';
import DelayNotificationScreen from '@/screens/settings/DelayNotificationScreen';
import NotificationTimeScreen from '@/screens/settings/NotificationTimeScreen';
import SoundSettingsScreen from '@/screens/settings/SoundSettingsScreen';
import LanguageSettingsScreen from '@/screens/settings/LanguageSettingsScreen';
import ThemeSettingsScreen from '@/screens/settings/ThemeSettingsScreen';
import LocationPermissionScreen from '@/screens/settings/LocationPermissionScreen';
import HelpScreen from '@/screens/settings/HelpScreen';
import PrivacyPolicyScreen from '@/screens/settings/PrivacyPolicyScreen';

const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsNavigator: React.FC = () => {
  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: COLORS.white,
        },
        headerTitleStyle: {
          fontSize: TYPOGRAPHY.fontSize.lg,
          fontWeight: TYPOGRAPHY.fontWeight.bold,
          color: COLORS.text.primary,
        },
        headerBackTitle: '뒤로',
        headerTintColor: COLORS.black,
      }}
    >
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ headerShown: false }} // Hide header for main settings
      />
      <SettingsStack.Screen
        name="CommuteSettings"
        component={CommuteSettingsScreen}
        options={{ title: '출퇴근 설정' }}
      />
      <SettingsStack.Screen
        name="DelayNotification"
        component={DelayNotificationScreen}
        options={{ title: '지연 알림' }}
      />
      <SettingsStack.Screen
        name="NotificationTime"
        component={NotificationTimeScreen}
        options={{ title: '알림 시간대' }}
      />
      <SettingsStack.Screen
        name="SoundSettings"
        component={SoundSettingsScreen}
        options={{ title: '소리 설정' }}
      />
      <SettingsStack.Screen
        name="LanguageSettings"
        component={LanguageSettingsScreen}
        options={{ title: '언어' }}
      />
      <SettingsStack.Screen
        name="ThemeSettings"
        component={ThemeSettingsScreen}
        options={{ title: '테마' }}
      />
      <SettingsStack.Screen
        name="LocationPermission"
        component={LocationPermissionScreen}
        options={{ title: '위치 권한' }}
      />
      <SettingsStack.Screen
        name="Help"
        component={HelpScreen}
        options={{ title: '도움말' }}
      />
      <SettingsStack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ title: '개인정보처리방침' }}
      />
    </SettingsStack.Navigator>
  );
};

export default SettingsNavigator;
