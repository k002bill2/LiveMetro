# Page-by-Page Design Application — Detailed Tasks

**Last Updated**: 2026-05-09 KST
**Progress**: 16 / 16 pages ✅ (Tier 5 마지막 OnboardingStationPicker partial closeout 완료 2026-05-09)

## Task List

### Tier 1 — 가장 가시성 큰 페이지

#### [x] AuthScreen (`auth.jsx` → `src/screens/auth/AuthScreen.tsx` + `src/components/auth/LoginHero.tsx`) — 2026-05-08, branch `feat/page-authscreen-design`

- [x] 시안 `auth.jsx` 직접 읽기 — LoginHero (~50줄), 본문 (~450줄)
- [x] 현재 AuthScreen + LoginHero 직접 읽기
- [x] 시각 차이 식별 — 가능한 영역:
  - LoginHero radial gradient backdrop ✅ 적용 (SVG Defs+RadialGradient+Rect)
  - LoginHero pulse pin multi-ring shadow ✅ 적용 (3겹 absolute View overlay)
  - 펄스 애니메이션 (시안 line 121 `setPulse`) ✅ Animated.loop+Easing.ease 700ms transition
  - Face ID 메인 CTA + 소셜 로그인 + 익명(둘러보기) 진입 흐름 — 변경 없음 (이미 일치)
- [x] 작업 범위 결정 + surgical edit — Tier 1 #1 시그니처 closeout
- [x] type-check + auth 영역 테스트 — 0 type errors / 18 tests pass
- [ ] commit (진행 중)

#### [x] HomeScreen (`main.jsx` → `src/screens/home/HomeScreen.tsx`) — 2026-05-08, **closeout (no-op)**

- [x] 시안 `main.jsx` HomeScreen 영역(line 7-326) 직접 읽기
- [x] 현재 HomeScreen.tsx (985줄) 직접 읽기
- [x] 시각 차이 식별 — **결과: gap 없음**
  - Orchestrator 7섹션(HomeTopBar / MLHero / CommuteRouteCard / QuickActionsGrid / 주변 역 / 즐겨찾기 / 실시간 제보)이 시안과 1:1 정렬됨 (Phase 56에서 흡수)
  - dev-only sample(`DEV_SAMPLE_COMMUTE/NEARBY/FAVORITES/DELAY`)이 시안 시각 preview까지 보장
  - **MLHeroCard spot-check** (시안 main.jsx:36-69 vs `src/components/design/MLHeroCard.tsx`): 100% 매칭
    - gradient `['#0066FF','#0044BB']` 135° ✅
    - shadow `0/8/24/0.20` ✅
    - 두 blob (`-40/-40 180x180 0.08`, `-60/20 140x140 0.06`) ✅
    - 56px 800 -2 letterSpacing tabular-nums ✅
    - sparkles 12px 2.4 stroke + 11px 800 0.5 letterSpacing tag ✅
- [x] 작업 범위 결정 — 메모리 [Phase B closeout = gap 부재 증명] 패턴 적용 (no source change)
- [x] type-check + home 영역 테스트 — 변경사항 없으므로 기존 baseline 그대로
- [x] commit — no commit needed (closeout)
- 비고: 다른 atom (CommuteRouteCard / NearbyStationCard / FavoriteRow / CommunityDelayCard)은 Phase 56 흡수 가정 + MLHeroCard spot-check로 추정. 향후 visual QA에서 delta 발견 시 별도 micro-phase로 분리 권장.

#### [ ] WelcomeOnboardingScreen (`onboarding-steps.jsx` → `src/screens/onboarding/WelcomeOnboardingScreen.tsx`) — **사전 분석 완료 (2026-05-08)**, 다음 세션에서 결정 포인트부터 시작

- [x] 시안 `onboarding-steps.jsx` OnboardingStep1Screen (line 38-164) 직접 읽기
- [x] 현재 WelcomeOnboardingScreen.tsx (317줄) 직접 읽기
- [x] 시각 차이 식별 — **11건 delta 분류 완료**:

  **시각 fidelity 핵심 4건 (commit unit 후보)**:
  - 🔴 #2 StepEyebrow `"STEP 1 / 4"` 누락 — 시안 11px 800 blue-500 letterSpacing 0.05em
  - 🔴 #5 Value props 컬러 시스템 단순화 — 시안: blue/violet `rgba(124,58,237,0.12)`/amber `#A06A00` 3색 + icon bg r10 rounded square; 현재: 단일 `primaryNormal` + r20 circle
  - 🔴 #7 Privacy note 시각 누락 — 시안: `shield-check` icon + gray bg pill 박스; 현재: 텍스트만
  - 🔴 #9 CTA shadow 누락 — 시안 `0 8px 20px rgba(0,102,255,0.30)` (audit #5 LoginHero shadow와 동일 spec)

  **카피 차이 3건 (보류, 디자이너 컨펌 영역)**:
  - 🟡 #3 Title: "서울 지하철, 더 똑똑하게" vs 시안 "시작 전에 몇 가지만 확인할게요"
  - 🟡 #4 Subtitle: "LiveMetro가 매일의 출퇴근을 도와드릴게요" vs 시안 "더 정확한 출퇴근 예측을 위해\n아래 정보가 필요해요. 1분이면 끝나요."
  - 🟡 #6 Value props 카피 (예: "자동 인식" vs "자동 검색", "±3분 정확도" 누락 등)

  **무시 (이미 closeout)**:
  - ⚪ #1 Hero 펄스 패턴 — 시안 SVG metro lines + multi-shadow pin / 현재 3 concentric Animated rings. 메모리 [audit #9 Welcome 펄스: RN 패턴이 충실]에서 변경 불필요로 종결
  - ⚪ #11 Hero 가짜 metro lines (#1과 동일 closeout)

  **미세 (보류)**:
  - 🟢 #8 CTA borderRadius r8(16) vs 시안 r14 (2px, 토큰 신설 필요)
  - 🟢 #10 CTA arrow-right 누락

