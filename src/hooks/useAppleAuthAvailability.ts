/**
 * useAppleAuthAvailability — resolves whether Apple sign-in is usable on this
 * device (iOS + `isAvailableAsync`). Returns false until the async check
 * resolves; the effect guards against setting state after unmount.
 */
import { useEffect, useState } from 'react';

import { isAppleSignInAvailable } from '@/services/auth/social/appleSignIn';

export function useAppleAuthAvailability(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isAppleSignInAvailable()
      .then((result) => {
        if (!cancelled) {
          setAvailable(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailable(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}
