# Next Session Entry Point

**마지막 세션 종료**: 2026-05-17 (2회차 — 본 entry는 두 번째 세션 마무리)
**현재 base**: `main` @ `fc14dd0` (= `origin/main`, fully synced)
**관련 plan**: 본 phase는 일단락. 새 phase는 backlog 우선순위에 따라 신규 도출

## 누적 머지된 PR (17개)

### Phase A — train-info-gap-analysis 본체 (2026-05-15 ~ 16)
| PR | 작업 | 머지 commit |
|---|---|---|
| #120 | line-speed weighting | (이전 세션) |
| #123 | service-layer gap fixes (B.1-B.5) | `35de874` |
| #124 | segment-level weighting foundation | `29c75cc` |
| #125 | TrainArrivalCard trainType 배지 UI | `11d9d5d` |

### Phase B — 기능 wiring + UI (2026-05-16)
| PR | 작업 | 머지 commit |
|---|---|---|
| #126 | A: trainType service→Card wiring | `24f3b20` |
| #127 | B: ErrorFallback 컴포넌트 | `f4ce908` |
| #128 | C: StationTimetableSection (첫차/막차 헤더) | `4b5bfa7` |
| #129 | F1: seoulSubwayApi test fix (CI unblock) | `514f814` |
| #130 | F3.1: dayType 3-segment tab | `617a4a8` |
| #131 | F4: TrainArrivalList → ErrorFallback wiring | `6f95443` |
| #132 | F5.1: Card train.trainType auto-derive | `67ebdaf` |
| #133 | F3.1.1: useTrainSchedule Gemini followups | `ba6dbb8` |

### Phase C — 시간표 full body + 통합 + propagation + ops (2026-05-17 ①)
| PR | 작업 | 머지 commit |
|---|---|---|
| #134 | F3.2: TimetableGrid (시간대×분 + 분류) | `a8e386c` |
| #135 | F3.3: DestinationChipRow (방면 필터) | `2810256` |
| #136 | F5.2a: TrainArrivalCard variant prop | `f915642` |
| #137 | G4: dataManager subscription error forward | `04d6512` |
| #138 | G5: docEnforcer LiveMetro 도메인으로 교체 | `9fe06cc` |

### Phase D — F5.2b swap + error category 가치 발현 + hook 회귀 net + 시간표 polish + doc 갱신 (2026-05-17 ②, 본 세션)
| PR | 작업 | 머지 commit |
|---|---|---|
| #139 | F5.2b: TrainArrivalList → TrainArrivalCard variant='compact' swap | `c7e40f1` |
| #140 | arrivalService.GetArrivalsOptions.throwOnError — SeoulApiError가 ErrorFallback까지 도달 | `577fec3` |
| #141 | docEnforcer.js unit test (Node:test, 13 cases, G5 회귀 net) | `285a966` |
| #142 | F3 polish: timestamp + legend + expand/collapse + Gemini followup (4 commits) | `216c35a` / `9cf86e8` / `68bcad0` / `303dc7e` |
| #143 | docs(api): arrivalService Contract 섹션 — throwOnError + caching policy | `ac51e62` |
| #144 | chore(ci): E2E Tests — Nightly + workflow_dispatch만 트리거 (Option D) + unit-tests-gate 중복 제거 | `96256f7` |
| #145 | chore(components/train): dead code 3 파일 정리 (-423 LOC, SubwayLineList + Card.example) | `667f57b` |
| #146 | chore(components/train): train/StationCard 일괄 제거 (-889 LOC, Phase 56 stale) | `a67fe2a` |
| #147 | feat(train): TrainArrivalCard.showDestination prop — F5.2b manual UI 회귀 응대 | `68b6a10` |
| #148 | fix(station): StationDetailScreen empty sub-message 시각 분기 — "운행 종료" 오인식 fix | `fc14dd0` |

## GAP_REPORT 진행 (15개 항목)

