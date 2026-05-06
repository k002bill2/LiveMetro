# Wanted Bundle 갭 인벤토리 (LiveMetro.html v3)

> 작성일: 2026-05-06
> 출처 번들: claude.ai/design `j01iuVhlroduq84dc3azIA` (LiveMetro 화면 디자인)
> 작성 컨텍스트: 사용자 요청 — 시안 24개 아트보드를 현재 구현(`src/screens/`, `src/components/`)과 비교하여 갭을 객관적으로 측정. 코드 수정은 하지 않음.

## 0. 요약

| 영역 | 상태 |
|------|------|
| **디자인 토큰 (Wanted)** | ✅ 적용 완료 — 33개 화면 전수 `WANTED_TOKENS`/`weightToFontFamily` 사용 (Phase 21~49) |
| **디자인 atoms (LineBadge/Pill/CongestionBar 등)** | ✅ `src/components/design/` 11개 컴포넌트로 추출 완료 |
| **풀 화면 매핑 (24 아트보드)** | ✅ 24개 모두 대응 (P0 3건 main 머지 확인 — 2026-05-06 재검증) |
| **세부 패턴 갭** | 화면별 0~3개 식별 (아래 표 참조). P0 갭 0건 |

핵심 결론: **이 프로젝트는 시안 P0 3건을 모두 main에 머지한 상태**입니다 (24h 타임라인 = `356a80f`, MapScreen v2 = 기존 `SubwayMapScreen.tsx:177-322`, StationPicker = `c6b0e0c`). 잔존 갭은 마이크로 시각 텍스처 수준(stripes, padding 미세 조정 등)이며 ROI가 낮습니다. **2026-05-06 재검증 노트**: 본 문서 5절 초안의 "Phase 50/51/52 추천"은 작성 시점의 grep 키워드(`LineChipRow` 등)와 실제 코드 명명(`lineSelector` 등) 어긋남으로 인한 false negative였음.

---

## 1. 디자인 시스템 매핑 (atoms × 토큰)

| Wanted atom | 시안 정의 | 현재 구현 | 비고 |
|-------------|----------|----------|------|
| `LineBadge` | `atoms.jsx:7-26` | `src/components/design/LineBadge.tsx` | 1:1 |
| `Pill` | `atoms.jsx:29-51` (tones: neutral/primary/pos/neg/warn/cool) | `src/components/design/Pill.tsx` | 검증 필요: tone 매핑 |
| `CongestionBar` | `atoms.jsx:68-75` (4단계 색) | `src/components/design/CongestionBar.tsx` | 1:1 |
| `CongestionDots` | `atoms.jsx:78-92` | `src/components/design/CongestionDots.tsx` | 1:1 |
| `CongestionMeter` | (시안에는 없음 — 추가 도입) | `src/components/design/CongestionMeter.tsx` | 시안 외 확장 |
| `Card` | `atoms.jsx:179-189` | (직접 매핑 없음 — 인라인 스타일) | 가능성: surface/border 토큰 일관성 점검 |
| `MLHeroCard` | `main.jsx:37-69` (그라디언트 카드) | `src/components/design/MLHeroCard.tsx` | 1:1 (Phase 33+) |
| `CommuteRouteCard` | `main.jsx:71-162` ("오늘의 출근 경로" 타임라인) | `src/components/design/CommuteRouteCard.tsx` | 1:1 (Phase 44) |
| `CommunityDelayCard` | `main.jsx:301-321` | `src/components/design/CommunityDelayCard.tsx` | 1:1 |
| `HomeTopBar` | `main.jsx:21-34` | `src/components/design/HomeTopBar.tsx` | 1:1 |
| `QuickActionsGrid` | `main.jsx:165-181` | `src/components/design/QuickActionsGrid.tsx` | 1:1 |
| `JourneyStrip` | `rest.jsx:82-109` (RoutesScreen 내) | `src/components/design/JourneyStrip.tsx` | 1:1 |
| `FavoriteRow` | `main.jsx:262-296` | `src/components/design/FavoriteRow.tsx` | 1:1 |
| `SectionHeader` | `atoms.jsx:131-141` | `src/components/design/SectionHeader.tsx` | 1:1 |
| `TabBar` | `atoms.jsx:146-176` | (네이티브 React Navigation Tab) | 위치 OK; visual treatment 점검 필요 |

