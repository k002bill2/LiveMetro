# HANDOFF — E2E 진입 비결정 조사: 다음 세션 착수 지점

작성 2026-08-15 오전 (세션 정리 지시). **작업 트리 깨끗, 미완성 코드 없음.**
직전 HANDOFF(E2E 부활 완결, 8/14)는 git 히스토리 참조.

## 한 줄 요약

E2E 파이프라인(#329)·spec(#330)은 완결됐으나, 8/14 오전부터 **공용 진입 흐름이
온보딩 STEP 2/5에서 OnbHeader a11y 부재로 정체**하는 환경 비결정이 지속 중.
nightly 대조 실험(8/15 02:49 KST) **빨간불 — 시간대 가설 사망**. 후속 ①②
spec 브랜치는 이 비결정에 막혀 머지 보류(동결) 상태다.

## 판정 이력 (전부 run 실측 — 상세는 메모리 `e2e-ci-structurally-unpassable` §8/14)

| 가설 | 판정 | 근거 run |
|------|------|----------|
| cold AVD flake | 기각 | 31760211199 (캐시 3종 적중에도 실패) |
| mocha 120s 상쇄 | 실재했으나 부차 | 31761026818 → 240s로 해소 |
| Firebase 익명 스로틀 Alert | 기각 | 31763217242 (fail-fast 미발동) |
| OTA 번들 오염 | 기각 | u.expo.dev curl 실측 (prebuild=embedded 확정) |
| callbacks 등록 race | 기각 (재조사 금지) | 코드 리딩 — Context 동기 제공 (OnboardingNavigator.tsx:49) |
| **시간대/부하 의존** | **8/15 기각** | nightly 31825765923 red — 어제 그린(03시 KST)과 같은 창에서 실패 |
| 남은 유력: RN Android 뷰 평탄화/a11y 트리 동기화 비결정 | 미검증 | ⓑ가 직접 검증 수단 |

**경계**: 마지막 그린 8/14 03:48 KST (31732615127) ↔ 첫 빨강 8/14 09:49 KST
(31758646877). 이 6시간 사이에 바뀐 무언가가 지속되고 있다 — 코드는 동일.

## 다음 세션 착수 순서

### 0. 오늘 계측 런의 PAGESRC 미파싱 (즉시, 최고 정보량)
run **31859235020** (8/15 11:27 KST dispatch, 계측 브랜치)의 `[ENTRY PAGESRC]`
덤프를 어제(31767590757)의 것과 diff — 정체 화면이 여전히 CommuteRoute인지,
OnbHeader 부재 양상이 같은지 확정. 시그니처는 동일 확인됨(프로브 15s 축하
도달 / 본 spec 16s부터 마커 전무).

### 1. 후보 수정 ⓐⓑⓒ 적용 (동결 해제는 사용자 확인 후)
- ⓐ 온보딩 스텝별 루트 View 화면 마커 testID (예: `onb-route-screen`)
- ⓑ `OnbHeader.tsx:44` 컨테이너 `collapsable={false}` — **평탄화 가설 직접 검증**
- ⓒ entry-flow 관측 세트에 로딩 텍스트 2종 추가 ("앱을 로딩중입니다" /
  "주변 역 정보를 가져오고 있습니다") — 무마커 구간 A·B 식별

### 2. 실패 스크린샷 아티팩트 갭 수리 (병행 가능)
wdio afterTest가 GET /screenshot을 실행하는데 아티팩트에 없음 — 업로드 누락
원인 미규명 (8/14 기록).

### 3. 머지 재판단 (HITL)
브랜치 `test/e2e-station-detail-settings-tab` **1a6c1ad 동결** (커밋 6개, 로컬
게이트 전부 그린, Codex 2/2 수용, PR 미개설). ⓐⓑⓒ 반영 후 게이트 그린이 나오면
사용자에게 머지 여부 재확인.

## 익명 진입 정상 시퀀스 (코드 실측 — E2E 관측 지도)

auth-hero → browse-cta 탭 → [무마커 A: RootNavigator.tsx:238 LoadingScreen,
AuthContext.loading = Firestore 유저문서 왕복] → signup-step3-cta (익명은 생체
Alert 안 뜸, SignupStep3Screen.tsx:129) → welcome-cta → onb-header-skip
(OnbHeader.tsx:78; onSkip 없으면 counter 대체) → [무마커 B: Home 주변역 로딩 —
**home-screen 마커는 로딩 완료 후에만 마운트**, HomeScreen.tsx:364-381] → home-screen

## 반드시 읽을 메모리 (파일명 grep)

- `project_e2e_ci_structurally_unpassable.md` — 3층 수리 + §8/14 비결정 전체 기록 (SSOT)
- `feedback_rn_e2e_appium_selector_pitfalls.md` — E2E 코드 만지면 필수
- `feedback_check_branch_before_commit.md` — **공유 디렉토리 병렬 세션 필독**: push는
  브랜치명 명시, 커밋 직전 `git branch --show-current` 재확인 (8/14 3발 사례)

## 환경 메모

- 메인 워킹 디렉토리는 한 세션 전용으로 쓰고, 다른 세션은 격리 워크트리
  (`/private/tmp/claude/<이름>`) 사용 — 8/14 HEAD 이동 race로 main 직행 푸시 1건 발생.
- E2E run 확인: 전체 `gh run list` + workflowName 필터 (`--workflow` 필터는 누락 사례 있음).
