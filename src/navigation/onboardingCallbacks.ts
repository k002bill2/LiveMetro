/**
 * Onboarding callbacks context
 *
 * Extracted from OnboardingNavigator to break a runtime require cycle:
 * the navigator imports the onboarding screens, and those screens need the
 * callback hooks. Both sides now depend on this leaf module instead of each
 * other, so the dependency graph stays acyclic
 * (screens -> onboardingCallbacks <- OnboardingNavigator).
 *
 * Named `OnboardingCallbacksContext` rather than `OnboardingContext` to stay
 * distinguishable from `@/contexts/OnboardingContext`, which holds onboarding
 * flow state and is an unrelated concern.
 */

import { createContext, useContext } from 'react';

export interface OnboardingContextType {
  onComplete: () => void;
  onSkip: () => void;
}

export const OnboardingCallbacksContext = createContext<OnboardingContextType | undefined>(
  undefined,
);

/** Access onboarding callbacks. Throws when used outside OnboardingNavigator. */
export const useOnboardingCallbacks = (): OnboardingContextType => {
  const context = useContext(OnboardingCallbacksContext);
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
  const context = useContext(OnboardingCallbacksContext);
  return context ?? null;
};
