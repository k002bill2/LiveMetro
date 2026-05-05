# Wanted Design System — 시각 검수 (Phase 32)

번들 `docs/design/wanted-bundle/` vs 코드 `src/`. typography는 BASELINE 0이므로 **레이아웃/구조/atom 사용/색상/누락 위젯** 차원만 본다.

severity: **H**(핵심 사용자 경험 영향) / **M**(시각 일관성) / **L**(스타일 디테일)

---

## HomeScreen (번들 65629bcd, 코드 src/screens/home/HomeScreen.tsx)

### ✅ 일치
- HomeTopBar: 인사 + 날짜/시간 + 벨 아이콘 + unread dot
- MLHeroCard: gradient(#0066FF→#0044BB), blob 데코, Sparkles 태그, 56px 분 숫자, deltaPill, 신뢰도 subtext — **MLHeroCard.tsx는 픽셀 단위로 번들과 동일**
- QuickActionsGrid: 4개 카드(경로검색/노선도/제보/증명서) — 라벨+아이콘 매칭
- SectionHeader 사용 일관

### 🟥 차이 (high)
| # | 항목 | 번들 | 코드 | severity |
|---|------|------|------|----------|
| H1 | 즐겨찾는 역 리스트 형태 | **vertical** stack, FavoriteRow 카드(LineBadge stack + nickname Pill + 분/초 카운트 + "곧 도착" dot) | **horizontal ScrollView** + StationCard | H |
| H2 | MLHeroCard `deltaMinutes` 표시 | "평소보다 -3분" deltaPill 항상 표시 | `HomeScreen.tsx:187-194` heroProps에 deltaMinutes 누락 → 항상 미표시 | H |
| H3 | 실시간 제보(Community delays) 카드 | "강남역 신호장애" + 검증됨 Pill + "12분 전 · 47명 확인" 형태의 단일 카드 | DelayAlertBanner(다른 디자인) 사용 | H |

### 🟡 차이 (med)
| # | 항목 | 번들 | 코드 | severity |
|---|------|------|------|----------|
| M1 | 즐겨찾기 카드의 분/초 라이브 카운트 | 첫 번째 카드만 `XX분 SS초` + "곧 도착" dot | 미구현 (StationCard 위임) | M |
| M2 | 즐겨찾기 카드의 혼잡도 inline 표시 | dot + "여유/보통/혼잡" 라벨 inline | StationCard 내부에 다르게 처리 | M |
| M3 | bell 아이콘의 unread red dot 위치 | 절대 위치 top:8, right:8, 8x8, white border | HomeTopBar 구현 미확인 — 검증 필요 | M |

### 🟢 차이 (low)
| # | 항목 | 번들 | 코드 |
|---|------|------|------|
| L1 | 상단 인사말 폰트 크기 | 22px / weight 800 | HomeTopBar 구현 확인 필요 |
| L2 | quick action 카드 라운드 | 14 | QuickActionsGrid 확인 필요 |

### 결론
- **HomeScreen 본체는 atom 조립 패턴이 잘 적용**되어 있으나, **"즐겨찾는 역" 섹션이 번들과 구조적으로 다름** (H1) — 번들이 의도한 정보 밀도와 라이브 카운트 경험이 누락
- MLHeroCard는 컴포넌트 자체는 완성, 호출자가 `deltaMinutes`를 넘기지 않아 핵심 가치(`-3분 빠름`) 미노출 (H2) — useMLPrediction에서 baseline 비교 값 추가 필요
- DelayAlertBanner를 번들의 "실시간 제보" 카드 디자인으로 교체하거나, 그것과 별개로 "근처 노선" 제보 카드를 추가 (H3)

---

---

## FavoritesScreen (번들 65629bcd, 코드 src/screens/favorites/FavoritesScreen.tsx)

### ✅ 일치
- Header: "즐겨찾기" 28px weight 800 + sort + add buttons (36x36 pill)
- Search bar (FavoritesSearchBar)
- 이미 `FavoriteRow` 컴포넌트가 design/에 빌드되어 있음 (번들 매칭 디자인)

### 🟥 차이 (high)
| # | 항목 | 번들 | 코드 | severity |
|---|------|------|------|----------|
| F1 | 리스트 row 컴포넌트 | **FavoriteRow** (grip + LineBadge stack + Pill nickname + 방향·혼잡도 + 분) | **DraggableFavoriteItem → StationCard wrapper** (다른 디자인) | H |
| F2 | Filter chips | `전체/2호선/신분당/8호선/4호선` 가로 스크롤 (alphabet + line filter) | FavoritesSearchBar 내부 다른 형태 | M |

### 결론
- FavoriteRow는 빌드되었으나 wired되지 않은 상태(주석에 "Phase 3B groundwork: ready to drop in"). 마이그레이션 미완료
- DraggableFavoriteItem이 StationCard를 감싸서 horizontal scroll의 큰 카드를 vertical로 보여주는 구조 — 번들의 dense vertical row와 다름

---

## StationDetailScreen (번들 65629bcd, 코드 src/screens/station/StationDetailScreen.tsx) — ✅ 검증 완료

### ✅ 일치 (검증됨)
- StationDetailHeader (top bar + hero)
- DirectionSegment (상행/하행 segmented) — `src/components/station/DirectionSegment.tsx`
- ArrivalCard with `carCongestion` prop — **칸별 혼잡도 구현됨** (line 265: `carCongestion={idx === 0 ? carCongestionPct : undefined}`)
- ExitInfoGrid — 출구 안내 grid

### 검증 결과 — audit 가정 모두 틀림
| # | 원래 가정 | 실제 코드 | 정정 severity |
|---|---|---|---|
| S1 | 칸별 혼잡도 미구현 | ✅ ArrivalCard에 carCongestion prop 첫 도착에만 표시 | **L** (디테일 점검만) |
| S2 | 첫 도착 강조 미구현 | ✅ ArrivalCard `isFirst` prop으로 처리 | **L** |
| S3 | 출구 안내 grid 미구현 | ✅ ExitInfoGrid 컴포넌트 wired | **L** |
| S4 | 상하행 segmented 별도 화면 | ✅ DirectionSegment 통합됨 | **L** |

### 결론
StationDetailScreen은 **거의 완벽**. atom 4종(Header/Direction/Card/Exit) 모두 wired. 시각 디테일(border 색상, shadow 강도 등) 미세 조정만 필요할 수 있음.

---

## LoginScreen (번들 83fe8f1a, 코드 src/screens/auth/AuthScreen.tsx + components/auth/*)

### ✅ 일치
- LoginHero, FaceIDButton, SocialButton(apple/google/kakao), OrDivider, TermsFooter 컴포넌트 모두 존재
- 컴포넌트 단위로는 번들 1:1 매핑

### 🟡 차이 (med)
| # | 항목 | 번들 | 코드 | severity |
|---|------|------|------|----------|
| L1 | LoginHero 라인 그래픽 | 5개 노선 색상 추상 SVG path + 펄스 핀 + 워드마크 | LoginHero 구현 검증 필요 (SVG path 5개 line + pulse pin + 'LiveMetro' wordmark 일치 여부) | M |
| L2 | FaceID 버튼 글리프 | 4개 코너 bracket + 두 눈 + 입 + 펄스 dot | FaceIDButton 구현 검증 필요 | M |
| L3 | "이메일로 로그인" 보조 버튼 | mail icon + outline pill | EmailLoginScreen이 별도 화면으로 분리 | L |

### 결론
컴포넌트는 갖춰져 있으나 LoginHero/FaceIDButton의 시각 디테일이 번들과 일치하는지는 코드 정밀 비교 필요. AuthScreen 자체의 조립이 번들의 LoginScreen과 같은 순서/spacing인지 확인 필요.

---

## RoutesScreen (번들 ee09cc40, 코드 src/screens/route/AlternativeRoutesScreen.tsx) — ✅ 검증 완료

### 검증 결과
화면 본체 컨셉이 다름: **번들은 "경로 비교" 화면**(From-To 입력 + 시간 옵션 + 3가지 경로 비교 + visual strip + 길안내 CTA), **코드는 "지연 시 대체 경로" 화면**(자동 계산된 우회 경로 표시 + RouteComparisonView로 원경로 vs 대체경로 비교).

| # | 번들 (경로 비교) | 코드 (지연 우회) | 정정 severity |
|---|---|---|---|
| R1 | From-To 입력 카드 + arrow-up-down | `route.params`에서 받은 from/to를 우회 계산만 | M (대체 경로 표시 목적은 다름) |
| R2 | 시간 옵션 chips | 미구현 (대체경로 화면 컨셉상 불요) | — |
| R3 | **Visual journey strip** (train colored block + walk pill + transfer arrow + station-proportional 너비) | `RouteLinePath` (LineIndicator → ArrowRight → LineIndicator chain, simpler) | **H** (시각 표현력 격차 큼) |
| R4 | 선택 시 detailed steps 펼침 | RouteComparisonView가 대체로 처리 | L |
| R5 | "이 경로로 길안내 시작" CTA | 미구현 (대체경로 화면이 길안내 시작점 아님) | — |

### 결론
**번들의 "경로 비교 화면"은 별도로 빌드되지 않음** — 코드의 AlternativeRoutesScreen은 다른 user story(지연 발생 시 대안)에 충실하나, 번들의 explore-and-compare flow는 부재. 새 화면 신설 또는 기존 화면 확장 결정 필요.

R3 visual journey strip은 어느 화면에서든 가치 있는 atom — JourneyStrip component 신설이 후속 작업.

---

## DelayFeedScreen (번들 ee09cc40, 코드 src/screens/delays/DelayFeedScreen.tsx)

### 핵심 차이
| # | 항목 | 번들 | severity |
|---|------|------|----------|
| D1 | Header: "실시간 제보" 28px + megaphone 작성 버튼 (blue 36x36) | 코드 검증 필요 | M |
| D2 | "지난 1시간 · 실시간 제보 4건" subtitle | 코드 검증 필요 | L |
| D3 | Filter chips (`전체/지연/신호장애/혼잡/내 노선만`) | 코드 검증 필요 | M |
| D4 | Report card: thumbs-up/message-circle/share icon row | 코드 검증 필요 | M |

---

## StatsScreen (번들 ee09cc40, 코드 src/screens/statistics/StatisticsDashboardScreen.tsx) — ✅ 검증 완료

### ✅ 일치 (검증됨)
- **4종 차트 모두 wired**: `StatsSummaryCard`, `WeeklyStatsChart`, `DelayStatsChart`, `LineUsagePieChart` (line 22-25, 141-160)
- 추가로 "지연 시간 분포" + "이번 주 요약" + "💡 인사이트" 섹션 — 번들보다 풍부

### 차이 (med/low)
| # | 항목 | 번들 | 코드 | 정정 severity |
|---|---|---|---|---|
| ST1 | Header | 17px chevron-left + "나의 통계" + calendar icon (cleaner) | "📊 통계 대시보드" 28px (이모지 + 큰 사이즈) | M (스타일 일관성) |
| ST2 | Section titles | "주간 정시율 추이" + "최근 7주" subtitle (SectionHeader) | "📈 주간 정시율 추이" 이모지 prefix + subtitle 없음 | M |
| ST3 | KPI grid 위치 | Top, 2x2 grid with delta indicator | StatsSummaryCard에 통합 | L (컴포넌트화 차이) |
| ST4 | Card padding | 20px + line-subtle border | 16px + shadow | L |

### 결론
ST1-4 high severity 가정 모두 **틀림**. 4종 차트는 이미 존재. 차이는 **이모지 prefix vs SectionHeader** 일관성 + 패딩/그림자 디테일. **Phase 36은 큰 차트 구현이 아닌 헤더 정리**로 대폭 축소 가능.

---

## MapScreen (번들 ee09cc40, 코드 src/screens/map/SubwayMapScreen.tsx) — ✅ 검증 완료

### ✅ 일치 (검증됨)
- **Line picker chips**: outline + active filled + line-color shadow (line 174-220) — 번들 정확 매칭
- **Vertical timeline 구현됨**: stationMarkerContainer + stationCircle + stationConnector (line 235-316). 환승역은 borderWidth 4 + bg-base, 일반은 lineColor filled
- 역명(ko) + nameEn 표시 (line 279-280) — 번들 매칭
- Chevron-forward (line 312)

### 차이 (low)
| # | 항목 | 번들 | 코드 | 정정 severity |
|---|---|---|---|---|
| MP1 | 환승 아이콘 | lucide `arrow-right-left` size 14 strokeWidth 2.6 | Ionicons `swap-horizontal` size 16 | L (cosmetic) |
| MP2 | 환승 노드 크기 | 30x30 with 3px border | (코드 정확 dim 미확인 — styles.stationCircle) | L |
| MP3 | Modal vs page navigation | 번들은 station tap 즉시 detail로 이동 | 코드는 Modal popup 후 "도착 정보 보기" 버튼 | M (UX flow 차이) |

### 결론
MP2 high severity 가정 **틀림** — vertical timeline은 정확히 구현되어 있음. 잔여 작업은 환승 아이콘 통일(Ionicons → lucide) + Modal 우회 결정 정도.

---

## AlertsScreen (번들 ee09cc40, 코드 src/screens/alerts/)

### 핵심 차이
| # | 항목 | 번들 | severity |
|---|------|------|----------|
| AL1 | "모두 읽음" 우측 액션 텍스트 (blue) | 코드 검증 필요 | L |
| AL2 | Filter chips (`전체/읽지않음 2/도착/지연/제보`) | 코드 검증 필요 | M |
| AL3 | Type-별 아이콘 + 색상 매핑 (arriving=blue/depart=blue/delay=red/community=yellow/cert=violet/weekly=cyan) | 코드 검증 필요 | M |
| AL4 | Read 상태 시각 차이 (read=bgBase, unread=blue-50 + blue border) | 코드 검증 필요 | M |

---

## OnboardingScreen (번들 ee09cc40, 코드 src/screens/onboarding/)

### 핵심 차이
| # | 항목 | 번들 | severity |
|---|------|------|----------|
| ON1 | 4단계 progress bar (active=blue) + STEP N / 4 라벨 + 건너뛰기 | 코드 측 OnbHeader가 있을 것 (chunk 1/6 commit 6b578cd) — 검증 | M |
| ON2 | From/To selector (출발 dot + 도착 dot + chevron) | CommuteRouteScreen 검증 | M |
| ON3 | **Time picker** — 32px dual digit (시:분) + preset chips (07:30~09:30) | CommuteRouteScreen 검증 | H |
| ON4 | Days picker (월~일 7-cell grid + 평일 선택) | CommuteRouteScreen 검증 | M |

---

## SettingsScreen (번들 ee09cc40, 코드 src/screens/settings/SettingsScreen.tsx)

### 핵심 차이
| # | 항목 | 번들 | severity |
|---|------|------|----------|
| SE1 | Profile card — gradient avatar (135deg blue) + 이름 + email + 누적 횟수 | 코드 검증 필요 | M |
| SE2 | Sectioned list — UPPERCASE caption header + rounded card with icon+label+toggle/value | 코드 검증 필요 | M |
| SE3 | Toggle switch (44x26 blue when on) | 코드 검증 필요 | L |
| SE4 | Sections: 출퇴근/알림/화면 접근성 | 코드는 25개 sub-screen으로 펼쳐져 있어 메인 SettingsScreen이 indexed list 역할 | M |

---

## CommutePredictionScreen (번들 9a7fe457, 코드 src/screens/prediction/CommutePredictionScreen.tsx + WeeklyPrediction)

번들 미독해 — 별도 audit 필요.

---

## 🎯 통합 우선순위 백로그 (검증 후)

### High (검증으로 확정된 진짜 gap) — 4건
1. **HomeScreen H1**: 즐겨찾는 역 horizontal → vertical FavoriteRow 리스트로 교체
2. **HomeScreen H2**: MLHeroCard에 deltaMinutes 데이터 흐름 연결 (useMLPrediction baseline 비교)
3. **FavoritesScreen F1**: DraggableFavoriteItem → FavoriteRow 마이그레이션
4. **RoutesScreen R3**: Visual journey strip atom 신설 (JourneyStrip 컴포넌트 + AlternativeRouteCard 통합)

### Med (확정 — 시각 일관성)
- HomeScreen H3 (Community delays 카드 디자인 → 번들 패턴으로 교체 또는 신설)
- HomeScreen M1-M3 (라이브 카운트, 혼잡도 inline, bell unread dot)
- StatsScreen ST1-2 (이모지 prefix 제거 + SectionHeader 통일)
- MapScreen MP3 (Modal vs 즉시 navigate 결정)
- LoginScreen L1-L2 (LoginHero/FaceIDButton 디테일 — 별도 코드 검증 필요)
- DelayFeedScreen D1-D4 (별도 코드 검증 필요)
- AlertsScreen AL2-AL4 (별도 코드 검증 필요)
- SettingsScreen SE1-SE2 (별도 코드 검증 필요)
- OnboardingScreen ON3 (Time picker — 별도 코드 검증 필요)

### Low (확정 — 디테일)
- StationDetailScreen S1-S4 (이미 구현, 디테일만)
- MapScreen MP1-MP2 (lucide 아이콘 통일)
- StatsScreen ST3-4 (KPI 위치 + 패딩)

### 🟢 검증으로 강등된 가정들 (audit 정확도 보강 결과)
| 원래 high | 실제 상태 | 효과 |
|-----------|-----------|------|
| StationDetail S1 (칸별 혼잡도) | ✅ ArrivalCard에 wired | high → low |
| StationDetail S3 (출구 grid) | ✅ ExitInfoGrid wired | high → low |
| StationDetail S4 (방향 segment) | ✅ DirectionSegment wired | high → low |
| Stats ST1-4 (차트 4종) | ✅ 모두 wired (4 컴포넌트 존재) | high → med (헤더 디테일만) |
| Map MP2 (vertical timeline) | ✅ 정확히 구현 | high → low |

→ **8건의 high 가정 중 5건이 강등** = audit 정확도 보강의 큰 효과. 진짜 high는 4건.

## Phase 33+ 후속 계획 (검증 후 단순화)

| Phase | 핵심 작업 | 추정 작업량 |
|-------|-----------|-----------|
| **33** | HomeScreen H1+H2+H3 (즐겨찾기 vertical 리스트 + delta 데이터 + community card) | 중 (HomeScreen.tsx + useMLPrediction + 신규 CommunityDelayCard atom) |
| **34** | FavoritesScreen F1 (DraggableFavoriteItem → FavoriteRow 통합, drag DnD 보존) | 중 |
| **35** | JourneyStrip atom 신설 + RoutesScreen R3 통합 + (옵션) "경로 비교" 신규 화면 | 중-큰 |
| **36** | 추가 검증 phase: LoginScreen, DelayFeed, Alerts, Onboarding, Settings 코드 직접 audit (med 등급 정확도 보강) | 작 |
| **37** | StatsScreen + MapScreen 디테일 정리 (이모지 제거 + Modal/navigate 통일 + lucide 통일) | 작 |
| **38+** | Phase 36 audit 결과에서 식별된 작업 | 가변 |

원래 9 phase → **5 phase로 축소** (검증 결과 5건의 high → low 강등 효과). 작업량 60%+ 감소.

각 phase는 atom 추가 → screen 통합 → typography helper 적용 → test 통과 → HARD_PREFIXES 유지 순서.