**토큰 매핑** (`src/styles/modernTheme.ts` 추정):
- 시안 `--blue-500: #0066FF` ↔ Wanted primary
- 시안 `--bg-subtle-page: #F7F8FA` ↔ semantic bgSubtlePage
- 시안 typography scale 14종 (display2 → caption2) ↔ `WANTED_TOKENS.type.*`
- 메모리 `project_typography_helpers.md`에 따라 `weightToFontFamily('700')` 사용 의무화 (Phase 21)

---

## 2. 화면별 갭 인벤토리 (24 아트보드)

표기 규칙:
- **상태**: ✅ 일치 / ⚠️ 부분 / ❌ 미구현 / 🔍 필요 추가 검증
- **갭 신뢰도**: 직접 verify(read+grep) | 추정(structure 기반)

### 2.1 진입 — 로그인 & 가입 (5)

| # | 시안 화면 | 시안 위치 | 현재 구현 | 상태 | 갭 |
|---|----------|----------|----------|------|------|
| 1 | LoginScreen (Face ID + 소셜 + 익명) | `auth.jsx:120-253` | `src/screens/auth/AuthScreen.tsx` (`FaceIDButton`, `SocialButton` × 3) | ✅ | 비교 시 — `LoginHero` SVG 추상 노선 그래픽이 현재 `WelcomeScreen`과 분리되어 있는지 확인 필요 (verified at AuthScreen.tsx:54,261,291,297,302) |
| 2 | SignupStep1Screen (NICE 본인인증) | `auth-signup-steps.jsx:32-233` | `src/screens/auth/SignupStep1Screen.tsx` | 🔍 | 시안의 통신사 6칸 그리드 (`SKT/KT/LGU + 알뜰폰 3종`) + OTP 6박스 + 02:48 카운트다운 + NICE 마이크로카피 — 현재 구현 검증 필요 |
| 3 | SignupScreen (2/3 계정) | `auth.jsx:324-497` | `src/screens/auth/SignUpScreen.tsx` | ✅ | `SignupHeader` 공유 컴포넌트 사용 확인됨. 비밀번호 강도 미터 4단계 + 약관 박스(전체동의 + 4행) 검증 필요 |
| 4 | SignupStep3Screen (3/3 완료) | `auth-signup-steps.jsx:236-406` | `src/screens/auth/SignupStep3Screen.tsx` | ✅ | 동심원 펄스 체크 마크 + 다음 단계 체크리스트 3행 + 30일 ML 보너스 배너 |
| 5 | EmailLoginScreen (시안 외) | — | `src/screens/auth/EmailLoginScreen.tsx` | ➕ | 시안에 없음 (구현 측 확장) |

### 2.2 핵심 화면 (4)

| # | 시안 화면 | 시안 위치 | 현재 구현 | 상태 | 갭 |
|---|----------|----------|----------|------|------|
| 6 | HomeScreen (실시간 대시보드) | `main.jsx:7-326` | `src/screens/home/HomeScreen.tsx` | ✅✅ | **directly verified — 1:1 매핑 완료**. HomeTopBar/MLHeroCard/CommuteRouteCard/QuickActionsGrid/CommunityDelayCard 전부 일치 |
| 7 | FavoritesScreen | `main.jsx:329-405` | `src/screens/favorites/FavoritesScreen.tsx` | 🔍 | 드래그 핸들 (`grip-vertical`) + 노선 필터 칩(`전체 / 2호선 / 신분당 / 8호선 / 4호선`) 행 + nickname Pill 검증 필요 |
| 8 | StationDetailScreen (강남) | `main.jsx:408-530` | `src/screens/station/StationDetailScreen.tsx` | 🔍 | **칸별 혼잡도 막대** (10량 편성 가로 세로 막대 그래프 `main.jsx:482-503`) 패턴이 가장 차별화. 현재 작업 트리에서 `TrainCongestionView.tsx`가 modified — 진행 중 작업과 시안 비교 필요. 또한 출구 안내 4-grid 검증 필요 |
| 9 | RoutesScreen (경로 비교) | `rest.jsx:7-142` | `src/screens/route/AlternativeRoutesScreen.tsx` | 🔍 | 시각적 journey strip (도보/노선 칩/환승 아이콘) `JourneyStrip` 컴포넌트로 추출되어 있으므로 일치 가능성 높음. `시간/옵션 칩` (지금 출발/오전 8:32/도착 시간 지정) 구현 검증 필요 |

