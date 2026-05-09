# Face ID Integration Gap — Context

## Last Updated: 2026-05-06 KST — **CLOSED via PR #6 merge**

## Status: ✅ CLOSED

All FaceID integration phases landed in PR #6 (`8b30874` merge to main). Phase 1.1 (`195bc3f` SoT 일원화), Phase 2 (`4538ab0` SignupStep3 prompt) and Phase 2.1 (`b221a12` unmount cleanup) are all on main. Phase 3 (AuthContext biometric state) remains intentionally deferred — current per-screen `isBiometricLoginEnabled()` calls are sufficient.

This Dev Docs entry is retained for archive. Next session: move to a completed/ directory or delete if no further reference is needed.

## 발견 경위

직전 세션(2026-05-04 22:00~22:40)의 `/verify-app` 검증 도중 새 SignupStep 3-step flow(다른 세션 WIP)에 FaceID 통합이 누락된 것을 grep으로 확인. 기존 `EmailLoginScreen`에는 FaceID 등록 prompt가 정상 작동하지만, 신규 회원가입 경로에는 없음.

직전 세션 dev docs: `dev/active/claude-design-handoff/claude-design-handoff-context.md` 참조 — "다른 세션 WIP 영역" 표에 SignupStep1/3 명시되어 있음.

## 검증 결과 (Grep 기반)

### 정상 연결된 영역

| 위치 | 역할 | 검증 명령 |
|------|------|----------|
| `src/services/auth/biometricService.ts` | 16개 export (`isBiometricSupported`, `isBiometricEnrolled`, `isBiometricAvailable`, `getBiometricTypes`, `getBiometricTypeName`, `authenticateWithBiometric`, `isBiometricLoginEnabled`, `enableBiometricLogin`, `disableBiometricLogin`, `getStoredCredentials`, `hasStoredCredentials`, `performBiometricLogin`) — 283 lines | `grep -nE "^export" src/services/auth/biometricService.ts` |
| `src/screens/auth/AuthScreen.tsx:54` | FaceIDButton import | grep |
| `src/screens/auth/AuthScreen.tsx:118-?` | `handleBiometricLogin` 핸들러 — `isBiometricAvailable` + `isBiometricLoginEnabled` 분기, 미등록 시 안내 Alert | sed |
| `src/screens/auth/AuthScreen.tsx:261-267` | FaceIDButton 렌더링 + `onPress={handleBiometricLogin}` | grep |
| `src/screens/auth/EmailLoginScreen.tsx:36` | `enableBiometricLogin` import | grep |
| `src/screens/auth/EmailLoginScreen.tsx:79` | `promptBiometricSetup = useCallback(...)` 정의 — Alert로 등록 prompt | sed |
| `src/screens/auth/EmailLoginScreen.tsx:94` | Alert "설정하기" 분기에서 `enableBiometricLogin(loginEmail, loginPassword)` 호출 | sed |
| `src/screens/auth/EmailLoginScreen.tsx:129` | `handleSubmit` 성공 분기에서 `await promptBiometricSetup(trimmedEmail, password)` 실제 호출 | sed |
| `src/screens/auth/EmailLoginScreen.tsx:144` | deps 배열 `[email, password, signInWithEmail, persistAutoLogin, promptBiometricSetup]` | sed |
| `src/components/auth/FaceIDButton.tsx` | UI 컴포넌트 (variant prop 받음, 시각 상태 분리) | grep |
| `src/screens/settings/SettingsScreen.tsx:52-57,87-109,154-197,382-417` | **biometric 토글 UI 완전 구현** — import 4개 + state 3개 + mount 상태 체크 + `handleBiometricToggle` + Switch + Face ID 아이콘 분기 + i18n. **Phase 1 검증 완료 (2026-05-05)** | grep |

### 끊어진 영역 (gap)

| 위치 | 누락 내용 | 사용자 영향 |
|------|----------|------------|
| `src/screens/auth/SignupStep1Screen.tsx` (untracked, 22:26) | biometric/FaceID grep **0건** | 본인인증 단계에는 FaceID 불필요 (정상) |
| **`src/screens/auth/SignupStep3Screen.tsx`** (untracked, 22:23, 회원가입 완료 celebration) | biometric/FaceID grep **0건** | **신규 가입자가 가입 직후 FaceID 등록 prompt 받지 못함** ← 핵심 gap |
| **`src/services/auth/AuthContext.tsx`** (Jan 10) | `biometric|FaceID|LocalAuth` grep **0줄** | Auth 전역 state에 biometric 상태 없음 — 헤더/알림/설정 등 다른 화면이 활성화 여부 못 읽음 |

## SettingsScreen의 등록 정책 (Phase 1 검증으로 발견)