| 상태 | 개수 | 항목 |
|---|---|---|
| ✅ FULLY YES | 11 | #1, #2, #3, #6, #7, #8, #9, #12, #13, A, B |
| ❌ NO (별도 phase / 외부 데이터) | 4 | #4 (칸별 혼잡도), #5 (추천 칸), #10 (무장애 경로 알고리즘), #11 (빠른 환승 하차문) |

**train-info-gap-analysis phase 일단락** — 본 phase의 자체 backlog는 모두 처리되었거나 외부 데이터 의존으로 별도 phase 대기. 본 NEXT_SESSION.md는 이제 새 phase 도출용 entry point로 전환.

## Manual UI 검증 결과 (2026-05-18 ~ 19)

### 검증 통과 ✅
- **#139 F5.2b (Card swap)**: 강남역 `__DEV__` mock data로 시각 회귀 1건 발견 → **PR #147로 응대 완료**. 회귀 닫힘.
- **#142 F3 polish**: 을지로입구역에서 모두 의도대로 작동 — timestamp 우측 정렬 / dayType 분기 / legend / collapsed+CTA / operating-day 24+ anchor 시각 확인.

### 회귀 응대 완료 (PR #147 — showDestination prop) 🟢
- 회귀 내용: Card swap 후 inline 시절 "{finalDestination} 방면" 텍스트가 사라져 같은 direction 내 여러 종착지(2호선 성수/건대입구) 구분 곤란
- 응대: TrainArrivalCard에 `showDestination?: boolean` 추가 + TrainArrivalList opt-in. variant prop 격리 패턴의 자연 확장
- 다음 manual UI 시 강남역 mock 4 train에서 "신도림 방면 / 성수 방면 / 건대입구 방면 / 까치산 방면" 라벨 확인

### 추가 발견 응대 결과
1. ~~**을지로입구역 "운행 종료 시간대입니다" (현재 20:26)**~~ → **PR #148로 응대 완료** (시각 휴리스틱 분기, 4 테스트 케이스 추가). 정상 운행 시간(05:00–01:59)에는 "잠시 후 다시 확인해주세요"로 친화 안내.
2. 🟡 **`[CongestionService] subscribeToLineCongestion failed (lineId=2): FirebaseError: Missing or insufficient permissions`** — Firestore rules의 `congestionSummary` collection 권한 부재. **남은 backlog**.
3. 🟡 모든 노선에서 `No stations found in Firebase for line X, trying local data` WARN — 정상 fallback이지만 매번 노출. silent vs noisy 정책 결정 필요. **남은 backlog**.

## 다음 세션 권장 진행 (우선순위 순)

## ✅ Phase 종결 선언 (2026-05-20)

train-info-gap-analysis 본체 + manual UI 회귀 응대 2건 모두 closeout. GAP_REPORT 11/15 ✅ + 4/15 외부 데이터 의존(별도 phase 대기). 본 phase는 더 이상 활성 작업 없음.

## 다음 세션 backlog (우선순위 순)

### 🔴 HIGH — 도메인 가치 큰 새 phase 후보

#### 1. ✅ CongestionService Firestore permissions fix — PR #149 머지 완료 (a4b07b8), 배포 대기 (2026-05-20)
Root cause 확정: `congestionSummary` + `congestionReports` collection이 `firestore.rules`에 부재 → Firestore v2 default-deny. auth 상태 문제 아님(규칙 자체 부재). 추가로 `subscribeToLineCongestion` 쿼리(`where lineId + orderBy lastUpdated`)에 복합 인덱스 부재 — two-layer bug.
- `firestore.rules`: `congestionReports`(소유권 create) + `congestionSummary`(auth-only write) match 블록 추가 — `delayReports` 패턴 차용
- `firestore.indexes.json`: `congestionSummary (lineId ASC, lastUpdated DESC)` 복합 인덱스 추가
- **배포 필요**: `firebase deploy --only firestore` 전까지 앱은 동일 에러. 인덱스 백필 수 분 소요
- deferred follow-up: (a) `congestionReports` 쿼리 인덱스 3종 (b) `congestionSummary` Cloud Function 집계 이관 (하드닝) (c) rules-test 하니스(`@firebase/rules-unit-testing`) 구축

