/**
 * Onboarding Navigator
 * Stack navigator for the commute setup onboarding flow
 */

import React, { createContext, useContext, useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from './types';
import { WelcomeOnboardingScreen } from '@/screens/onboarding/WelcomeOnboardingScreen';
import { CommuteRouteScreen } from '@/screens/onboarding/CommuteRouteScreen';
import { OnboardingStationPickerScreen } from '@/screens/onboarding/OnboardingStationPickerScreen';
import { NotificationPermissionScreen } from '@/screens/onboarding/NotificationPermissionScreen';
import { FavoritesOnboardingScreen } from '@/screens/onboarding/FavoritesOnboardingScreen';
import { COLORS } from '@/styles/modernTheme';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

// Context for onboarding callbacks
interface OnboardingContextType {
  onComplete: () => void;
  onSkip: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

// Hook to access onboarding callbacks
export const useOnboardingCallbacks = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboardingCallbacks must be used within OnboardingNavigator');
  }
  return context;
};

interface OnboardingNavigatorProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export const OnboardingNavigator: React.FC<OnboardingNavigatorProps> = ({
  onComplete,
  onSkip,
}) => {
  const handleSkipOnboarding = useCallback(() => {
    if (onSkip) onSkip();
  }, [onSkip]);

  const handleComplete = useCallback(() => {
    if (onComplete) onComplete();
  }, [onComplete]);

  const contextValue: OnboardingContextType = {
    onComplete: handleComplete,
    onSkip: handleSkipOnboarding,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.white },
          animation: 'slide_from_right',
        }}
        initialRouteName="WelcomeOnboarding"
      >
        <Stack.Screen name="WelcomeOnboarding" component={WelcomeOnboardingScreen} />
        <Stack.Screen name="CommuteRoute" component={CommuteRouteScreen} />
        <Stack.Screen name="OnboardingStationPicker" component={OnboardingStationPickerScreen} />
        <Stack.Screen name="NotificationPermission" component={NotificationPermissionScreen} />
        <Stack.Screen name="FavoritesOnboarding" component={FavoritesOnboardingScreen} />
      </Stack.Navigator>
    </OnboardingContext.Provider>
  );
};

export default OnboardingNavigator;
