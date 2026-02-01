# LiveMetro 구현 현황 문서

> 최종 업데이트: 2026-02-01

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
| Firebase | 10.7.1 | Auth, Firestore |
| React Navigation | 6.x | 네비게이션 |
| TensorFlow.js | - | ML 예측 |

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

**관련 파일:**
- `src/services/theme/index.ts`
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

## 2. 부분 구현 (70-90%)

### 2.1 ML 기반 예측 (80%)

**구현됨:**
- ✅ TensorFlow.js 초기화
- ✅ 특성 추출 (featureExtractor)
- ✅ 모델 로딩 서비스
- ✅ useMLPrediction 훅
- ✅ CommutePredictionCard UI

**미구현:**
- ❌ 실제 훈련 데이터 수집 파이프라인
- ❌ 모델 정기 업데이트 메커니즘
- ❌ 예측 정확도 검증 시스템

**관련 파일:**
- `src/services/ml/tensorflowSetup.ts`
- `src/services/ml/modelService.ts`
- `src/services/ml/featureExtractor.ts`
- `src/services/ml/trainingService.ts`

### 2.2 혼잡도 시스템 (75%)

**구현됨:**
- ✅ 혼잡도 서비스 기본 로직
- ✅ CongestionBadge 컴포넌트
- ✅ CongestionReportModal UI
- ✅ TrainCongestionView 표시
- ✅ useCongestion 훅

**미구현:**
- ❌ 실제 혼잡도 데이터 API 연동
- ❌ 사용자 제보 집계 알고리즘
- ❌ 시간대별 혼잡도 예측

**관련 파일:**
- `src/services/congestion/congestionService.ts`
- `src/components/congestion/CongestionBadge.tsx`
- `src/hooks/useCongestion.ts`

### 2.3 대체 경로 제안 (70%)

**구현됨:**
- ✅ 경로 탐색 기본 로직
- ✅ AlternativeRouteCard UI
- ✅ RouteComparisonView UI
- ✅ AlternativeRoutesScreen
- ✅ useAlternativeRoutes 훅

**미구현:**
- ❌ 실시간 지연 반영 경로 재계산
- ❌ A*/Dijkstra 최적화 알고리즘
- ❌ 환승 시간 정확한 계산
- ❌ 요금 비교 기능

**관련 파일:**
- `src/services/route/routeService.ts`
- `src/screens/route/AlternativeRoutesScreen.tsx`
- `src/hooks/useAlternativeRoutes.ts`

### 2.4 지연 증명서 (70%)

**구현됨:**
- ✅ DelayCertificateScreen UI
- ✅ 증명서 데이터 모델
- ✅ 지연 기록 조회

**미구현:**
- ❌ PDF 생성 기능
- ❌ 이메일 발송 (emailService 미완성)
- ❌ 공식 증명서 연동 API

**관련 파일:**
- `src/screens/delays/DelayCertificateScreen.tsx`
- `src/models/delayCertificate.ts`
- `src/services/email/emailService.ts`

### 2.5 스마트 알림 (75%)

**구현됨:**
- ✅ 출퇴근 패턴 분석 서비스
- ✅ 패턴 기반 알림 로직
- ✅ SmartAlertToggle UI
- ✅ CommuteInsightCard UI
- ✅ integratedAlertService

**미구현:**
- ❌ 장기 패턴 학습 (1주 이상)
- ❌ 예외 상황 자동 감지
- ❌ 개인화 알림 시간 최적화

**관련 파일:**
- `src/services/pattern/patternAnalysisService.ts`
- `src/services/pattern/smartNotificationService.ts`
- `src/hooks/useIntegratedAlerts.ts`

### 2.6 지연 제보 커뮤니티 (65%)

**구현됨:**
- ✅ DelayFeedScreen UI
- ✅ DelayReportForm 컴포넌트
- ✅ delayReportService 기본 기능
- ✅ Firebase 저장

