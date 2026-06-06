/**
 * Web polyfill for React Native's `Alert.alert`.
 *
 * react-native-web 0.19 ships `Alert` as a no-op (`static alert() {}`), so
 * every `Alert.alert(...)` across the app silently does nothing on Expo Web:
 * confirm dialogs never fire their button callbacks (e.g. deleting a favorite
 * appears unresponsive) and notification alerts never render. Rather than
 * rewrite ~160 call sites, we patch `Alert.alert` once at the web entry point
 * to bridge RN's button model onto the browser's native dialogs.
 *
 * Button mapping:
 *   - 0–1 buttons → `window.alert`, then invoke the single button's onPress
 *   - 2 buttons   → `window.confirm`; OK → the non-'cancel' button's onPress,
 *                   Cancel → the 'cancel' button's onPress
 *   - 3+ buttons  → `window.confirm` best-effort (OK → first non-'cancel'
 *                   button, Cancel → 'cancel' button). The third branch is
 *                   unreachable on web; the few such call sites degrade
 *                   gracefully. Upgrade to a styled modal if that matters.
 *
 * This is a deliberate boundary monkeypatch — the documented alternative is
 * mutating 160 call sites. Native platforms are untouched (early return).
 */
import { Alert, Platform, type AlertButton } from 'react-native';

export interface BrowserDialogs {
  readonly alert: (message?: string) => void;
  readonly confirm: (message?: string) => boolean;
}

const formatBody = (title?: string, message?: string): string => {
  if (title && message) return `${title}\n\n${message}`;
  return title ?? message ?? '';
};

/**
 * Pure web implementation of `Alert.alert`. Exported so it can be unit-tested
 * with fake dialogs instead of a real browser `window`.
 */
export const createWebAlert =
  (dialogs: BrowserDialogs) =>
  (title?: string, message?: string, buttons?: readonly AlertButton[]): void => {
    const body = formatBody(title, message);

    if (!buttons || buttons.length === 0) {
      dialogs.alert(body);
      return;
    }

    if (buttons.length === 1) {
      dialogs.alert(body);
      buttons[0]?.onPress?.();
      return;
    }

    const cancelButton = buttons.find((b) => b.style === 'cancel');
    const confirmButton =
      buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];

    if (dialogs.confirm(body)) {
      confirmButton?.onPress?.();
    } else {
      cancelButton?.onPress?.();
    }
  };

/**
 * Install the web polyfill. No-op on native and in non-browser environments
 * (e.g. SSR / tests without a global alert). Call once at app startup.
 */
export const installWebAlertPolyfill = (): void => {
  if (Platform.OS !== 'web') return;

  const globalDialogs = globalThis as unknown as Partial<BrowserDialogs>;
  if (
    typeof globalDialogs.alert !== 'function' ||
    typeof globalDialogs.confirm !== 'function'
  ) {
    return;
  }

  Alert.alert = createWebAlert({
    alert: globalDialogs.alert.bind(globalThis),
    confirm: globalDialogs.confirm.bind(globalThis),
  });
};
