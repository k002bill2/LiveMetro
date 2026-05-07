# Wanted Design System — Manual QA Checklist

> 작성일: 2026-05-07
> 대상: PR #6 + Phase 50~56 시안 sync 머지 결과 검증
> 실행 환경: iOS 시뮬레이터 + Android 에뮬레이터 (또는 실기기)
>
> 자동 검증(tsc/eslint/jest/lint:typography)은 0이지만 폰트 렌더, 다크모드 contrast, 로케일 전환, ML 예측은 실행 환경에서만 확인 가능.

## 사전 준비

```bash
# 1. 캐시 클리어 후 dev 서버
npx expo start --clear

# 2. 키 이슈 발생 시 .env 재확인 (memory: feedback_env_path_protection.md)
grep "EXPO_PUBLIC" .env | head -5

# 3. iOS는 i, Android는 a 입력하여 시뮬레이터 부팅
```

---

## QA 1 — iOS Pretendard 폰트 적용

**목적**: `expo-font` 번들이 정상 로드되어 system font flash 없이 Pretendard로 첫 렌더되는지

### 절차
1. iOS 시뮬레이터 부팅 (i 키)
2. Splash → 첫 화면 전환 시 텍스트 깜빡임 관찰
3. 로그인 화면 헤로 텍스트 (`LoginHero`) 확인

### Pass 기준
- [ ] Splash 직후 첫 화면 텍스트가 **처음부터** Pretendard로 렌더 (system San Francisco로 잠깐 표시 후 swap = FAIL)
- [ ] `Pretendard-Regular`/`Medium`/`SemiBold`/`Bold` 4가 가중치 모두 시각 차이 명확
- [ ] 로그인 화면 헤로 "LiveMetro" 800 가중치 (ExtraBold) 정확히 굵음

### 참조
- `project_pretendard_wiring.md` — `fontFamily: 'Pretendard'` 무성 fallback 회피 정책
- commit `65ece74` — bundle 시점

---

## QA 2 — Android Pretendard + faux-bold 부재

**목적**: Phase 21 핵심 검증. `weightToFontFamily` 헬퍼가 `fontWeight`를 반환하지 않아 Android faux-bold 합성이 발생하지 않아야 함.

### 절차
1. Android 에뮬레이터 부팅 (a 키)
2. 설정 → 언어 한국어 확인
3. 다음 화면 순회:
   - HomeScreen 노선 카드 타이틀
   - StationDetail 도착시간 (큰 숫자)
   - WeeklyPrediction 차트 라벨
   - SettingsScreen 그룹 헤더

### Pass 기준
- [ ] **bold 텍스트가 한 글자도 부자연스럽게 두꺼워지지 않음** (faux-bold = 시스템이 medium에 stroke 합성 → 글자 outline 거칠어짐)
- [ ] iOS 동일 화면과 시각 비교 — Android가 더 두껍거나 거칠면 FAIL
- [ ] Map 탭 아이콘 `lucide-react-native`이 정상 렌더 (Phase 39에서 ionicons 제거)

### 참조
- `project_typography_helpers.md` — fontWeight 미반환 정책
- `lint:typography` 4-layer enforcement (commit `7b5bae8`)

---

## QA 3 — 다크모드 contrast

**목적**: Phase 50/52/54/56 시안 sync 후 다크모드 토글 시 모든 redesign 화면의 contrast 보장

### 절차
1. SettingsScreen → 테마 → 다크
2. 다음 화면 순회 (Phase 50/52/54/56 신규 영역 중점):
   - **NotificationTime 24h timeline** (Phase 50, `356a80f`)
   - **OnboardingStationPicker** (Phase 52, `c6b0e0c`)
   - **WeeklyPrediction hourly congestion forecast chart** (Phase 54, `a8ab59a`)
   - **SignupStep1/2/3** (Phase 56, `65563fb`)
   - DelayCertificateScreen verified badge (commit `dbe7b25`)
   - 즐겨찾기 카드 + 경로 카드 (commit `3d59fa5`)

### Pass 기준
- [ ] WCAG AA 4.5:1 contrast 시각 충족 (작은 텍스트 기준)
- [ ] `headerTintColor`, `tabBar` 배경/텍스트가 다크 톤에 정확히 적응
- [ ] 다크 → 라이트 전환 시 깜빡임/지연 < 200ms
- [ ] 차트 (WeeklyPrediction)의 그리드선/라벨이 다크에서도 식별 가능

### 참조
- `useTheme` two-path import (memory: `project_dual_path_theme_mock.md`)

---

## QA 4 — AlertsScreen 영어 로케일

**목적**: i18n 키가 모두 매핑되어 영어 전환 시 raw 키나 한국어 잔존이 없어야 함

### 절차
1. SettingsScreen → 언어 → English
2. AlertsScreen 진입
3. 다음 케이스 순회:
   - 빈 상태 ("데이터가 없습니다." → "No data available")
   - 신규 알림 도착 시 toast/banner
   - 필터 칩 (Phase 41 `filter chips`)
   - 알림 카드 시간 라벨 ("3분 전" → "3 minutes ago")

### Pass 기준
- [ ] **`t.alerts.*` raw 키 0건 노출** (예: `alerts.empty.title`이 그대로 보이면 FAIL)
- [ ] 한국어 잔존 0건 (혼합 표시 = 번역 누락 = FAIL)
- [ ] 한 → 영 → 한 토글 시 즉시 갱신 (재진입 필요 없음)

### 참조
- `react-i18next` t-함수 사용처는 `src/i18n/locales/` 참조

---

## QA 5 — useMLPrediction 실데이터 표시

**목적**: ML 학습이 일정량 데이터 누적 후 placeholder/fallback에서 real prediction으로 전환되는지

### 절차
1. 5일 이상 dev 서버에서 통근 패턴 누적 (또는 mock data 시드)
2. WeeklyPredictionScreen 진입
3. MLHeroCard 상태 관찰

### Pass 기준
- [ ] Placeholder ("학습 데이터 부족") → real prediction 카드 전환 발생
- [ ] 시간대별 혼잡도 예측 차트가 mock 0/null이 아닌 실제 분포로 렌더
- [ ] 예측 신뢰도 라벨 ("LOW/MID/HIGH") 표시
- [ ] CommutePrediction hero (Phase 7 재작성, Phase 21/21.1 보강) 정상 렌더

### 참조
- 참조 시안: `docs/design/wanted-bundle/9a7fe457-….js` (CommutePrediction hero)

---

## 결과 기록 양식

```
QA 1 (iOS Pretendard):       PASS / FAIL — [관찰 내용]
QA 2 (Android faux-bold):    PASS / FAIL — [관찰 내용]
QA 3 (다크모드 contrast):     PASS / FAIL — [실패 화면 + 스크린샷 경로]
QA 4 (영어 로케일):           PASS / FAIL — [누락 키 목록]
QA 5 (ML 실데이터):           PASS / FAIL / N/A (학습 데이터 부족) — [관찰 내용]
```

FAIL 발견 시:
1. 스크린샷 → `docs/design/qa-evidence/` (디렉토리 미존재 시 생성)
2. 이슈 체크리스트 → `dev/active/` 하위 새 컨텍스트로 분리
3. 회귀 분석: `git bisect` 또는 `git log --oneline -- <touched file>`로 도입 시점 추적