`SettingsScreen.tsx:154-197 handleBiometricToggle`은 **직접 신규 등록을 거부**하고 EmailLoginScreen 경유를 강제합니다 (line 161-165 안내 메시지):

> "{biometricTypeName} 로그인을 사용하려면 먼저 로그아웃 후 이메일/비밀번호로 다시 로그인해주세요. 로그인 시 {biometricTypeName} 설정 안내가 표시됩니다."

이는 **credentials(email/password)가 SecureStore에 이미 저장된 상태에서만 토글 활성화 가능**하다는 정책. 그런데:
- EmailLoginScreen 경로: 이메일 로그인 → `enableBiometricLogin(email, password)` → credentials 저장 ✓
- SignupStep 경로 (현재): 가입 → credentials 저장 안 됨 → 가입 직후 SettingsScreen 토글 *불가* ✗

**즉 SignupStep3에서 `enableBiometricLogin(email, password)`를 호출해 credentials를 저장하지 않으면, 신규 가입자는 다음 두 단계를 모두 거쳐야 FaceID 사용 가능**:
1. 가입 → 자동 로그인 → 로그아웃
2. 다시 EmailLogin으로 들어가 비번 입력 → 거기서야 prompt 받음

→ Phase 2 (SignupStep3 통합)이 단순 편의 기능이 아니라 **신규 가입자 UX 정상화의 필수 작업**임이 명확해짐.

## SettingsScreen ↔ biometricService SoT 비대칭 (Phase 1.1)

Phase 1 검증의 후속 정밀 grep(2026-05-05)에서 발견된 아키텍처 이슈. 데이터 버그는 아니지만 미래 회귀 위험.

### 사실 (Grep 결과)

| 동작 | SettingsScreen | biometricService |
|------|----------------|------------------|
| Key 정의 | `:60 const BIOMETRIC_ENABLED_KEY = '@livemetro_biometric_enabled'` | `:15 const BIOMETRIC_ENABLED_KEY = '@livemetro_biometric_enabled'` |
| **활성화 (set 'true')** | `:169 AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true')` ⚠️ **직접 호출** | `:182` (in `enableBiometricLogin(email, password)`) |
| **비활성화 (set 'false')** | `:186 disableBiometricLogin()` ✅ 서비스 경유 | `:201` (in `disableBiometricLogin`) |
| **읽기 (get)** | `:105 isBiometricLoginEnabled()` ✅ 서비스 경유 | `:154` |

### 우회의 합리성 vs 위험

**왜 SettingsScreen이 직접 setItem하는가** (line 156-167 컨텍스트):
- `handleBiometricToggle(true)` 시 `hasStoredCredentials()`로 credentials 존재 확인
- credentials는 이미 EmailLoginScreen에서 `enableBiometricLogin(email, password)` 호출 시 저장된 상태 (재활성화 시나리오)
- 따라서 password를 다시 받을 필요 없으므로 `enableBiometricLogin(email, password)` 재호출 불가
- biometricService에 password 없이 활성화하는 API가 없어서 setItem 직접 호출

**위험**:
1. `enableBiometricLogin`(line 165-192)이 미래에 추가 로직(telemetry, hash, lockout 카운터 등) 가지면 SettingsScreen이 **bypass** → 활성화 후 inconsistent state
2. 코드 중복 — key 상수 정의 2곳, 변경 시 양쪽 동기 필요
3. 아키텍처: biometricService가 SoT여야 하는데 SettingsScreen이 직접 storage 접근

### 권장 Fix (Phase 1.1로 분리)

`biometricService.ts`에 password-less 재활성화 API 추가:
```typescript
// biometricService.ts
export const reEnableBiometricLogin = async (): Promise<boolean> => {
  const hasCredentials = await hasStoredCredentials();
  if (!hasCredentials) return false;
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
  return true;
};
```

`SettingsScreen.tsx:169`를 다음으로 교체:
```typescript
const success = await reEnableBiometricLogin();
if (success) {
  setBiometricEnabled(true);
  Alert.alert('완료', `${biometricTypeName} 로그인이 활성화되었습니다.`);
}
```

→ Key 상수 1곳, 미래 로직 추가 시 자동 반영, 비대칭 해소.

## 통합 권장 패턴 (기존 EmailLoginScreen 답습)

### 1. SignupStep3Screen 통합

