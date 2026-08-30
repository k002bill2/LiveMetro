# HANDOFF — QA 진단 반영 + 저장소 위생 정리 + preview 빌드 큐잉

작성 2026-08-30. **작업 트리 깨끗, 미완성 코드 없음, main = origin/main 동기.**
직전 HANDOFF(E2E 진입 정체 완결, 8/15)는 해당 사가가 종결되어 교체함 — git 히스토리 참조.

## 한 줄 요약

8/29 실기기 QA 결과를 저장소·메모리에 반영하고, 빌드 산출물이 워킹트리를 영구히
더럽히던 구조를 제거한 뒤, 전 검증 게이트를 통과시켜 preview 빌드를 큐잉했다.

## 이번 세션에 머지된 커밋 (전부 main 푸시 완료)

| 커밋 | 내용 |
|---|---|
| `282d890` | `docs(qa)`: 2026-08-29 실기기 QA 진단 보고서 추가 (`docs/qa-diagnosis-2026-08-29.md`) |
| `5a63d6a` | `chore(e2e)`: entry-probe 배열 타입 표기 통일 (동작 변화 0) |
| `60aaeb5` | `chore(functions)`: **`lib/` 빌드 산출물 추적 해제 + gitignore 신설** |

`60aaeb5`가 이번 세션의 실질 성과다. `functions/lib`(tsconfig `outDir`)이 무시 규칙 없이
8개만 tracked 인 부분 커밋 상태였고, 누가 빌드하든 `M` 2개 + `??` 다수가 재생성돼
`requireCommit:true` 게이트를 반복 차단했다. `functions/.gitignore`(`lib/`) 신설 +
`git rm -r --cached functions/lib` 로 해소. 배포는 predeploy(`firebase.json`)와
`.github/workflows/firebase-deploy.yml:61`이 `npm run build`로 항상 재생성하므로 무영향.

## 현재 진행 중 — preview 빌드 (확인 필요)

`/deploy-with-tests` 전 게이트 통과 후 `--non-interactive --no-wait`로 큐잉:

```
ANDROID  ec0c4069-e3f9-479b-9dd8-f71e40b6a86f  IN_PROGRESS
IOS      44e69105-02bc-4ae7-84b5-120f1b91ecf0  IN_QUEUE
둘 다 commit=60aaeb5, profile=preview, channel=preview
```

**다음 세션 첫 행동**: `eas build:list --limit 2` 로 완료 여부 확인.

게이트 실측치(2026-08-30): functions tsc 0 · root tsc 0 · lint exit 0(**0 errors /
755 warnings**) · jest **5,828 passed / 25 skipped / 352 suites, exit 0, 57초** ·
커버리지 stmt 87.24 / branch 77.26 / func 89.31 / lines 88.43 (임계 75/60/70/75 충족).

## 남은 일 — QA 릴리스 차단요인 5종 (우선순위 순)

이 게이트들과 **별개**다. tsc·lint·jest가 전부 초록이어도 출시는 보류 상태.

1. **서울 API `INFO-100` 인증키** — 실기기 로그에서 관측. 설치 APK라 `EXPO_PUBLIC_*`는
   빌드 타임 인라인 → 진단은 번들 grep으로 "어떤 키가 박혔는지" 먼저 확정할 것.
   로컬 `.env.local` 가림 사례와는 메커니즘이 다르니 재발로 단정 금지.
2. **앱 lint `--max-warnings 0`** — 0 errors / 755 warnings. Hook deps·unused·no-console.
3. **Expo Doctor 13/16** — `@types/react-native` 직접 설치, SDK 48부터 제거된
   `expo-firebase-recaptcha`, `@expo/config-plugins@5.0.4` 불일치.
4. **최신 CI Quality Gate 실패**(run 33174715969) — 로컬은 전부 통과하므로 **원인 미확정**.
   2번과 같은 원인이라고 단정하지 말 것.
5. **iOS 전면 미검증** — 기기 offline, `ios-deploy` 미설치. preview 빌드 나오면 착수 가능.

QA 권고 순서상 preview 빌드 완료 후 **실제 release APK 기준 Android E2E 재실행**(권고 5번)이
자연스러운 다음 단계다. 로컬 WDIO는 Android 13.0 고정 + release APK 부재로 현재 사용 불가.

## 부수 정리

- Orca 워크트리 `orca/workspaces/LiveMetro/commute-prediction-duration` 삭제 (미커밋 0·
  고유 커밋 0·stash 0·작업은 `6f0307e (#334)`로 머지 완료 확인 후). 남은 워크트리는 메인뿐.

## 재발 방지 지식 (메모리 SSOT)

- `project_qa_diagnosis_2026_08_29_release_gate.md` — QA 스냅샷 전체.
  원본 문서가 untracked였으므로 메모리가 사실상 SSOT. Appium 사망 시 ADB 접근성 트리 +
  실터치 대체 검증 레시피, "13/13은 독립 QA 아님" 주의 포함.
- `project_deploy_with_tests_gates_2026_06.md` §⑦ 해소 — `functions/lib` 원인 귀속 정정
  (훅 `--noEmit`이라 범인 아님, mtime 대조가 판별자).
- `project_e2e_ci_structurally_unpassable.md` §8/29 — 원격 E2E PASS ≠ 로컬 standalone 검증.
