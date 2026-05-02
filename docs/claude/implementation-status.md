# LiveMetro 구현 현황 문서

> 최종 업데이트: 2026-05-03

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프로젝트명 | LiveMetro |
| 설명 | 서울 지하철 실시간 도착 정보 앱 |
| 버전 | 1.0.0 |
| 플랫폼 | iOS, Android, Web |

### 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| React Native | 0.72.10 | 모바일 프레임워크 |
| Expo SDK | ~49.0.15 | 개발 플랫폼 |
| TypeScript | 5.1+ | 타입 시스템 (strict mode) |
| Firebase | 10.7.1 | Auth, Firestore, FCM |
| React Navigation | 6.x | 네비게이션 |
| TensorFlow.js | 4.x | ML 예측 |

---

## 1. 구현 완료 (100%)

### 1.1 인증 시스템
- ✅ Firebase 이메일/비밀번호 인증
- ✅ 익명 로그인
- ✅ 생체인식 로그인 (지문/Face ID)
- ✅ AuthContext 상태 관리
- ✅ AuthGuard 컴포넌트

**관련 파일:**
- `src/services/auth/AuthContext.tsx`
- `src/services/auth/biometricService.ts`
- `src/screens/auth/AuthScreen.tsx`
- `src/screens/auth/WelcomeScreen.tsx`

### 1.2 실시간 기차 정보
- ✅ 서울 공공데이터 API 연동
- ✅ 30초 폴링 실시간 업데이트
- ✅ 도착 시간 표시 (분/초)
- ✅ 노선별 색상 구분
- ✅ 상행/하행 방향 표시

**관련 파일:**
- `src/services/api/seoulSubwayApi.ts`
- `src/services/train/trainService.ts`
- `src/hooks/useRealtimeTrains.ts`
- `src/components/train/TrainArrivalCard.tsx`
- `src/components/train/TrainArrivalList.tsx`

### 1.3 즐겨찾기 기능
- ✅ 역 즐겨찾기 추가/삭제
- ✅ 드래그 앤 드롭 순서 변경
- ✅ 역 검색 기능
- ✅ 필터링 기능
- ✅ Firebase 동기화

**관련 파일:**
- `src/services/favorites/favoritesService.ts`
- `src/hooks/useFavorites.ts`
- `src/screens/favorites/FavoritesScreen.tsx`
- `src/components/favorites/DraggableFavoriteItem.tsx`

### 1.4 알림 시스템
- ✅ 로컬 알림 저장
- ✅ 알림 목록 표시
- ✅ 읽음/삭제/모두읽음 기능
- ✅ expo-notifications 연동

**관련 파일:**
- `src/services/notification/notificationService.ts`
- `src/services/notification/notificationStorageService.ts`
- `src/hooks/useAlerts.ts`
- `src/screens/alerts/AlertsScreen.tsx`

### 1.5 출퇴근 설정
- ✅ 온보딩 플로우 (4단계)
- ✅ 출퇴근 시간 설정
- ✅ 출퇴근 경로 선택
- ✅ 환승역 설정
- ✅ 알림 커스터마이징

**관련 파일:**
- `src/screens/onboarding/CommuteTimeScreen.tsx`
- `src/screens/onboarding/CommuteRouteScreen.tsx`
- `src/screens/onboarding/CommuteNotificationScreen.tsx`
- `src/services/commute/commuteService.ts`
- `src/contexts/OnboardingContext.tsx`

### 1.6 다국어 지원
- ✅ 한국어/영어 지원
- ✅ i18n 컨텍스트
- ✅ 언어 설정 화면

**관련 파일:**
- `src/services/i18n/i18nContext.tsx`
- `src/services/i18n/translations.ts`
- `src/screens/settings/LanguageSettingsScreen.tsx`

### 1.7 테마 시스템
- ✅ 밝음/어두움 모드
- ✅ 시스템 설정 자동 감지
- ✅ 테마 설정 화면
- ✅ modernTheme 디자인 시스템
- ✅ 고대비 테마 (NEW)

**관련 파일:**
- `src/services/theme/index.ts`
- `src/services/theme/highContrastTheme.ts` (NEW)
- `src/styles/modernTheme.ts`
- `src/screens/settings/ThemeSettingsScreen.tsx`

