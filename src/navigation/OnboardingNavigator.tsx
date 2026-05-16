/**
 * Onboarding Navigator
 * Stack navigator for the commute setup onboarding flow
 */

import React, { createContext, useContext, useCallback, type ComponentType } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { OnboardingStackParamList } from './types';
import { WelcomeOnboardingScreen } from '@/screens/onboarding/WelcomeOnboardingScreen';
import { CommuteRouteScreen } from '@/screens/onboarding/CommuteRouteScreen';
import { OnboardingStationPickerScreen } from '@/screens/onboarding/OnboardingStationPickerScreen';
import { CommuteTimeScreen } from '@/screens/onboarding/CommuteTimeScreen';
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

// Optional variant: returns null when used outside OnboardingNavigator.
// CommuteRouteScreen reuses this hook in both the onboarding stack and
// the settings stack (EditCommuteRoute); the latter has no provider, so
// the strict variant would throw. Rules-of-Hooks compliant because the
// hook is always called unconditionally.
export const useOnboardingCallbacksOptional = (): OnboardingContextType | null => {
  const context = useContext(OnboardingContext);
  return context ?? null;
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
        {/* CommuteRouteScreen + OnboardingStationPickerScreen use union
            Props (this stack ∪ SettingsStack.EditCommuteRoute/Picker) so
            the same component can host both flows. Stack.Screen's
            `component` prop is invariant in its Props, so cast each
            registration to the precise typed-Props shape for THIS stack. */}
        <Stack.Screen
          name="CommuteRoute"
          component={
            CommuteRouteScreen as ComponentType<
              NativeStackScreenProps<OnboardingStackParamList, 'CommuteRoute'>
            >
          }
        />
        <Stack.Screen
          name="OnboardingStationPicker"
          component={
            OnboardingStationPickerScreen as ComponentType<
              NativeStackScreenProps<OnboardingStackParamList, 'OnboardingStationPicker'>
            >
          }
        />
        <Stack.Screen name="CommuteTime" component={CommuteTimeScreen} />
        <Stack.Screen name="NotificationPermission" component={NotificationPermissionScreen} />
        <Stack.Screen name="FavoritesOnboarding" component={FavoritesOnboardingScreen} />
      </Stack.Navigator>
    </OnboardingContext.Provider>
  );
};

export default OnboardingNavigator;