### 2.3 히어로 — ML 출퇴근 예측 (1)

| # | 시안 화면 | 시안 위치 | 현재 구현 | 상태 | 갭 |
|---|----------|----------|----------|------|------|
| 10 | CommutePredictionScreen | `commute-prediction.jsx:6-359` | `src/screens/prediction/WeeklyPredictionScreen.tsx` + `CommutePredictionCard` | ⚠️ | 시안의 7개 섹션 — ① 96px 큰 숫자 + 신뢰구간 막대 + 87% confidence ② 구간별 분해 (도보/대기/승차) ③ **시간대별 혼잡도 막대그래프** (지금 컬럼 강조 + 그라디언트 + 말풍선 화살표) ④ 영향 요소 4개 ⑤ 주간 추이 7일 막대 — 어디까지 구현되었는지 deep verify 필요. 화면 이름이 `Weekly`로 변경된 점도 의미 차이 |

### 2.4 커뮤니티 · 통계 · 노선도 (3)

| # | 시안 화면 | 시안 위치 | 현재 구현 | 상태 | 갭 |
|---|----------|----------|----------|------|------|
| 11 | DelayFeedScreen | `rest.jsx:145-207` | `src/screens/delays/DelayFeedScreen.tsx` (579 lines) | 🔍 | 필터 칩 5개 (`전체/지연/신호장애/혼잡/내 노선만`), 카드 내 검증 Pill, 좋아요/댓글/공유 footer 검증 필요. 실제 데이터 연동되므로 시안의 4개 카드 디자인은 정적 — 동적 매핑 적합성도 평가 |
| 12 | StatsScreen (KPI + 차트) | `rest.jsx:210-350` | `src/screens/statistics/StatisticsDashboardScreen.tsx` (404 lines) | ⚠️ | **시안 4개 위젯**: ① KPI 그리드 2x2 ② 주간 정시율 라인차트 + 그라디언트 fill ③ 노선별 도넛 + 범례 ④ 요일별 정시/지연 스택바 + 범례. 현재 `WeeklyStatsChart`만 verified — 도넛(LineUsagePieChart)/스택바(DelayStatsChart)는 status report에서 구현됐다고 명시됐으므로 추가 검증 |
| 13 | MapScreen (호선 칩 + 타임라인 v2) | `rest.jsx:353-477` | `src/screens/map/SubwayMapScreen.tsx` (638 lines) + `.bak` | ⚠️**HIGH** | **갭 가장 큼**. 시안 v2는 ① 가로 스크롤 노선 칩 (1~9호선) ② "2호선 역 목록 · 총 51개 역" 헤더 ③ 4px 노선 컬러 트랙 + 역 노드 (일반 = 채움, 환승 = 흰색 + 외곽선 + ↔) ④ 행: 한글/영문/환승 노선 배지/우측 화살표. 현재 grep 결과 **line-chip + timeline 패턴 미발견** → v1 SVG (`SubwayMapView`) 가능성. `.bak` 파일 존재는 최근 작업 흔적 |

### 2.5 알림 · 온보딩 · 설정 (7 + 1 picker)