### 1.8 데이터 캐싱
- ✅ 다층 캐싱 (API → Firebase → AsyncStorage)
- ✅ 오프라인 지원
- ✅ 동기화 큐

**관련 파일:**
- `src/services/data/dataManager.ts`
- `src/services/data/stationCacheService.ts`
- `src/utils/storageUtils.ts`

### 1.9 위치 서비스
- ✅ GPS 위치 추적
- ✅ 근처 역 탐색
- ✅ 백그라운드 위치 권한

**관련 파일:**
- `src/services/location/locationService.ts`
- `src/hooks/useLocation.ts`
- `src/hooks/useNearbyStations.ts`

### 1.10 설정 화면들
- ✅ 프로필 수정
- ✅ 출퇴근 설정 관리
- ✅ 지연 알림 임계값
- ✅ 알림 시간대 (조용한 시간)
- ✅ 알림음/진동 설정
- ✅ 위치 권한 관리
- ✅ 도움말
- ✅ 개인정보처리방침

---

## 2. 신규 구현 완료 (Phase 1 - 부분 구현 100% 완성)

### 2.1 ML 기반 예측 (100%) ✅

**구현됨:**
- ✅ TensorFlow.js 초기화 및 동적 로딩
- ✅ LSTM 모델 아키텍처 정의
- ✅ 특성 추출 (featureExtractor)
- ✅ 모델 로딩 서비스
- ✅ 실제 훈련 서비스 (TensorFlow.js 기반)
- ✅ 모델 검증 서비스 (교차 검증, 정확도 측정)
- ✅ useMLPrediction 훅
- ✅ CommutePredictionCard UI
- ✅ 폴백 모드 (TensorFlow 미사용 시 통계 기반)

**관련 파일:**
- `src/services/ml/tensorflowSetup.ts` (수정)
- `src/services/ml/modelArchitecture.ts` (NEW)
- `src/services/ml/trainingService.ts` (수정)
- `src/services/ml/validationService.ts` (NEW)
- `src/services/ml/index.ts`

### 2.2 혼잡도 시스템 (100%) ✅

**구현됨:**
- ✅ 혼잡도 서비스 기본 로직
- ✅ 시간대별 혼잡도 예측 서비스
- ✅ 과거 데이터 분석 서비스
- ✅ 데이터 품질 관리 (이상치 탐지)
- ✅ 히트맵 생성 서비스
- ✅ CongestionBadge 컴포넌트
- ✅ CongestionReportModal UI
- ✅ TrainCongestionView 표시
- ✅ useCongestion 훅

**관련 파일:**
- `src/services/congestion/congestionService.ts`
- `src/services/congestion/congestionPredictionService.ts` (NEW)
- `src/services/congestion/historicalAnalysis.ts` (NEW)
- `src/services/congestion/dataQualityService.ts` (NEW)
- `src/services/congestion/heatmapService.ts` (NEW)
- `src/services/congestion/index.ts` (NEW)

### 2.3 대체 경로 제안 (100%) ✅

**구현됨:**
- ✅ A* 알고리즘 기반 경로 탐색
- ✅ 우선순위 큐 (Min-Heap) 자료구조
- ✅ Yen's K-최단 경로 알고리즘
- ✅ 요금 계산 서비스 (일반/청소년/어린이/경로)
- ✅ 실시간 지연 반영 경로 재계산
- ✅ AlternativeRouteCard UI
- ✅ RouteComparisonView UI
- ✅ AlternativeRoutesScreen
- ✅ useAlternativeRoutes 훅

**관련 파일:**
- `src/services/route/routeService.ts` (수정 - A* 알고리즘 추가)
- `src/utils/priorityQueue.ts` (NEW)
- `src/services/route/fareService.ts` (NEW)
- `src/services/route/kShortestPath.ts` (NEW)
- `src/services/route/index.ts` (수정)

### 2.4 지연 증명서 (100%) ✅

**구현됨:**
- ✅ PDF 생성 서비스 (expo-print)
- ✅ QR코드 생성 및 검증
- ✅ 증명서 HTML 템플릿
- ✅ Firestore 동기화
- ✅ DelayCertificateScreen UI
- ✅ 증명서 데이터 모델
- ✅ 지연 기록 조회