**미구현:**
- ❌ 제보 신뢰도 점수 시스템
- ❌ 중복 제보 병합
- ❌ 관리자 검토 시스템
- ❌ 알림 푸시 (지역 기반)

**관련 파일:**
- `src/screens/delays/DelayFeedScreen.tsx`
- `src/services/delay/delayReportService.ts`
- `src/components/delays/DelayReportForm.tsx`

---

## 3. 미구현 / 계획 중

### 3.1 소셜 기능
- ❌ 혼잡도 실시간 공유
- ❌ 지연 정보 SNS 공유
- ❌ 친구 출퇴근 경로 공유
- ❌ 커뮤니티 게시판

### 3.2 고급 경로 탐색
- ❌ 실시간 최적 경로 계산
- ❌ 요금 최소화 경로
- ❌ 환승 최소화 경로
- ❌ 막차 알림 연동

### 3.3 음성 기능
- ❌ TTS 음성 안내
- ❌ 역 도착 음성 알림
- ❌ 음성 명령 (역 검색)

### 3.4 오프라인 지도
- ❌ 지하철 노선도 오프라인 저장
- ❌ 역 내부 지도
- ❌ 출구별 주변 정보

### 3.5 위젯
- ❌ iOS 홈 화면 위젯
- ❌ Android 위젯
- ❌ Apple Watch 앱

### 3.6 고급 알림
- ❌ 푸시 알림 서버 (FCM)
- ❌ 지역 기반 알림
- ❌ 특정 노선 운행 중단 알림

### 3.7 분석 및 통계
- ❌ 개인 이용 통계 대시보드
- ❌ 월별 이용 리포트
- ❌ 탄소 절감량 계산

### 3.8 접근성 강화
- ❌ 스크린 리더 완전 지원
- ❌ 고대비 모드
- ❌ 큰 글씨 모드

---

## 4. 프로젝트 구조

```
src/
├── App.tsx                    # 앱 진입점
├── navigation/                # 네비게이션 (5개 파일)
│   ├── RootNavigator.tsx
│   ├── SettingsNavigator.tsx
│   ├── OnboardingNavigator.tsx
│   └── types.ts
├── screens/                   # 화면 (27개)
│   ├── auth/                  # 인증 (2)
│   ├── home/                  # 홈 (1)
│   ├── favorites/             # 즐겨찾기 (1)
│   ├── alerts/                # 알림 (1)
│   ├── settings/              # 설정 (11)
│   ├── onboarding/            # 온보딩 (4)
│   ├── station/               # 역 정보 (2)
│   ├── delays/                # 지연 (2)
│   ├── route/                 # 경로 (1)
│   └── prediction/            # 예측 (1)
├── components/                # 컴포넌트 (45+)
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
│   └── prediction/            # 예측 (1)
├── services/                  # 서비스 (50+)
│   ├── auth/                  # 인증 (3)
│   ├── firebase/              # Firebase (1)
│   ├── api/                   # API (4)
│   ├── train/                 # 기차 (1)
│   ├── arrival/               # 도착 (1)
│   ├── data/                  # 데이터 (3)
│   ├── favorites/             # 즐겨찾기 (1)
│   ├── location/              # 위치 (1)
│   ├── commute/               # 출퇴근 (1)
│   ├── delay/                 # 지연 (2)
│   ├── route/                 # 경로 (2)
│   ├── congestion/            # 혼잡도 (1)
│   ├── notification/          # 알림 (9)
│   ├── pattern/               # 패턴 (4)
│   ├── ml/                    # ML (4)
│   ├── sound/                 # 사운드 (1)
│   ├── email/                 # 이메일 (1)
│   ├── i18n/                  # 다국어 (3)
│   ├── theme/                 # 테마 (1)
│   └── monitoring/            # 모니터링 (4)
├── hooks/                     # 훅 (19개)
├── models/                    # 모델 (12개)
├── contexts/                  # Context (1)
├── styles/                    # 스타일 (1)
├── utils/                     # 유틸 (15+)
└── data/                      # 정적 데이터 (4)
```