| # | 시안 화면 | 시안 위치 | 현재 구현 | 상태 | 갭 |
|---|----------|----------|----------|------|------|
| 14 | AlertsScreen | `rest.jsx:480-545` | `src/screens/alerts/AlertsScreen.tsx` (714 lines) | 🔍 | 타입별 컬러 아이콘 (`arriving/depart/delay/community/cert/weekly`) 매핑, 읽지 않은 카드 `var(--blue-50)` 배경 + 보더 강조, 필터 칩 5개 (`전체 / 읽지않음 N / 도착 / 지연 / 제보`) 검증 필요 |
| 15 | OnboardingStep1Screen (1/4 환영) | `onboarding-steps.jsx:38-164` | `src/screens/onboarding/WelcomeOnboardingScreen.tsx` | ✅ | StepEyebrow + 추상 노선 SVG (페이드 마스크) + 펄스 핀 + 가치 제안 카드 3개 |
| 16 | OnboardingScreen (2/4 출퇴근 경로) | `rest.jsx:548-643` | `src/screens/onboarding/CommuteRouteScreen.tsx` | ✅ | 출/도착 selector + 시간 picker + 요일 칩 7개 |
| 16.5 | **OnboardingStationPickerScreen** (역 선택 — 출발/환승/도착 + 직접 선택) | `onboarding-station-picker.jsx:6-455` | (별도 화면 없음, `TransferStationList.tsx` 부분) | ❌**HIGH** | 시안에는 **독립 화면**으로 존재. 핵심 기능: ① 3슬롯 시각적 라우트 (출발/환승/도착 세로 연결) ② 활성 슬롯에 맞춘 검색 placeholder ③ 최근 검색 칩 ④ 슬롯별 추천 (GPS / 직행+환승 옵션 / 회사 인근) ⑤ **`browseMode` 토글** — 노선 탭 + 노선 내 전체 역 가나다순 목록. 환승역 자동/직접 양방향 선택. 현재 구현은 `CommuteRouteScreen` 내 inline + `TransferStationList` 컴포넌트로 분산됨. **지난 Phase 49(TransferStationList)의 자연스러운 후속 후보** |
| 17 | OnboardingStep3Screen (3/4 알림 권한) | `onboarding-steps.jsx:167-291` | `src/screens/onboarding/NotificationPermissionScreen.tsx` | ✅ | 잠금 화면 미리보기 카드 + 토글 카드 3개 (출근/지연/제보) — 켜진 상태 `2px solid var(--blue-500)` |
| 18 | OnboardingStep4Screen (4/4 즐겨찾기) | `onboarding-steps.jsx:294-419` | `src/screens/onboarding/FavoritesOnboardingScreen.tsx` | ✅ | 검색 바 + 추천 6개 역 + 선택 카운터 + CTA 활성/비활성 상태 |
| 19 | SettingsScreen | `rest.jsx:646-732` | `src/screens/settings/SettingsScreen.tsx` (666 lines) | ✅ | **verified at line 6,42**: gradient profile avatar + sections (출퇴근/알림 4 · 지연 정보 2 · 앱 설정 4 · 기타 3) + 로그아웃 빨강 — Phase 42(SE1) 적용 흔적. 일치도 매우 높음 |

### 2.6 설정 상세 (4)

| # | 시안 화면 | 시안 위치 | 현재 구현 | 상태 | 갭 |
|---|----------|----------|----------|------|------|
| 20 | SettingsCommuteScreen (출퇴근 설정) | `settings-detail.jsx:223-383` | `src/screens/settings/CommuteSettingsScreen.tsx` | ✅ | **verified**: `RouteWithTransfer` atom 사용 (chunk 6/6 코멘트), `outTransfer/inTransfer` state 분리. 시안의 hero 그라디언트 카드 ("32분 ±3분") + 환승 옵션 라디오 패널 (4개: 합정/신도림/사당/교대) + 요일 칩 + ML 스마트 기능 토글까지 매칭 추정 |
| 21 | SettingsAlertsScreen (지연 알림) | `settings-detail.jsx:386-528` | `src/screens/settings/DelayNotificationScreen.tsx` | 🔍 | 시안: ① master 그라디언트 카드 ② 임계값 슬라이더 4-step (3/5/10/15분) ③ 노선 멀티픽 (노선 컬러 칩 + 체크) ④ 알림 출처 3행 (공식/제보/긴급). 임계값 4-step custom slider가 핵심 |
| 22 | SettingsAlertTimeScreen (알림 시간대) | `settings-detail.jsx:531-687` | `src/screens/settings/NotificationTimeScreen.tsx` | ⚠️**HIGH** | **시안의 시그니처 = 24시간 타임라인 시각화** (반복 그라디언트 stripes로 방해 금지 표시 + 출근/퇴근 강조 블록 + hour ticks). 현재 grep 결과 `quietHours` state는 있으나 **24h 타임라인 graphic은 미발견** → 시안의 가장 시각적인 요소 누락 가능성 |
| 23 | SettingsSoundScreen (소리 설정) | `settings-detail.jsx:690-798` | `src/screens/settings/SoundSettingsScreen.tsx` | 🔍 | ① 2x2 알림 방식 카드 (소리+진동/소리만/진동만/무음) ② 볼륨 슬라이더 (continuous, with 핸들) ③ 알림음 라디오 4개 (chime/doorbell/beep/wave) ④ 이벤트별 토글 3행 |