**관련 파일:**
- `src/services/certificate/pdfService.ts` (NEW)
- `src/services/certificate/qrService.ts` (NEW)
- `src/services/certificate/index.ts` (NEW)
- `src/services/delay/delayHistoryService.ts` (수정)
- `src/screens/delays/DelayCertificateScreen.tsx`

### 2.5 스마트 알림 (100%) ✅

**구현됨:**
- ✅ 출퇴근 패턴 분석 서비스
- ✅ 심화 패턴 분석 (지연 빈도, 요일별 패턴 등)
- ✅ 날씨 연동 (Open-Meteo API)
- ✅ 알림 타이밍 최적화 서비스
- ✅ 피드백 기반 학습 서비스
- ✅ 패턴 기반 알림 로직
- ✅ SmartAlertToggle UI
- ✅ CommuteInsightCard UI
- ✅ integratedAlertService

**관련 파일:**
- `src/services/weather/weatherService.ts` (NEW)
- `src/services/pattern/advancedPatternService.ts` (NEW)
- `src/services/notification/notificationOptimizer.ts` (NEW)
- `src/services/pattern/feedbackLearningService.ts` (NEW)

### 2.6 지연 제보 커뮤니티 (100%) ✅

**구현됨:**
- ✅ 허위 제보 탐지 서비스
- ✅ 공식 지연 정보 API 연동
- ✅ 사용자 신뢰도 점수 시스템
- ✅ 관리자 검증 시스템 (Cloud Functions)
- ✅ 자동 검증 시스템
- ✅ 커뮤니티 교차 검증
- ✅ DelayFeedScreen UI
- ✅ DelayReportForm 컴포넌트
- ✅ Firebase 저장

**관련 파일:**
- `src/services/delay/fraudDetectionService.ts` (NEW)
- `src/services/delay/officialDelayService.ts` (NEW)
- `src/services/user/userTrustService.ts` (NEW)
- `src/services/delay/index.ts` (NEW)
- `functions/src/admin/reportVerification.ts` (NEW)

---

## 3. 신규 구현 완료 (Phase 2 - 신규 기능)

### 3.1 푸시 알림 (FCM) (100%) ✅

**구현됨:**
- ✅ FCM 푸시 알림 서비스
- ✅ 토큰 관리 서비스
- ✅ 토픽 구독 서비스
- ✅ 알림 트리거 (지연, 인증서, 뱃지 등)
- ✅ 출퇴근 리마인더 스케줄러
- ✅ 토큰 만료 정리 작업

**관련 파일:**
- `functions/src/services/pushNotificationService.ts` (NEW)
- `functions/src/services/tokenManagementService.ts` (NEW)
- `src/services/notification/topicSubscriptionService.ts` (NEW)
- `functions/src/triggers/notificationTriggers.ts` (NEW)
- `functions/src/index.ts` (수정)

### 3.2 통계 대시보드 (100%) ✅

**구현됨:**
- ✅ 통계 계산 서비스
- ✅ 일간/주간/월간 통계
- ✅ 노선별 이용 현황
- ✅ 지연 분포 분석
- ✅ 요일별 지연 차트
- ✅ 주간 정시율 추이 차트
- ✅ 통계 대시보드 스크린

**관련 파일:**
- `src/services/statistics/statisticsService.ts` (NEW)
- `src/services/statistics/index.ts` (NEW)
- `src/screens/statistics/StatisticsDashboardScreen.tsx` (NEW)
- `src/components/statistics/StatsSummaryCard.tsx` (NEW)
- `src/components/statistics/WeeklyStatsChart.tsx` (NEW)
- `src/components/statistics/DelayStatsChart.tsx` (NEW)
- `src/components/statistics/LineUsagePieChart.tsx` (NEW)
- `src/components/statistics/index.ts` (NEW)

### 3.3 음성 기능 (TTS) (100%) ✅

**구현됨:**
- ✅ TTS 서비스 (expo-speech)
- ✅ 도착 안내 음성 출력
- ✅ 지연 알림 음성 출력
- ✅ 출발 리마인더 음성 출력
- ✅ 음성 설정 화면
- ✅ 접근성 서비스 연동

