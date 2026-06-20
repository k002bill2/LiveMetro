/**
 * usePushRegistration
 *
 * Mounted once in the authenticated tree (AppContent). Persists the device's
 * Expo push token + the lines the user cares about (derived from favorites'
 * lineIds) so the server can target real-time push (delay alerts) by line.
 * Reacts to favorites changes so the subscribed-lines set stays current.
 */
import { useEffect } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { pushTokenService } from '@/services/notification';

export function usePushRegistration(): void {
  const { user } = useAuth();
  const { favorites } = useFavorites();

  const lines = Array.from(new Set(favorites.map((f) => f.lineId).filter(Boolean)));
  const linesKey = lines.join(',');
  const uid = user?.id;

  useEffect(() => {
    if (!uid) return;
    void pushTokenService.registerPushToken(uid, lines);
    // linesKey is the stable primitive dep standing in for the lines array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, linesKey]);
}

export default usePushRegistration;