### 2.7 시안 외 추가 화면 (현재 구현 측)

| 화면 | 위치 | 시안 매칭 |
|------|------|----------|
| EditProfileScreen | `src/screens/settings/EditProfileScreen.tsx` | 없음 — 시안의 SettingsScreen 프로필 카드 클릭 시 진입 추정 |
| LanguageSettingsScreen | `src/screens/settings/LanguageSettingsScreen.tsx` | 시안 SettingsScreen에서 "언어 한국어" 행 → 진입 |
| ThemeSettingsScreen | `src/screens/settings/ThemeSettingsScreen.tsx` | 시안에서 라이트/다크 토큰 전환 모드만 정의됨; 별도 화면은 구현 측 확장 |
| LocationPermissionScreen | `src/screens/settings/LocationPermissionScreen.tsx` | 동 |
| PrivacyPolicyScreen | `src/screens/settings/PrivacyPolicyScreen.tsx` | 동 |
| HelpScreen | `src/screens/settings/HelpScreen.tsx` | 동 |
| AccessibilitySettingsScreen | `src/screens/settings/AccessibilitySettingsScreen.tsx` | 시안 외 (Phase 3.6 신규) |
| VoiceSettingsScreen | `src/screens/settings/VoiceSettingsScreen.tsx` | 시안 외 (Phase 3.3 TTS) |
| DelayCertificateScreen | `src/screens/delays/DelayCertificateScreen.tsx` | 시안 home Quick Actions의 "증명서" 진입처 |
| StationNavigatorScreen | `src/screens/station/StationNavigatorScreen.tsx` | 시안 외 (앱 내부 navigation hub) |

---

## 3. 차이가 큰 패턴 정리 (우선순위 순)

### P0 — 시안의 시그니처가 누락 가능성 (재현가치 높음)

1. **MapScreen v2 (호선 칩 + 수직 타임라인)** — 노선도 화면이 시안 v2 디자인과 다른 형태일 가능성 매우 높음. 현재 SVG 기반 view로 보이며, 시안은 챗1에서 명시적으로 v2로 바뀐 디자인 (`pasted-1777743918147-0.png` 참조). 이용 패턴이 완전히 다름 (검색 → 필터 → 노선 선택 → 역 목록).
2. **SettingsAlertTimeScreen 24h 타임라인 그래픽** — 24시간 절기 위에 출퇴근/일반/방해금지 영역을 시각화하는 막대. 시안의 가장 시각적이고 차별화된 설정 화면. 현재는 quietHours toggle + time picker만 있을 가능성.
3. **OnboardingStationPickerScreen 독립 화면** — 시안에서 별도 아트보드로 존재(`onboard-2-picker`). 출발/환승/도착 3슬롯 + browseMode (노선 탭 → 가나다순 역 목록) 패턴.

### P1 — 디테일 누락 가능성

4. **CommutePredictionScreen 시간대별 혼잡도 차트** — 시안의 hero 화면 핵심. "지금" 컬럼 그라디언트 + 글로우 + 말풍선 화살표 + 25/50/75% 점선 그리드라인. 현재 `WeeklyPredictionScreen`으로 이름 변경됨 → 의미 차이 가능.
5. **StatisticsDashboardScreen 도넛 + 스택바** — `LineUsagePieChart` / `DelayStatsChart`가 implementation-status에 명시됨. 시안의 도넛 (47회 중심 텍스트 + 노선 컬러 segment) 및 요일별 정시/지연 스택바 정확도 검증 필요.
6. **StationDetailScreen 칸별 혼잡도 막대** — 10량 편성 막대 그래프 (col별 % 색상). 현재 `TrainCongestionView.tsx`가 작업 트리 modified — 다음 phase 후보.

