/**
 * Onboarding Context
 * Manages onboarding state across the app
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETE_KEY = '@livemetro/onboarding_complete';
const SIGNUP_CELEBRATION_SEEN_KEY = '@livemetro/signup_celebration_seen';
const SIGNUP_TERMS_AGREED_KEY = '@livemetro/signup_terms_agreed';

interface OnboardingContextType {
  hasCompletedOnboarding: boolean | null;
  hasSeenSignupCelebration: boolean | null;
  /**
   * Tracks whether the current user has accepted the legally required
   * agreements (이용약관, 개인정보 처리방침, 만 14세 이상). Phone-only users
   * land on SignupStep2 before SignupStep3 to collect these. `null` while
   * the AsyncStorage check is in flight; `false` for new users; `true`
   * after `markTermsAgreed`.
   */
  hasAgreedToTerms: boolean | null;
  isCheckingStatus: boolean;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  /**
   * Resets ALL signup-related flags (onboarding completion, celebration
   * seen, terms agreed) for the current userId. Used by the dev-only
   * "Reset Onboarding" / "Delete Account" shortcuts so the next sign-in
   * re-runs the full SignupStep2 → SignupStep3 → Onboarding flow.
   * Distinct from `resetOnboarding` which only clears the completion flag.
   */
  resetSignupFlow: () => Promise<void>;
  markCelebrationSeen: () => Promise<void>;
  markTermsAgreed: () => Promise<void>;
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
  const [hasAgreedToTerms, setHasAgreedToTerms] = useState<boolean | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async (): Promise<void> => {
      if (!userId) {
        setHasCompletedOnboarding(null);
        setHasSeenSignupCelebration(null);
        setHasAgreedToTerms(null);
        setIsCheckingStatus(false);
        return;
      }

      try {
        const onboardingKey = `${ONBOARDING_COMPLETE_KEY}_${userId}`;
        const celebrationKey = `${SIGNUP_CELEBRATION_SEEN_KEY}_${userId}`;
        const termsKey = `${SIGNUP_TERMS_AGREED_KEY}_${userId}`;
        const [onboardingValue, celebrationValue, termsValue] = await Promise.all([
          AsyncStorage.getItem(onboardingKey),
          AsyncStorage.getItem(celebrationKey),
          AsyncStorage.getItem(termsKey),
        ]);
        setHasCompletedOnboarding(onboardingValue === 'true');
        setHasSeenSignupCelebration(celebrationValue === 'true');
        setHasAgreedToTerms(termsValue === 'true');
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setHasCompletedOnboarding(false);
        setHasSeenSignupCelebration(false);
        setHasAgreedToTerms(false);
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

  const resetSignupFlow = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const onboardingKey = `${ONBOARDING_COMPLETE_KEY}_${userId}`;
      const celebrationKey = `${SIGNUP_CELEBRATION_SEEN_KEY}_${userId}`;
      const termsKey = `${SIGNUP_TERMS_AGREED_KEY}_${userId}`;
      await Promise.all([
        AsyncStorage.removeItem(onboardingKey),
        AsyncStorage.removeItem(celebrationKey),
        AsyncStorage.removeItem(termsKey),
      ]);
      setHasCompletedOnboarding(false);
      setHasSeenSignupCelebration(false);
      setHasAgreedToTerms(false);
    } catch (error) {
      console.error('Error resetting signup flow:', error);
    }
  }, [userId]);

  const markTermsAgreed = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const key = `${SIGNUP_TERMS_AGREED_KEY}_${userId}`;
      await AsyncStorage.setItem(key, 'true');
      setHasAgreedToTerms(true);
    } catch (error) {
      console.error('Error saving terms agreement:', error);
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
        hasAgreedToTerms,
        isCheckingStatus,
        completeOnboarding,
        skipOnboarding,
        resetOnboarding,
        resetSignupFlow,
        markCelebrationSeen,
        markTermsAgreed,
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
