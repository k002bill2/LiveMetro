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

## LoginScreen (번들 83fe8f1a, 코드 src/screens/auth/AuthScreen.tsx + components/auth/*) — ✅ 검증 완료

### ✅ 일치 (검증됨)
- **LoginHero (LoginHero.tsx)**: 5 line path SVG with **번들 정확 컬러**(#00A84D/#0052A4/#EF7C1C/#996CAC/#D6406A) + 노선당 2개 station node + pulse pin at (168, 130) + 워드마크 + brand badge — **픽셀 단위 일치**
- **FaceIDButton (FaceIDButton.tsx)**: 26x26 frame + 4 corner brackets + 2 eyes + mouth + 1.4s 주기 펄스 dot — **픽셀 단위 일치**. 추가로 Touch ID variant 지원 (Fingerprint 아이콘)
- **AuthScreen orchestrator**: LoginHero/FaceIDButton/SocialButton/OrDivider/TermsFooter 모두 wired. Phase 8 rewrite로 679줄 legacy → 365줄 orchestrator + 5 atoms로 정리

### 검증 결과 — audit 가정 모두 강등
| # | 원래 가정 | 실제 코드 | 정정 severity |
|---|---|---|---|
| L1 | LoginHero 미구현 추정 | ✅ 5 line + pulse pin + wordmark 정확 구현 | **L** (코스메틱만) |
| L2 | FaceID glyph 미구현 추정 | ✅ corner bracket + eyes + mouth + pulse 정확 구현 | **L** |
| L3 | 이메일 로그인 보조 버튼 | EmailLoginScreen 분리 (의도된 분리) | **L** (UX 결정) |

### 결론
LoginScreen은 **거의 완벽**. atom 5종 모두 wired + 번들 디자인 1:1. 시각 차이 없음.

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

## DelayFeedScreen (번들 ee09cc40, 코드 src/screens/delays/DelayFeedScreen.tsx) — 🟨 부분 검증

### ✅ 일치 / 부분 일치 (검증됨)
- delayReportService 기반 실시간 구독 + filter chip + 카드 list ✓ 구조 일치
- 카드 내부: line accent + line badge + station + time + reportType + description + reporter + verified CheckCircle + credibility + upvote button ✓
- formatTimeAgo 헬퍼 (방금 전/N분 전/N시간 전) ✓ 번들과 동일

### 검증 결과
| # | 원래 가정 | 실제 코드 | 정정 severity |
|---|---|---|---|
| D1 | "실시간 제보" 28px + megaphone | 헤더는 별도 검증 필요 (read 범위 밖). Plus 아이콘 사용 (megaphone 아님) | **M** (아이콘 통일) |
| D2 | "지난 1시간 · 4건" subtitle | 미구현 추정 | **L** (메타 라인) |
| D3 | filter: `전체/지연/신호장애/혼잡/내 노선만` (type 기반) | LINES = `전체/1~9호선` (line 기반) — **filter 축이 다름** | **M** (filter 축 결정 필요) |
| D4 | thumbs-up + message-circle + share | ThumbsUp만 구현, comment/share 없음 | **M** (소셜 액션 부족) |

### 결론
구조는 잘 갖춰짐 (구독+필터+카드). 차이는: filter 축(line vs type), 액션 row의 comment/share 부재, megaphone vs Plus 아이콘. **D3가 가장 의미 있는 결정 — 사용자 의도(특정 라인만 vs 특정 사고타입만)**.

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

## AlertsScreen (번들 ee09cc40, 코드 src/screens/alerts/AlertsScreen.tsx) — ✅ 검증 완료

### ✅ 일치 (검증됨)
- useAlerts hook + StoredNotification 모델 ✓
- markAsRead + markAllAsRead + clearAll 액션 ✓
- formatTimestamp 헬퍼 (방금/N분/N시간/N일/날짜) ✓ 번들과 거의 동일

### 검증 결과 — gap 확정
| # | 원래 가정 | 실제 코드 | 정정 severity |
|---|---|---|---|
| AL1 | "모두 읽음" blue 텍스트 | ✅ Phase 40 검증 — header에 CheckCheck 아이콘 + handleMarkAllAsRead 버튼 (텍스트 대신 아이콘 사용) | **L** (UX 결정) |
| AL2 | filter chips `전체/읽지않음 N/도착/지연/제보` | ✅ Phase 41에서 해소 — 5 chip(`전체/읽지않음 N/도착/지연/정보`) row + FilterId 매핑(arrival=ARRIVAL, delay=DELAY group, info=SERVICE/COMMUTE/FAVORITE) + filteredNotifications memo | ~~H~~ → ✅ |
| AL3 | type-별 차별화 아이콘+색상 | ✅ Phase 37에서 해소 — getNotificationIcon에 ARRIVAL→TrainFront, DELAY→AlertTriangle, SERVICE→BarChart3, FAVORITE→Star, COMMUTE→Clock 매핑 + getNotificationColor 신설 | ~~H~~ → ✅ |
| AL4 | read=bgBase, unread=blue-50 + blue border | ✅ Phase 40 검증 — `unreadCard` 스타일(border `primaryNormal` + bg `primaryBg`)로 read/unread 시각 구분 구현됨. 번들의 blue-50 + blue border와 개념적으로 동일 | **L** (구현됨) |

### 결론
모든 high/med 항목 해소: AL3 (Phase 37), AL4 (Phase 40 L 강등), AL2 (Phase 41), SE2 (Phase 40 L). AlertsScreen은 audit 완전 완료. 번들의 "제보" chip은 코드 type 체계와 정합하도록 "정보"로 라벨 조정 (SERVICE_UPDATE/COMMUTE_REMINDER/FAVORITE 그룹).

---

## OnboardingScreen (번들 ee09cc40, 코드 src/screens/onboarding/CommuteRouteScreen.tsx + others) — ✅ 검증 완료

### ✅ 일치 (검증됨)
- **OnbHeader atom** (`@/components/onboarding/OnbHeader`): 4-step progress bar, Phase Chunk 1/6 commit `6b578cd`로 신설. CommuteRouteScreen의 step 2/4 위치에 wired (line 31)
- StationSearchModal + TransferStationList + RoutePreview 3종 atom으로 From/Transfer/Arrival 선택 ✓
- onSkip handler (useOnboardingCallbacks) ✓ → 건너뛰기 액션

### 검증 결과
| # | 원래 가정 | 실제 코드 | 정정 severity |
|---|---|---|---|
| ON1 | progress bar + STEP 라벨 + 건너뛰기 | ✅ OnbHeader atom 구현 + onSkip 연결 | **L** (디테일만) |
| ON2 | From/To dot selector | TransferStationList + StationSearchModal로 처리 — **번들의 inline dot/chevron row와 다른 모달 기반 UX**. ✅ Phase 43: 둘 다 합법적 UX 선택, gap이 아닌 design choice | **L** (UX 결정) |
| ON3 | Time picker (32px dual digit + preset chips) | **Onboarding에서 제거됨** — CommuteTime step이 Chunk 5에서 SettingsCommute로 이동. ✅ Phase 43 검증: SettingsCommute의 `SettingTimePicker` (line 19/197/211/239/245)로 정상 재배치 | **L** (Onboarding 외 기능, 의도된 재배치) |
| ON4 | Days picker (월~일 7-cell grid) | 미구현. ✅ Phase 43 결정: SettingsCommute에도 없음, 코드 전체가 weekdays 기본 가정. 추가 시 cross-screen schema 변경(ParamList + CommuteSchedule + UI) — 별도 product 의사결정 phase로 이월 | **L** (의도된 simplification) |

### 결론
**Phase 43 검증 완료**: ON1 (구현됨), ON2 (UX 합법적 선택), ON3 (SettingsCommute로 정상 재배치 확인), ON4 (의도된 simplification, 추가 시 cross-screen schema 변경 필요). 모든 sub-item L 등급으로 audit 완전 closure. Onboarding은 "최소 필수만 받고 detail은 나중"이라는 Chunk 5 설계 철학이 일관되게 구현됨.

---

## SettingsScreen (번들 ee09cc40, 코드 src/screens/settings/SettingsScreen.tsx) — ✅ 검증 완료

### ✅ 일치 (검증됨)
- AsyncStorage + SecureStore 기반 자동로그인/생체인증 토글 ✓
- biometric 서비스(isBiometricAvailable, isBiometricLoginEnabled, getBiometricTypeName, reEnable, disable) wired ✓
- React Native `<Switch>` 컴포넌트 사용 ✓ (번들의 커스텀 44x26 토글 UI 대신 OS 표준)
- 25개 sub-screen으로 분리된 구조 — 번들의 단일 list와 다른 indexed navigation pattern

### 검증 결과
| # | 원래 가정 | 실제 코드 | 정정 severity |
|---|---|---|---|
| SE1 | gradient avatar(135deg blue) + 이름 + email + 누적 N회 | ✅ Phase 42에서 해소 — LinearGradient 52x52 pill (#0066FF→#6FA8FF) + 이니셜 + email · 누적 N회 (commuteLogService) + chevron-right (Pencil 제거) | ~~M~~ → ✅ |
| SE2 | UPPERCASE caption header + rounded card + icon+toggle | ✅ Phase 40 검증 — sectionTitle에 `textTransform: 'uppercase'` + `letterSpacing: 0.6` ✓. settingGroup rounded card + iconContainer 36x36 pill ✓ | **L** (구현됨) |
| SE3 | Custom 44x26 blue toggle | RN `<Switch>` 사용 (OS 표준) — 의도적 결정 | **L** (UX 결정) |
| SE4 | 출퇴근/알림/화면 접근성 sections | 25개 sub-screen으로 풍부하게 분리 (CommuteSettings/DelayNotification/SoundSettings 등) | **L** (확장된 구현) |

### 결론
모든 sub-item 해소: SE1 (Phase 42), SE2 (Phase 40 L), SE3 (OS Switch L), SE4 (확장 L). SettingsScreen audit 완전 완료. profile card는 이제 번들의 시각 시그니처(gradient avatar + 이니셜 + 누적 횟수)를 그대로 반영.

---

## CommutePredictionScreen (번들 9a7fe457, 코드 src/screens/prediction/CommutePredictionScreen.tsx + WeeklyPrediction)

번들 미독해 — 별도 audit 필요.

---

## 🎯 통합 우선순위 백로그 (Phase 36 검증 후)

### ✅ Phase 33-35로 해소된 high gap (4건)
1. ~~HomeScreen H1~~ — vertical layout 전환 (Phase 33-C1)
2. ~~HomeScreen H2~~ — MLHeroCard deltaMinutes wire (Phase 33-A)
3. ~~FavoritesScreen F1~~ — FavoriteRow 통합 (Phase 34)
4. ~~RoutesScreen R3~~ — JourneyStrip atom + AlternativeRouteCard (Phase 35)

### ✅ 새로 식별 + 즉시 해소된 high gap
1. ~~AlertsScreen AL3~~: Phase 37에서 type-별 icon+color 매핑 구현 (commit 추적용)

### 🔴 Phase 40 검증으로 새로 확정된 high gap
1. **AlertsScreen AL2**: filter chips 부재 — sub-item 미독해 가정이 실제로는 H severity gap. 사용자가 알림 type별/read 상태별 분류 불가

### Med (Phase 40 검증 후)
- DelayFeed D3 (filter 축 결정 — line vs type) — product 결정 필요
- DelayFeed D4 (comment/share 액션 부재) — 백엔드 의존
- ~~DelayFeed D1~~ ✅ Phase 38 해소
- ~~AlertsScreen AL2~~ → 🔴 H로 승격 (위)
- ~~AlertsScreen AL4~~ ✅ Phase 40 검증으로 L 강등
- Onboarding ON2 (modal 기반 vs inline dot/chevron)
- Onboarding ON4 (Days picker 부재)
- Settings SE1 (gradient avatar + 누적 횟수 부재)
- ~~Settings SE2~~ ✅ Phase 40 검증으로 L 강등
- HomeScreen H3 부속 디테일 (실시간 제보 카드는 Phase 33-B 신설로 기본 구현됨)
- ~~StatsScreen ST1-2~~ ✅ Phase 39 해소

### 🟢 Phase 36 검증으로 강등된 가정 (총 5건)
| 원래 severity | 항목 | 강등 이유 |
|--------------|------|----------|
| M → L | LoginScreen L1 | LoginHero가 5 line + pulse pin + wordmark 픽셀 일치 |
| M → L | LoginScreen L2 | FaceIDButton glyph(corner+eyes+mouth+pulse) 픽셀 일치 |
| M → L | LoginScreen L3 | EmailLoginScreen 분리는 의도된 결정 |
| H → L | Onboarding ON1 | OnbHeader atom 완전 구현 |
| H → L | Onboarding ON3 | Onboarding에서 의도적으로 제거됨 (SettingsCommute로 이동) |
| L → L | Settings SE3 | OS 표준 Switch 사용 (의도된 결정) |

### Low (확정 — 디테일)
- StationDetailScreen S1-S4 (이미 구현, 디테일만)
- MapScreen MP1-MP2 (lucide 아이콘 통일)
- StatsScreen ST3-4 (KPI 위치 + 패딩)
- LoginScreen L1-L3 (디테일만)
- Onboarding ON1, ON3 (구현됨/의도된 제거)
- Settings SE3-SE4 (의도된 결정/확장된 구현)

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

## Phase 33+ 진행 + 후속 계획

### 완료
| Phase | 핵심 작업 | commit |
|-------|-----------|--------|
| ✅ 32 | 시각 audit 문서 신설 | `6de4f8a` |
| ✅ 33 | HomeScreen H1+H2+H3 (vertical 즐겨찾기 + delta + community card) | `8838140` |
| ✅ 34 | FavoritesScreen FavoriteRow 통합 | `9f453ef` |
| ✅ 35 | JourneyStrip atom + RoutesScreen R3 | `8986441` |
| ✅ 36 | LoginScreen/DelayFeed/Alerts/Onboarding/Settings 검증 (audit 정확도 보강) | `a91f1ee` |
| ✅ 37 | AlertsScreen AL3: type-별 icon+color 매핑 + audit 라벨 정확도 수정 | `69bcb0b` |
| ✅ 38 | DelayFeedScreen D1: Plus → Megaphone (D3/D4 이월) | `c0e6537` |
| ✅ 39 | StatsScreen 이모지 7개 제거 + MapScreen Ionicons 6개 → lucide | `0eac3de` |
| ✅ 40 | Alerts AL2/AL4 + Settings SE1/SE2 render 검증 (AL2 H 승격, AL4/SE2 L 강등) | `723897b` |
| ✅ 41 | AlertsScreen AL2: filter chips 신설 (5 chip + filter 매핑) | `9ef347d` |
| ✅ 42 | SettingsScreen SE1: gradient avatar + 이니셜 + 누적 횟수 | `3615be0` |
| ✅ 43 | Onboarding ON2/ON4 audit closure (UX 결정 + 의도된 simplification 명시) | (this) |

### 향후 (Phase 36 검증 후 우선순위 재조정)

| Phase | 핵심 작업 | 추정 작업량 | 영향 |
|-------|-----------|-----------|------|
| 이월 | D3 (filter 축), D4 (comment/share), MP2 (Modal vs navigate), ON4 (Days picker 추가 여부) | — | product 결정 영역 |
| 후속 | CommuteSettingsScreen Ionicons → lucide 잔여 (Phase 39 follow-up) | 작 | L |

### 작업량 변화 추이
- 초기 audit: 9 phase 추정
- Phase 32-G 검증 후: 5 phase로 축소 (5건 high → low 강등)
- Phase 36 검증 후: **5건 추가 강등 + 1건 신규 high(AL3)** — 잔여 5 phase로 유지하되 AL3가 새로운 H 우선순위

각 phase는 atom 추가 또는 매핑 보강 → screen 통합 → typography helper 적용 → test 통과 → HARD_PREFIXES 유지 순서.