**관련 파일:**
- `src/services/speech/ttsService.ts` (NEW)
- `src/services/speech/index.ts` (NEW)
- `src/screens/settings/VoiceSettingsScreen.tsx` (NEW)
- `src/services/accessibility/accessibilityService.ts` (NEW)
- `src/services/accessibility/index.ts` (NEW)

### 3.4 오프라인 지도 (100%) ✅

**구현됨:**
- ✅ SVG 기반 노선도 뷰어
- ✅ 확대/축소/이동 기능
- ✅ 역 선택 인터랙션
- ✅ 환승역 표시
- ✅ 지도 데이터 캐싱 서비스

**관련 파일:**
- `src/components/map/SubwayMapView.tsx` (NEW)
- `src/components/map/index.ts` (NEW)
- `src/services/map/mapCacheService.ts` (NEW)
- `src/services/map/index.ts` (NEW)

### 3.5 소셜 기능 (100%) ✅

**구현됨:**
- ✅ 공유 서비스 (경로, 지연, 역 정보)
- ✅ 친구 시스템
- ✅ 친구 요청/수락/거부
- ✅ 초대 코드 시스템
- ✅ 출퇴근 공유 기능
- ✅ 딥링크 생성

**관련 파일:**
- `src/services/social/shareService.ts` (NEW)
- `src/services/social/friendService.ts` (NEW)
- `src/services/social/index.ts` (NEW)

### 3.6 접근성 강화 (100%) ✅

**구현됨:**
- ✅ 접근성 컨텍스트
- ✅ 시스템 접근성 설정 감지
- ✅ 고대비 테마 (Light/Dark)
- ✅ 텍스트 크기 조절
- ✅ 굵은 텍스트 모드
- ✅ 동작 줄이기 지원
- ✅ 햅틱 피드백 설정
- ✅ 음성 안내 연동
- ✅ WCAG 대비율 유틸리티
- ✅ 접근성 설정 화면

**관련 파일:**
- `src/contexts/AccessibilityContext.tsx` (NEW)
- `src/services/theme/highContrastTheme.ts` (NEW)
- `src/screens/settings/AccessibilitySettingsScreen.tsx` (NEW)
- `src/services/accessibility/accessibilityService.ts` (NEW)

---

## 4. 미구현 / 향후 계획

### 4.1 위젯 (제외됨)
> ⚠️ Expo Managed Workflow 제한으로 인해 홈 화면 위젯은 현재 구현 불가능합니다.
> Expo의 Dev Client나 Bare Workflow로 전환 시 구현 가능합니다.

- ❌ iOS 홈 화면 위젯
- ❌ Android 위젯
- ❌ Apple Watch 앱

### 4.2 향후 고려 기능
- ❌ 커뮤니티 게시판
- ❌ 실시간 채팅
- ❌ AR 네비게이션
- ❌ 막차 알림 연동

---

## 5. 프로젝트 구조 (업데이트됨)

