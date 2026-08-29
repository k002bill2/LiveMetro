# LiveMetro QA 진단 보고서

> 문서 작성: 2026-08-30 KST  
> 실기기 QA 실행: 2026-08-29 KST  
> 대상: `/Users/younghwankang/Work/LiveMetro`  
> 범위: 구현 완성도 추정, 자동화·정적 검증, Android 실기기 핵심 흐름, 릴리스 차단요인

## 1. 결론

- **기능 구현 완성도 추정:** 85~90%
- **검증 준비도 지표:** 4/7 통과(57.1%)
- **Android 실기기 핵심 흐름:** 13/13 PASS
- **현재 릴리스 판정:** **출시 보류**
- **주요 차단요인:** 서울 지하철 API 인증, 앱 lint warning, Expo 호환성, 최신 CI Quality Gate, iOS 실기기 검증

85~90%는 정식 PRD의 가중치로 계산한 확정 수치가 아니라, 현재 구현된 주요 서비스 범위와 검증 결과를 바탕으로 한 PM 추정치입니다. 검증 준비도 57.1%는 릴리스 관련 검증 항목 7개를 동일 가중치로 표시한 운영 지표이며 기능 완성률과 동일하지 않습니다.

## 2. 검증 환경 및 변경 범위

### 2.1 Android 실기기

| 항목 | 값 |
|---|---|
| 모델 | Samsung `SM-N971N` |
| Android | 12 / API 31 |
| 패키지 | `com.livemetro.app` |
| 설치 버전 | `1.0.0` |
| 설치·데이터 초기화 | 수행하지 않음 |
| 최종 화면 | `routes-tab-screen` |
| 앱 프로세스 | 테스트 종료 후 생존 확인 |

### 2.2 저장소 변경

- QA 과정에서 앱 코드 수정, 커밋, 푸시, 배포를 수행하지 않음
- 실기기에서 앱 재설치와 데이터 초기화를 수행하지 않음
- swap과 경로 카드 확장 상태는 테스트 후 원상복구
- Appium 서버는 테스트 후 종료
- 저장소 작업트리는 QA 시작 시점 기준 변경 없음
- 로컬 `main`은 원격 `main`보다 1커밋 뒤처진 상태였음

## 3. 자동화 및 정적 검증 결과

| 검증 항목 | 결과 | 실제 결과 |
|---|---:|---|
| 루트 TypeScript | PASS | `npm run type-check`, exit 0 |
| Firebase Functions TypeScript | PASS | `npm --prefix functions exec tsc -- --noEmit`, exit 0 |
| Jest 전체 테스트 | PASS | 352 suites passed, 1 skipped |
| 테스트 개수 | PASS | 5,802 passed, 25 skipped |
| Statements coverage | PASS | 87.23% |
| Branches coverage | PASS | 77.23% |
| Functions coverage | PASS | 89.30% |
| Lines coverage | PASS | 88.42% |
| Plugins lint | PASS | `npx eslint plugins --ext .js --max-warnings 0`, exit 0 |
| 앱 전체 lint | **FAIL** | 0 errors, 756 warnings; `--max-warnings 0` 기준 실패 |
| Expo Doctor | **FAIL** | 13/16 통과, 3개 검사 실패 |

Coverage 기준은 `jest.config.js`에 설정된 Statements/Lines 75%, Functions 70%, Branches 60%입니다. 현재 수치는 해당 기준을 충족합니다.

### 3.1 앱 lint 주요 경고 유형

- React Hook dependency 누락
- unused variable
- `no-console`
- unreachable code

확인된 예:

- `src/screens/settings/CommuteSettingsScreen.tsx:542`
- `src/services/auth/AuthContext.tsx:291`
- `src/services/monitoring/healthCheckService.ts:460`

### 3.2 Expo Doctor 확인사항

- `@types/react-native` 직접 설치
- SDK 48부터 제거된 `expo-firebase-recaptcha` 사용
- `@expo/config-plugins@5.0.4`와 Expo SDK 49 기대 버전 불일치
- Android target SDK와 Google Play 제출 요건 추가 확인 필요