- [x] 작업 범위 결정 — 핵심 4건 #2 + #5 + #7 + #9 한 commit unit으로 묶음
- [x] surgical edit — 2 files (WelcomeOnboardingScreen.tsx + WelcomeOnboardingScreen.test.tsx)
- [x] type-check + onboarding 영역 테스트 — 0 errors / 6 suites / 45 tests pass
- [x] commit on `feat/page-onboarding-welcome-design`
- [ ] PR 생성 (사용자 터미널 명령 대기, gh sandbox TLS 함정)

### Tier 2 — 핵심 사용 화면

#### [x] StationDetailScreen (`main.jsx` → `src/screens/station/StationDetailScreen.tsx`) — 2026-05-09, branch `feat/page-station-detail-design`, commit `6ed45f9`

- [x] 시안 `main.jsx` StationDetailScreen 영역 (line 408-530) 직접 읽기
- [x] 현재 StationDetailScreen + 4 sub-component 직접 읽기 (Phase 53b ArrivalCard 적용 상태 확인됨)
- [x] 시각 차이 식별 — **결과: sub-component 4개 모두 1:1 일치**, orchestrator wiring 2건만 누락:
  - 🔴 #1 Subtitle 미노출 — `StationDetailHeader`가 `subtitle?` prop 받을 준비 다 됐는데 orchestrator가 안 넘김
  - 🔴 #2 Multi-line badge 누락 — `lines={[lineId as LineId]}` 단일 배지만; 환승역에서 2개 안 나옴
  - 🟢 #3 출구 grid `max=6` vs 시안 4 — design intent 토론 영역, 보류
- [x] 작업 범위 결정 — #1+#2 한 commit unit, orchestrator만 편집 (sub-component 무수정)
- [x] surgical edit — 1 source + 1 test (mapCacheService import + useEffect + 2 useMemo + prop wiring)
- [x] type-check + 테스트 — 0 errors / 9 station suites / **103 tests pass** / full regression 195 suites / 3536 pass
- [x] commit on `feat/page-station-detail-design`
- [ ] PR 생성 (사용자 터미널 명령 대기, gh sandbox TLS 함정)
- 비고: subtitle은 시안 3-part 중 2-part fallback (`Gangnam · 222`). 환승 노선 코드(`신분당 D07`) 추가는 cross-line stationCode lookup 데이터 필요 → 별개 phase. 출구 grid `max=6` → `4` 변경은 design intent 결정 필요(6이 더 informative)이라 보류.

#### [x] WeeklyPredictionScreen (`commute-prediction.jsx` → `src/screens/prediction/WeeklyPredictionScreen.tsx`) — 2026-05-09, branch `feat/page-prediction-design`, commit `b1ae619`

- [x] 시안 `commute-prediction.jsx` (359줄) 직접 읽기
- [x] 현재 WeeklyPredictionScreen.tsx (813줄) 직접 읽기
- [x] **참고**: audit #6 (96px/900ms ease-out) 이미 1:1 일치 검증됨. Phase 7 + Phase 54로 9개 section 중 6개 구현됨. Sections 5/7/8 (segment/factors/weekly)은 명시적 placeholder + ML 데이터 hook 확장 필요로 별도 phase
- [x] 시각 차이 식별 — 5건 polish + 별개 phase 후보 분류:
  - 🔴 #1 Range bar fill — 시안: 그라디언트(blue 0.25→0.55→0.25) + [최단,최장] 영역만 강조 / 현재: opacity 0.45 단색 full width
  - 🔴 #2 Range marker shadow 누락 — 시안: `0 2px 4px rgba(0,102,255,0.3)`
  - 🔴 #3 Hourly isNow bar gradient — 시안: 180deg `${c}→${c}DD` / 현재: flat
  - 🔴 #4 Hourly isNow bar shadow 누락 — 시안: `0 4px 10px ${c}40`
  - 🔴 #5 "지금" tooltip arrow tip 누락 — 시안: 6×6 회전(45deg) 사각형
  - 🟡 #6 hero ML 예측 tag tone (Pill primary vs blue-700) → 별도 phase (audit #7 Pill tone palette)
  - 🟡 #7 Sections 5/7/8 (segment/factors/weekly) → 별도 phase (ML 데이터 hook 확장)