```
src/
├── App.tsx                    # 앱 진입점
├── navigation/                # 네비게이션 (5개 파일)
│   ├── RootNavigator.tsx
│   ├── SettingsNavigator.tsx
│   ├── OnboardingNavigator.tsx
│   └── types.ts
├── screens/                   # 화면 (30+)
│   ├── auth/                  # 인증 (2)
│   ├── home/                  # 홈 (1)
│   ├── favorites/             # 즐겨찾기 (1)
│   ├── alerts/                # 알림 (1)
│   ├── settings/              # 설정 (13) - VoiceSettings, AccessibilitySettings 추가
│   ├── onboarding/            # 온보딩 (4)
│   ├── station/               # 역 정보 (2)
│   ├── delays/                # 지연 (2)
│   ├── route/                 # 경로 (1)
│   ├── prediction/            # 예측 (1)
│   └── statistics/            # 통계 (1) - NEW
├── components/                # 컴포넌트 (60+)
│   ├── common/                # 공통 (6)
│   ├── train/                 # 기차 (8)
│   ├── station/               # 역 (3)
│   ├── settings/              # 설정 (8)
│   ├── favorites/             # 즐겨찾기 (3)
│   ├── commute/               # 출퇴근 (3)
│   ├── delays/                # 지연 (3)
│   ├── route/                 # 경로 (2)
│   ├── congestion/            # 혼잡도 (3)
│   ├── pattern/               # 패턴 (2)
│   ├── prediction/            # 예측 (1)
│   ├── statistics/            # 통계 (4) - NEW
│   └── map/                   # 지도 (1) - NEW
├── services/                  # 서비스 (80+)
│   ├── auth/                  # 인증 (3)
│   ├── firebase/              # Firebase (1)
│   ├── api/                   # API (4)
│   ├── train/                 # 기차 (1)
│   ├── arrival/               # 도착 (1)
│   ├── data/                  # 데이터 (3)
│   ├── favorites/             # 즐겨찾기 (1)
│   ├── location/              # 위치 (1)
│   ├── commute/               # 출퇴근 (1)
│   ├── delay/                 # 지연 (5) - fraudDetection, officialDelay 추가
│   ├── route/                 # 경로 (4) - fareService, kShortestPath 추가
│   ├── congestion/            # 혼잡도 (5) - prediction, historical, dataQuality, heatmap 추가
│   ├── notification/          # 알림 (10) - optimizer, topicSubscription 추가
│   ├── pattern/               # 패턴 (5) - advancedPattern, feedbackLearning 추가
│   ├── ml/                    # ML (5) - modelArchitecture, validation 추가
│   ├── sound/                 # 사운드 (1)
│   ├── email/                 # 이메일 (1)
│   ├── i18n/                  # 다국어 (3)
│   ├── theme/                 # 테마 (2) - highContrastTheme 추가
│   ├── monitoring/            # 모니터링 (4)
│   ├── certificate/           # 증명서 (3) - NEW
│   ├── weather/               # 날씨 (1) - NEW
│   ├── statistics/            # 통계 (1) - NEW
│   ├── speech/                # TTS (1) - NEW
│   ├── accessibility/         # 접근성 (1) - NEW
│   ├── map/                   # 지도 (1) - NEW
│   ├── social/                # 소셜 (2) - NEW
│   └── user/                  # 사용자 (1) - NEW
├── contexts/                  # Context (2) - AccessibilityContext 추가
├── hooks/                     # 훅 (19개)
├── models/                    # 모델 (12개)
├── styles/                    # 스타일 (1)
├── utils/                     # 유틸 (16+) - priorityQueue 추가
└── data/                      # 정적 데이터 (4)

functions/                     # Cloud Functions
├── src/
│   ├── index.ts              # 메인 exports
│   ├── types/                # 타입 정의
│   ├── services/             # 서비스 (4)
│   │   ├── emailService.ts
│   │   ├── userService.ts
│   │   ├── pushNotificationService.ts  # NEW
│   │   └── tokenManagementService.ts   # NEW
│   ├── admin/                # 관리자 (1) - NEW
│   │   └── reportVerification.ts
│   └── triggers/             # 트리거 (1) - NEW
│       └── notificationTriggers.ts
```

---

## 6. 테스트 현황

### 구현된 테스트

| 카테고리 | 파일 |
|---------|------|
| Components | StationCard.test.tsx, TrainArrivalCard.test.tsx, Toast.test.tsx, LoadingScreen.test.tsx |
| Services | seoulSubwayApi.test.ts, trainService.test.ts, commuteService.test.ts, delayReportService.test.ts, congestionService.test.ts 등 (15+) |
| Utils | authUtils.test.ts |
| Screens | WelcomeScreen.test.tsx |

### 커버리지 목표

| 메트릭 | 목표 | 현재 (추정) |
|--------|------|------------|
| Statements | 75% | ~60% |
| Functions | 70% | ~55% |
| Branches | 60% | ~45% |

### 미구현 테스트

- ❌ E2E 테스트 (Detox/Appium)
- ❌ 통합 테스트 (API 연동)
- ❌ 스냅샷 테스트 (전체 화면)
- ❌ 성능 테스트
- ❌ 신규 서비스 단위 테스트 (ML, Statistics, TTS 등)

---

## 7. 알려진 이슈

### 해결됨

