/**
 * Module augmentation for firebase v10's React Native auth persistence.
 *
 * firebase v10 ships `getReactNativePersistence` (and its
 * `ReactNativeAsyncStorage` storage interface) only in the React Native
 * entry point (`index.rn.d.ts`). tsc resolves `firebase/auth` to the
 * default web typings (`dist/auth/index.d.ts`) where both are absent —
 * even though Metro bundles the `.rn` variant at runtime, so the function
 * genuinely exists on the device.
 *
 * This augmentation re-declares the RN-only members for the type checker
 * with their real signatures, so callers stay fully type-checked. Remove
 * this file once firebase exposes them from the default entry point.
 *
 * See: src/services/firebase/config.ts
 */
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  /**
   * Minimal async storage contract firebase expects — satisfied by
   * `@react-native-async-storage/async-storage`.
   */
  export interface ReactNativeAsyncStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }

  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage,
  ): Persistence;
}
