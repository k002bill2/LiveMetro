/**
 * Onboarding Context
 * Manages onboarding state across the app
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETE_KEY = '@livemetro/onboarding_complete';

interface OnboardingContextType {
  hasCompletedOnboarding: boolean | null;
  isCheckingStatus: boolean;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
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
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async (): Promise<void> => {
      if (!userId) {
        setHasCompletedOnboarding(null);
        setIsCheckingStatus(false);
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

  return (
    <OnboardingContext.Provider
      value={{
        hasCompletedOnboarding,
        isCheckingStatus,
        completeOnboarding,
        skipOnboarding,
        resetOnboarding,
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
