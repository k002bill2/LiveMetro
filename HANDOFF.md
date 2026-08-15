# HANDOFF — E2E 진입 정체 해결 완결: 잔여 2건만 남음

작성 2026-08-15 오후. **작업 트리 깨끗, 미완성 코드 없음.**
직전 HANDOFF(진입 비결정 조사 착수, 8/15 오전)는 git 히스토리 참조.

## 한 줄 요약

8/14부터 지속된 E2E "진입 무음 정체"의 근본 원인을 확정하고 수정을 main에
반영했다: **RN core SafeAreaView가 Android에서 인셋 없는 일반 View라
OnbHeader가 상태바 뒤에 렌더**되었고, AVD 상태바가 63→128px로 변하며 완전
피복 → UiAutomator가 트리에서 클립한 것 (appium 로그 `statusBar` 값으로 L1
실측). 실사용 UI 버그이기도 했다(건너뛰기가 상태바 아이콘과 겹침).

- 수정 머지: **PR #331** (spec 브랜치 선머지 — 사용자 옵션 A 결정. 5화면
  RNSAC 교체 + station-detail·설정 탭 spec + 진입 계측 포함)
- 그린 실증: run 31867618329 `6/6` (브랜치) + **run 31869830074 `6/6, 6m21s,
  재시도 0` (#331 머지 후 main 최초 — nightly 경로 사상 첫 그린 조건 충족)**

## 남은 일 (이 순서로)

### 1. PR #332 머지 (HITL — 사용자 승인 대기)
- OnboardingStationPickerScreen 1파일 — #331이 남긴 마지막 RN core
  SafeAreaView 동일 패턴 교체. quality-gate **pass**, jest 62·tsc·eslint 그린.
- 6파일판 Codex 리뷰에서 동일 diff 검토 완료. 머지만 남음.

### 2. nightly 확인 (KST 8/16 02:00)
- `gh run list --workflow=e2e-tests.yml --limit 3` — main 캐시가 아직
  없어 첫 nightly는 cold(~40분). 그린이면 이 사가 완전 종결.

## 재발 방지 지식 (메모리 SSOT)

- `project_e2e_ci_structurally_unpassable.md` §8/15 — 진단 체인 전체
  (PAGESRC diff → 픽셀 증거 → statusBar 63↔128 실측), 기각 가설 목록
- `feedback_rn_e2e_appium_selector_pitfalls.md` — **"덤프에 없음 ≠ 렌더 안
  됨"**: 픽셀·레이아웃(형제 bounds)·트리 삼각측량, appium 로그
  `statusBar":N` grep
- 운영 함정: 에뮬 부팅 후 스냅샷 저장 무로그 hang(70분 cancelled) /
  auth-hero 30s 콜드스타트 flake / pre-push 훅(npx pinned npm)이 push를
  2분+ 지연 — 타임아웃 여유 필수, 브랜치 삭제 push는 --no-verify 무방

## 환경 메모

- 남은 작업 브랜치: `fix/station-picker-safearea` (PR #332, 머지 후 삭제).
  6파일판 `fix/onboarding-safearea-statusbar`는 정리 완료(원격·로컬 삭제).
- 메인 워킹 디렉토리 한 세션 전용 규칙 유지. E2E run 확인은 전체
  `gh run list` + workflowName 필터.