**기존 EmailLoginScreen 패턴 (line 79-104, line 129)**:
```typescript
// 1) 함수 정의
const promptBiometricSetup = useCallback(
  async (loginEmail: string, loginPassword: string): Promise<void> => {
    const available = await isBiometricAvailable();
    if (!available) return;
    const enabled = await isBiometricLoginEnabled();
    if (enabled) return;
    const typeName = await getBiometricTypeName();
    Alert.alert(
      `${typeName} 설정`,
      `다음에 ${typeName}로 빠르게 로그인하시겠습니까?`,
      [
        { text: '나중에', style: 'cancel' },
        {
          text: '설정하기',
          onPress: async () => {
            const success = await enableBiometricLogin(loginEmail, loginPassword);
            if (success) {
              Alert.alert('완료', `${typeName} 로그인이 활성화되었습니다.`);
            }
          },
        },
      ]
    );
  },
  []
);

// 2) 가입 성공 분기에서 호출
await promptBiometricSetup(trimmedEmail, password);
```

**SignupStep3에 이식 시 고려사항**:
- 가입 완료 시점 = celebration 화면 도달 시점이므로 useEffect로 mount 직후 호출 또는 "완료" 버튼 onPress에서 호출
- `loginEmail`/`loginPassword`는 회원가입 form context (Step1/2에서 수집)에서 전달 필요 — 현재 SignupStep flow의 state 전달 방식 확인 후 결정
- 가입 직후 자동 로그인이 이미 되어 있다면 password를 어떻게 안전하게 전달할지 — Step2 직후 임시 보관 vs 회원가입 직후 즉시 호출 권장
- celebration 화면 UX와의 조화: prompt를 즉시 띄우면 celebration 분위기 깨짐 → "완료" 버튼 누른 직후 또는 별도 step으로 분리 검토

### 2. AuthContext 보강 (선택, 다른 화면 통합 시)

```typescript
// AuthContext.tsx에 state 추가
const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

useEffect(() => {
  isBiometricLoginEnabled().then(setIsBiometricEnabled);
}, [user]);  // 로그인 상태 변경 시 재확인

// value 객체에 노출
const value = {
  ...,
  isBiometricEnabled,
  refreshBiometricState: async () => {
    setIsBiometricEnabled(await isBiometricLoginEnabled());
  },
};
```

→ 헤더 아이콘에 자물쇠 표시, SettingsScreen 토글 등에서 사용 가능. 현재는 화면별로 직접 `isBiometricLoginEnabled()` 호출 중 — 비효율적이지 않으면 보강 불필요.

### 3. SettingsScreen 토글 UI 검증 (Phase 1)

`grep -niA3 "biometric" src/screens/settings/SettingsScreen.tsx` 결과 확인 후:
- 토글 UI 있음 → 정상
- import만 있고 UI 없음 → "FaceID 사용" toggle 추가 필요 (`enableBiometricLogin` / `disableBiometricLogin` 호출)

## 다른 세션과의 충돌 회피 가이드

### 2026-05-05 00:20 업데이트: 부분 영속화

`cf0b9cf feat(auth): signup wizard step 1/3 + 3/3` 커밋이 SignupStep1/3 + SignupHeader + Routing을 영속화. 그러나 **AuthContext.tsx가 여전히 modified 상태** — biometric 통합 작업이 다른 세션에서 진행 중일 가능성 높음 (Phase 3 영역과 충돌). 진입 전 `git diff src/services/auth/AuthContext.tsx`로 변경 내용 확인 필수.

### 현재 working tree (다른 세션 active 가능성)

- `src/services/auth/AuthContext.tsx` (M) — 🔥 **Phase 3 (AuthContext biometric state 보강) 영역과 직접 충돌 가능**
- `src/screens/auth/SignupStep1Screen.tsx` (M) — Phase 2와 무관 (Step3에 통합)
- `src/services/firebase/config.ts` (M) — biometric과 무관
- `package.json` + `package-lock.json` (M) — 새 의존성 추가 가능성
- `src/utils/phoneFormat.ts` (??) — NICE 관련, biometric과 무관

### 해소된 파일 (cf0b9cf로 영속화 또는 discard)

- ✅ SignupStep3Screen.tsx — `cf0b9cf`에 들어감. Phase 2 진입 시 git checkout cf0b9cf 후 변경
- ✅ SignupHeader.tsx — `cf0b9cf`에 들어감
- ✅ OnboardingContext.tsx — working tree에서 빠짐
- ✅ RootNavigator.tsx + types.ts — `cf0b9cf`에 흡수

### 안전한 진입 방법 (업데이트)

1. **Phase 2 진입 가능**: SignupStep3Screen이 commit됐으므로 *그 commit 위*에 FaceID 통합 추가 가능. 단 `cf0b9cf` 이후에도 SignupStep1Screen이 modified 상태이므로 다른 세션 종료 대기 권장
2. **Phase 3은 AuthContext가 깨끗해진 후 진입** — 다른 세션이 AuthContext 작업 중일 가능성. `git status` + `git diff src/services/auth/AuthContext.tsx`로 확인 필수
3. **Phase 1.1 (SoT 비대칭)은 즉시 진입 가능** — `biometricService.ts`만 수정하므로 충돌 영역 없음