1. ~~ML 모델 훈련 데이터 부족~~ → TensorFlow.js 훈련 서비스 + 통계 기반 폴백 구현
2. ~~혼잡도 API 미확정~~ → 사용자 제보 + 시간대별 예측 서비스 구현
3. ~~푸시 알림 서버 미구축~~ → FCM Cloud Functions 구현
4. ~~대체 경로 최적화 미흡~~ → A* 알고리즘 + K-최단 경로 구현
5. ~~접근성 부분 지원~~ → 고대비 테마 + 접근성 컨텍스트 구현

### 남은 이슈

1. **테스트 커버리지 부족**
   - 신규 서비스에 대한 테스트 작성 필요
   - 75% 커버리지 목표 달성 필요

2. **오프라인 모드 제한적**
   - 마지막 캐시 데이터만 표시
   - 실시간 정보 불가 안내 필요

3. **태블릿 레이아웃 미최적화**
   - 폰 레이아웃만 구현
   - 반응형 디자인 필요

---

## 8. 다음 개발 계획

### 완료됨 ✅
- [x] ML 훈련 데이터 파이프라인 구축
- [x] 푸시 알림 서버 (FCM) 구축
- [x] 혼잡도 예측 서비스 강화
- [x] 대체 경로 알고리즘 최적화
- [x] 지연 증명서 PDF 기능
- [x] 음성 안내 기능
- [x] 오프라인 지도
- [x] 소셜 기능
- [x] 접근성 강화

### 다음 단계
- [ ] 테스트 커버리지 75% 달성
- [ ] 신규 서비스 단위 테스트 작성
- [ ] E2E 테스트 구현
- [ ] 성능 최적화
- [ ] 태블릿 반응형 레이아웃

---

## 9. 최근 변경 이력 (2026-04-25 ~ 2026-05-03)

