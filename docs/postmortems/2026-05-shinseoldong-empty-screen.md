# 신설동 빈 화면 — 6레이어 디버깅 (2026-05-21 ~ 05-24)

## 요약

기기에서 *신설동 2호선 역 상세*가 운행 시간대에도 `현재 운행 중인 열차가 없습니다`로 지속 표시되는 단일 증상이, **여섯 겹의 독립적 원인**을 가리고 있었다. 만료된 API 키부터 응답 파싱 버그, 미배포 Firestore 규칙, 망가진 CI 파이프라인, GCP IAM 권한 모델, 비-interactive 모드의 고아 리소스 처리까지 — systematic-debugging의 "fix the root, not the symptom" 원칙으로 한 겹씩 벗겨낸 결과 코드(PR #153), CI(PR #154), GCP IAM(역할 4종), 라이브 Firestore(규칙 + 인덱스 정리), 운영 자산(메모리 3종)이 모두 정렬됐다.

세션 시작 시점에 Firebase Deploy CI는 **2주간 한 번도 성공한 적이 없었고**, 종료 시점엔 다시 자동으로 흐르는 상태가 됐다.

## 사용자가 처음 본 증상

```
[역 상세정보 — 신설동]  Line 2  상행
  🌙 현재 운행 중인 열차가 없습니다
       잠시 후 다시 확인해주세요
  시간표: 시간표를 불러오는 중...
  출구 안내: 출구 안내 정보가 없습니다
```

**평일 17:39 KST.** 직접 Seoul API를 호출하면 신설동은 `total: 12` 도착 정보를 정상 반환했다 — 즉 *앱이 받지 못하는* 문제. systematic-debugging Phase 1에 따라 "추측 없이 API 경계에서 증거 수집"으로 시작.

## 6레이어 인과 사슬

```
신설동 빈 화면
 └─ ❶ 만료된 EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY (INFO-100 auth)
      └─ ❷ 앱이 그 INFO-100을 빈 배열로 silent swallow (response shape blindness)
           └─ ❸ 혼잡도 영역까지 동시에 깨짐 — congestionSummary Firestore 규칙 미배포
                └─ ❹ 규칙 자동 배포 CI(Firebase Deploy)가 5/8부터 실패 — gitleaks가 공개 Firebase 키 false-positive
                     └─ ❺ CI 복구 후에도 firebase-adminsdk SA의 배포 권한 0 — 5단계 IAM whack-a-mole
                          └─ ❻ 권한 정렬 후 인덱스·함수 고아가 non-interactive 모드 차단
```

각 레이어는 *이전 레이어를 고친 뒤에만* 드러났다. ❶을 해결해야 ❷의 결과(에러가 throw로 surfacing)가 보이고, ❷를 고쳐야 ❸가 정확히 진단되고, ❹·❺·❻은 순차적으로만 노출됐다.

---

## 레이어별 상세

### ❶ 만료된 Seoul 실시간 API 키

**증거**: PR #153의 진단 로그가 기기에서 다음을 찍었다 — 6개 역 모두 동일:

```
[SeoulSubwayApi] Realtime arrival error for "광화문": code=INFO-100 category=auth message=인증키가 유효하지 않습니다
[SeoulSubwayApi] Realtime arrival error for "건대입구": code=INFO-100 category=auth ...
[SeoulSubwayApi] Realtime arrival error for "서울역":   code=INFO-100 category=auth ...
ApiKeyManager: Key 565a...796b disabled until 2026-05-21T15:05:17Z
```

`code=INFO-100` = 인증키가 유효하지 않음. 단일 키 보유 + 만료 → 모든 역에서 동일 증상. *신설동은 우연히 사용자가 처음 본 곳*이었다.

**해결**: data.seoul.go.kr에서 키 재발급 → `EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY` 교체 → Metro는 `EXPO_PUBLIC_*`을 빌드 시 inline하므로 `expo start --clear` 필수 (memory: `project_metro_expo_public_cache`).

**재발 방지**: `ApiKeyManager`는 `_KEY_2`, `_KEY_3`까지 multi-key 폴백을 지원. 단일 키 운영은 single-point-of-failure — 백업 키 등록 권장.

### ❷ 코드: Seoul API 두 응답 구조 처리 — PR #153

**근본 원인**: Seoul Open API는 **실패도 HTTP 200**으로 응답하며 **두 가지 JSON 구조**를 쓴다:

| 케이스 | 응답 구조 |
|--------|-----------|
| 성공 (또는 wrapped 에러) | `{ errorMessage: {code, message}, realtimeArrivalList: [...] }` |
| 게이트웨이 실패 (auth INFO-100 / 역명 INFO-200 / 쿼터 ERROR-3xx) | `{ status, code, message }` — `errorMessage` 래퍼 없음 |
| 시간표 게이트웨이 실패 (8088 포털) | `{ RESULT: { CODE, MESSAGE } }` — 서비스 래퍼 없음 |

기존 `getRealtimeArrival`은 `if (data.errorMessage)`로만 에러를 판별 → 최상위 구조를 건너뛰고 `return data.realtimeArrivalList || []` → **모든 실패가 빈 배열 + `reportSuccess` 호출**. throw가 없으니 에러 화면이 아닌 **빈 Moon 화면**이 매 30s 폴링마다 지속.

**해결** (PR #153, 5ce5fe3 + 57fccd2):

- `extractSeoulApiErrorCode(data)` 헬퍼 — 래핑/최상위 두 구조에서 `{code, message}` 추출.
- `getRealtimeArrival` / `getStationsByLine` / `getStationTimetable` 모두 통합 처리 — 최상위 에러는 `SeoulApiError` throw + 카테고리별 `reportError`/`reportRateLimit` + 진단 `console.warn`.
- `SeoulApiResponse` 타입에 최상위 에러 필드(`status?`, `code?`, `message?`) 추가, `SeoulTimetableResponse`에 게이트웨이 `RESULT?` 추가.
- **StationDetailScreen 노선 필터** — 환승역(신설동 1·2·우이신설)에서 realtime API가 반환하는 타 노선 열차가 섞이지 않도록 `lineId` 기반 strict 필터 (1–9 숫자 노선 한정, 연장·광역 노선은 정규화 형식 차이로 보존).
- **빈 상태 새로고침 버튼** — 일시적 빈 응답에 수동 재시도 affordance.

**테스트** (`src/services/api/__tests__/seoulSubwayApi.test.ts`, `src/screens/station/__tests__/StationDetailScreen.test.tsx`):
- seoulSubwayApi: 신규 5건 (realtime INFO-200/INFO-100, getStationsByLine 최상위 에러, getStationTimetable 게이트웨이 + INFO-200 `[]` 유지). 73/73.
- StationDetailScreen: 신규 3건 (노선 필터 2 + 빈 상태 새로고침 1). 24/24.

이 단계는 **버그를 숨기지 않고 드러내는 것**이 핵심이었다. PR #153 머지 후 진단 로그가 ❶의 실제 원인(INFO-100)을 정확히 짚어줬다.

### ❸ Firestore 규칙: `congestionSummary` 미배포

**증거**: 앱 로그에 `[CongestionService] subscribeToLineCongestion failed for congestionSummary (lineId=2): [FirebaseError: Missing or insufficient permissions]`.

`firestore.rules`엔 `match /congestionSummary/{summaryId} { allow read: if true; ... }`가 PR #149 (`a4b07b8`, 5/20)에 추가돼 있었지만 — **라이브 Firestore에 배포된 적이 없었다.** `allow read: if true`는 무조건 허용이라 배포만 됐다면 거부 불가능 → 즉 배포 갭.

**해결**: `firebase deploy --only firestore:rules` (사용자 manual, Owner 권한). 출력의 `✔ firestore: released rules firestore.rules to cloud.firestore` 라인이 활성화 확정 신호 (memory: `project_firebase_deploy_trailing_error_cosmetic`).

규칙이 배포되자 혼잡도 권한 거부 해소. 단, *왜* 자동 배포가 안 됐는지가 ❹로 이어졌다.

### ❹ CI: gitleaks false-positive — PR #154

**증거**: `gh run list --workflow=firebase-deploy.yml` — **최근 3개 런이 모두 failure** (가장 오래된 게 2026-05-08). 즉 2주간 functions/rules가 한 번도 배포되지 않음.

실패 지점: `guard` job의 **gitleaks 시크릿 스캐너 스텝**이 `.env.example` line 3 + `docs/FIREBASE_SETUP.md` line 44의 `EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...`를 `gcp-api-key`로 탐지 → `leaks found: 2 → 🛑` → guard 실패 → deploy job 스킵.

**false-positive인 이유**: Firebase Web SDK API 키는 **설계상 공개값**이다. `EXPO_PUBLIC_` 접두사로 클라이언트 번들에 inline되어 모든 APK/IPA에 포함되어 배포되며, Firebase 접근 제어는 키 비밀성이 아니라 Firestore 규칙 + Auth + App Check가 담당한다 (Google 공식 문서). gitleaks의 `gcp-api-key` 룰은 공개 Firebase 키와 민감한 GCP 키를 형식(`AIza...`)으로 구분하지 못한다.

**해결** (PR #154, dcee97a — 머지됨):

- `.gitleaks.toml` 신규 — `[extend] useDefault = true`로 기본 룰셋 유지 + 공개 Firebase 키 **1건만** `regexes` allowlist. 다른 모든 시크릿은 계속 탐지.
- `.env.example`, `docs/FIREBASE_SETUP.md` — 실제 값 → placeholder (템플릿 위생).

**중요한 함정**: `[extend] useDefault = true`가 없으면 커스텀 config가 기본 룰셋을 *통째로* 비활성화하고 스캔이 silently 통과한다. 모든 커스텀 gitleaks config의 필수 한 줄.

### ❺ GCP IAM: firebase-adminsdk-fbsvc의 배포 권한 0 — 5단계 whack-a-mole

PR #154 머지 + `gh workflow run firebase-deploy.yml` 트리거 → `guard` ✅ → `deploy` job이 2주 만에 처음 실행 → 새로운 일련의 권한 에러가 차례로 노출됐다.

**근본 원인**: Firebase Console "새 비공개 키 생성"으로 만들어 `FIREBASE_SERVICE_ACCOUNT` GitHub 시크릿에 넣은 `firebase-adminsdk-fbsvc@livemetro-cc092.iam.gserviceaccount.com`은 **Firebase Auth/App Check 관리자 역할만** 기본 보유, **배포 권한은 처음부터 0**.

| # | 에러 | 누락 권한 | 부여 |
|---|------|----------|------|
| ❺-1 | `Missing permissions: iam.serviceAccounts.ActAs on livemetro-cc092@appspot.gserviceaccount.com` | Cloud Functions Gen2 런타임 SA `ActAs` | **`roles/iam.serviceAccountUser`** (서비스 계정 사용자) |
| ❺-2 | `firebaserules.googleapis.com/.../:test had HTTP Error: 403` | Firebase Rules / Cloud Run / Cloud Build / Artifact Registry / Datastore — 다수 | **`roles/editor`** (편집자) — 한 번에 처리 |
| ❺-3 | `cloudbilling.googleapis.com/.../billingInfo had HTTP Error: 403, API has not been used or is disabled` | Cloud Billing API 프로젝트 레벨 활성화 | **Cloud Billing API 사용 설정** (GCP Console 1클릭) |
| ❺-4 | `Failed to set IAM Policy on the function ...` × 5개 함수 | `cloudfunctions.functions.setIamPolicy` (Editor가 빠뜨리는 유일한 setIamPolicy) | **`roles/cloudfunctions.admin`** (Cloud Functions 관리자) |

`roles/editor`가 `*.setIamPolicy` 류 권한을 일반적으로 제외한다는 GCP 기본 역할의 알려진 한계가 ❺-4의 핵심이다. HTTP/Callable 함수에 `allUsers` invoker IAM을 세팅하려면 Cloud Functions Admin이 필수.

**다음 Firebase CI 셋업에 적용할 풀셋** (memory `project_firebase_ci_deploy_role_set`):

```
firebase-adminsdk-<r>@<proj>.iam.gserviceaccount.com 에
  roles/iam.serviceAccountUser
  roles/editor
  roles/cloudfunctions.admin
  + Cloud Billing API 프로젝트 활성화
```

처음부터 이 4가지를 한 번에 부여하면 whack-a-mole 없이 끝난다.

### ❻ 비-interactive 모드 차단: 인덱스 + 함수 고아

권한이 모두 정렬된 뒤에도 두 종류의 *고아 리소스* 가 CI를 막았다 — `firebase deploy`가 라이브 프로젝트엔 있지만 로컬 코드/파일엔 없는 리소스를 발견하면 *삭제할까?* 를 묻는데, `--non-interactive` 모드에서는 그 프롬프트가 에러로 변한다.

**❻-1 인덱스 고아**: `delayReports (lineId, userId, timestamp ASC)` — `firestore.indexes.json`에 없는 라이브 인덱스.
→ 사용자가 manual interactive `firebase deploy --only firestore:indexes` 실행 → 프롬프트에서 "Yes 삭제" → ✔.

**❻-2 함수 고아**: `getStationTimetable(asia-northeast3)` — `functions/src/`에 정의 없는 라이브 Cloud Function (과거 시간표 프록시 함수가 클라이언트 직접 호출로 대체되며 *deploy에서 제거됐지만 라이브에서 삭제 안 된* dead code on the project).
→ `firebase functions:delete getStationTimetable --region asia-northeast3`.

**중요한 함정**: `Firestore 인덱스 삭제`는 백그라운드 작업이다 — `Deleting 1 indexes...` 즉시 ✔를 찍어도 실제 propagation은 수 분~시간. ❻-1 직후 CI를 재트리거하면 같은 고아가 또 보였다 (3일 propagation 대기 후 통과).

`--force` 플래그를 CI에 박는 건 footgun — 미래의 ad-hoc 인덱스/함수까지 자동 삭제. *interactive 정리 한 번 + 이후 디시플린* 이 정답.

---

## 산출물

### Pull Requests

| # | 제목 | 상태 |
|---|------|------|
| **#153** | `fix(api):` Seoul 실시간 API 최상위 에러 구조 처리 — 지속적 "운행 열차 없음" 오표시 수정 | merged ([2 commits](https://github.com/k002bill2/LiveMetro/pull/153): `5ce5fe3` + `57fccd2`) |
| **#154** | `ci:` gitleaks allowlist for public Firebase web key — Firebase Deploy 복구 | merged (`dcee97a`) |

### 메모리 (영구 지식 자산)

세 개의 프로젝트 메모리가 추가됐다 (개인 메모리 저장소 `~/.claude/projects/-Users-younghwankang-Work-LiveMetro/memory/`에 위치, 다음 세션의 컨텍스트에 자동 로드):

- **`project_seoul_api_two_response_shapes.md`** — Seoul API 두 응답 구조 (wrapped vs 최상위) + `extractSeoulApiErrorCode` 패턴.
- **`project_firebase_deploy_trailing_error_cosmetic.md`** — `firebase deploy` 트레일링 에러는 cosmetic; `✔ released rules` 라인이 성패 판정.
- **`project_firebase_ci_deploy_role_set.md`** — Firebase CI 배포 SA의 IAM 풀셋 (서비스계정사용자 + 편집자 + Cloud Functions 관리자 + Cloud Billing API).

### 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `src/services/api/seoulSubwayApi.ts` | `extractSeoulApiErrorCode` 추가, `getRealtimeArrival`/`getStationsByLine`/`getStationTimetable` 통합 에러 처리 + 진단 로그. `SeoulApiResponse`/`SeoulTimetableResponse` 타입 확장 |
| `src/services/api/__tests__/seoulSubwayApi.test.ts` | 신규 5건 (최상위 에러 + 게이트웨이 에러 + INFO-200 [] 유지) |
| `src/screens/station/StationDetailScreen.tsx` | 노선 필터 (1–9 숫자 노선) + 빈 상태 "다시 시도" 버튼 |
| `src/screens/station/__tests__/StationDetailScreen.test.tsx` | 신규 3건 (필터 2 + 새로고침 1) |
| `.gitleaks.toml` | 신규 — `useDefault=true` + 공개 Firebase 키 1건 allowlist |
| `.env.example` | 실제 livemetro-cc092 값 → placeholder |
| `docs/FIREBASE_SETUP.md` | 동일 placeholder화 |

### GCP/Firebase 인프라 변경 (코드 외)

- `firebase-adminsdk-fbsvc` 서비스 계정에 다음 역할 부여: `roles/iam.serviceAccountUser`, `roles/editor`, `roles/cloudfunctions.admin`.
- Cloud Billing API 활성화 on `livemetro-cc092`.
- Firestore 인덱스: 고아 `delayReports (lineId, userId, timestamp)` 삭제 (의도된 파일 8개와 일치).
- Cloud Functions: 고아 `getStationTimetable(asia-northeast3)` 삭제 (dead code).
- Firebase Auth: `EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY` 신규 키로 교체.

---

## 재발 방지 체크리스트

다음에 *비슷한* 빈 화면 또는 권한 에러가 나타나면:

### 빈 화면 / 권한 거부 (앱 측)
- [ ] **콘솔 로그 먼저 확인** — PR #153의 진단 `console.warn`이 정확한 `code=...`를 알려준다.
  - `code=INFO-100` → API 키 만료/무효 → `EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY` 교체.
  - `code=INFO-200` → 역명 불일치 → 앱이 보내는 역명 추적.
  - `code=ERROR-3xx` → 쿼터 → 백업 키 추가 / 폴링 간격 점검.
- [ ] Firestore 권한 거부 → 해당 컬렉션이 `firestore.rules`에 `match` 블록을 갖는지 + **그 규칙이 실제로 라이브에 배포됐는지** 확인. 배포 판정: `firebase deploy --only firestore:rules` 출력의 `✔ released rules` 라인.

### CI 자동 배포 실패
- [ ] `gh run list --workflow=firebase-deploy.yml --limit 5` — 최근 런이 모두 실패하면 *조용히 망가진 지 오래된* 신호.
- [ ] `guard` 실패 → `gh run view <id> --log-failed` — gitleaks/lint/test 중 어디가 막혔는지 확인.
- [ ] `deploy` 실패 → 권한이면 위 IAM 풀셋 확인. 새 GCP API면 활성화 필요 (에러 메시지에 URL 포함).

### 새 Firebase CI 셋업 시 (whack-a-mole 회피)
1. 서비스 계정에 *처음부터* `roles/iam.serviceAccountUser` + `roles/editor` + `roles/cloudfunctions.admin` 부여.
2. Cloud Billing API 활성화.
3. `firebase deploy` interactive로 1회 실행해 기존 라이브 리소스와 로컬 파일을 동기화 (고아 정리).
4. 그 다음에 CI에서 `--non-interactive` 배포 안전.

---

## 다음에 또 빈 화면이 보이면

PR #153이 머지된 지금, **앱 로그가 곧 진단서**다. 이 문서를 다시 펴기 전에:

1. 기기/시뮬레이터 콘솔에서 `[SeoulSubwayApi] Realtime arrival error for "...": code=...` 라인을 찾는다.
2. 그 `code`가 위 체크리스트에 매핑된다.
3. 안 매핑되면 — 새로운 변종일 수 있다. `extractSeoulApiErrorCode` 가 어떤 응답 구조든 잡아주므로, 새 코드도 진단 로그에 그대로 찍힌다.

코드는 이미 *왜* 비어 있는지를 스스로 말하도록 작성됐다 — 추측 없이 그 답을 듣고 행동하면 된다.

---

**기록**: 2026-05-24. 세션 시작 시점에 Firebase Deploy CI는 2주간 실패 중이었고, 이 문서를 쓰는 시점엔 다시 자동으로 흐른다. 신설동 빈 화면 한 줄의 사용자 보고가 5월 21일에 시작해 24일에 6레이어 전부 닫혔다.
