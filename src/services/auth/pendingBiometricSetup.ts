/**
 * pendingBiometricSetup — transient password handoff for the signup wizard.
 *
 * The biometric login feature stores email + password in SecureStore so the
 * user can later sign in with Face ID / fingerprint. EmailLoginScreen has
 * password in scope when prompting; SignupStep3 (the celebration screen)
 * does NOT — password was entered on a different screen (SignUpScreen,
 * step 2/3) and must not flow through navigation params (visible in dev
 * tools / state persistence).
 *
 * This module is the minimal in-memory bridge: SignUpScreen.handleSubmit
 * sets credentials on link/signup success; SignupStep3.handleCta consumes
 * (read + clear). The credentials live only in JS heap for the few
 * seconds between SignUp success and the user tapping the Step3 CTA.
 *
 * Safety:
 * - No persistence (no AsyncStorage / SecureStore writes from this module).
 * - `consume()` always clears, so a successful read can only happen once.
 * - On app foreground/background or unmount, the module-level ref drops
 *   with the JS context.
 */

interface PendingBiometricCredentials {
  email: string;
  password: string;
}

let pending: PendingBiometricCredentials | null = null;

/**
 * Stash credentials for a one-time biometric prompt downstream.
 * Subsequent calls overwrite the previous value.
 */
export const setPendingBiometricCredentials = (creds: PendingBiometricCredentials): void => {
  pending = { ...creds };
};

/**
 * Read and clear stashed credentials. Returns null if nothing pending.
 */
export const consumePendingBiometricCredentials = (): PendingBiometricCredentials | null => {
  if (!pending) return null;
  const creds = pending;
  pending = null;
  return creds;
};

/**
 * Test-only helper to reset state between specs.
 */
export const __resetPendingBiometricCredentials = (): void => {
  pending = null;
};
