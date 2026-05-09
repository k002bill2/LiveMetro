# Face ID Integration Gap — Tasks

## Last Updated: 2026-05-05 KST (Phase 0 완전 해소, Phase 1.1 closed `195bc3f`, Phase 2 closed `4538ab0`+`e6e9b47`)

## Branch Snapshot (참고)

| 항목 | 값 |
|------|-----|
| 분석 시점 HEAD | `ea5f978` (Phone Auth, Phase 24+) |
| 다른 세션 WIP | 없음 — working tree clean |
| 진입 조건 | ✅ 충족 (모든 의존 commit 영속화 완료) |
| 관련 메모리 | `project_auth_decision_firebase_over_clerk.md` (Firebase 유지) |

## Phase 0 — 진입 가능 여부 확인 (완전 해소 2026-05-05)

✅ **모두 해소** (commit으로 영속화):
- `cf0b9cf` (wizard): SignupStep3Screen.tsx, SignupHeader.tsx, RootNavigator.tsx, types.ts, OnboardingContext.tsx, EmailLoginScreen.tsx, SignUpScreen.tsx
- `ea5f978` (phone auth): AuthContext.tsx (3 phone 메서드), SignupStep1Screen.tsx (실 Firebase wire-up), phoneFormat.ts, firebase/config.ts

**진입 가능한 phase (2026-05-05 후반 기준)**:
- ✅ **Phase 2** (SignupStep3 FaceID 통합) — **진행 중** (이번 세션). prereq 모두 충족
- ✅ **Phase 1.1** (SoT 비대칭) — 언제든 진입 가능, Phase 2 후 정리 phase로 권장
- ✅ **Phase 3** (AuthContext biometric state) — AuthContext도 clean해서 진입 가능. 단 결정 게이트 통과 필요

## Phase 1 — SettingsScreen 토글 UI 검증 (2/2 complete, 2026-05-05)

- [x] grep 측정 — `SettingsScreen.tsx:52-417`에 **biometric 토글 UI 완전 구현** 확인
  - import: `isBiometricAvailable`, `isBiometricLoginEnabled`, `getBiometricTypeName`, `disableBiometricLogin` (line 52-57)
  - state 3개: `biometricAvailable`, `biometricEnabled`, `biometricTypeName` (line 88-90)
  - mount 시 상태 체크 (line 100-109)
  - `handleBiometricToggle` 핸들러 (line 154-197)
  - Switch UI + Face ID 아이콘 분기 + i18n + disabled state (line 382-417)
- [x] **신규 발견**: SettingsScreen은 *직접 신규 등록 거부* 정책. credentials가 SecureStore에 저장된 상태에서만 토글 활성. → SignupStep3에서 `enableBiometricLogin` 호출하지 않으면 신규 가입자는 *반드시* 로그아웃 후 EmailLogin 경유해야 FaceID 사용 가능. context.md "SettingsScreen의 등록 정책" 섹션 참조
- [x] **잠재 동기화 버그 검증 완료 (2026-05-05)**: 데이터 측면 정상 (key 일치). 하지만 SoT 비대칭 발견 → **Phase 1.1로 정식 등록**

## Phase 1.1 — SoT 비대칭 해소 (3/3 ✅ closed `195bc3f`, 2026-05-05)

데이터 버그는 아니지만 미래 회귀 방지용. context.md "SettingsScreen ↔ biometricService SoT 비대칭" 섹션 참조.

- [x] `biometricService.ts`에 `reEnableBiometricLogin()` API 추가 — password-less 재활성화. `hasStoredCredentials` gate + `BIOMETRIC_ENABLED_KEY = 'true'` 설정. 시그니처 `(): Promise<boolean>`. default export 등록
- [x] `SettingsScreen.tsx`: `AsyncStorage.setItem` 직접 호출 → `reEnableBiometricLogin()` 경유. 중복 `BIOMETRIC_ENABLED_KEY` 상수 제거 (서비스가 SoT). boolean-return 패턴이 `disableBiometricLogin`과 대칭
- [x] 테스트: `biometricService.test.ts`에 TDD 3 케이스 추가 (happy / no-credentials gate / storage error). 47/47 pass, SettingsScreen 회귀 0 (208/208 pass)

**검증**: tsc 0 errors (touched files), eslint 0 errors. 메모리 `feedback_credentials_service_reactivation_api.md` prescription 코드화 완료.

**우선순위**: Phase 2 (SignupStep3 통합) > Phase 1.1 (이 작업). Phase 2가 사용자 UX 직접 영향, Phase 1.1은 내부 아키텍처 정리.

## Phase 2 — SignupStep3Screen FaceID 등록 prompt 통합 (0/5)

