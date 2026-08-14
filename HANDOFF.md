# HANDOFF — E2E CI 부활 작업: 다음 세션 착수 지점

작성 2026-08-14 (컨텍스트 예산 소진으로 세션 교체). **작업 트리 깨끗, 미완성 코드 없음.**
직전 HANDOFF(측정 소요시간, 2026-08-13 완결)는 git 히스토리 참조.

## 한 줄 요약

도입 이래 성공 0회이던 E2E nightly를 2단계로 부활시켰다: 파이프라인 수리(**#329 머지**) + spec 전면 현행화(**#330 머지** — 6e784cc). 최종 2개 run 연속 `Spec Files: 5 passed, 5 total` (도입 후 최초 그린, run 31729722676·31732615127).

## 다음 세션 착수 순서

### 0. nightly 그린 확인 (즉시, 1분)
- 다음 nightly(KST 02:00)가 사상 처음 그린으로 돌 수 있다. `gh run list --workflow=e2e-tests.yml --limit 3`으로 결과 확인이 실질적 완결 검증.
- 참고: Actions 캐시는 브랜치 격리라 main 첫 nightly는 cold(~40분, timeout 70분 내). 이후 main 캐시로 warm(~25분).

### 1. 후속 — station-detail spec 구현 (중간 난도)
- 현재 `e2e/specs/station/station-detail.spec.ts`는 describe.skip + 사유 명시.
- 경로: FavoritesScreen 검색 모달(`isSearchModalVisible` 경로)에 testID 계약 부여 → "즐겨찾기 추가 → 역 선택 → 상세 진입 → station-detail-loading/empty/error 상태 검증". 화면 자체 testID는 이미 존재(station-detail-header 등).

### 2. 후속 — 설정 탭 검증 (쉬움)
- SettingsScreen 상단에 화면 마커 testID 1개 추가(src 변경 — mandatory-docs·react-native-development 스킬 절차 필요) → tab-navigation.spec에 설정 탭 테스트 복원.

### 3. 후속 — AppNavigator.tsx 死 코드 정리 (쉬움, 별도 PR)
- `src/navigation/AppNavigator.tsx`의 MainTabs(알림 탭 포함)는 렌더되지 않는 죽은 코드. 실제 활성 탭은 `RootNavigator.tsx`의 MainTabNavigator(홈/즐겨찾기/경로/제보/설정). 삭제 전 import 그래프 확인.

## 반드시 읽을 메모리 (파일명 grep)

- `project_e2e_ci_structurally_unpassable.md` — 파이프라인 3층 원인·수리 전체 기록
- `feedback_rn_e2e_appium_selector_pitfalls.md` — **E2E 코드를 만질 거면 필수**: 셀렉터·wdio 함정 4종 + `[PAGESRC]` 진단 spec 방법론 + 실패 스크린샷 채집
- `feedback_scratchpad_wiped_midsession_worktree_loss.md` — 워크트리 증발·bg reaper·시간 오판 함정

## 환경 정리 상태

- 작업 워크트리 `/private/tmp/claude/e2e-specs-fix`는 제거 예정(전부 push됨). 재작업 시: `git worktree add /private/tmp/claude/<이름> fix/e2e-specs-current-ui` (`.claude/worktrees`는 checkout이 sandbox deny에 걸리므로 /private/tmp/claude 권장, 단 증발 대비 편집 즉시 push).
- 브랜치: `fix/e2e-specs-current-ui` (origin, PR #330). `chore/e2e-ci-structural-fix`는 머지·삭제됨.
