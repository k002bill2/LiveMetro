# HANDOFF — 측정 소요시간(measured travel duration) 부정확 조사

작성 2026-08-13. 컨텍스트 예산 경고로 세션 중단. **작업 트리는 깨끗하고, 진행 중인 미완성 코드는 없다.**

## 한 줄 요약

"측정 소요시간이 부정확하다"는 신고를 조사해 **원인 3층**을 찾았다. 2층은 PR로 올렸고(#323 머지, #324·#325 OPEN), prod 오염 데이터는 정리했다. **남은 1건은 착수 직전 상태**(브랜치만 생성, 코드 0줄).

## 표시값 분해 (prod 실측 근거)

```
81분 (조사 시작 시점 표시값)
 −6.9분  ← 오염 로그 2건        → 정리 완료 (prod)
 −5.6분  ← OD 혼합              → PR #325 (OPEN)
────────
69분 (실제 출근 산곡→선릉 소요시간)
```

실측(30일 창, uid `FEXFJHmSpCa4ZhhE3fI7x9th0xN2`): 산곡→선릉 **69.3분**(n=16), 선릉→산곡 **81.0분**(n=15), 혼합 74.9분.

## 완료된 것

| 항목 | 상태 |
|---|---|
| **#323** 도착 스탬프가 엉뚱한 leg에 찍힘 (`getTodayLog` limit(1) 무정렬) | **MERGED** (squash `19f3fa8`) |
| **#324** 입양 staleness 상한 (`isCompletableAt`, 180분) | **OPEN**, MERGEABLE, base=main |
| **#325** `baselineMinutes` → `baselineMinutesFor` OD 분리 | **OPEN**, MERGEABLE, base=main |
| prod 오염 로그 2건 정리 | **완료** — 문서 보존, `arrivalTime` 필드만 제거 |

- #324·#325는 **파일 집합이 겹치지 않아** 어느 쪽을 먼저 머지해도 무방하다.

### 보존 자료 — `dev/active/measured-duration-fix/` (gitignore됨, 커밋 안 됨)

| 파일 | 용도 |
|---|---|
| `commutelogs-arrivaltime-backup.json` | 정리 전 2건 원문 전체 — **되돌리려면 이 파일** |
| `diagnose_commute_durations.js` | prod 실조회 + baselineMinutes 재현 (읽기 전용) |
| `analyze_outliers.js` | OD별 통계 + 중앙값 대비 이상치 랭킹 (읽기 전용) |
| `clear_arrival_time.js` | 백업→지문검증→dry-run→`--apply` 절차 (**prod 쓰기**) |

`dev/active/`는 `.gitignore:160`에 있어 prod 개인 데이터가 커밋될 위험이 없다. 다시 조회하려면 `node dev/active/measured-duration-fix/analyze_outliers.js` — 단, `googleapis.com`은 샌드박스 허용 호스트가 아니므로 **sandbox 해제 필요**.

## 다음 작업 (착수 직전)

**브랜치 `fix/guidance-implausible-completion` 이미 생성됨 (base `19f3fa8` = main, 커밋 0개).**

### 문제

길안내 세션을 빠르게 탭해 넘기면 8분 만에 "완주" 판정이 나고, 그게 75분짜리 경로의 측정 소요시간으로 기록된다. prod 실측: 08-11 `21:28→21:36` 선릉→산곡 8분(정상 퇴근 `18:47→20:04`가 이미 완결된 뒤). 다른 계정(`kakao:4994721410`)에도 07-25에 1·2·2분짜리 동일 패턴 3건.

### 확정된 원인 (L1, 코드 추적 완료)

`isAtEnd = progress.currentIndex === steps.length - 1` (`useGuidanceProgress.ts:138`)이고, 진행도는 **수동 anchor + 경과 시간**으로 결정된다(`guidanceSteps.ts`). 수동으로 스텝을 넘기면 즉시 `isAtEnd` → `RouteGuidanceScreen.tsx:283`이 `updateGuidanceLocalCompletion(Date.now(), ...)` → `useGuidanceCommuteLogSync.ts:53` 라이브 분기가 `completeGuidanceCommuteLog` 호출 → 8분이 기록된다.

> **이전 세션의 오진 정정**: "`startGuidanceCommuteLog`에 `legAlreadyCompleted` 검사가 없어서"라고 요약했던 것은 **틀렸다**. 그 축으로 고치면 (a) 정당한 당일 2회차 통근을 막고 (b) 그날 *첫* 세션을 탭으로 넘긴 경우를 못 잡는다. 실제 축은 **기록된 소요시간의 타당성**이다.

### 합의된 설계

경로 자체 추정치 대비 **하한**을 둔다. #324가 상한(180분)을 두므로 둘이 하나의 불변식을 이룬다 — *"기록되는 소요시간은 이 경로에 대해 타당해야 한다"*.

```ts
// guidanceCommuteLogService.ts 내부 (자족적 — #324·#325 어느 쪽에도 의존 안 함)
const MIN_COMPLETION_RATIO = 0.5;
const isPlausibleCompletion = (session, completedAt) => {
  const estimate = session.route.totalMinutes;      // Route.totalMinutes 존재 확인됨
  if (!Number.isFinite(estimate) || estimate <= 0) return true;
  return (completedAt - session.startedAt) / 60_000 >= estimate * MIN_COMPLETION_RATIO;
};
```

- 측정값은 **`completedAt - session.startedAt`**(에폭 차)을 쓴다. "이 여정이 실제로 일어났는가"가 판정 대상이므로, 어느 문서에 스탬프가 찍히는지와 무관해야 한다.
- 하한은 안전하다: 측정 소요시간은 승강장 대기를 포함하므로 보통 ride 추정치를 **넘는다**.

### ⚠️ 반드시 먼저 확인할 것 — 재시도 폭주 위험

거절 시 **그냥 return 하면 안 된다.** `useGuidanceCommuteLogSync.ts:53`의 라이브 분기 조건이 `session.localCompletedAt && !session.commuteLogCompletedAt`이고, outbox 슬롯은 `runCompletion` resolve 시에만 정리된다(`:64`). 스탬프 없이 빠져나오면 **매 emit마다 재시도**한다.

거절 경로는 반드시:
1. `arrivalTime` write를 건너뛰고 (출발 로그는 **열린 채** 유지 — prod 정리 때와 같은 규칙)
2. **`commuteLogCompletedAt`은 스탬프**하고 (`setGuidanceSession`)
3. 정상 resolve 한다

### 테스트 (TDD)

`src/services/guidance/__tests__/guidanceCommuteLogService.test.ts`:
- 하한 미달 → `updateLog`/`logCommute` 미호출 **+ `commuteLogCompletedAt` 스탬프됨**(루프 종료 증명)
- 하한 이상 → 정상 완료
- `totalMinutes` 0/비정상 → 통과시킴(차단 안 함)

### 알려진 한계 (정직하게 기록할 것)

짧은 경로는 하한이 작아 보호가 약하다. 2분짜리 경로면 하한 1분이라 1분짜리 유령 로그가 통과한다. 다만 **0분(같은 분) 로그는 이미 무해**하다 — `commuteDuration.commuteDurationMinutes`(#325)가 `diff > 0`으로 걸러 평균에 도달하지 않는다.

## 착수하지 않기로 한 것

**아침 도착 미기록** — `detectCommuteType`(`useAutoCommuteLog.ts:29`)이 06–11시를 `'departure'`로만 분류해 08:45 실제 도착이 영영 안 찍힌다. *틀린 값*이 아니라 *없는 값*이고, 고치려면 시간대 창 의미론 재설계가 필요해 blast radius가 다르다. **이번 조사 범위 밖.**

## 실행 환경 함정 (이 레포에서 재현됨 — 다음 세션이 그대로 밟는다)

1. `npx jest ... | tail` — 파이프가 SIGPIPE로 jest를 죽인다. **파일 리다이렉트 후 grep**.
2. **exit 144는 테스트 실패가 아니다** — 래퍼만 죽고 출력 파일엔 완주 결과가 그대로 있다. **파일부터 확인**. load average 30 구간에서 빈발(백그라운드도 동일).
3. `cd functions`가 CWD를 오염시켜 이후 `npx jest`가 functions jest로 **5개 suite만 돌고 "통과"로 보인다**. → 서브셸 `( cd functions && ... )`.
4. `git stash push`는 **untracked 신규 파일을 안 건드린다** → revert 검증 시 직접 `mv`.
5. `--watchman=false` 누락 시 watchman 크래시(샌드박스 권한).
6. `gh` CLI는 TLS 차단 → `dangerouslyDisableSandbox` 단발. `git push`는 통과하나 `.git/config` 잠금 실패로 **upstream이 안 걸린다**(무해, 이후 `git push origin HEAD` 명시).

## 게이트 명령 (이 레포 기준)

```bash
npx tsc --noEmit
( cd functions && npx tsc --noEmit )
npx eslint <변경파일들> --max-warnings 0     # 전체는 756개 기존 warning으로 실패 — baseline 비교 필수
npx jest --watchman=false --maxWorkers=2 > /tmp/out.txt 2>&1; grep -aE "Test Suites:|Tests:" /tmp/out.txt
```

전체 스위트 baseline: **352 suites / 5763 tests** (main + #325 기준).