**[2026-05-05 격상] 단순 편의 기능에서 → 신규 가입자 UX 정상화의 필수 작업으로**: Phase 1 검증에서 발견된 SettingsScreen "직접 등록 거부" 정책 때문. SignupStep3에서 credentials를 저장하지 않으면 신규 가입자는 가입 → 로그아웃 → 재로그인 2-단계 거쳐야만 FaceID 사용 가능.

핵심 gap. EmailLoginScreen 패턴 답습.

- [ ] **Pre-step**: SignupStep flow의 password 전달 방식 파악
  - Step1 → Step2 → Step3 사이의 form state 흐름 추적
  - Step3에서 user의 email, password 접근 가능한지 확인
  - 접근 불가 시: SignupStep2(password 입력)에서 임시 보관 → Step3 도달 시 FaceID prompt 후 즉시 폐기
- [ ] **import 추가** to `SignupStep3Screen.tsx`:
  ```typescript
  import {
    isBiometricAvailable,
    isBiometricLoginEnabled,
    enableBiometricLogin,
    getBiometricTypeName,
  } from '@/services/auth/biometricService';
  ```
- [ ] **`promptBiometricSetup` 함수 정의** — `EmailLoginScreen.tsx:79-104` 패턴 그대로 복사 (DRY 위반 검토 필요 — 기능 동일하면 `src/services/auth/biometricPrompt.ts` 같은 helper로 추출 고려)
- [ ] **호출 위치 결정 + 호출** — UX 검토 후:
  - 옵션 A: celebration 화면 mount 직후 useEffect (자동, 흐름 끊김)
  - 옵션 B: "완료" 버튼 onPress 직전 (사용자 명시 동작 후, 권장)
  - 옵션 C: 별도 SignupStep4 step (가장 명확하지만 step 추가 비용)
- [ ] **테스트**: `SignupStep3Screen.test.tsx` (다른 세션이 만들 untracked 파일 위에 추가)에 다음 케이스 추가:
  - biometric 미지원 디바이스 → prompt 안 뜸 + 가입 완료 정상
  - biometric 이미 등록 → prompt 안 뜸
  - "나중에" 선택 → 가입 완료 정상, biometric 비활성
  - "설정하기" 선택 → `enableBiometricLogin` 호출 + 완료 Alert

## Phase 3 — AuthContext biometric state 보강 (0/3, 선택)

화면별 직접 호출이 비효율이거나 헤더 등에 활성화 여부 표시 필요할 때만.

- [ ] **결정 게이트**: 다른 화면에서 `isBiometricLoginEnabled()`를 자주 호출하는 곳이 3곳 이상인가?
  - 예 → Phase 3 진행
  - 아니오 → Phase 3 보류, 화면별 직접 호출 유지
- [ ] **AuthContext.tsx 수정**: state + useEffect + value 노출 (context.md "AuthContext 보강" 섹션 참조)
- [ ] **소비처 마이그레이션**: 직접 `isBiometricLoginEnabled()` 호출하는 화면을 `useAuth().isBiometricEnabled` 사용으로 전환

## Phase 4 — Verification (0/4)

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npx eslint <touched files>` → 0 errors
- [ ] `npx jest --watchman=false --testPathPattern='(SignupStep3|AuthContext|biometricService)'` → all pass
- [ ] Manual QA (실기기): iOS Face ID + Android 지문 — 가입 직후 prompt 정상 표시 + "설정하기" 후 다음 로그인 시 자동 인증 작동

## Phase 5 — DRY 정리 (0/2, 선택)

`SignupStep3Screen`과 `EmailLoginScreen`이 같은 `promptBiometricSetup` 함수를 가짐 → 중복 가능성.

- [ ] **결정 게이트**: 두 화면의 `promptBiometricSetup` 본문이 정확히 동일한가? 메시지 차이 등 화면별 customization 필요한가?
  - 동일 → helper 추출 (예: `src/services/auth/biometricPrompt.ts`)
  - 차이 있음 → 중복 유지 (cost > benefit)
- [ ] **추출 시**: 두 화면에서 helper import + 자체 정의 제거. 회귀 테스트로 동일 동작 확인

## 관련 외부 작업

- **다른 세션 WIP 작업자에게 전달 가능**: 이 문서를 다른 세션에서 작업 중인 사용자가 직접 참조하여 SignupStep3 commit 시 FaceID 통합을 함께 처리하면 별도 phase 불필요. dev/active/는 git untracked이므로 사용자가 의도적으로 commit해야 공유됨

## Verification Snapshot

이 phase 시작 *전* 상태 (sanity baseline):
- [ ] `find src -type f \( -name '*.ts' -o -name '*.tsx' \) | xargs node scripts/lint-typography.cjs 2>&1 | tail -1` — typography baseline 기록 (통합 후 회귀 비교용)
- [ ] `git rev-parse HEAD` — 시작 commit 기록

이 phase 종료 *후*:
- [ ] 동일 명령으로 baseline 회귀 없음 확인
- [ ] FaceID 통합 commit hash 기록