#### 2. 외부 데이터 의존 GAP 항목 phase 도출 (#4, #5, #10, #11)
4개 독립 sub-project로 분해됨. 각자 spec→plan→구현 사이클.

- ✅ **#10 무장애 경로** — phase 도출 완료 (2026-05-21). brainstorming→writing-plans 사이클로 spec+plan 작성.
  - 브랜치: `feat/elevator-priority-route` (origin push됨) — spec `1712282`, plan `40b7125`
  - spec: `docs/superpowers/specs/2026-05-21-elevator-priority-route-design.md`
  - plan: `docs/superpowers/plans/2026-05-21-elevator-priority-route.md` (5 task TDD)
  - **다음 세션**: 이 plan을 subagent-driven 또는 inline으로 실행. Task 1 데이터 fetch는 data.go.kr 키+네트워크 필요
- ⬜ **#4 칸별 혼잡도** — 인프라(model+service+UI+`StationDetailScreen` wiring) 대부분 존재. 진짜 gap은 *데이터 공급*(크라우드소싱 cold-start / SKT 융합). 별도 phase 도출 대기
- ⬜ **#5 추천 칸** — #4 데이터 위 derived 로직. #4 종속
- ⬜ **#11 환승 하차문** — 순수 greenfield. 외부 도어 위치 데이터 확보가 최대 난관

단일 세션에는 1 phase만 권장.

### 🟡 MEDIUM — 단일 PR scope

#### 3. docs/claude/ 5종 doc 최신화 점검
- `architecture.md` / `development-patterns.md` / `testing.md` / `FIREBASE_SETUP.md` / `DEVELOPMENT.md`
- PR #140(throwOnError) / PR #141(test:hooks script) / PR #144(E2E Nightly) / PR #147(showDestination) / PR #148(시각 분기) 등 본 세션 변경 누락 점검
- docEnforcer가 안내하는 doc path가 stale이면 미래 작업이 잘못된 메모로 코드 수정. PR #141 회귀 net이 doc 실재만 검증 — 내용 최신성은 별도