> 브랜치: `fix/realtime-timetable-reliability` ([PR #5](https://github.com/k002bill2/LiveMetro/pull/5))

### 9.1 성능 개선 (Performance Overhaul)

- **백그라운드 폴링 제거**: `useCurrentStationAlert`/`useCurrentStationAlerts`의 5s `setInterval` 3개 폐기 → `currentStationAlertService.subscribe()` 기반 pub/sub 전환 (분당 ~60 setState 절감)
- **AlertsScreen 가상화**: `ScrollView + .map()` → `FlatList` + `removeClippedSubviews` + memoized `renderItem`
- **StationCard 메모이제이션 안정화**: 인라인 콜백을 `useCallback` + `useMemo` Map으로 캐싱 → React.memo 동작 복원
- **LiveClock 컴포넌트 분리**: StationDetailScreen의 60s 시계 tick이 화면 전체 re-render 유발 → 시계 노드만 격리
- **StationCard 폴링 게이팅**: HomeScreen 5개 카드의 30s 폴링이 탭 전환 후에도 계속됨 → `arrivalsEnabled` prop + `useIsFocused()` 조합으로 비활성 시 정지
- **useDelayDetection enabled 옵션**: 호출자가 effect 전체(초기 fetch + 폴링 + setState)를 게이트 가능

**관련 파일**:
- `src/hooks/useCurrentStationAlert.ts`, `src/hooks/useDelayDetection.ts`
- `src/screens/main/HomeScreen.tsx`, `src/screens/main/StationDetailScreen.tsx`, `src/screens/alerts/AlertsScreen.tsx`
- `src/components/cards/StationCard.tsx`, `src/components/clock/LiveClock.tsx`
- `src/services/alert/currentStationAlertService.ts`

### 9.2 실시간 도착 안정화 (Realtime Arrival Fixes)

- **arrivalService 단일 소스**: `dataManager.subscribeToRealtimeUpdates`가 자체 폴러 대신 `arrivalService.subscribe()`로 위임 → 역당 폴러 1개 보장. `dataManager` 메서드는 `@deprecated` 표기, 기존 호출자 무중단 동작
- **trainId 결정성**: 기존 `Date.now()` 포함 → `btrainNo|ordkey|statnId+index` 결정적 키. FlatList re-render 폭발 해결
- **arvlCd '2' 필터링**: 당역 출발 열차 정보 행 UI 제거
- **빈 결과 캐시 금지**: 60초 stale empty state 차단 (다음 폴링이 즉시 재시도)
- **detectDelays 일시 비활성화**: 기존 구현이 "도착까지 남은 시간"을 schedule deviation으로 오인해 5분+ 모든 열차를 "지연"으로 false alert → `[]` 반환. 실제 지연 감지는 timetable과의 비교로 별도 후속 작업

**관련 파일**:
- `src/services/arrival/arrivalService.ts`, `src/services/data/dataManager.ts`
- `src/hooks/useRealtimeTrains.ts`

### 9.3 시간표 (Timetable) 개선

- **시간 비교 정확도**: 문자열 lexicographic → `toSecondsOfDay()` 숫자 비교. `"9:35:00"` vs `"14:30:00"` 정렬 오류 수정. 24시간 초과(`"25:30:00"`) 입력 허용으로 자정 인접 비교 단순화
- **한국 공휴일 인식**: `isKoreanHoliday()` 신규 utility — 2025-2027 fixed-date + 대체공휴일 + 음력 기반(설날/추석/부처님오신날). 평일 공휴일에 weekTag `'3'` 적용 → 어린이날 화요일 등 ~12-15일/년 잘못된 시간표 표시 수정 (TODO: 2027 이후 만료)
- **자정 carry-over**: 22:00+에는 다음날 < 03:00 시간표 행도 upcoming에 포함 (서울 지하철 ~01:00 운행 반영). 23:55에 0건 표시되던 silent failure 해결
- **observability 강화**: `SearchSTNTimeTableByIDService`가 XML/HTML 반환 시 (key 무효/quota 초과 등) content-type + 200자 본문을 **API 키 마스킹 후** 로깅, `timetableKeyManager.reportError()` 자동 호출
- **웹 플랫폼 처리**: HTTP-only timetable endpoint를 웹에서 호출 시 silent `[]` 반환 → `TimetableUnsupportedOnWebError` 명시 throw. UI는 "시간표는 모바일 앱에서 확인할 수 있습니다" 표시

**관련 파일**:
- `src/utils/timeUtils.ts` (toSecondsOfDay), `src/utils/koreanHolidays.ts` (isKoreanHoliday)
- `src/hooks/useTrainSchedule.ts`
- `src/services/api/seoulSubwayApi.ts`

### 9.4 Firestore observability

- **congestionService 에러 핸들러**: `subscribeToTrainCongestion`/`subscribeToLineCongestion`이 `onSnapshot`에 error callback 없이 등록되던 문제 해결. 권한 거부/규칙 미스매치가 silent runtime error로 묻히던 것 → SUMMARY_COLLECTION + summaryId/lineId 함께 로깅, firestore.rules 누락 항목 즉시 식별 가능

**관련 파일**: `src/services/congestion/congestionService.ts`

### 9.5 환경설정 표준화

- **변수명 sync**: `EXPO_PUBLIC_DATA_GO_KR_API_KEY` → `EXPO_PUBLIC_DATA_PORTAL_API_KEY` 리네임 (코드 참조와 일치). `EXPO_PUBLIC_DATA_PORTAL_API_KEY_2` 폴백 키 추가
- **사용 안 되는 placeholder 제거**: AWS S3, LLM API 키 (코드 0회 참조 검증 후)
- **`.editorconfig` 도입**: `[.env*]` 섹션에 `trim_trailing_whitespace = true` + `indent_style = unset` → dotenv silent parsing failure 재발 방지

**Breaking change**: 기존 로컬 `.env`/CI secret store에서 `DATA_GO_KR_API_KEY` → `DATA_PORTAL_API_KEY` 리네임 필요.

### 9.6 DX / 도구

- **`functions/` ESLint 분리**: 루트 ESLint가 `firebase-functions`/`@sendgrid/mail` resolve 실패하던 CI 이슈 해결 (functions/는 자체 package.json + lint script 보유)
- **테스트 결정성**: `useTrainSchedule` "fetch and convert" 테스트에 `setSystemTime(05:00)` 도입 → CI 실행 시각 의존성 제거
- **`@types/react-native` devDep 추가**: RN intrinsic 타입 검사 강화

---

## 10. 참고 문서

- [아키텍처 상세](./architecture.md)
- [API 레퍼런스](./api-reference.md)
- [개발 패턴](./development-patterns.md)
- [테스트 가이드](./testing.md)