## 관련 메모리

- `project_auth_decision_firebase_over_clerk.md` — Firebase Auth 유지 결정 (2026-05-04). FaceID 통합도 Firebase Auth 위에서 진행
- `feedback_multi_session_staging.md` — 다른 세션 WIP 감지 시 명시 파일만 스테이징

## Open Questions

- [ ] SignupStep flow의 password 보관 정책 — Step2에서 받은 password를 Step3까지 어떻게 전달하는가 (회원가입 후 즉시 로그아웃 = password 폐기 vs 자동 로그인 유지)
- [ ] FaceID prompt 시점 — celebration 화면 mount 직후 vs "완료" 버튼 onPress vs 별도 step 분리
- [ ] AuthContext 보강 필요성 — 현재 화면별 직접 호출 패턴이 충분한가, 아니면 전역 state 필요한가
- [x] **SettingsScreen biometric 토글 UI 존재 여부** — 측정 완료 (2026-05-05): line 52-417에 **완전 구현**. Phase 1 closed.
- [x] **동기화 버그 검증 완료 (2026-05-05)**: 데이터 측면은 정상 (양측 모두 `'@livemetro_biometric_enabled'` key 일치). 하지만 **SoT 위반 + 비대칭성 발견** — Phase 1.1로 정식 등록. 아래 "SettingsScreen ↔ biometricService SoT 비대칭" 섹션 참조

## Next Steps

1. **다른 세션 WIP 종료 대기** — `git status`에서 SignupStep 관련 파일들이 commit되거나 discard될 때까지 대기
2. **Phase 1: SettingsScreen 토글 UI 검증** — grep으로 현재 상태 확인, 없으면 추가 phase 분리
3. **Phase 2: SignupStep3 FaceID 통합** — 위 패턴 답습. password 전달 방식 결정 후 구현
4. **Phase 3 (선택): AuthContext biometric state 추가** — 다른 화면(헤더 등)에서 활성화 여부 표시할 필요 있으면

## Phase Closure Log (2026-05-05)

### ✅ Phase 1.1 — closed by `195bc3f`

`refactor(auth): biometric 재활성화 SoT 일원화 (Phase 1.1)` — 이 세션 작업.

- `biometricService.ts`: `reEnableBiometricLogin(): Promise<boolean>` 추가, default export 등록
- `SettingsScreen.tsx`: 중복 `BIOMETRIC_ENABLED_KEY` 상수 제거, `AsyncStorage.setItem` 직접 호출 → `reEnableBiometricLogin()` 경유
- `biometricService.test.ts`: TDD 3 케이스 (47/47 pass, SettingsScreen 회귀 0)
- 메모리 갱신: `feedback_credentials_service_reactivation_api.md`의 prescription 코드화 완료

### ✅ Phase 2 — closed by parallel session (`4538ab0` + `e6e9b47`)

`feat(auth): SignupStep3 → biometric setup prompt (FaceID gap Phase 2)` + `fix(auth): SignupStep3 — await success Alert + double-tap guard`

- 평행 세션이 **Hybrid 패턴(Option 3 변형)** 채택 — `src/services/auth/pendingBiometricSetup.ts` 신규 모듈로 SignUpScreen → SignupStep3 password staging 처리
- 우리 분석 시점에 보였던 "다른 세션 WIP" 신호(`pendingBiometricSetup.ts` 임시 untracked)가 결국 그 패턴의 산출물이었음
- 이 세션은 충돌 회피 위해 Option 4(대기) 선택 → 평행 세션 Phase 2 완결 후 자연스럽게 fast-forward 적층 (`195bc3f`가 그 위에 올라감)
- 메모리 갱신: `feedback_multi_session_staging.md`에 "동일 phase 평행 세션 시 wait > race" 패턴 추가

### Phase 1.1 SoT 비대칭 섹션 (위 본문) status

- "Recommended Fix" 코드 블록 prescription = `195bc3f` 구현과 동일. 본 섹션은 이제 **historical reference**로 전환 (실제 구현 차이 없음).

### 미완 phase

- ⏸️ **Phase 3 (AuthContext biometric state 보강)** — 결정 게이트 보류 중. 평행 세션의 `pendingBiometricSetup` 도입으로 화면별 직접 호출 패턴이 그대로 유지될 가능성 높음 → Phase 3 필요성 재평가 필요
- ⏸️ **Phase 5 (DRY 정리, helper 추출)** — Phase 2가 신규 모듈 패턴(`pendingBiometricSetup`)을 도입했으므로 `EmailLoginScreen`의 `promptBiometricSetup`과 새 모듈을 통합할지 별도 검토 필요
