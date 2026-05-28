# Manual UI 검증 체크리스트 — 2026-05-17 머지 4 PR

본 체크리스트는 PR #139, #140, #142 머지 후 사용자 체감 회귀를 확인합니다.
모든 항목은 시뮬레이터/실기기에서 직접 조작 필요.

**시작 명령**:
```bash
npm start
# iOS: i 키, Android: a 키
```

---

## ① PR #139 (F5.2b) — TrainArrivalList inline Item → TrainArrivalCard variant='compact' 교체

**Risk**: 🔴 시각 회귀 큼 — markup 정보 모델이 바뀜.

| 경로 | 단계 | 확인 사항 | 예상 결과 |
|---|---|---|---|
| 1-A | 강남역 진입 (`__DEV__` mock data) | 4개 mock train 카드 표시 | `2호선` line badge + `상행`/`하행` direction badge + 시간 + (옵션) `gangnam역` 표시 |
| 1-B | 동일 화면 | 목적지 텍스트("{신도림}/{성수}/{건대입구}/{까치산} 방면") | **사라짐** (의도된 변경) — 회귀로 판정 시 patch 또는 revert 결정 |
| 1-C | 지연 카드 | 지연 분 표시 형식 | `3분 지연` (괄호 없음) — 이전엔 `(3분 지연)` |
| 1-D | 9호선 급행역 (노량진 / 여의도) | 급행 카드 | 빨간 `급행` badge 노출 |
| 1-E | 일반 카드 | 도착 시간 텍스트 | `2분후` / `5분후` / `도착` 등 inline과 동일 포맷 |
| 1-F | VoiceOver / TalkBack | screen reader 라벨 | `"2호선, 상행 열차, 2분후, 상태: 정상"` 또는 station 추가 |

**회귀 발견 시 액션**:
- 시각 회귀 → `git revert c7e40f1` (F5.2b 단일 commit revert. PR #136의 variant prop은 main에 보존 → 다음 시도 즉시 가능)
- 또는 patch: TrainArrivalCard에 `showDestination?: boolean` prop 추가 → `<TrainArrivalCard variant="compact" showDestination />` 호출

---

## ② PR #140 (arrivalService throwOnError) — SeoulApiError가 ErrorFallback까지 도달

**Risk**: 🟡 caller 동작 변경 — 일부 폴링이 이전엔 silent cache fallback이던 자리에 ErrorFallback 노출.

| 시나리오 | 재현 방법 | 예상 결과 |
|---|---|---|
| 2-A | Wi-Fi 차단 → 강남역 진입 | ErrorFallback `"연결을 확인해주세요"` 노출 + 재시도 버튼 |
| 2-B | 정상 네트워크 → 도착정보 정상 로딩 | 기존과 동일 (회귀 없음) |
| 2-C | Seoul API rate limit 트리거 (드물게 재현) | ErrorFallback `"도착정보를 잠시 가져올 수 없어요"` (SeoulApiError category=transient) |
| 2-D | 재시도 버튼 클릭 | 새 fetch 시작 + loading state → 성공 시 정상 데이터, 실패 시 다시 ErrorFallback |

**회귀 발견 시 액션**:
- 예상보다 ErrorFallback이 자주 노출되면 → dataManager 측 `throwOnError: true`를 `throwOnError: { categories: ['quota', 'auth'] }` 같은 selective opt-in으로 좁히기 (별도 PR)
- 또는 cache TTL 늘리기 (`arrivalService.options.cacheTTL`)

---

## ③ PR #142 (F3 polish) — 시간표 timestamp + legend + expand/collapse

**Risk**: 🟢 polish — 기능 영향 없음, UX 개선만.

| 항목 | 경로 | 확인 사항 | 예상 결과 |
|---|---|---|---|
| 3-A | StationDetailScreen → 시간표 헤더 | "현재 HH:MM" 우측 정렬 | 현재 시각 표시. 1분마다 갱신 (60s 정도 대기) |
| 3-B | 다른 dayType tab (토요일 / 일요일·공휴일) 누름 | timestamp 처리 | **숨김** (`isViewingToday=false`) — 다시 평일 누르면 다시 노출 |
| 3-C | 그리드 아래 | legend 노출 | 파란 swatch="다음 출발", strikethrough 샘플="지난 열차" |
| 3-D | 빈 시간표 (예: 임시 화면 mock으로 schedules=[]) | legend 처리 | **숨김** (grid도 null) |
| 3-E | 시간표 카드 초기 진입 | 그리드 hour rows 개수 | **3개만 표시** (collapsed default). 5+ hours 데이터인 경우 |
| 3-F | "전체 시간표 보기 ↓" CTA 클릭 | grid 펼침 | 모든 hour rows 표시 + CTA 텍스트 "접기 ↑" |
| 3-G | "접기 ↑" 클릭 | grid 다시 collapse | 3개로 돌아옴 |
| 3-H | 짧은 시간표 (3 hours 이하 데이터 — 예: 막차 부근) | CTA 노출 | **숨김** (uniqueHourCount ≤ 3) — Gemini followup으로 거짓 affordance 제거 |
| 3-I | 자정 후 (현재 시각 00시~03시대) | anchor hour | groups에 `25`/`26` 같은 operating-day 시간 있으면 그것을 anchor로 표시 (이전엔 새벽 05시대로 fallback) |

---

## 머지된 commit 일람 (참조)

| Commit | PR | 변경 |
|--------|-----|------|
| `303dc7e` | #142 | F3 Gemini followup (anchor + toggle 조건) |
| `68bcad0` | #142 | F3.C — expand/collapse |
| `9cf86e8` | #142 | F3.B — legend |
| `216c35a` | #142 | F3.A — 현재 HH:MM timestamp |
| `285a966` | #141 | docEnforcer.js unit test (백엔드 회귀 net — UI 무관) |
| `577fec3` | #140 | arrivalService throwOnError opt-in |
| `c7e40f1` | #139 | F5.2b — TrainArrivalList → Card swap |

## 검증 결과 기록

회귀 발견 시 본 파일 하단에 "검증 결과" 섹션 추가 후 GitHub Issue 또는 patch PR 발의.
검증 통과 시 본 파일 그대로 두거나 `dev/archive/` 이동.
