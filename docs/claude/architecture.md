# Architecture Reference

> **Last verified against code: 2026-06-29.** 이 문서는 코드 스냅샷이다. 큰
> 리팩토링(네비게이션·데이터 흐름·서비스 추가) 후 재검증하고 이 날짜를 갱신할 것.

## Entry Point & Provider Tree

`index.js` → `registerRootComponent(App)` → **`App.tsx`** (루트 `./App.tsx`).
`src/App.tsx`는 死코드 — 진입점은 루트 파일이다.

**Provider 중첩** (`App.tsx`):

```
ErrorBoundary
└─ I18nProvider          # ko/en (useI18n/useTranslation, ~7 소비처)
   └─ AccessibilityProvider   # 고대비/글자크기 등 (소비처 3: 설정 2 + usePublicData)
      └─ ThemeProvider        # 다크/라이트 (useTheme, ~23 소비처 — 가장 많이 소비됨)
         └─ AuthProvider      # Firebase Auth 전역 상태
            └─ FavoritesProvider
               └─ NavigationContainer → RootNavigator
```

`OnboardingContext`는 루트가 아니라 온보딩 플로우에서 로컬 마운트된다.

**앱 레벨 오케스트레이션 훅** (`AppContent`): `useCommuteReminderSync`(출퇴근 리마인더),
`usePushRegistration`(Expo 푸시 토큰+구독 노선), `useWatchedLineIds` + `useCommuteDelayAlerts`
(포그라운드 지연 알림), `hydrateGuidanceSession`(앱 킬 후 길안내 세션 복원).
폰트는 Pretendard 9 face를 `useFonts`로 로드, `installWebAlertPolyfill()`로 웹 Alert 폴백.

## Data Flow

데이터 흐름은 **용도별로 경로가 다르다.** "Seoul API → Firebase → Cache" 단일
우선순위가 아니다.

**실시간 도착 (`dataManager.getRealtimeTrains`)** — Stale-While-Revalidate:
1. AsyncStorage 캐시 hit → 즉시 반환 + 백그라운드에서 Seoul API 재요청
2. 캐시 miss → Seoul API await
→ 이 경로에 **Firebase 티어 없음**. 캐시 TTL 5분.

**실시간 구독 (`dataManager.subscribeToRealtimeUpdates`)** — `arrivalService.subscribe`에
위임 (역당 단일 폴링 소스: rate-limit ≥30초·retry·캐시·interval dedup).
신규 코드는 `arrivalService`를 직접 쓸 것 (wrapper는 `@deprecated`).

**역 메타데이터 (`dataManager.getStationInfo`)** — 캐시(24h) → 로컬 데이터
(`stationsDataService`) → Firebase(`trainService.getStation`, ID로 풍부한 데이터) →
Seoul API(`getAllStations`) 순 폴백.

**Firebase/Firestore의 실제 역할**: Auth, 즐겨찾기, 출퇴근 경로, 푸시 토큰 타게팅,
역 메타데이터 보강. **실시간 도착의 폴백 티어가 아니다.**

**핵심 서비스:**
- `seoulSubwayApi` (`src/services/api/seoulSubwayApi.ts`): Seoul API. 타임아웃·`SeoulApiError`
  카테고리 분류(auth/quota/transient/client/no-data/unknown).
- `arrivalService` (`src/services/arrival/arrivalService.ts`): 단일 폴링 소스.
- `dataManager` (`src/services/data/dataManager.ts`): 캐시 오케스트레이션(SWR) + 어댑터.
- `trainService` (`src/services/train/trainService.ts`): Firebase 쿼리/구독.

> `dataManager.detectDelays()`는 `@deprecated` — 항상 `[]` 반환. "도착까지 남은 시간"을
> 지연으로 오판하던 버그를 막기 위해 비활성. 올바른 지연 감지는 실시간 vs 시간표 비교 필요.

## Navigation

**`RootNavigator.tsx`가 활성 네비게이터** (App.tsx가 렌더). `AppNavigator.tsx`는 死코드
(import 0).

- 루트: `createStackNavigator<RootStackParamList>`
- 탭: `createBottomTabNavigator<MainTabParamList>` (`MainTabNavigator`)

**탭 (5개):** `Home` · `Favorites` · `Routes`(RoutesTabScreen) · `DelayFeed` ·
`Profile`(→ `SettingsNavigator` 중첩 스택).

