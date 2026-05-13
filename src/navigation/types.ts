import {
  StationSelection,
  TransferStation,
  CommuteNotifications,
} from '@/models/commute';

// LEGACY: AppNavigator (4-tab) is dead code as of Phase 56. The active
// navigator is RootNavigator with `MainTabParamList` (5 tabs). Kept here
// only because src/navigation/AppNavigator.tsx still imports it for type
// inference. Do not add new tabs to this list — update RootNavigator's
// MainTabParamList instead.
export type AppTabParamList = {
  Home: undefined;
  Favorites: undefined;
  Alerts: undefined;
  Settings: undefined;
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  EditProfile: undefined;
  CommuteSettings: undefined;
  DelayNotification: undefined;
  NotificationTime: undefined;
  SoundSettings: undefined;
  LanguageSettings: undefined;
  ThemeSettings: undefined;
  LocationPermission: undefined;
  Help: undefined;
  Feedback: undefined;
  PrivacyPolicy: undefined;
};

// Route data passed between onboarding screens.
//
// `departureTime` carries the morning leg time. `eveningDepartureTime` is
// optional so the type stays backward-compatible with callers that only
// configure morning; FavoritesOnboarding falls back to a default ('18:30')
// when committing the evening leg if it's missing.
export interface OnboardingRouteData {
  departureTime: string;
  eveningDepartureTime?: string;
  departureStation: StationSelection;
  arrivalStation: StationSelection;
  transferStations: TransferStation[];
  notifications?: CommuteNotifications;
}

// Phase 52: handoff payload returned from OnboardingStationPicker → CommuteRoute
// via navigation.navigate(..., { merge: true }). Serializable so React Navigation
// doesn't warn; consumed once by CommuteRoute's useEffect then cleared.
export interface PickedStationPayload {
  selectionType: 'departure' | 'arrival' | 'transfer';
  station: StationSelection;
}

export type OnboardingStackParamList = {
  // 5-step onboarding flow (image 17 reintroduces the dedicated time step):
  //   1/5 Welcome (brand + value props, no params)
  //   2/5 CommuteRoute (route picker — defaults departureTime to '08:00')
  //   3/5 CommuteTime (chip-based departure time picker, finalises route data)
  //   4/5 NotificationPermission (OS prompt + alert toggles)
  //   5/5 FavoritesOnboarding (commit + onComplete)
  // OnboardingStationPicker: full-screen drill-in from CommuteRoute — not a
  // numbered step (returns to CommuteRoute via merged params).
  WelcomeOnboarding: undefined;
  CommuteRoute: { pickedStation?: PickedStationPayload } | undefined;
  OnboardingStationPicker: {
    selectionType: 'departure' | 'arrival' | 'transfer';
    excludeStationIds: string[];
    currentName?: string;
  };
  CommuteTime: {
    route: OnboardingRouteData;
  };
  NotificationPermission: {
    route: OnboardingRouteData;
  };
  FavoritesOnboarding: {
    route: OnboardingRouteData;
    notificationGranted: boolean;
    notifications: CommuteNotifications;
  };
};

export type AppStackParamList = {
  // Authenticated screens
  MainTabs: undefined;
  StationDetail: {
    stationId: string;
    stationName: string;
    lineId: string;
  };
  StationNavigator: {
    stationId: string;
    lineId: string;
    mode?: 'departure' | 'arrival';
  };

  // Delay screens
  DelayCertificate: undefined;
  DelayFeed: {
    lineId?: string;
  } | undefined;
  ReportDetail: { reportId: string };
  ReportFeedback: { reportId: string };

  // Route screens
  AlternativeRoutes: {
    fromStationId: string;
    toStationId: string;
    fromStationName: string;
    toStationName: string;
  };
  // Phase 56: top-level routes still navigable via QuickActionsGrid
  // (노선도) and HomeTopBar (Bell) after their tabs were removed.
  SubwayMap: undefined;
  Alerts: undefined;

  // ML Prediction screens
  WeeklyPrediction: undefined;
  AlertSettings: undefined;

  // Unauthenticated screens
  Auth: undefined;
  EmailLogin: undefined;
  SignupStep1: undefined;
  SignUp: undefined;
  SignupStep2: undefined;
  SignupStep3: undefined;
  // Post-auth/!hasCompletedOnboarding stack — shown when a phone-only user
  // (created by Step1 OTP verification) needs to attach email + password.
  EmailLink: undefined;

  // Onboarding screens
  Onboarding: undefined;
};

// Type alias for code that historically imported `RootStackParamList` from
// here. The OUTER navigator's true definition lives in
// `./RootNavigator.tsx` (it has different route names like `Main` vs the
// `MainTabs` route that lives in `AppStackParamList`). When adding new
// outer-stack routes (Welcome, Auth, EmailLogin, SignUp, Onboarding,
// modals), update both this `AppStackParamList` AND
// `RootNavigator.tsx#RootStackParamList` to keep the two in sync.
export type RootStackParamList = AppStackParamList;
