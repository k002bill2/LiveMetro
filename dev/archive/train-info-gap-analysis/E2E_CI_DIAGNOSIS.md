# E2E-Android CI 진단 보고서 (2026-05-17)

## 결론

**14/14 E2E run이 `cancelled` — 단 한 번도 정상 종료된 적 없음**. fail이 아닌 cancelled가 conclusion. PR checks API는 이를 "fail"로 표시하지만 실제 conclusion은 cancelled.

## 데이터 (최근 50 run 표본)

```
Total E2E runs visible: 14
Conclusion histogram:
  cancelled: 14  (100%)
  success:   0
  failure:   0
```

가장 최근 10개 run 모두 `feat/*` 또는 `chore/*` PR — 각 PR마다 트리거되었고 모두 cancelled로 종료.

## Root cause 분석

### Cause 1: 30분 timeout이 빠듯
`.github/workflows/e2e-tests.yml`:

```yaml
e2e-android:
  runs-on: ubuntu-latest
  timeout-minutes: 30
  steps:
    - Checkout + Setup Node 18 + Install dependencies
    - Setup Java 17 + Android SDK
    - Enable KVM
    - AVD cache (cached, but cold-build still slow)
    - Create AVD (api-33, x86_64, pixel_6) + run:
        npx expo run:android --variant debug &  # debug build cold-start
        sleep 60
        npx appium --port 4723 --allow-cors &
        sleep 5
        npx wdio e2e/config/wdio.android.conf.ts
```

**예상 소요 시간** (cold start):
- npm ci: 1-2분
- Android SDK / Java setup: 2-3분
- Emulator boot (AVD cache hit): 3-5분 / (miss): 8-12분
- `npx expo run:android --variant debug`: 8-15분 (Gradle + Metro bundler 첫 빌드)
- Appium 시작: 5초
- wdio 테스트: 알 수 없음 (도달한 적 없음)

→ **wdio 시작 전에 25-35분 소요 → 30분 timeout hit**

### Cause 2: 머지 시 GitHub Actions 자동 취소
- 진행 중이던 e2e가 PR 머지에 의해 cancelled로 마무리
- PR checks가 cancelled를 "fail"로 표시 → 본 진단 직전 inconsistency 원인

### Cause 3: required check 아님
- 머지 차단 없음 → 14번 연속 cancel 누적해도 무브로커 머지 가능
- PR review에 노이즈만 누적, 실 가치 0

## 머지 gate 영향

본 세션 4 PR 모두 e2e cancelled 상태에서 quality-gate + unit-tests-gate green으로 머지 진행. e2e가 required check가 아니어서 차단 없었음. **현재 상태는 "noise만 만들고 회귀 가드 가치 0"**.

## 조치 옵션 (다음 세션 작업 후보)

### Option A — Timeout 늘리기 (timeout-minutes: 30 → 60)
- 가장 surgical (1줄 변경)
- 단점: PR마다 CI 시간 2배, GHA 비용 증가, 본질 해결 아님
- **추천도**: ⭐⭐ (응급 패치 only)

### Option B — Build cache 최적화
- `actions/cache@v4`로 gradle (~/.gradle) + expo prebuild output 캐시 추가
- Cold start 시간 30-50% 단축 예상
- **추천도**: ⭐⭐⭐ (실제 가치 회복 시도)

### Option C — Trigger 좁히기 (paths-ignore + label)
- 현재 `src/**` 어떤 변경에도 트리거 — 본 세션 같이 src 변경 1줄에도 e2e 30분 시도
- e2e 자체 변경 또는 `[run-e2e]` label 적용 시에만 트리거로 좁히기
- 단점: e2e가 실제 회귀를 잡는 가치를 더 줄임 (이미 0이지만)
- **추천도**: ⭐⭐ (가치 회복 후 함께 적용)

### Option D — Nightly로 분리 (★ 추천)
- PR trigger 제거 → `schedule: cron: '0 17 * * *'` (KST 새벽 2시) + `workflow_dispatch` 만
- PR review noise 0
- 매일 main 상태 health check 유지
- e2e가 실제 통과하기 시작하면 main breakage를 24h 내 발견 가능
- **추천도**: ⭐⭐⭐⭐ (현재 가치 0인 상태에서 noise 제거 + 인프라 작업 시간 확보)

### Option E — Smoke + Full 분리
- PR-level: 1-2 critical path만 (smoke, ~10분)
- Nightly: 전체 wdio suite (1시간+)
- 가장 정통적 e2e 전략 but 구현 비용 큼
- **추천도**: ⭐⭐⭐ (장기적으로 정답이나 단기 ROI 낮음)

## 추천 순서

1. **Option D** 즉시 적용 → noise 0으로 만들고 PR review 정상화
2. **Option B** 1주 내 적용 → cold start 시간 단축, e2e가 실제 통과 가능한 인프라 확보
3. **Option E** 한 달 내 도입 검토 → smoke만 PR-level로 복귀

## 실행 시 PR scope

각 옵션은 surgical PR 단위로 분리 가능 — `.github/workflows/e2e-tests.yml` 단일 파일 변경. 본 세션 4 PR과 file set 비겹침이라 평행 가능했지만, 본 phase 본체에 포함 안 시키고 별도 phase로 도출하는 것이 [Surgical Changes] 원칙에 부합.

## 후속 ticket 제안

```
Title: chore(ci): e2e-android Nightly로 분리 + cold start 진단

Summary:
- 최근 14 e2e run 100% cancelled — PR-level e2e가 사실상 noise.
- Trigger를 schedule + workflow_dispatch로 좁혀 PR review 정상화.
- 후속으로 build cache 추가 검토 (Option B).

Reference: dev/active/train-info-gap-analysis/E2E_CI_DIAGNOSIS.md
```
