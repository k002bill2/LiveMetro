/**
 * NotificationTimeScreen Test Suite (Phase 51 — Wanted 알림 시간대 handoff)
 *
 * Covers the recomposed screen: timeline + commute alert rows + quiet hours +
 * the "주말은 종일 무음" toggle. Critical regression guard (plan D2): that
 * weekend toggle must write the *wired* `weekdaysOnly` field, NOT the unwired
 * legacy `weekendsAlwaysSilent`.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { NotificationTimeScreen } from '../NotificationTimeScreen';
import { useAuth } from '@/services/auth/AuthContext';
import { useFirestoreCommuteRoutes } from '@/hooks/useFirestoreCommuteRoutes';
import { cancelAlightAlert } from '@/services/notification/alightAlertService';

jest.mock('@/services/theme', () => ({
  useSemanticTokens: jest.fn(() =>
    jest.requireActual('@/styles/modernTheme').WANTED_TOKENS.light
  ),
  useTheme: () => ({ isDark: false }),
}));

jest.mock('@/services/auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/components/common/Toast', () => ({
  __esModule: true,
  useToast: () => ({ showSuccess: () => {}, ToastComponent: () => null }),
}));

jest.mock('@/components/settings/NotificationTimeline', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => ReactLocal.createElement(View, { testID: 'notification-timeline' }),
    // Screen imports parseTime for deriveWindowEnd — provide a real impl.
    parseTime: (t: string): number => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim());
      return m ? parseInt(m[1]!, 10) + parseInt(m[2]!, 10) / 60 : 0;
    },
  };
});

jest.mock('@/components/settings/CommuteAlertRow', () => {
  const ReactLocal = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      badgeLabel,
      caption,
      startTime,
      endTime,
      locked,
      onLockedPress,
      testID,
    }: {
      badgeLabel: string;
      caption: string;
      startTime: string;
      endTime: string;
      locked?: boolean;
      onLockedPress?: () => void;
      testID?: string;
    }) =>
      ReactLocal.createElement(
        Pressable,
        {
          testID,
          // Mirror real behavior: a locked row routes to setup; an unlocked
          // (resolved) row is read-only.
          onPress: locked ? onLockedPress : undefined,
        },
        ReactLocal.createElement(Text, null, badgeLabel),
        ReactLocal.createElement(Text, null, caption),
        ReactLocal.createElement(Text, { testID: `${testID}-start` }, startTime),
        ReactLocal.createElement(Text, { testID: `${testID}-end` }, endTime),
        ReactLocal.createElement(
          Text,
          { testID: `${testID}-locked` },
          String(!!locked)
        )
      ),
  };
});

// Store #2 (Firestore commuteSettings) reader — default: nothing set.
jest.mock('@/hooks/useFirestoreCommuteRoutes', () => ({
  __esModule: true,
  useFirestoreCommuteRoutes: jest.fn(() => ({ morning: null, evening: null })),
}));

jest.mock('@/components/settings/TimeFieldBox', () => {
  const ReactLocal = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      value,
      onChange,
      testID,
    }: {
      label: string;
      value: string;
      onChange?: (t: string) => void;
      testID?: string;
    }) =>
      ReactLocal.createElement(
        Pressable,
        { testID, onPress: onChange ? () => onChange('23:30') : undefined },
        ReactLocal.createElement(Text, null, label),
        ReactLocal.createElement(Text, null, value)
      ),
  };
});

jest.mock('@/components/settings/SettingSection', () => {
  const ReactLocal = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, children }: { title: string; children: React.ReactNode }) =>
      ReactLocal.createElement(
        View,
        { testID: `section-${title}` },
        ReactLocal.createElement(Text, null, title),
        children
      ),
  };
});

jest.mock('@/components/settings/SettingToggle', () => {
  const ReactLocal = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      label,
      subtitle,
      value,
      onValueChange,
      disabled,
    }: {
      label: string;
      subtitle?: string;
      value: boolean;
      onValueChange: (v: boolean) => void;
      disabled?: boolean;
    }) =>
      ReactLocal.createElement(
        Pressable,
        {
          testID: `toggle-${label}`,
          onPress: disabled ? undefined : () => onValueChange(!value),
        },
        ReactLocal.createElement(Text, null, label),
        subtitle && ReactLocal.createElement(Text, null, subtitle)
      ),
  };
});

jest.mock('@/services/notification/alightAlertService', () => ({
  __esModule: true,
  cancelAlightAlert: jest.fn().mockResolvedValue(undefined),
}));

const mockCancelAlightAlert = cancelAlightAlert as jest.MockedFunction<
  typeof cancelAlightAlert
>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockFsRoutes = useFirestoreCommuteRoutes as jest.MockedFunction<
  typeof useFirestoreCommuteRoutes
>;

const createNavigation = () =>
  ({
    setOptions: jest.fn(),
    canGoBack: jest.fn(() => true),
    goBack: jest.fn(),
    navigate: jest.fn(),
  }) as any;

const renderScreen = (nav = createNavigation()) => ({
  nav,
  ...render(<NotificationTimeScreen navigation={nav} route={{} as any} />),
});

const usableCommute = {
  morningCommute: {
    departureTime: '08:00',
    stationId: 'station-1',
    destinationStationId: 'station-2',
    bufferMinutes: 10,
  },
  eveningCommute: {
    departureTime: '18:00',
    stationId: 'station-2',
    destinationStationId: 'station-1',
    bufferMinutes: 10,
  },
};

const createDefaultUser = (overrides: Record<string, unknown> = {}) => ({
  uid: 'test-uid',
  displayName: 'Test User',
  email: 'test@example.com',
  preferences: {
    favoriteStations: [],
    notificationSettings: {
      pushNotifications: true,
      weekdaysOnly: false,
      quietHours: { enabled: false, startTime: '23:00', endTime: '07:00' },
    },
    commuteSchedule: { weekdays: usableCommute },
    ...overrides,
  },
});

const mockAuth = (user: unknown, update = jest.fn().mockResolvedValue(undefined)) => {
  mockUseAuth.mockReturnValue({
    user,
    firebaseUser: null,
    loading: false,
    signInAnonymously: jest.fn(),
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    signOut: jest.fn(),
    updateUserPreferences: update,
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  } as any);
  return update;
};

describe('NotificationTimeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFsRoutes.mockReturnValue({ morning: null, evening: null });
    mockAuth(createDefaultUser());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders the 24h timeline', () => {
      const { getByTestId } = renderScreen();
      expect(getByTestId('notification-timeline')).toBeTruthy();
    });

    it('renders the commute alert section with both legs', () => {
      const { getByTestId, getByText } = renderScreen();
      expect(getByTestId('section-출퇴근 알림 시간')).toBeTruthy();
      expect(getByTestId('commute-morning')).toBeTruthy();
      expect(getByTestId('commute-evening')).toBeTruthy();
      expect(getByText('출근')).toBeTruthy();
      expect(getByText('퇴근')).toBeTruthy();
    });

    it('shows the commute departure as start and derived window as end', () => {
      const { getByTestId } = renderScreen();
      // morning 08:00 → end 08:00 + 2h = 10:00
      expect(getByTestId('commute-morning-start')).toHaveTextContent('08:00');
      expect(getByTestId('commute-morning-end')).toHaveTextContent('10:00');
      // evening 18:00 → end 18:00 + 3h = 21:00
      expect(getByTestId('commute-evening-start')).toHaveTextContent('18:00');
      expect(getByTestId('commute-evening-end')).toHaveTextContent('21:00');
    });

    it('renders the quiet hours section and weekend toggle', () => {
      const { getByTestId } = renderScreen();
      expect(getByTestId('section-방해 금지')).toBeTruthy();
      expect(getByTestId('toggle-방해 금지 사용')).toBeTruthy();
      expect(getByTestId('toggle-주말은 종일 무음')).toBeTruthy();
    });

    it('renders the footer disclosure', () => {
      const { getByText } = renderScreen();
      expect(getByText(/긴급 지연 알림도 무음으로 와요/)).toBeTruthy();
    });

    it('shows quiet time fields only when quiet hours enabled', () => {
      mockAuth(
        createDefaultUser({
          notificationSettings: {
            weekdaysOnly: false,
            quietHours: { enabled: true, startTime: '23:00', endTime: '07:00' },
          },
        })
      );
      const { getByTestId } = renderScreen();
      expect(getByTestId('quiet-start')).toBeTruthy();
      expect(getByTestId('quiet-end')).toBeTruthy();
    });

    it('hides quiet time fields when quiet hours disabled', () => {
      const { queryByTestId } = renderScreen();
      expect(queryByTestId('quiet-start')).toBeNull();
      expect(queryByTestId('quiet-end')).toBeNull();
    });

    it('falls back to default times when preferences are absent', () => {
      mockAuth({
        uid: 'test-uid',
        preferences: {
          notificationSettings: { quietHours: {} },
          commuteSchedule: { weekdays: {} },
        },
      });
      const { getByTestId } = renderScreen();
      expect(getByTestId('commute-morning-start')).toHaveTextContent('08:00');
      expect(getByTestId('commute-evening-start')).toHaveTextContent('18:00');
    });

    it('handles null notificationSettings without crashing', () => {
      mockAuth({
        uid: 'test-uid',
        preferences: {
          notificationSettings: null,
          commuteSchedule: { weekdays: usableCommute },
        },
      });
      const { getByTestId } = renderScreen();
      expect(getByTestId('toggle-방해 금지 사용')).toBeTruthy();
    });
  });

  describe('Commute resolution (store #1 / store #2)', () => {
    it('marks a usable profile (store #1) commute as not locked', () => {
      mockAuth(createDefaultUser());
      const { getByTestId } = renderScreen();
      expect(getByTestId('commute-morning-locked')).toHaveTextContent('false');
      expect(getByTestId('commute-evening-locked')).toHaveTextContent('false');
    });

    it('resolves a commute from Firestore (store #2) when the profile leg is unusable', () => {
      // Profile (#1) morning is a phantom (empty station ids); the real route
      // lives in Firestore (#2). The row must show the #2 time and not lock.
      mockFsRoutes.mockReturnValue({
        morning: {
          departureTime: '07:40',
          stationId: 'fs-1',
          destinationStationId: 'fs-2',
          bufferMinutes: 5,
        },
        evening: null,
      });
      mockAuth(
        createDefaultUser({
          commuteSchedule: {
            weekdays: {
              morningCommute: {
                departureTime: '08:00',
                stationId: '',
                destinationStationId: '',
                bufferMinutes: 10,
              },
              eveningCommute: null,
            },
          },
        })
      );
      const { getByTestId } = renderScreen();
      expect(getByTestId('commute-morning-locked')).toHaveTextContent('false');
      expect(getByTestId('commute-morning-start')).toHaveTextContent('07:40');
      // 07:40 + 2h = 09:40 derived end
      expect(getByTestId('commute-morning-end')).toHaveTextContent('09:40');
    });

    it('locks the row and routes to setup when neither store has the commute', () => {
      mockFsRoutes.mockReturnValue({ morning: null, evening: null });
      mockAuth(
        createDefaultUser({
          commuteSchedule: {
            weekdays: {
              morningCommute: {
                departureTime: '08:00',
                stationId: '',
                destinationStationId: '',
                bufferMinutes: 10,
              },
              eveningCommute: null,
            },
          },
        })
      );
      const { getByTestId } = renderScreen();
      expect(getByTestId('commute-morning-locked')).toHaveTextContent('true');

      fireEvent.press(getByTestId('commute-morning'));
      expect(Alert.alert).toHaveBeenCalledWith(
        '출근 경로 먼저 설정',
        expect.any(String),
        expect.any(Array)
      );
    });

    it('navigates to CommuteSettings from the locked-row guide action', () => {
      mockAuth(
        createDefaultUser({
          commuteSchedule: { weekdays: { morningCommute: null, eveningCommute: null } },
        })
      );
      const nav = createNavigation();
      const { getByTestId } = renderScreen(nav);
      fireEvent.press(getByTestId('commute-morning'));

      // Invoke the "설정으로 이동" button from the Alert's action array.
      const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)![2];
      const go = buttons.find((b: { text: string }) => b.text === '설정으로 이동');
      go.onPress();
      expect(nav.navigate).toHaveBeenCalledWith('CommuteSettings');
    });
  });

  describe('Quiet hours interactions', () => {
    it('toggles quiet hours enabled', async () => {
      const update = mockAuth(createDefaultUser());
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId('toggle-방해 금지 사용'));
      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({
              quietHours: expect.objectContaining({ enabled: true }),
            }),
          })
        )
      );
    });

    it('persists the quiet hours start and end times', async () => {
      const update = mockAuth(
        createDefaultUser({
          notificationSettings: {
            weekdaysOnly: false,
            quietHours: { enabled: true, startTime: '23:00', endTime: '07:00' },
          },
        })
      );
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId('quiet-start'));
      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({
              quietHours: expect.objectContaining({ startTime: '23:30' }),
            }),
          })
        )
      );

      fireEvent.press(getByTestId('quiet-end'));
      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({
              quietHours: expect.objectContaining({ endTime: '23:30' }),
            }),
          })
        )
      );
    });
  });

  describe('Weekend silence (D2 honesty guard)', () => {
    it('writes the WIRED weekdaysOnly field, not the unwired weekendsAlwaysSilent', async () => {
      const update = mockAuth(createDefaultUser());
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId('toggle-주말은 종일 무음'));

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({ weekdaysOnly: true }),
          })
        )
      );

      // Guard: the payload must NOT route through quietHours.weekendsAlwaysSilent.
      const payload = update.mock.calls[0]![0] as {
        notificationSettings?: { quietHours?: { weekendsAlwaysSilent?: boolean } };
      };
      expect(payload.notificationSettings?.quietHours?.weekendsAlwaysSilent).toBeUndefined();
    });
  });

  describe('하차 임박 알림 설정', () => {
    it('기본값으로 토글 ON + 2분 전이 선택되어 렌더된다 (alightAlert 필드 없는 기존 사용자)', () => {
      // Default user has no alightAlert field → resolves to { enabled: true, leadMinutes: 2 }.
      const { getByTestId } = renderScreen();
      // Toggle ON → chips render.
      expect(getByTestId('alight-lead-1')).toBeTruthy();
      expect(getByTestId('alight-lead-2')).toBeTruthy();
      expect(getByTestId('alight-lead-3')).toBeTruthy();
      // 2분 chip is the active selection; the others are not.
      expect(getByTestId('alight-lead-2').props.accessibilityState.selected).toBe(true);
      expect(getByTestId('alight-lead-1').props.accessibilityState.selected).toBe(false);
      expect(getByTestId('alight-lead-3').props.accessibilityState.selected).toBe(false);
    });

    it('토글 OFF 시 updateUserPreferences를 alightAlert 부분으로 호출한다', async () => {
      const update = mockAuth(createDefaultUser());
      const { getByTestId } = renderScreen();
      // Mock SettingToggle press flips the current value (true → false).
      fireEvent.press(getByTestId('toggle-하차 임박 알림'));
      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({
              alightAlert: { enabled: false, leadMinutes: 2 },
            }),
          })
        )
      );
      // Partial write guard: sibling notification fields must survive.
      const payload = update.mock.calls[0]![0] as {
        notificationSettings?: { pushNotifications?: boolean };
      };
      expect(payload.notificationSettings?.pushNotifications).toBe(true);
    });

    it('사전 시간 칩(3분) 선택 시 leadMinutes를 저장한다', async () => {
      const update = mockAuth(createDefaultUser());
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId('alight-lead-3'));
      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({
            notificationSettings: expect.objectContaining({
              alightAlert: { enabled: true, leadMinutes: 3 },
            }),
          })
        )
      );
    });

    it('형제(주말) 저장 in-flight 동안 alight 토글이 게이트되어 stale 스프레드를 막는다', async () => {
      // Sibling save leaves saving=true (pending). While in flight, the alight
      // toggle must be disabled — otherwise it spreads a pre-save
      // notificationSettings snapshot and clobbers the just-written weekdaysOnly.
      let resolveUpdate!: () => void;
      const update = jest.fn().mockReturnValue(
        new Promise<void>((res) => {
          resolveUpdate = () => res();
        })
      );
      mockAuth(createDefaultUser(), update);
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId('toggle-주말은 종일 무음'));
      expect(update).toHaveBeenCalledTimes(1);

      // Alight toggle is gated while the sibling save is in flight.
      fireEvent.press(getByTestId('toggle-하차 임박 알림'));
      expect(update).toHaveBeenCalledTimes(1);

      // Cleanup: resolve the pending save so saving resets to false.
      await act(async () => {
        resolveUpdate();
      });
    });

    it('형제(주말) 저장 in-flight 동안 lead 칩이 게이트된다', async () => {
      let resolveUpdate!: () => void;
      const update = jest.fn().mockReturnValue(
        new Promise<void>((res) => {
          resolveUpdate = () => res();
        })
      );
      mockAuth(createDefaultUser(), update);
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId('toggle-주말은 종일 무음'));
      expect(update).toHaveBeenCalledTimes(1);

      // Lead chip is disabled while the sibling save is in flight.
      fireEvent.press(getByTestId('alight-lead-3'));
      expect(update).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveUpdate();
      });
    });

    it('토글 OFF 시 pending/고아 알림을 취소한다 (cancelAlightAlert 호출)', async () => {
      // Firestore write alone can't stop an already-scheduled local alert when
      // RouteGuidanceScreen is unmounted — cancel must fire on OFF.
      const update = mockAuth(createDefaultUser());
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId('toggle-하차 임박 알림'));
      await waitFor(() => expect(update).toHaveBeenCalled());
      expect(mockCancelAlightAlert).toHaveBeenCalledTimes(1);
    });

    it('토글 ON(꺼짐 상태에서 켤 때) 시에는 취소하지 않는다', async () => {
      const update = mockAuth(
        createDefaultUser({
          notificationSettings: {
            pushNotifications: true,
            weekdaysOnly: false,
            quietHours: { enabled: false, startTime: '23:00', endTime: '07:00' },
            alightAlert: { enabled: false, leadMinutes: 2 },
          },
        })
      );
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId('toggle-하차 임박 알림'));
      await waitFor(() => expect(update).toHaveBeenCalled());
      expect(mockCancelAlightAlert).not.toHaveBeenCalled();
    });

    it('lead 칩 변경(계속 켜짐) 시에는 취소하지 않는다', async () => {
      const update = mockAuth(createDefaultUser());
      const { getByTestId } = renderScreen();
      fireEvent.press(getByTestId('alight-lead-3'));
      await waitFor(() => expect(update).toHaveBeenCalled());
      expect(mockCancelAlightAlert).not.toHaveBeenCalled();
    });

    it('토글 OFF 상태에서는 사전 시간 칩이 렌더되지 않는다', () => {
      mockAuth(
        createDefaultUser({
          notificationSettings: {
            pushNotifications: true,
            weekdaysOnly: false,
            quietHours: { enabled: false, startTime: '23:00', endTime: '07:00' },
            alightAlert: { enabled: false, leadMinutes: 2 },
          },
        })
      );
      const { queryByTestId } = renderScreen();
      expect(queryByTestId('alight-lead-1')).toBeNull();
      expect(queryByTestId('alight-lead-2')).toBeNull();
      expect(queryByTestId('alight-lead-3')).toBeNull();
    });
  });

  describe('Header save action', () => {
    it('registers a "저장" header button that pops back', () => {
      jest.useFakeTimers();
      try {
        const nav = createNavigation();
        renderScreen(nav);

        const opts = nav.setOptions.mock.calls.at(-1)![0];
        expect(opts.headerRight).toBeTruthy();

        const { getByText } = render(opts.headerRight());
        fireEvent.press(getByText('저장'));
        jest.advanceTimersByTime(900);

        expect(nav.goBack).toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