---

## 5. 네비게이션 구조

```
RootNavigator
├── Welcome → Auth (미인증)
├── OnboardingNavigator (인증 + 온보딩 미완료)
│   ├── CommuteTime
│   ├── CommuteRoute
│   ├── CommuteNotification
│   └── CommuteComplete
└── MainTabNavigator (인증 + 온보딩 완료)
    ├── Home
    ├── Favorites
    ├── Alerts
    └── Settings
        └── SettingsNavigator
            ├── SettingsHome
            ├── EditProfile
            ├── CommuteSettings
            ├── DelayNotification
            ├── NotificationTime
            ├── SoundSettings
            ├── LanguageSettings
            ├── ThemeSettings
            ├── LocationPermission
            ├── Help
            └── PrivacyPolicy

추가 모달/스택
├── StationNavigator
├── StationDetail
├── DelayCertificate
├── DelayFeed
├── AlternativeRoutes
└── WeeklyPrediction
```

---

## 6. 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                        User Action                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│    Custom Hooks (useRealtimeTrains, useFavorites, etc.)     │
│    - 상태 관리, 로딩/에러 처리                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         Services (trainService, favoritesService)           │
│         - 비즈니스 로직, API 호출                            │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Seoul API      │ │    Firebase     │ │  AsyncStorage   │
│  (실시간 30초)   │ │  (사용자 데이터) │ │  (오프라인 캐시) │
└─────────────────┘ └─────────────────┘ └─────────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              DataManager (다층 캐싱 전략)                     │
│              - API 응답: 5분 유효                            │
│              - Firebase: 실시간 리스너                       │
│              - AsyncStorage: 오프라인 폴백                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            Components (TrainArrivalCard, etc.)              │
│            - UI 렌더링                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 테스트 현황

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

---

## 8. 알려진 이슈

### 높은 우선순위

1. **ML 모델 훈련 데이터 부족**
   - 현재 더미 데이터로 테스트 중
   - 실제 사용자 데이터 수집 필요

2. **혼잡도 API 미확정**
   - 서울교통공사 API 협의 필요
   - 현재 사용자 제보에만 의존

3. **푸시 알림 서버 미구축**
   - 로컬 알림만 동작
   - FCM 서버 구축 필요

### 중간 우선순위

4. **대체 경로 최적화 미흡**
   - 단순 BFS 알고리즘 사용 중
   - A* 또는 Dijkstra 적용 필요

5. **오프라인 모드 제한적**
   - 마지막 캐시 데이터만 표시
   - 실시간 정보 불가 안내 필요

### 낮은 우선순위

6. **접근성 부분 지원**
   - 기본 라벨만 적용
   - 스크린 리더 테스트 필요

7. **태블릿 레이아웃 미최적화**
   - 폰 레이아웃만 구현
   - 반응형 디자인 필요

---

## 9. 다음 개발 계획

### Phase 1 (1-2주)
- [ ] 테스트 커버리지 75% 달성
- [ ] ML 훈련 데이터 파이프라인 구축
- [ ] 푸시 알림 서버 (FCM) 구축

### Phase 2 (3-4주)
- [ ] 혼잡도 API 연동 (또는 크라우드소싱 강화)
- [ ] 대체 경로 알고리즘 최적화
- [ ] 지연 증명서 PDF/이메일 기능

### Phase 3 (5-8주)
- [ ] iOS/Android 위젯
- [ ] 음성 안내 기능
- [ ] 오프라인 지도

---

## 10. 참고 문서

- [아키텍처 상세](./architecture.md)
- [API 레퍼런스](./api-reference.md)
- [개발 패턴](./development-patterns.md)
- [테스트 가이드](./testing.md)
