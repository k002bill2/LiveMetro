import {
  StationSelection,
  TransferStation,
  CommuteNotifications,
  CommuteType,
} from '@/models/commute';

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
  PrivacyPolicy: undefined;
};

// Route data passed between onboarding screens
export interface OnboardingRouteData {
  departureTime: string;
  departureStation: StationSelection;
  arrivalStation: StationSelection;
  transferStations: TransferStation[];
  notifications?: CommuteNotifications;
}

export type OnboardingStackParamList = {
  // Step 1/4 — entry screen with brand graphic + value props.
  // Will become initialRouteName once Chunk 5 wires up the full flow.
  WelcomeOnboarding: undefined;
  CommuteTime: {
    commuteType: CommuteType;
    initialTime?: string;
    morningRoute?: OnboardingRouteData;
    onTimeSet: (time: string) => void;
    onSkip?: () => void;
  };
  CommuteRoute: {
    commuteType: CommuteType;
    departureTime: string;
    morningRoute?: OnboardingRouteData;
  };
  CommuteNotification: {
    commuteType: CommuteType;
    departureTime: string;
    departureStation: StationSelection;
    arrivalStation: StationSelection;
    transferStations: TransferStation[];
    morningRoute?: OnboardingRouteData;
  };
  CommuteComplete: {
    morningRoute: OnboardingRouteData;
    eveningRoute: OnboardingRouteData;
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

  // Route screens
  AlternativeRoutes: {
    fromStationId: string;
    toStationId: string;
    fromStationName: string;
    toStationName: string;
  };

  // ML Prediction screens
  WeeklyPrediction: undefined;
  AlertSettings: undefined;

  // Unauthenticated screens
  Welcome: undefined;
  Auth: undefined;
  EmailLogin: undefined;
  SignupStep1: undefined;
  SignUp: undefined;
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
