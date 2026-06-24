/**
 * expo-server-sdk ESM loader (isolated for deploy-safety + testability).
 *
 * expo-server-sdk@6 ships as pure ESM (`type: "module"`). Under this project's
 * `module: "commonjs"` tsconfig, TypeScript down-levels a plain `await import()`
 * to `require()` (verified: emits `Promise.resolve().then(() => require(...))`),
 * which throws `ERR_REQUIRE_ESM` against a pure-ESM package — both at
 * `firebase deploy` discovery time (the function module is loaded to enumerate
 * exports, which is exactly where CI deploy was aborting) and at runtime on
 * Node < 20.19.
 *
 * Wrapping the import in `new Function` makes TypeScript emit a genuine native
 * dynamic `import()` (TS never parses the string body), which Node resolves as
 * ESM from a CommonJS module at runtime on any Node version — `ERR_REQUIRE_ESM`
 * only affects `require()`, never `import()`.
 *
 * Kept in its own module so tests can `jest.mock('./expoSdkLoader')`: a
 * `new Function`-created native `import()` bypasses jest's module registry, so
 * mocking the `expo-server-sdk` package directly would not take effect.
 */
import type { Expo as ExpoClass } from 'expo-server-sdk';

type ExpoModule = typeof import('expo-server-sdk');

// eslint-disable-next-line @typescript-eslint/no-implied-eval
const nativeImportExpoSdk = new Function(
  'return import("expo-server-sdk")',
) as () => Promise<ExpoModule>;

/** Lazily load the (ESM-only) Expo class from CommonJS. */
export async function loadExpo(): Promise<typeof ExpoClass> {
  const mod = await nativeImportExpoSdk();
  return mod.Expo;
}