- [x] 작업 범위 결정 — 5건 polish 한 commit (#1+#2+#3+#4+#5)
- [x] surgical edit — 1 source (geometry 추가 + LinearGradient + shadow + arrow View)
- [x] type-check + 테스트 — 0 errors / 1 suite / **10 tests pass** / full regression 195 suites / 3534 pass
- [x] commit on `feat/page-prediction-design`
- [ ] PR 생성 (사용자 터미널, gh sandbox TLS 함정)
- 비고: TRACK_SPAN_MIN = 20분 (predicted 중심)으로 track 영역 정의. 시안의 [20,40] 하드 스케일을 동적 변환. 데이터에 따라 fill 비율이 적응적으로 변함. shadowColor는 inline (congestion tone 동적)이라 styles에서 분리 불가, barIsNowShadow에 offset/opacity/radius/elevation만 정의.

#### [x] FavoritesScreen (`main.jsx` → `src/screens/favorites/FavoritesScreen.tsx`) — 2026-05-09, **partial closeout (no-op)**

- [x] 시안 `main.jsx` FavoritesScreen 영역(line 328-405) 직접 읽기
- [x] 현재 FavoritesScreen.tsx (668줄) + FavoriteRow.tsx (231줄) + DraggableFavoriteItem.tsx + FavoritesSearchBar.tsx 직접 읽기 (head-spot-check)
- [x] 시각 차이 식별 — **partial closeout 결론**:
  - ✅ Header (line 360-394) 시안 spec 정렬됨 — `WANTED_TOKENS.type.title2 size 28px / weight 800` 제목 + 36x36 pill round sort/add 버튼 (sort outlined / add filled blue)
  - ✅ Row 카드 — `DraggableFavoriteItem`이 이미 `FavoriteRow` atom 사용 (line 19 `import { FavoriteRow }`). atom-level 시각 fidelity 완료
  - 🟡 `FavoritesSearchBar`는 시안 `bg gray height 44 r12 + 5 line chips`보다 **기능이 더 풍부** — direction(up/down) / commute toggle / clear 버튼 / line filter. 시안의 단순 chip 5개는 현재 기능의 부분집합 (상위 호환). legacy 토큰(`SPACING/RADIUS/TYPOGRAPHY/colors`)이라 design system 일관성 차이는 있으나 surgical 적용은 functional regression 위험
  - ⚪ Empty/Loading/Error states — WANTED_TOKENS 사용, 시안과 동일 패턴
- [x] 작업 범위 결정 — partial closeout 선언, no source change. 메모리 [Phase B closeout = 갭 부재 증명] + HomeScreen #2 패턴 적용
- [x] type-check + favorites 영역 테스트 — 변경사항 없으므로 기존 baseline 그대로
- [x] commit — no commit needed (closeout)
- 비고: FavoritesSearchBar의 `WANTED_TOKENS` 마이그레이션은 디자인 시스템 일관성 강화 목적의 별개 phase 후보 (기능 변경 0). atom 통합(FavoriteRow)은 이미 완료된 Phase 56 작업. 향후 advanced filter UX vs 시안 simple chip 결정은 product 영역.

### Tier 3 — 부가 화면

#### [x] DelayFeedScreen (`rest.jsx` → `src/screens/delays/DelayFeedScreen.tsx`) — 2026-05-09, branch `feat/page-delays-design`, commit `c86c15a`

- [x] 시안 `rest.jsx` DelayFeedScreen 영역 (line 145-207) 직접 읽기
- [x] 현재 DelayFeedScreen.tsx (579줄) 직접 읽기
- [x] 시각 차이 식별 — 6건 분류:
  - 🔴 #1 `{stationName}역` double-suffix 위반 — 메모리 [역명 double-suffix 금지] BANNED 패턴
  - 🔴 #2 LineBadge atom 미사용 — 인라인 `<View style={lineBadge}>` + `${lineId}호선` Text
  - 🔴 #5 검증됨 표현 — 시안 `Pill warn` (header) vs 현재 `<CheckCircle>` (footer)
  - 🟡 #3 Filter semantics — 시안 `[전체/지연/신호장애/혼잡/내노선만]` (의미별) vs 현재 `[전체/1호선/.../9호선]` (호선별) → 별개 phase (reportType filter + data query)
  - 🟡 #4 Header subtitle 카피 — 시안 "지난 1시간 · 실시간 제보 4건" (count 포함) vs 현재 "승객들의 실시간 지연 정보" → 미세
  - 🟡 #6 Footer 구성 — 시안 community engagement (#tag/comment/share) vs 현재 credibility/upvote → product feature decision
- [x] 작업 범위 결정 — #1+#2+#5 한 commit unit (BANNED 위반 + design system 일관성 + visual layout 정합)
- [x] surgical edit — 1 source (-20 / +9 lines, 미사용 lineBadge/lineBadgeText styles 정리)
- [x] type-check + 테스트 — 0 errors / 193 tests pass (delays + design + station + route 영역)
- [x] commit on `feat/page-delays-design`
- [ ] PR 생성 (사용자 터미널, gh sandbox TLS 함정)
- 비고: Phase A (Pill 토큰화 `bd855d8`)의 amber700이 검증됨 Pill에 직접 사용됨 — Phase A → DelayFeed cascade. CheckCircle import 제거. 사전 cross-suite contamination(DelayCertificateScreen)은 단독 실행 시 PASS, 내 변경 영향 없음.

#### [x] AlertsScreen (`rest.jsx` → `src/screens/alerts/AlertsScreen.tsx`) — 2026-05-09, branch `feat/page-alerts-design`, commit `d2344f9`

- [x] 시안 `rest.jsx` AlertsScreen 영역 (line 480-545) 직접 읽기
- [x] 현재 AlertsScreen.tsx (714줄) 직접 읽기 + StoredNotification 모델 확인
- [x] 시각 차이 식별 — 8건 분류 (이미 정렬된 항목은 Phase 41 기여):
  - 🔴 #1 LineBadge 누락 in card row1
  - 🔴 #2 Unread blue dot 누락 (6×6 r999)
  - 🔴 #3 Title fontWeight 600 → 800
  - 🔴 #5 "모두 읽음" text-link vs CheckCheck icon
  - 🔴 #6 Card borderRadius r6(12) → r8(16)
  - 🟡 #4 Body lineHeight 미세 차이
  - 🟡 #7 Delete X 버튼 — 시안 없음 / 현재 있음 → product feature 유지
  - 🟡 #8 Unread border solid vs translucent → 미세
  - ✅ Phase 41 (filter chips Phase 41 정렬 완료)
- [x] 작업 범위 결정 — 5건 (#1+#2+#3+#5+#6) 한 commit unit (Full polish)
- [x] surgical edit — AlertsScreen.tsx (+44/-11) + translations.ts (+4 markAllRead i18n key)
- [x] type-check + 테스트 — 0 errors / 9 suites / **129 tests pass** (alerts + design + i18n + useAlerts)
- [x] commit on `feat/page-alerts-design` (브랜치 race 복구 후 정상 위치)
- [ ] PR 생성 (사용자 터미널)
- 비고: `extractLineId` type guard로 untyped `data` bag에서 lineId 안전 추출. `markAllRead` i18n key 추가 (ko: "모두 읽음" / en: "Mark all read"). **평행 세션 race 발생** — commit이 의도한 브랜치가 아닌 main에 들어가 `git branch -f` + `checkout` + `branch -f main origin/main`로 복구. 메모리 [diverged main 회복 = backup + branch -f] 패턴 적용.

#### [x] MapScreen (`rest.jsx` → `src/screens/map/SubwayMapScreen.tsx`) — 2026-05-09, branch `feat/page-map-design`, commit `1829f56`

- [x] 시안 `rest.jsx` MapScreen 영역 (line 353-477) 직접 읽기
- [x] 현재 SubwayMapScreen.tsx (618줄) 직접 읽기
- [x] 시각 차이 식별 — 6건 분류 (전부 적용):
  - 🔴 #1 Line button geometry — 시안 48px / r9999 / 16px 800 vs 현재 r20 / 15px bold
  - 🔴 #2 Station node 사이즈 변별 — 시안 transfer=30 / normal=18 vs 현재 항상 32 균일
  - 🔴 #3 Station info typography — 시안 ko 17/800 vs 현재 16/600
  - 🔴 #4 Title borderBottom + typography — 시안 22/800 + lineSubtle border vs 현재 20/bold no border
  - 🔴 #5 LineBadge atom 미사용 — 시안 `<LineBadge size={20}>` vs 현재 인라인 transferBadge + formatTransferBadgeLabel
  - 🔴 #6 Timeline rail layout — 시안 grid 3-col + 절대위치 rail tracks vs 현재 flexrow + 수직 connector
- [x] 작업 범위 결정 — Full polish (#1-#6) 한 commit unit
- [x] surgical edit — 1 source (+137/-107, formatTransferBadgeLabel import 제거 + 5 styles 추가/수정)
- [x] type-check + 테스트 — 0 errors / 17 suites / **177 tests pass**
- [x] commit on `feat/page-map-design`
- [ ] PR 생성
- 비고: timeline rail의 절대위치 top-half/bottom-half 구조가 핵심 — 시안 CSS Grid의 RN equivalent. `isFirst`/`isLast` 조건으로 endpoint 처리. 전체 row를 단일 TouchableOpacity로 감싸 tap target 확장 + accessibility label 1개로 통합. Pill audit #7 cascade 패턴이 LineBadge migration에도 적용됨.

#### [x] StatsScreen (`rest.jsx` → `src/screens/statistics/*`) — 2026-05-09, branch `feat/page-stats-design`, commit `28dbf8e`

- [x] 시안 `rest.jsx` StatsScreen 영역 (line 210-350) 직접 읽기
- [x] 현재 StatisticsDashboardScreen.tsx (404줄) + 5 sub-component(StatsSummaryCard/WeeklyStatsChart/DelayStatsChart/LineUsagePieChart) head-spot-check
- [x] 시각 차이 식별 — 6건 분류 (orchestrator 3건 + sub-component 3건):
  - 🔴 #1 2×2 KPI grid 누락 — 시안 4 cards (정시율/평균출퇴근/이용횟수/총지연 tone-colored 26/800) vs 현재 단일 StatsSummaryCard
  - 🔴 #2 Header 카피 — 시안 "나의 통계" 17/700 vs 현재 "통계 대시보드"
  - 🔴 #3 Period subtitle 누락 — 시안 "YYYY년 M월 · 이번 주" 12/700 labelAlt
  - 🟡 #4 Weekly trend chart 내부 — 시안 svg gradient + 7-pt line vs WeeklyStatsChart 별개 구현 (별도 phase)
  - 🟡 #5 Per-line donut 내부 — 시안 svg stroke-dasharray vs LineUsagePieChart (별도 phase)
  - 🟡 #6 Day-of-week 내부 — 시안 stacked bars 정시/지연 vs DelayStatsChart (별도 phase)
- [x] 작업 범위 결정 — Quick wins (#2 + #3 + #1 partial). orchestrator level만 수정, sub-component 무수정. StatsSummaryCard 제거 후 KPI grid 신규 도입
- [x] surgical edit — 1 source (-7/+107 lines, header re-copy + period subtitle + 2×2 KPI grid + 6 styles)
- [x] type-check + 테스트 — 0 errors / 5 suites / **29 tests pass**
- [x] commit on `feat/page-stats-design`
- [ ] PR 생성
- 비고: KPI 4 cards = `summary.onTimeRate` (정시율 pos) + `summary.avgDelayMinutes` (평균지연 neutral) + `weeklyStats.totalTrips ?? summary.totalTrips` (이용횟수) + `summary.totalDelayMinutes` (총지연 — > 0이면 neg). 시안의 "평균 출퇴근"은 service에 commute duration 필드 부재 → "평균 지연"으로 대체. tone 색은 `WANTED_TOKENS.status.green500/red500/labelStrong`. Sub-component 3개 SVG 재구성은 별개 phase 후보 (insights/distribution은 시안에 없는 추가 — 유지).

#### [x] RoutesScreen (`rest.jsx 7-142` → `src/screens/route/*`) — 2026-05-09, **closeout (no-op, deferred 인정)**

- [x] 시안 `rest.jsx` RoutesScreen 영역 (line 7-142, ~135줄) 직접 읽기 — tasks.md에 `main.jsx`로 잘못 표기됐던 매핑 정정
- [x] 현재 RoutesTabScreen.tsx (174줄) + AlternativeRoutesScreen.tsx (448줄) 직접 읽기
- [x] 시각 차이 식별 — **closeout 결론**:
  - ✅ `RoutesTabScreen` 자체 주석(line 10-13)이 명시적으로 "Wanted bundle reference: rest.jsx:7-142 (RoutesScreen). The full RoutesScreen implementation (search bar, time chips, journey strips) is **deferred to a follow-up phase**" 선언
  - ✅ 현재 architecture: 의도적 split — RoutesTabScreen은 entry/launcher (empty state + 검색 CTA), AlternativeRoutesScreen은 다른 use case (지연 발생 시 대체 경로)
  - 🟡 시안의 단일 풀 RoutesScreen UI는 미구현 (search bar / 시간 chips / 다중 route cards / journey strip)
- [x] 작업 범위 결정 — 메모리 [Phase B closeout = 갭 부재 증명] + HomeScreen/FavoritesScreen 패턴 적용 (no source change)
- [x] type-check + 테스트 — 변경사항 없으므로 baseline 유지
- [x] commit — no commit needed (closeout)
- 비고: 풀 RoutesScreen 구현은 surgical phase 범위 밖 — search bar UI / route compare 데이터 layer / 시간 chip 상태 관리 모두 새 feature 작업. Phase B(useMLPrediction)와 함께 별개 sprint 후보. tasks.md 매핑이 `main.jsx`로 잘못 표기됐으나 `rest.jsx`가 정답 (`window.RoutesScreen` global이 line 7에 정의됨).

### Tier 4 — Settings 군

#### [x] SettingsScreen (main list, `rest.jsx:646-740` → `src/screens/settings/SettingsScreen.tsx`) — 2026-05-09, branch `feat/page-settings-design`

- [x] 시안 `rest.jsx` SettingsScreen 영역 (line 646-740, 94줄) 직접 읽기
- [x] 현재 SettingsScreen.tsx (821줄) 직접 읽기 + SettingsScreen.test.tsx 영향 범위 확인
- [x] 시각 차이 식별 — 5건 fidelity 항목 (한 commit unit) + 3건 deferral:

  **Polish 5건 (적용)**:
  - 🔴 #1 Section title — 시안 12/800 0.04em vs 현재 label2(13)/600 0.6 → caption1 + weight 800 + tighter letterSpacing
  - 🔴 #2 Setting title — 시안 14/600 vs 현재 body1(16)/600 → label1 (14)
  - 🔴 #3 Setting subtitle — 시안 11/600 marginTop 1 vs 현재 body2(15)/500 marginTop 2 → caption2 + weight 600 + tighter inset
  - 🔴 #4 Icon container — 시안 32×32 r8(8px) icon 16 strokeWidth 2 vs 현재 36×36 r-pill icon 20 → r4 token (8px) + 4건 Icon size 20→16 (SettingItem/LogIn/ScanFace/Fingerprint)
  - 🔴 #5 Profile name — 시안 16/800 vs 현재 heading2(20)/700 → body1 size + weight 800

  **Deferral 3건 (UX 변경 동반, 별개 phase 후보)**:
  - 🟡 #6 Logout list-item — 시안: items[] 안에 `{ icon: 'log-out', label: '로그아웃', fg: red-500 }` 통합 / 현재: 별도 signOutButton. UX shift + Security 섹션(자동로그인/생체) 재배치 필요
  - 🟡 #7 Footer "LiveMetro 1.0.0" 11/600 center — 시안에 명시 / 현재: 없음. signOutButton 제거가 선행 필요
  - 🟡 #8 SettingItem `value` 우측 정렬 prop — 시안: `{ label: 'LiveMetro 정보', value: 'v1.0.0' }` 우측 표시 / 현재: subtitle "버전 1.0.0". signature 변경 + 테스트 영향(`getByText('버전 1.0.0')` 어쩌면 깨짐)

- [x] 작업 범위 결정 — Polish 5건 한 commit unit (순수 StyleSheet + Icon size, signature/UX 변경 0)
- [x] surgical edit — 1 source (4 Icon size + 5 style block)
- [x] type-check + 테스트 — 0 errors / 1 suite / **57 tests pass**
- [x] commit on `feat/page-settings-design`
- [ ] PR 생성 (사용자 터미널, gh sandbox TLS 함정)
- 비고: SettingsNavigator의 17/700 navigator header가 이미 PR #34에서 적용됐으므로 시안의 in-body 28/800 "설정" big title은 doubled-title 위험으로 미적용 (디자인 의도 재검토 영역). Auto Login / Biometric / Dev Tools 섹션은 시안에 없으나 functionality 유지. radius.r4 token = 8px (numeric suffix가 token rank, 아닌 px) — 매핑 두 번 검증.

#### [x] Settings detail 화면군 (`settings-detail.jsx` → `src/screens/settings/{Delay,Time,Sound}`) — 2026-05-09, branch `feat/page-settings-design`, **cascade via shared atoms**

- [x] 시안 `settings-detail.jsx` 4개 영역 직접 읽기 (Commute 223-385 / Alerts 386-530 / AlertTime 531-674 / Sound 690-798) + 공통 chrome (1-222: DetailHeader/GroupLabel/GroupCard/Toggle/Row)
- [x] 현재 4개 screen + 공유 atom (`SettingSection.tsx` / `SettingToggle.tsx`) 직접 읽기
- [x] 시각 차이 식별 — **공유 atom = SettingsScreen entry와 동일 5 delta** → cascade 기회 발견:
  - 🔴 #1 `SettingSection.sectionTitle` — 13/600/0.6 → caption1(12)/800/0.04em
  - 🔴 #2 `SettingToggle.iconContainer` — 36×36 r-pill → 32×32 r4(8px)
  - 🔴 #3 `SettingToggle` Icon size — 20 → 16 strokeWidth 2
  - 🔴 #4 `SettingToggle.subtitle` — 13/500 marginTop 2 → caption2(11)/500/lh round(11×1.4) marginTop 2
- [x] 작업 범위 결정 — Cascade 한 commit unit. Delay/AlertTime/Sound는 **공유 atom 변경만으로 완전 적용** (functional logic은 이미 적합). Commute는 자체 RouteCard 구조 사용으로 cascade 무관 → **partial closeout**
- [x] surgical edit — 2 atom (SettingSection -1/+9 / SettingToggle -3/+13)
- [x] type-check + 테스트 — 0 errors / settings 영역 19 suites / **352/353 pass** (1 pre-existing baseline fail in `LocationPermissionScreen.test.tsx:719` Alert mock 배열 구조 — 내 변경과 무관, baseline stash verify로 확인)
- [x] commit on `feat/page-settings-design` (SettingsScreen entry와 같은 branch에 stacked)
- [ ] PR 생성 (사용자 터미널)
- 비고: Cascade 영향 = SettingSection 6 screen consumer (Lang/Sound/Delay/Theme/Loc/Time) + SettingToggle 4 screen consumer (Sound/Delay/Time/...). 시안 mapping이 없는 Lang/Theme/Loc도 일관된 visual hierarchy 받음 — semantic regress 아닌 일관성 강화. NotificationTimeScreen의 24h timeline graphic은 Phase 50에서 이미 구현됨 (시안 line 539-617과 1:1).

##### Image-driven follow-up audit (2026-05-09 사용자 reference 4 screens)

사용자 첨부 이미지 (출퇴근 설정 / 지연 알림 / 알림 시간대 / 소리 설정) 기준 8건 missing element 식별 + 1건 quick win 처리:

| 화면 | ✅ 적용됨 | ❌ 미구현 | 분류 |
|------|----------|---------|------|
| 출퇴근 설정 | RouteWithTransfer atom (Phase 46), 출근/퇴근 RouteCard 2개 | Hero ETA gradient `32분 ±3분`, 출근 요일 7-pill picker, 스마트 기능 3종 (ML/대안경로/자동출발) | structural — feature work (`useMLPrediction` 확장과 같은 sprint, partial closeout 재확인) |
| 지연 알림 | "지연 알림 받기" toggle, "지연 기준" SettingSlider (5분 이상…) | 알림 받을 노선 9-pill chip grid (1-9호선 다중 선택), 알림 종류 3-toggle (공식 운영기관/실시간 제보/긴급 푸시) | medium UX + 데이터 모델 확장 |
| 알림 시간대 | Phase 50 24h timeline + quietHours 데이터 모델 + **주말 종일 무음 toggle (NEW, 본 phase)** | (모두 적용됨) | quick win 완료 ✅ |
| 소리 설정 | "알림 방식" SettingSection, 볼륨 slider, "알림음" SettingSection | 알림 방식 2×2 grid (소리+진동/소리만/진동만/무음), 알림음 4 옵션 (차임/도어벨/비프/웨이브) radio list, 이벤트별 3-toggle | medium UX + sound data model |

###### Quick win 적용 — "주말은 종일 무음" toggle (commit `1cc1ce6`, branch `feat/settings-weekend-silent`)

- 🔴 `QuietHours` 모델 확장: `weekendsAlwaysSilent?: boolean` (optional, `?? false` fallback — 기존 user data 마이그레이션 0)
- 🔴 NotificationTimeScreen "방해 금지 모드" SettingSection 안에 SettingToggle row 1개 추가 — `quietHours.enabled` 조건부 렌더 (시안 의도와 일치, sub-option 위치)
- 🔴 `handleToggleWeekendsAlwaysSilent` callback (handleToggleQuietHours 패턴 복사) + Calendar icon 재사용 (이미 import됨, 신규 lucide dep 0)
- type-check 0 / 12 settings suites / **308 tests pass**
- 평행 세션 race로 main에 잘못 commit → backup + `branch -f main origin/main`로 복구, 1cc1ce6은 `feat/settings-weekend-silent`에 안전 분리. 메모리 [diverged main 회복 = backup + branch -f] + [Sandbox git config write failure 무해] 패턴 적용.
- [ ] PR 생성 (사용자 터미널)

###### Remaining audit items (별개 sprint candidate)

- 지연 알림: 노선 필터 + 알림 종류 3-toggle — `notificationSettings.lineFilter: string[]` 모델 + chip grid + reportSource preferences
- 소리 설정: 알림 방식 4-grid + 알림음 4 옵션 + 이벤트별 toggles — `notificationSettings.alertMethod`/`soundProfile`/`perEventOverrides` 모델 확장
- 출퇴근 설정: Hero ETA + day picker + smart features — `useMLPrediction` 확장 의존 (Phase B 후보, 가치 증거 필요)

#### [x] CommuteSettingsScreen (`settings-detail.jsx:223-385` → `src/screens/settings/CommuteSettingsScreen.tsx`) — 2026-05-09, **partial closeout (structural divergence)**

- [x] 시안 vs 현재 직접 비교
- [x] 시각 차이 식별 — **structural divergence, surgical polish 범위 밖**:
  - 🟡 시안 hero ETA gradient card (38px 800 "32분" + ±3분 pill + 평일 08:30 출발 · 2호선 직행 · 환승 0회) — 구현 없음. 데이터 layer 필요 (ML + 출퇴근 routing)
  - 🟡 시안 day picker (월~일 7-pill, active blue-500 / inactive bg-base) — 구현 없음. `commuteSchedule.weekdays` 필드 확장 필요
  - 🟡 시안 smart features section (ML 출퇴근 시간 예측 / 대안 경로 자동 추천 / 자동 출발 감지) — 구현 없음. 별개 feature work
  - 🟡 inline header "출퇴근 설정" 20/700 — SettingsNavigator 17/700 nav header와 doubled. 단순 drop 가능하나 다른 routing/test 영향 cross-cutting
  - ✅ RouteWithTransfer atom — Phase 46에서 자체 구현, 시안 RouteWithTransfer (line 99-220)와 의미상 일치 (transfer station picker)
- [x] 작업 범위 결정 — 메모리 [Phase B closeout = 갭 부재 증명 + 회귀 net] 패턴 적용. Hero/day picker/smart features는 **별개 sprint candidate** (`useMLPrediction` hook 확장과 같은 feature work). Inline header drop은 다음 micro-fix
- [x] commit — no code commit (closeout)
- 비고: SettingSection/SettingToggle을 Commute에 도입하는 refactor도 후보지만, 현재 RouteCard 구조가 routing-specific 정보(출발/도착/환승역 picker)를 dense하게 표현하므로 atom 일반화는 반대 방향. Commute는 **데이터 모델 + UX**가 시안과 다른 영역 — visual polish가 아닌 product feature decision으로 재분류 권장.

#### [x] SettingsNavigator header 시안 정렬 (`src/navigation/SettingsNavigator.tsx`)

- [x] 시안 spec: 17px / 700, theme-aware bg, chevron-only back, center title
- [x] 현재: hardcoded white + 16px / bold + headerBackTitle '뒤로'
- [x] 변경: theme-aware screenOptions로 13 화면 자동 통일 + 다크모드 호환
- [x] type-check + nav/settings 영역 테스트
- [ ] commit

### Tier 5 — Onboarding 군

#### [x] OnboardingStep3 (알림 권한, `onboarding-steps.jsx` → `src/screens/onboarding/NotificationPermissionScreen.tsx`) — 2026-05-09, **merged via PR #34 (`ea9efc0`)**

- [x] 시안 추출, 현재 비교, surgical edit, 검증
- [x] 작업 범위 A (시각만) — title 28/800, preview LinearGradient + nested card, toggle 좌측 colored icon, CTA arrow + shadow
- [x] 토글 데이터 의미 변경(시안 arrive/delay/comm vs 현재 transfer/delay/incident)은 deferral — multi-screen 영향
- [x] commit — `NotificationPermissionScreen.tsx` +219/-62 + `.test.tsx` +15/-1, PR #34 머지(2026-05-09)에 포함됨. `feat(onboarding): apply Wanted handoff to NotificationPermission step3` 섹션
- 비고: lucide mock 5 icon 추가 + `expo-linear-gradient` View pass-through stub 도입 (메모리 [expo-linear-gradient jest mock] 패턴). 토글 의미 rename은 CommuteNotifications 모델 + FavoritesOnboarding 영향으로 별개 phase로 분리됨.

#### [x] OnboardingStep4 (즐겨찾기 setup, `onboarding-steps.jsx:293-419` → `src/screens/onboarding/FavoritesOnboardingScreen.tsx`) — 2026-05-09, branch `feat/page-onboarding-favorites-design`

- [x] 시안 추출 (line 293-419, 127줄) + 현재 (433줄) 직접 read
- [x] 시각 차이 식별 — 7건 polish + 데이터 model 변경 0:
  - 🔴 #1 StepEyebrow "STEP 4 / 4" 누락 — Welcome 패턴 재사용
  - 🔴 #2 Title typography — title3(24)/lh32 → 28/800/-0.025em/lh34 + "\n" 줄바꿈
  - 🔴 #3 Subtitle — 카피 정렬 + lh21
  - 🔴 #4 Search bar — h48 r6 → h44 r6 + 10px gap + 13/600 input
  - 🔴 #5 Section header "추천 / N개 선택됨" 누락 — flexrow space-between baseline
  - 🔴 #6 Row 카드 재구성 — 36×36 Star container (selected blue+fill, unselected 10% gray) + name 15/800 + Pill "추천" (recommend = dep/arr id 매칭, derived) + multi-line LineBadge size 16 + reason 11/600 + 24×24 Check icon container
  - 🔴 #7 CTA — r8 → r14 + active state shadow `0/8/20/primary@30%` + ArrowRight 18 strokeWidth 2.4 + 카피 `${n}개 추가하고 시작하기` / `역을 선택해주세요`
- [x] 작업 범위 결정 — 7건 한 commit unit (data model 무변경 derived recommend)
- [x] surgical edit — 1 source + 1 test (lucide mock 3 icon 추가)
- [x] type-check + 테스트 — 0 errors / 5 onboarding suites / **40 tests pass** / lint:typography 0
- [x] commit on `feat/page-onboarding-favorites-design` (`1fb5653`)
- [x] follow-up commit `38575b0` (`feat/page-settings-design` head, 23:11 KST) — multi-line transfer badge support:
  - 🔴 데이터 모델: `RecommendedStation.lineId: string` → `lineIds: string[]` (RECOMMENDATIONS 6 entries: 홍대입구 `['2','6','경의선']` / 강남 `['2','신분당선']` / 잠실 `['2','8']` / 서울역 `['1','4','경의선']` / 신촌 `['2']` / 합정 `['2','6']`)
  - 🔴 `toStationModel`: `'lineIds' in rec ? (rec.lineIds[0] ?? '') : rec.lineId` (strict `noUncheckedIndexedAccess` 대응 + Station 단일 lineId fallback)
  - 🔴 annotated dep/arr fromRoute: `lineId: dep.lineId` → `lineIds: [dep.lineId]` 1-tuple wrap
  - 🔴 render: `<LineBadge line={s.lineId}>` → `s.lineIds.map((id) => <LineBadge key={id} line={id}>)`
  - 🔴 styles.checkbox.borderRadius: 12 → 9999 (round, 시안 r9999)
  - linter가 short Korean code (`'경의'`, `'신분당'`)를 `'경의선'`, `'신분당선'`으로 자동 normalize — 메모리 [Label registry input-domain mismatch] 패턴 선제 차단. PR #34 등록 LINE_LABELS alias의 정확한 form
  - Gemini cross-review 4 issues 모두 validate + auto-merge via `geminiAutoTrigger.js` hook
  - type-check 0 / 5 suites / 40 tests pass / lint:typography 0
- [ ] PR 생성 (사용자 터미널, gh sandbox TLS 함정)
- 비고: `${semantic.primaryNormal}0F` hex-alpha 8자리 표기로 selected bg tint(시안 `rgba(0,102,255,0.06)`) 다크모드 자동 분기. `recommend`는 `(id === depId || id === arrId)` derived value — 1단계는 RECOMMENDATIONS data model 무변경, 2단계가 multi-line 표시를 위해 model 확장. console.error 2개 ESLint warning은 baseline pre-existing (stash verify 확인 완료) — 별개 cleanup phase 후보.

#### [x] OnboardingStationPicker (`onboarding-station-picker.jsx` → `src/screens/onboarding/OnboardingStationPickerScreen.tsx`) — 2026-05-09, **partial closeout (architectural divergence)**

- [x] 시안 `onboarding-station-picker.jsx` (455줄) 직접 읽기
- [x] 현재 OnboardingStationPickerScreen.tsx (725줄) head + spot-check (Phase 52에서 "Wanted handoff design's in-screen flow"로 의도 정렬)
- [x] 시각 차이 식별 — **결과: architectural divergence, surgical polish 범위 밖**:
  - 🟡 시안: **single-screen route flow** — 한 화면에 3 slot (출발/환승/도착) 동시 표시 + 슬롯 클릭으로 active 전환 + bottom CTA "다음 단계" 진행
  - ✅ 현재: **drill-in modal pattern** — CommuteRouteScreen이 3-slot orchestrator, 슬롯별로 OnboardingStationPicker 진입 → 단일 슬롯 선택 → `navigation.navigate('CommuteRoute', { pickedStation }, { merge: true })` 반환
  - 시안 progress bar (4-segment) / "STEP 2 / 4 · 경로 설정" eyebrow / "어디서 어디까지\n이동하시나요?" title / "건너뛰기" / SlotRow 3-stack / bottom "다음 단계" CTA — 모두 **CommuteRouteScreen 책임**
  - 시안 picker 부분 (slot-aware search bar / 추천/직접 선택 toggle / line tabs / 가나다순 station list / StationChip) — 현재 OnboardingStationPickerScreen에 매핑됨 (Phase 52 의도)
- [x] 작업 범위 결정 — 메모리 [Phase B closeout = 갭 부재 증명] 패턴. CommuteSettings (line 256-267) 와 동일한 architectural divergence 분류 — single-screen vs drill-in은 product/architecture decision 영역, surgical visual polish 영역 아님
- [x] commit — no code commit (closeout)
- 비고: drill-in pattern은 React Navigation native-stack의 typical 사용법이고 single-screen은 시안의 prototype 한계 (state lifting 단순화). LiveMetro의 drill-in은 (1) deep linkable, (2) navigation history로 each slot 변경 undoable, (3) modal layer가 CommuteRouteScreen orchestrator 안정성 보존 — visual polish가 아닌 architectural advantage. 시안의 single-screen으로 reshape는 large refactor (별개 sprint candidate, 가치 증거 없음). Tier 5 #4 Onboarding 영역 마무리 — Page-by-page progress 16/16 도달.

### 별도 small task

#### [x] Pill tone palette 토큰화 (audit #7 closeout) — 2026-05-09, branch `feat/pill-tone-tokenize`, commit `bd855d8`

- [x] `src/components/design/Pill.tsx`의 inline 색 → `WANTED_TOKENS` 매핑 (5/6 tones: primary/pos/neg/warn/cool token-derived; neutral은 token 부재로 raw rgba + 문서화)
- [x] `WANTED_TOKENS.status.amber700: '#A06A00'` 추가 (Wanted amber-700, warn-tone fg에 사용)
- [x] hex-alpha 8자리 표기(`${color}1A` ≈ 10%, `${color}29` ≈ 16%)로 tint 도출 — base는 token, 새 helper util 불필요
- [x] 5개 Pill 사용처 자동 적용 검증 (StationDetailHeader / ArrivalCard / AlternativeRouteCard / WeeklyPredictionScreen)
- [x] type-check + design 영역 테스트 — 0 errors / 18 suites / **185 tests pass**
- [x] commit on `feat/pill-tone-tokenize`
- [ ] PR 생성 (사용자 터미널, gh sandbox TLS 함정)
- 비고: 이 closeout으로 prediction tasks.md 항목 #6 (hero ML 예측 tag blue-700 일치)도 자동 unblock. neutral tone의 `'rgba(112,115,124,0.10)'`는 design의 labelAlt @10%인데 `WANTED_TOKENS.light.bgSubtle`이 8% + theme-scoped라 부적합 — 향후 Pill을 dark-aware로 전환 시 추가 closeout 권장.

#### [ ] useMLPrediction hook 확장 (Phase B — feature work, surgical phase 범위 밖)

WeeklyPredictionScreen sections 5/7/8 (segment breakdown / factors / weekly comparison) unblock 위한 데이터 layer 작업. 별개 sprint로 분리 결정 (2026-05-09):
- **결정 미해결**: (1) segment 데이터 source (route service vs commuteLog 패턴 vs 정적 heuristic), (2) factors derivation (TF disabled 상태에서 어디서?), (3) weekly fallback (commuteLog 없을 때)
- **추정 비용**: 4-8h, 다중 commit, 다층 변경 (`models/ml.ts` + `services/ml/` + `hooks/useMLPrediction.ts` + `screens/prediction/WeeklyPredictionScreen.tsx` + 각 layer 테스트)
- **다음 세션 진입**: `gsd:plan-phase` 또는 `dev-docs` 3파일 시스템으로 설계 시작 권장

## Manual QA (각 페이지 commit 후 또는 묶음별)

- [ ] iOS 시뮬레이터에서 화면 진입 + 시각 점검
- [ ] Android 에뮬레이터에서 화면 진입 + 시각 점검
- [ ] 다크모드 분기 점검
- [ ] 한/영 i18n 분기 점검 (해당 화면이 텍스트 추가/변경 시)

## 작업 시작 시 체크리스트 (한 페이지 진입할 때)

```
□ context.md 다시 read
□ plan.md 워크플로우 확인
□ 해당 페이지 시안 jsx 직접 read
□ 현재 화면 tsx 직접 read
□ 차이점 명시적 정리 (3-5건)
□ 작업 범위 1개 카테고리 선정 (시각/토큰/동작)
□ skillGateGuard 통과: react-native-development 스킬 invoke
□ surgical edit 진행
□ type-check + 테스트
□ commit (conventional message)
```

## Progress Tracking

각 페이지 완료 시:
1. 위 체크박스에 ✅
2. `Progress: N / 16 pages` 업데이트
3. commit SHA 또는 PR 번호를 페이지 옆에 메모
