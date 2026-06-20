/**
 * useCommuteReminderSync
 *
 * App-wide reconcile for the commute departure reminder. Mounted once in the
 * authenticated tree (AppContent) so that a user whose alert is already enabled
 * — the default `alertEnabled ?? true` — gets reminders scheduled on launch,
 * not only when they toggle the switch. Also reacts to commute-time / activeDays
 * changes (incl. edits made via EditCommuteRoute) so reminders never go stale.
 *
 * The reconcile is idempotent (cancel-before-schedule) and does NOT request
 * permission — the explicit toggle owns that interaction.
 */
import { useEffect } from 'react';
import { useAuth } from '@/services/auth/AuthContext';
import { useFirestoreMorningCommute } from '@/hooks/useFirestoreMorningCommute';
import { commuteReminderService } from '@/services/notification';

const DEFAULT_ACTIVE_DAYS: readonly boolean[] = [true, true, true, true, true, false, false];

export function useCommuteReminderSync(): void {
  const { user } = useAuth();
  const morning = useFirestoreMorningCommute(user?.id);

  const commuteSchedule = user?.preferences?.commuteSchedule;
  const alertEnabled = commuteSchedule?.alertEnabled ?? true;
  const activeDays = commuteSchedule?.activeDays ?? DEFAULT_ACTIVE_DAYS;
  const departureTime = morning?.departureTime;
  // Stable primitive key for the activeDays array so the effect doesn't re-run
  // on every render from a fresh array identity.
  const activeDaysKey = activeDays.join(',');

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    void commuteReminderService.reconcileCommuteReminders(uid, {
      alertEnabled,
      departureTime,
      activeDays,
    });
    // activeDaysKey is the stable dependency standing in for the activeDays array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, alertEnabled, departureTime, activeDaysKey]);
}

export default useCommuteReminderSync;
