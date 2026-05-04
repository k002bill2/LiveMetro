/**
 * Onboarding Context
 * Manages onboarding state across the app
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETE_KEY = '@livemetro/onboarding_complete';
const SIGNUP_CELEBRATION_SEEN_KEY = '@livemetro/signup_celebration_seen';

interface OnboardingContextType {
  hasCompletedOnboarding: boolean | null;
  hasSeenSignupCelebration: boolean | null;
  isCheckingStatus: boolean;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  markCelebrationSeen: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

interface OnboardingProviderProps {
  children: React.ReactNode;
  userId: string | undefined;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({
  children,
  userId,
}) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [hasSeenSignupCelebration, setHasSeenSignupCelebration] = useState<boolean | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async (): Promise<void> => {
      if (!userId) {
        setHasCompletedOnboarding(null);
        setHasSeenSignupCelebration(null);
        setIsCheckingStatus(false);
        return;
      }

      try {
        const onboardingKey = `${ONBOARDING_COMPLETE_KEY}_${userId}`;
        const celebrationKey = `${SIGNUP_CELEBRATION_SEEN_KEY}_${userId}`;
        const [onboardingValue, celebrationValue] = await Promise.all([
          AsyncStorage.getItem(onboardingKey),
          AsyncStorage.getItem(celebrationKey),
        ]);
        setHasCompletedOnboarding(onboardingValue === 'true');
        setHasSeenSignupCelebration(celebrationValue === 'true');
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setHasCompletedOnboarding(false);
        setHasSeenSignupCelebration(false);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkOnboardingStatus();
  }, [userId]);

  const completeOnboarding = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const key = `${ONBOARDING_COMPLETE_KEY}_${userId}`;
      await AsyncStorage.setItem(key, 'true');
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  }, [userId]);

  const skipOnboarding = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const key = `${ONBOARDING_COMPLETE_KEY}_${userId}`;
      await AsyncStorage.setItem(key, 'true');
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  }, [userId]);

  const resetOnboarding = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const key = `${ONBOARDING_COMPLETE_KEY}_${userId}`;
      await AsyncStorage.removeItem(key);
      setHasCompletedOnboarding(false);
    } catch (error) {
      console.error('Error resetting onboarding status:', error);
    }
  }, [userId]);

  const markCelebrationSeen = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const key = `${SIGNUP_CELEBRATION_SEEN_KEY}_${userId}`;
      await AsyncStorage.setItem(key, 'true');
      setHasSeenSignupCelebration(true);
    } catch (error) {
      console.error('Error saving signup celebration flag:', error);
    }
  }, [userId]);

  return (
    <OnboardingContext.Provider
      value={{
        hasCompletedOnboarding,
        hasSeenSignupCelebration,
        isCheckingStatus,
        completeOnboarding,
        skipOnboarding,
        resetOnboarding,
        markCelebrationSeen,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

export default OnboardingContext;
