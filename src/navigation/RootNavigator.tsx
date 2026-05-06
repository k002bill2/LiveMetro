/**
 * Root Navigator Component
 * Main navigation structure for the app
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Home,
  Star,
  Route as RouteIcon,
  Megaphone,
  User,
  CircleHelp,
} from 'lucide-react-native';

import { useAuth } from '../services/auth/AuthContext';
import { useTheme } from '../services/theme';
import { WANTED_TOKENS, weightToFontFamily } from '../styles/modernTheme';
import { LoadingScreen } from '../components/common/LoadingScreen';
import { OnboardingProvider, useOnboarding } from '../contexts/OnboardingContext';

// Import screens
import { AuthScreen } from '../screens/auth/AuthScreen';
import { EmailLoginScreen } from '../screens/auth/EmailLoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { SignupStep1Screen } from '../screens/auth/SignupStep1Screen';
import { SignupStep2Screen } from '../screens/auth/SignupStep2Screen';
import { SignupStep3Screen } from '../screens/auth/SignupStep3Screen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { SubwayMapScreen } from '../screens/map/SubwayMapScreen';
import { FavoritesScreen } from '../screens/favorites/FavoritesScreen';
import { AlertsScreen } from '../screens/alerts/AlertsScreen';
import { SettingsNavigator } from './SettingsNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import StationNavigatorScreen from '../screens/station/StationNavigatorScreen';
import StationDetailScreen from '../screens/station/StationDetailScreen';
import { DelayCertificateScreen } from '../screens/delays/DelayCertificateScreen';
import { DelayFeedScreen } from '../screens/delays/DelayFeedScreen';
import { AlternativeRoutesScreen } from '../screens/route/AlternativeRoutesScreen';
import { RoutesTabScreen } from '../screens/route/RoutesTabScreen';

// DEBUG: Set to true to always show onboarding screen during development
const DEBUG_FORCE_ONBOARDING = __DEV__ && false;

// Navigation types
//
// NOTE: This `RootStackParamList` describes the OUTER (root) navigator —
// Welcome, Auth, Onboarding, Main, plus the modal stack (StationDetail,
// DelayCertificate, AlternativeRoutes, EmailLogin, SignUp). The INNER
// authenticated stack (MainTabs, etc.) lives in `./types.ts` as
// `AppStackParamList`. The two stacks have overlapping but non-identical
// route sets (e.g. this file uses `Main`, types.ts uses `MainTabs`), so
// they intentionally remain separate.
export type RootStackParamList = {
  Auth: undefined;
  EmailLogin: undefined;
  SignupStep1: undefined;
  SignUp: undefined;
  SignupStep2: undefined;
  SignupStep3: undefined;
  EmailLink: undefined;
  Main: undefined;
  Onboarding: undefined;
  StationNavigator: {
    stationId: string;
    lineId: string;
    mode?: 'departure' | 'arrival';
  };
  StationDetail: {
    stationId: string;
    stationName: string;
    lineId: string;
  };
  DelayCertificate: undefined;
  DelayFeed: {
    lineId?: string;
  } | undefined;
  AlternativeRoutes: {
    fromStationId: string;
    toStationId: string;
    fromStationName: string;
    toStationName: string;
  };
  // Phase 56 — moved out of MainTabs (TabBar v3 = 5 tabs without Map/Alerts).
  // QuickActionsGrid '노선도' button + HomeTopBar Bell still navigate here,
  // so they must remain reachable through the outer Stack.
  SubwayMap: undefined;
  Alerts: undefined;
};

// Phase 56 — TabBar v3 alignment with Wanted bundle (`main.jsx` HomeScreen
// + `atoms.jsx` TabBar). Replaces (Home/Map/Favorites/Alerts/Settings) with
// the design's 5-tab layout. Map and Alerts remain reachable as outer-stack
// routes (see RootStackParamList).
export type MainTabParamList = {
  Home: undefined;
  Favorites: undefined;
  Routes: undefined;
  DelayFeed: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator: React.FC = () => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size, focused }) => {
          // Phase 4: stroke weight follows focus (active 2.2 / inactive 1.7)
          // matching the design handoff TabBar atom.
          const strokeWidth = focused ? 2.2 : 1.7;
          switch (route.name) {
            case 'Home':
              return <Home size={size} color={color} strokeWidth={strokeWidth} fill="none" />;
            case 'Favorites':
              return <Star size={size} color={color} strokeWidth={strokeWidth} fill="none" />;
            case 'Routes':
              return <RouteIcon size={size} color={color} strokeWidth={strokeWidth} fill="none" />;
            case 'DelayFeed':
              return <Megaphone size={size} color={color} strokeWidth={strokeWidth} fill="none" />;
            case 'Profile':
              return <User size={size} color={color} strokeWidth={strokeWidth} fill="none" />;
            default:
              return <CircleHelp size={size} color={color} strokeWidth={strokeWidth} fill="none" />;
          }
        },
        // Phase 4 — Wanted-aligned tint: primaryNormal active, labelAlt inactive
        tabBarActiveTintColor: semantic.primaryNormal,
        tabBarInactiveTintColor: semantic.labelAlt,
        tabBarStyle: {
          backgroundColor: semantic.bgBase,
          borderTopWidth: 1,
          borderTopColor: semantic.lineSubtle,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          // '600' matches WANTED_TOKENS.type.caption2 weight; '700' was a
          // mismatch noted in cross-review.
          fontWeight: '600',
          fontFamily: weightToFontFamily('600'),
          letterSpacing: 0,
        },
        headerStyle: {
          backgroundColor: semantic.primaryNormal,
        },
        // Use semantic.labelOnColor — colors.textInverse is #121212 in dark
        // mode, which would render dark text on a blue header (poor contrast).
        headerTintColor: semantic.labelOnColor,
        headerTitleStyle: {
          fontWeight: '700',
          fontFamily: weightToFontFamily('700'),
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: '홈',
          tabBarLabel: '홈',
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          title: '즐겨찾기',
          tabBarLabel: '즐겨찾기',
        }}
      />
      <Tab.Screen
        name="Routes"
        component={RoutesTabScreen}
        options={{
          title: '경로',
          tabBarLabel: '경로',
        }}
      />
      <Tab.Screen
        name="DelayFeed"
        component={DelayFeedScreen}
        options={{
          title: '제보',
          tabBarLabel: '제보',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={SettingsNavigator}
        options={{
          title: '나',
          tabBarLabel: '나',
          headerShown: false, // SettingsNavigator has its own header
        }}
      />
    </Tab.Navigator>
  );
};

// Inner navigator component that uses onboarding context
const RootNavigatorContent: React.FC = () => {
  const { user, loading } = useAuth();
  const {
    hasCompletedOnboarding,
    hasSeenSignupCelebration,
    hasAgreedToTerms,
    isCheckingStatus,
    completeOnboarding,
    skipOnboarding,
  } = useOnboarding();

  if (loading || (user && isCheckingStatus)) {
    return <LoadingScreen message="앱을 로딩중입니다..." />;
  }

  // Not authenticated - show welcome/auth flow
  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
        <Stack.Screen name="SignupStep1" component={SignupStep1Screen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
      </Stack.Navigator>
    );
  }

  // Authenticated but hasn't completed onboarding (or DEBUG mode).
  //
  // Three possible first screens, in priority order:
  //   1. SignupStep2 — phone-only user who hasn't accepted terms yet.
  //      Required by 정보통신망법 (Terms of Service) + 개인정보보호법
  //      §22-2 (만 14세 이상 확인). Email signup users skip this because
  //      they collect agreements inline in SignUpScreen 'create' mode.
  //   2. SignupStep3 — fresh signup celebration (once per user, gated by
  //      `hasSeenSignupCelebration`).
  //   3. Onboarding — returning user who hasn't completed onboarding.
  //
  // We use `initialRouteName` rather than `navigation.navigate` from the
  // unauth stack to avoid the race where the unauth stack unmounts before
  // a navigate call lands.
  if (!hasCompletedOnboarding || DEBUG_FORCE_ONBOARDING) {
    const phoneOnly = !user.isAnonymous && (user.email == null || user.email === '');
    const needsTerms = phoneOnly && hasAgreedToTerms === false;
    const showCelebration = hasSeenSignupCelebration === false;
    const initial: 'SignupStep2' | 'SignupStep3' | 'Onboarding' = needsTerms
      ? 'SignupStep2'
      : showCelebration
        ? 'SignupStep3'
        : 'Onboarding';
    return (
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={initial}
      >
        <Stack.Screen name="EmailLink">
          {() => <SignUpScreen mode="link" />}
        </Stack.Screen>
        <Stack.Screen name="SignupStep2" component={SignupStep2Screen} />
        <Stack.Screen name="SignupStep3" component={SignupStep3Screen} />
        <Stack.Screen name="Onboarding">
          {() => (
            <OnboardingNavigator
              onComplete={completeOnboarding}
              onSkip={skipOnboarding}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  // Authenticated and completed onboarding - show main app
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabNavigator} />
      <Stack.Screen
        name="StationNavigator"
        component={StationNavigatorScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="StationDetail"
        component={StationDetailScreen}
        options={{
          headerShown: true,
          title: '역 상세정보',
        }}
      />
      <Stack.Screen
        name="DelayCertificate"
        component={DelayCertificateScreen}
        options={{
          headerShown: true,
          title: '지연증명서',
        }}
      />
      <Stack.Screen
        name="DelayFeed"
        component={DelayFeedScreen}
        options={{
          headerShown: true,
          title: '실시간 제보',
        }}
      />
      <Stack.Screen
        name="AlternativeRoutes"
        component={AlternativeRoutesScreen}
        options={{
          headerShown: false,
        }}
      />
      {/* Phase 56 — moved out of MainTabs but still reachable from
          QuickActionsGrid '노선도' (HomeScreen) and HomeTopBar Bell. */}
      <Stack.Screen
        name="SubwayMap"
        component={SubwayMapScreen}
        options={{
          headerShown: true,
          title: '노선도',
        }}
      />
      <Stack.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          headerShown: true,
          title: '알림',
        }}
      />
    </Stack.Navigator>
  );
};

// Root Navigator with OnboardingProvider
export const RootNavigator: React.FC = () => {
  const { user } = useAuth();

  return (
    <OnboardingProvider userId={user?.id}>
      <RootNavigatorContent />
    </OnboardingProvider>
  );
};