**인증 조건부 루트 스택:**
- 미인증: `Auth` · `EmailLogin` · `SignupStep1~3` · `SignUp` · `EmailLink` · `Onboarding`
- 인증: `Main`(탭) + 푸시 화면들 — `StationNavigator` · `StationDetail` · `TrainSelection` ·
  `TrainPosition` · `DelayCertificate` · `DelayFeed` · `ReportDetail` · `ReportFeedback` ·
  `AlternativeRoutes` · `RouteGuidance`

**ParamList** (`src/navigation/types.ts`): `RootStackParamList`(= `AppStackParamList` 별칭) ·
`MainTabParamList` · `SettingsStackParamList` · `OnboardingStackParamList`.
`AppTabParamList`은 레거시.

## State Management

**No Redux/MobX** — Context API + 커스텀 훅 + 싱글턴 서비스.

**Context** (마운트 위치 = Provider 트리 참조): `AuthContext`, `ThemeProvider`(다크모드),
`I18nProvider`(ko/en), `FavoritesContext`, `AccessibilityContext`, `OnboardingContext`(로컬).

**커스텀 훅 ~37개** (`src/hooks/`), 도메인별:
- 실시간/열차: `useRealtimeTrains` · `useTrainPositions` · `useTrainSchedule` · `useAdjacentStations`
- 위치/주변: `useLocation` · `useNearbyStations` · `useCurrentStationId`
- 출퇴근: `useCommuteHeroEstimate` · `useCommutePattern` · `useCommuteRouteSteps` ·
  `useCommuteSetup` · `useCommuteReminderSync` · `useAutoCommuteLog` 등
- 길안내: `useGuidanceProgress` · `useGuidanceSession` · `useStartCommuteGuidance`
- 경로/예측: `useRouteSearch` · `useAlternativeRoutes` · `useMLPrediction` · `usePredictionFactors`
- 알림: `useAlerts` · `useIntegratedAlerts` · `useDelayDetection` · `useWeatherAlert`
- 즐겨찾기/기타: `useFavorites` · `useDragReorder` · `useWatchedLineIds` · `useCongestion`

**싱글턴 서비스**: `dataManager`, `arrivalService`, `trainService` 등 — 클래스 인스턴스를
싱글턴으로 export.

## Service Layer (`src/services/`, ~30 도메인)

- **실시간/Seoul**: `api` · `arrival` · `train` · `data`
- **계정/Firebase**: `auth` · `firebase` · `user` · `favorites`
- **출퇴근/경로 지능**: `commute` · `guidance` · `route` · `ml` · `pattern`
- **지연/혼잡/통계**: `delay` · `congestion` · `statistics` · `certificate`
- **알림/소셜**: `notification` · `sound` · `email` · `social` · `feedback`
- **위치/맥락**: `location` · `map` · `weather`
- **표현/접근성**: `theme` · `i18n` · `accessibility` · `speech`

## Static Data Layer (`src/data/*.json`)

- `lines.json` — 노선 색상 + 역 목록 (~24개 노선: 1~9호선 + 인천1/2·분당·신분당·
  경의중앙·공항철도·경춘·의정부·에버라인·경강·우이신설 등 수도권 광역)
- `stations.json` / `seoulStations.json` / `stationCoordinates.json` — 역 기본정보·좌표
- `stationAccessibility.json` — 엘리베이터/편의시설 (무장애 경로 탐색의 기반 데이터)
- `exitLandmarks.json` — 출구 랜드마크
- `transferTimes.json` · `lineSpeed.json` · `segmentSpeed.json` — 경로 ETA 가중치

## Subway Map

- **컴포넌트**: `SubwayMapView` (`src/components/map/SubwayMapView.tsx`) — 커스텀 SVG 렌더링
- **데이터/레이아웃 유틸**: `src/utils/subwayMapData.ts` · `subwayLinePaths.ts` · `mapLayout.ts`;
  SVG 앵커는 `src/components/map/subwayLineSvgAnchors.ts`
- 데이터 기반으로 수도권 ~24개 노선을 그린다 (9호선 한정 아님)

## 死/Deprecated 코드 (참조 금지)

| 대상 | 상태 |
|------|------|
| `src/navigation/AppNavigator.tsx` | 死코드 — 활성은 `RootNavigator.tsx` |
| `src/App.tsx` | 死코드 — 진입점은 루트 `./App.tsx` |
| `monitoringManager` (`src/services/monitoring/`) | export는 되나 **unwired** (비-테스트 소비처 0, App.tsx 초기화 없음). crash/perf/health 서비스 미가동 |
| `dataManager.detectDelays()` | `@deprecated` — `[]` 반환 |
| `src/components/map/SubwayMapCanvas.tsx.bak` | 백업 파일 |