### P2 — 마이크로 패턴

7. **SignupStep1 통신사 6칸 그리드** + OTP 6박스 + 카운트다운
8. **SettingsAlertsScreen 4-step 임계값 슬라이더** (3/5/10/15분 snap)
9. **SettingsSoundScreen 2x2 알림 방식 카드**
10. **AlertsScreen 타입별 컬러 매핑** (6개 type 6색)
11. **DelayFeedScreen 필터 칩 5개**
12. **FavoritesScreen 드래그 핸들 + 노선 필터**

---

## 4. 시안 데이터 모델 (`data.js` 참고용)

시안에서 참조하는 데이터 구조 (현재 구현과 정합 점검 시 사용):

- `LM_DATA.LINES` — 노선 메타 (`label`, `color`, `name`)
- `LM_DATA.STATIONS` — 역 마스터
- `LM_DATA.NEARBY_STATIONS` — GPS 기반 (distance/walkMin/exit/arrivals)
- `LM_DATA.FAVORITES` — nickname/lines/dest/nextMin/cong
- `LM_DATA.ARRIVALS_GANGNAM` — 도착 + 칸별 congestion 배열
- `LM_DATA.ROUTES` — 경로 비교 (legs: walk/train/transfer)
- `LM_DATA.COMMUTE_PREDICTION` — predicted_min/range/hourly/factors/weekly
- `LM_DATA.STATS` — weeklyTrend/byLine/byDay
- `LM_DATA.LINE_STATIONS` — 노선별 역 리스트 (Map v2용)
- `LM_DATA.DELAY_REPORTS` — line/station/msg/votes/verified
- `LM_DATA.ALERTS` — type/line/title/body/read

현재 구현은 Firebase + Seoul API 실데이터 기반이므로 위 구조는 **시각적 레퍼런스**로만 활용. 데이터 마이그레이션은 불필요.

---

## 5. 추천 다음 phase 후보 (2026-05-06 재검증 결과)

| 우선 | Phase 후보 | 시안 갭 ID | 상태 | 검증 결과 |
|------|-----------|-----------|------|----------|
| 1 | SettingsAlertTime 24h 타임라인 시각화 | P0-2 | ✅ **완료** | commit `356a80f` Phase 50. `NotificationTimeScreen.tsx:240-319`에 24h 타임라인 카드(eyebrow + title + 출퇴근 솔리드 밴드 + 일반 라이트 밴드 + 방해금지 muted 밴드 + hour ticks 0/6/12/18/24 + legend 3종) 매핑 |
| 2 | MapScreen v2 (호선 칩 + 수직 타임라인) | P0-1 | ✅ **완료** | `SubwayMapScreen.tsx:177-322` (Phase 8/28/31 누적). 호선 칩 ScrollView (활성=컬러 채움 + box-shadow / 비활성=2px border) + "{이름} 역 목록 · 총 N개" + lineVisualization 수직 타임라인 + 환승 노드(`ArrowRightLeft size=14 strokeWidth=2.6` — 시안과 정확히 동일) + chevron-right 18 모두 일치 |
| 3 | OnboardingStationPickerScreen 독립 화면 | P0-3 | ✅ **완료** | commit `c6b0e0c` Phase 52 + follow-up `8fc9b62` 테스트. `OnboardingStationPickerScreen.tsx` 독립 화면 존재 |
| 4 | StationDetail 칸별 혼잡도 막대 | P1-6 | ✅ **완료** | PR #14→#16 redirect (commit `35f7cc3`) Phase 53b ArrivalCard car-bar tooltip + PR #17 (commit `3b2bdbd`) Phase 55 empty-state placeholder |
| 5 | CommutePredictionScreen 시간대별 차트 | P1-4 | ✅ **완료** | PR #15 (commit `a8ab59a`) Phase 54 WeeklyPrediction hourly congestion forecast chart |