#### 4. ErrorFallback category copy 5종 완성도 점검
arrivalService throwOnError(PR #140)로 SeoulApiError category 분기가 비로소 실 사용자에게 도달. 한국어 카피 자연성 + 재시도 가능 여부 명시 등 5종(quota/auth/transient/rateLimit/network)을 일괄 점검 + 필요 시 patch.

#### 5. Firebase station fallback WARN 정책 결정
모든 노선에서 `No stations found in Firebase for line X, trying local data` WARN 노출. 정상 fallback이지만 매번 noise.
- silent fallback (개발자 noise 0) vs noisy (무결성 추적)
- production만 silent + dev 모드 noisy 분기도 옵션

### 🟢 LOW — 후순위/meta

#### 6. MEMORY.md 인덱스 압축 phase
- 현재 34987 bytes (limit 24400 — 10KB 초과)
- 오래된/덜 발현되는 entry detail로 분리 또는 한 줄 길이 압축
- 본 세션 6건(skillGate marker / useMemo stale Date / Node:test / 1 PR+N commit / gh merge ancestor / git cherry patch-id / F5.2 split 3-step) 모두 정식화 완료

#### 7. e2e-android CI 인프라 Option B/E (PR #144 후속)
- Option B: gradle/expo prebuild cache 추가 — cold start 30-50% 단축
- Option E: smoke-only sub-suite PR-level 복귀 (전체는 nightly 유지)
- 참조: `dev/active/train-info-gap-analysis/E2E_CI_DIAGNOSIS.md`

## 메모리 정식화 결과 (본 세션)

- 5건 정식화: `feedback_skill_gate_marker_ttl` / `feedback_usememo_stale_new_date_prop_sync` / `project_node_test_runner_for_hooks` / `project_one_pr_n_commit_same_file_polish` / `feedback_gh_merge_ancestor_verify`
- 추가 2건: `feedback_git_cherry_patch_id_safe_branch_delete`(stale branch 정리) / `project_f52_split_three_step_evolution`(cross-PR 3-step 진화)
- 미정식화 1건: "useEffect deps에 mode 분기 → interval mount 자체 분기" — 다음 세션에 정식화 가능 ([비활성 화면 폴링 게이팅]에 통합 vs 별도)

## 인프라 상태 (2026-05-20)

- **Working tree**: clean (main `fc14dd0`)
- **dev/active/train-info-gap-analysis/**: 5 files (NEXT_SESSION + GAP_REPORT + MANUAL_UI_CHECKLIST + E2E_CI_DIAGNOSIS + COMPONENTS_TRAIN_SIMPLIFICATION) — 모두 closeout, 다음 세션이 `dev/archive/`로 이동 검토 가능
- **로컬 branches**: `main` only (본 세션 시작 시 15개 stale을 [git cherry patch-id] 검증 후 일괄 정리, 본 세션 신규 9 PR 모두 머지 시 `--delete-branch` 동기 적용)
- **CI**:
  - `quality-gate` (ci.yml): tsc + lint + jest --coverage + functions/ build + expo-doctor — PR마다 트리거
  - `e2e-tests` (PR #144): schedule(KST 02:00 daily) + workflow_dispatch만 — PR-level 제거
  - 본 세션 모든 PR(머지된 10개) quality-gate green
- **TMPDIR worktree**: 본 세션 0건 사용
- **Skill markers**: `/tmp/claude-skill-gate-livemetro/` 5분 TTL — 다음 세션 진입 시 만료 가정

## 다음 세션 시작 명령어 후보

```bash
# 옵션 1 (HIGH): CongestionService Firebase rules fix
/resume dev/active/train-info-gap-analysis
"CongestionService subscribeToLineCongestion FirebaseError fix — firestore.rules의 congestionSummary 읽기 권한"

# 옵션 2 (HIGH): 외부 데이터 의존 새 phase 도출
"GAP_REPORT #4 (칸별 혼잡도) 데이터 수급 phase 도출 — 크라우드소싱 vs 외부 데이터셋 결정 + 데이터 모델 설계"

# 옵션 3 (MEDIUM): docs/claude/ 5종 doc 최신화 점검
"docs/claude/ 5종(architecture/development-patterns/testing/FIREBASE_SETUP/DEVELOPMENT) PR #140-#148 변경 반영 점검 + 갱신 PR"

# 옵션 4 (MEDIUM): ErrorFallback category copy 5종 점검
"ErrorFallback category copy 5종(quota/auth/transient/rateLimit/network) 한국어 자연성 + 재시도 가능 여부 명시 점검"

# 옵션 5 (LOW): MEMORY.md 인덱스 압축
"MEMORY.md 34KB → 24KB 압축 phase — 오래된 entry detail로 분리"

# 옵션 6 (meta): dev/active/ → dev/archive/ 이동
"train-info-gap-analysis phase 완전 종결 — dev/active → dev/archive 이동 + NEXT_SESSION reset"
```

## 본 세션(2026-05-15 ~ 20) 전체 통계

| 항목 | 값 |
|------|-----|
| 머지된 PR | **17개** (Phase A-C는 누적 8개 + 본 2회차 9개) |
| main HEAD 변화 | `9fe06cc` → `fc14dd0` (+15 commits) |
| LOC 변화 | 신규 ~2200 + 정리 ~1700 = 순 +500 LOC (가치 추가 + cleanup) |
| 메모리 정식화 | 7건 (118 → 127 files) |
| GAP_REPORT 진행 | 11/15 ✅, 4/15 별도 phase 대기 |
| manual UI 회귀 발견 | 2건 (모두 응대 완료: #147 + #148) |
| ghost merge | 0건 ([gh merge ancestor verify] 메모리 적용 결과) |
