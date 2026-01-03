/**
 * Onboarding Navigator
 * Stack navigator for the commute setup onboarding flow
 */

import React, { createContext, useContext, useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from './types';
import { CommuteTimeScreen } from '@/screens/onboarding/CommuteTimeScreen';
import { CommuteRouteScreen } from '@/screens/onboarding/CommuteRouteScreen';
import { CommuteNotificationScreen } from '@/screens/onboarding/CommuteNotificationScreen';
import { CommuteCompleteScreen } from '@/screens/onboarding/CommuteCompleteScreen';
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
  // Handle time set for morning commute
  const handleMorningTimeSet = useCallback(() => {
    // Time is already passed via route params
  }, []);

  // Handle skip onboarding
  const handleSkipOnboarding = useCallback(() => {
    if (onSkip) {
      onSkip();
    }
  }, [onSkip]);

  // Handle complete onboarding
  const handleComplete = useCallback(() => {
    if (onComplete) {
      onComplete();
    }
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
        initialRouteName="CommuteTime"
      >
        <Stack.Screen
          name="CommuteTime"
          component={CommuteTimeScreen}
          initialParams={{
            commuteType: 'morning',
            onTimeSet: handleMorningTimeSet,
            onSkip: handleSkipOnboarding,
          }}
        />
        <Stack.Screen name="CommuteRoute" component={CommuteRouteScreen} />
        <Stack.Screen
          name="CommuteNotification"
          component={CommuteNotificationScreen}
        />
        <Stack.Screen name="CommuteComplete" component={CommuteCompleteScreen} />
      </Stack.Navigator>
    </OnboardingContext.Provider>
  );
};

export default OnboardingNavigator;