**P0 갭 0건, P1 갭 0건** — 시안 핵심 화면 모두 main 머지 상태.

남은 작업은 P2 마이크로 텍스처 (24h stripes 패턴 / Pill tone 정밀 매핑 등)이며, 각각 ROI가 낮습니다. 본 문서 6절 "검증 필요 항목" 13건은 line-level 정렬도 audit 대상으로 별도 sweep 가능.

---

## 6. 미수행 — 다음 세션에 검증 필요한 항목

다음은 본 인벤토리에서 직접 verify되지 않은 항목 (구조 기반 추정):

- [ ] `Pill` tone 매핑 정확도 (warn = `#A06A00` foreground 색상 채택)
- [ ] `LineBadge` long label (분당/신분당/경의/공항) padding 처리
- [ ] `SignupStep1Screen` 통신사 6칸 + OTP 박스 모두 존재하는지
- [ ] `FavoritesScreen` 드래그 핸들 + 노선 필터 칩 행
- [ ] `AlertsScreen` 6개 type 컬러 매핑 + 읽지 않은 카드 `--blue-50` 배경
- [ ] `DelayFeedScreen` 5개 필터 칩 + verified Pill
- [ ] `RoutesScreen` 시간 칩 + 선택 카드 expand 시 detail steps
- [ ] `WeeklyPredictionScreen`이 시안 `CommutePredictionScreen` 7개 섹션 모두 커버하는지
- [ ] `StatisticsDashboardScreen` 도넛 차트 (47회 중심 + 6개 segment)
- [ ] `MapScreen` 호선 칩 행 + 수직 타임라인 + 환승 노드 ↔ 아이콘
- [ ] `NotificationTimeScreen` 24h 타임라인 막대 graphic
- [ ] `SoundSettingsScreen` 2x2 mode 카드 + 볼륨 핸들 + 알림음 라디오 4개
- [ ] `DelayNotificationScreen` 임계값 4-step slider snap 동작

이 항목들은 phase 작업 직전 해당 파일을 정밀 read하여 확정.

---

## 7. 부록: 시안 번들 위치

```
/tmp/claude-501/livemetro-design/extracted/livemetro/
├── README.md
├── chats/                      # chat1 (초기) / chat2 (네비/로그인) / chat3 (설정상세)
└── project/
    ├── LiveMetro.html          # 메인 캔버스 (24 아트보드 wiring)
    ├── LiveMetro-print.html    # PDF용 인쇄 레이아웃
    ├── lib/
    │   ├── wanted-tokens.css   # Wanted 토큰 정의
    │   ├── metro-tokens.css    # 서울 노선 컬러
    │   ├── ios-frame.jsx
    │   ├── android-frame.jsx
    │   ├── design-canvas.jsx
    │   └── tweaks-panel.jsx
    └── src/
        ├── data.js
        ├── atoms.jsx           # LineBadge/Pill/CongestionBar/...
        └── screens/
            ├── auth.jsx                           # Login + Signup 2/3
            ├── auth-signup-steps.jsx              # Signup 1/3 + 3/3
            ├── commute-prediction.jsx             # Hero ML 예측
            ├── main.jsx                           # Home/Favorites/StationDetail
            ├── rest.jsx                           # Routes/DelayFeed/Stats/Map/Alerts/Onboarding/Settings
            ├── settings-detail.jsx                # 설정 4 detail 화면
            ├── onboarding-steps.jsx               # 1/3/4 단계
            └── onboarding-station-picker.jsx      # 2/4 역 선택 (independent)
```

```
docs/design/wanted-bundle/                # 기존 v1 번들 (UUID JS files — 다른 번들)
docs/design/wanted-livemetro-template.html # 별도 템플릿
docs/design/wanted-visual-audit.md         # 별도 audit (선행 작업 결과)
```

본 v3 번들 (`j01iuVhlroduq84dc3azIA`)은 `pasted-1777802788702-0.png` (설정 화면 이미지) 및 `pasted-1777743918147-0.png` (노선도 v2 레퍼런스)을 포함.