## 4. CI 및 E2E 결과

### 4.1 원격 CI

- 최근 원격 Android E2E: **PASS**
  - [GitHub Actions run 33224727451](https://github.com/k002bill2/LiveMetro/actions/runs/33224727451)
- 최신 Quality Gate: **FAIL**
  - [GitHub Actions run 33174715969](https://github.com/k002bill2/LiveMetro/actions/runs/33174715969)

로컬 Jest와 TypeScript는 통과했으므로, Quality Gate 실패의 단일 원인은 확정하지 않았습니다. CI 전용 Node/의존성/환경 또는 gate 설정 차이 확인이 필요합니다.

### 4.2 로컬 Android E2E

- 로컬 설정이 Android `13.0`을 고정
- 사용 가능한 AVD는 Android 14였고, 연결 실기기는 Android 12
- 설정상 release APK 경로는 `android/app/build/outputs/apk/release/app-release.apk`
- 로컬에는 `apps/android/app-debug.apk`만 존재
- 디버그 APK는 standalone 앱이 아니라 `DevLauncherMainScreen`으로 진입
- 기존 WDIO E2E 명령은 **0 passed, 6 retries failed**로 standalone 검증에 사용하지 못함

따라서 원격 E2E 성공과 로컬 release 검증은 별도 상태로 관리해야 합니다.

## 5. Android 실기기 핵심 QA

테스트는 Appium 시도 후 UiAutomator2 instrumentation이 테스트 서버 APK 교체로 종료되어, 앱 데이터 변경 없이 ADB 접근성 트리와 실제 터치 입력으로 재검증했습니다. 초기 Appium 오류는 앱 크래시로 판정하지 않았습니다.

| # | 시나리오 | 결과 |
|---:|---|---:|
| 1 | 앱 실행 및 `MainActivity` 진입 | PASS |
| 2 | 경로 검색 화면 초기 렌더링 | PASS |
| 3 | 출발역 선택 모달 열기·닫기 | PASS |
| 4 | 도착역 선택 모달 열기·닫기 | PASS |
| 5 | 출발·도착역 swap 후 원상복귀 | PASS |
| 6 | 시간 지정 선택기 진입·취소 복귀 | PASS |
| 7 | 경로 카드 확장·축소 | PASS |
| 8 | 홈 탭 진입 | PASS |
| 9 | 즐겨찾기 탭 진입 | PASS |
| 10 | 경로 탭 진입 | PASS |
| 11 | 제보 탭 진입 | PASS |
| 12 | 설정 탭 진입 | PASS |
| 13 | 경로 탭 최종 복귀 | PASS |

**최종 결과: 13/13 PASS**

### 5.1 실기기 런타임 확인

- `com.livemetro.app` 프로세스 생존 확인
- 최종 UI에서 `routes-tab-screen` 확인
- 최종 UI에서 `경로 검색` 확인
- 테스트 후 `FATAL EXCEPTION`: 0건
- 테스트 후 React Native 오류 로그: 0건

## 6. 실시간 데이터 상태

실기기 로그에서 서울 지하철 API 인증 오류가 관찰되었습니다.

```text
SeoulApiError: INFO-100
인증키가 유효하지 않습니다
```

앱은 캐시 또는 fallback 경로로 화면을 계속 제공했지만, 다음은 아직 PASS로 확정할 수 없습니다.

- 실제 실시간 도착정보의 최신성
- production API key의 유효성
- 인증 실패 후 캐시 데이터의 표시 시점·신선도
- API key rotation 및 장애 복구 동작

이 항목은 Android UI 흐름 PASS와 별도의 릴리스 차단요인입니다.

## 7. iOS 상태

- 연결된 iPhone은 `xcrun xctrace list devices` 기준 offline
- 로컬에 `apps/ios/LiveMetro.app` 없음
- `ios-deploy` 미설치
- iOS 실기기 앱 실행·검증 불가

미검증 범위:

- iOS 로그인·온보딩
- 위치 권한 및 백그라운드 위치
- 푸시 알림·알림 권한
- iOS 레이아웃 및 Safe Area
- iOS release/preview 빌드

## 8. QA 직원 상태

QA 독립 검증을 위해 다음 프로필을 추가했습니다.

| 항목 | 값 |
|---|---|
| 프로필 | `/Users/younghwankang/.hermes/profiles/qa` |
| 역할 | QA Engineer · Quality Lead |
| 모델 | `anthropic/claude-haiku-4.5` |
| Provider | OpenRouter |
| 작업 디렉터리 | `/Users/younghwankang/Work/LiveMetro` |
| 권한 계약 | 읽기 전용, 코드 수정·배포·외부 발송 금지 |

독립 QA 직원의 최종 보고서는 아직 확보하지 못했습니다.

- 최초 실행: OpenRouter `HTTP 402` 크레딧 부족
- 크레딧 갱신 후 재실행: 셸 프롬프트 전달 오류
- 전달 방식 수정 후 실행: 세션 복구 전 Gateway interruption

따라서 이 문서의 검증된 실기기 결과는 **Jarvis가 직접 수행한 결과**이며, QA 직원의 독립 PASS로 합산하지 않았습니다.

## 9. 완성도 및 릴리스 판정

### 9.1 기능 영역별 판단

| 영역 | 판단 | 상태 |
|---|---|---|
| 인증·온보딩 | 주요 구현 확인 | 자동화 중심, 실기기 신규 사용자 흐름 미검증 |
| 홈·통근 | 주요 구현 확인 | Android 실기기 탭 진입 PASS |
| 실시간 도착 | 구현 및 fallback 존재 | API 인증키 확인 필요 |
| 경로 검색 | 핵심 UI 흐름 PASS | 실시간 경로 데이터 정확성 별도 확인 필요 |
| 즐겨찾기 | 구현 및 테스트 존재 | 실제 Firebase 쓰기 미검증 |
| 알림 | 구현 및 테스트 존재 | 실제 푸시·백그라운드 수신 미검증 |
| 지도·위치 | 구현 및 테스트 존재 | 실제 권한·GPS 흐름 미검증 |
| 설정·다국어·테마 | 주요 화면 구현 확인 | 전체 옵션 조합의 실기기 검증 미완료 |
| Android 배포 | 원격 E2E 성공 | 로컬 standalone release 검증 미완료 |
| iOS 배포 | 구현 대상 존재 | 실기기/Preview 검증 미완료 |

### 9.2 릴리스 Gate

| Gate | 상태 |
|---|---:|
| TypeScript | PASS |
| Unit/integration tests | PASS |
| Coverage threshold | PASS |
| Plugin lint | PASS |
| App lint zero-warning | **FAIL** |
| Expo dependency health | **FAIL** |
| Latest CI Quality Gate | **FAIL** |
| Android physical smoke | PASS |
| Android standalone release E2E | BLOCKED |
| iOS physical/preview QA | BLOCKED |
| Production Seoul API | **BLOCKED/확인 필요** |

## 10. 권고 조치

우선순위 순서입니다.

1. **Production 서울 API 인증키와 환경변수 확인**
2. 앱 lint warning을 정리하고 `--max-warnings 0` 통과
3. Expo Doctor 실패 3건 해결
4. 최신 CI Quality Gate 실패 원인 재현·수정
5. Java 17 및 실제 release APK 기준 Android E2E 재실행
6. iOS Preview 빌드 생성 후 인증·권한·알림·백그라운드 흐름 검증
7. QA 직원 독립 검증을 정상 완료하고 Jarvis 결과와 교차 대조

## 11. 최종 상태 문장

> LiveMetro는 기능 구현과 Android 실기기 핵심 UI 흐름은 거의 완성된 상태지만, 실시간 API 인증과 배포 품질 게이트가 해결되지 않아 현재는 릴리스 승인 전 단계입니다.
