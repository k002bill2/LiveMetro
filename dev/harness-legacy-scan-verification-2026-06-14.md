# Harness Legacy Scan — 보완 여부 검증 (2026-06-14)

> 대상: `dev/harness-legacy-scan-report.md` (2026-06-07 생성)
> 방식: READ-ONLY 7-에이전트 병렬 대조 (workflow `wf_c0d9cea0-3c7`, 580K tok)
> 증거 원칙: 각 판정은 `ls`/`wc -l`/`grep`/`git show --stat` 1차 증거로 뒷받침. 추측 없음.

## TL;DR

**모두 보완되지는 않았다.** 보고서 §9가 "지금 자동처리(LOW-RISK)" vs "별도 세션 사람 승인(MEDIUM SHRINK + §7 hooks/settings)"으로 나눈 그대로다.

- ✅ **저위험/auto 항목(§6 DELETE, §4 functions MOVE, stale 정정)**: PR #190·#193·#194·#195·#196·#197로 거의 전부 처리됨.
- 🟡 **PARTIAL**: 핵심은 됐고 부수 작업만 남음 (subway-data 타입, settings 체인, cc-feature 트리거 등).
- ✅ **KEEP_CONFIRMED**: 안전 훅·기계강제 rule은 보고서 권고대로 정확히 보존됨 (건드리지 않은 게 정답).
- ❌ **NOT_DONE (13건)**: §3 도메인 rules SHRINK, §5 대형 SPLIT(MEMORY.md·monitoring), 글로벌 rules(coding-style·interaction·security) — 대부분 "사람 승인 후" 보류.

대략 분포: REMEDIATED ~10 · KEEP_CONFIRMED ~7 · PARTIAL ~6 · NOT_DONE ~13.

---

## 처리한 PR 매핑

| PR | 처리 섹션 | 핵심 |
|----|-----------|------|
| #190 (2a7ee85) | §3 | CLAUDE.md 309→84줄(-69.6%), 상세 → docs/claude/* 이관 |
| #193 (7784c6c) | §6, §8.1~8.3, §3 | react-web-development-aos·verify-loop·run-workflow → archive/, dangling 참조 정리, Skill description 레이어 경계화 |
| #194 (3dcc07e) | §7, §4 | tddGuard·geminiAutoTrigger·gemini-bridge 전면 제거 + settings 체인 -14줄 + .mcp.json memory 제거 + livemetro-functions.md → functions/CLAUDE.md MOVE |
| #195 (0cf48be) | §6, §3/§5 | build-fix.md 삭제 + route-fare api_reference A*→Dijkstra 정정 |
| #196 (6e5c055) | §5, §3 | cc-feature-implementer name 드리프트 정정(자동탐색 복구) + agents-registry 복원 + CLAUDE.md path-aliases dedup + _aos-imports orphan 제거 |
| #197 (90c5438) | (외래물) | explore/draft-commits AOS-fork 키워드 정정 |

---

## ✅ REMEDIATED

- `.claude/skills/react-web-development-aos/` → archive/로 이동 (#193)
- `.claude/commands/verify-loop.md` → archive (#193)
- `.claude/commands/run-workflow.md` → archive (#193)
- `.claude/commands/build-fix.md` → 완전 삭제 (#195), verificationGuard.js의 `/build-fix` 참조도 제거
- `.claude/hooks/tddGuard.js` → 삭제 + settings.json 참조 제거 (#194)
- `.claude/hooks/geminiAutoTrigger.js` → CONVERT 권고였으나 **전면 제거** (권고보다 강함, #194)
- 교차참조 스캔: 라이브 config(settings/skill-rules/agents/hooks/docs)에 죽은 참조 **0**. 잔존은 archive 사본·plan 이력 문서뿐(의도적).
- `CLAUDE.md` SHRINK (#190 + #196)
- `route-fare-calculation` A* stale 정정 + File Map 검증 통과 (#193)
- `.claude/rules/livemetro-functions.md` → `functions/CLAUDE.md` MOVE (#194)
- `.mcp.json` memory 서버 제거 (#194)

## ✅ KEEP_CONFIRMED (보고서가 KEEP 권고 → 정확히 보존됨)

- 훅: `pathProtection`, `ethicalValidator`(코어), `outputSecretFilter`, `fileLock`, `hardGateGuard`, `skillGateGuard` — settings.json 배선 확인
- 글로벌 rules: `date-calculation`(36), `golden-principles`(26), `verification`(53) — 부록B REVERSE→KEEP 그대로
- `commands-registry.json` — §7에서 "구조 변경 금지, 별도 승인"으로 deferred → 파일 보존 + 삭제 커맨드 엔트리만 정리

## 🟡 PARTIAL

| 항목 | 된 것 | 남은 것 |
|------|-------|---------|
| `commands-registry.json` | 삭제 커맨드 참조 정리 | drift 잔존: 18키 vs 25 .md (7개 native 커맨드 미등록) — **선재 상태, 회귀 아님** |
| `subway-data-processor` SKILL | 매핑표·description 정정 | `TrainArrival`/`Station` 인터페이스 타입이 `src/models/train.ts`와 불일치 (#193이 명시적 DEFER) |
| `seoul-api-limits.md` | rate-limit 코어 KEEP | BANNED 표가 Skill로 "이동"이 아닌 "중복" 상태 |
| `cc-feature-implementer-main` | name 드리프트 정정(자동탐색 복구) | 과넓은 트리거 축소·중복 체크리스트 이동 미확인 |
| `settings.json` PreToolUse | tddGuard 제거(6→5) | 목표 2~3훅 미달 (단 hardGate/skillGate는 의도적 KEEP) |
| `.mcp.json` | memory 제거 | context7 글로벌 중복 의도적 잔존(사용 중이라 보존) |

## ❌ NOT_DONE (13건 — 대부분 "사람 승인 후"로 보류)

**§3 SHRINK (도메인 rules / commands):**
- `react-native-patterns.md` — RN BANNED SSOT 허브 통합 미실행 (path-aliases·cleanup 중복 잔존)
- `mandatory-docs.md` — "반드시 Read" 축소 미실행 (#196이 'KEEP'로 명시 deferral)
- `coverage-thresholds.md` — jest.config SSOT 참조 전환 미실행. **⚠️ 실측 드리프트 확인: 문서 75/70/60 vs `jest.config.js:63-66` 실제 15/20/20** — 보고서가 경고한 "잘못된 임계값 주입 위험"이 실재. 하네스와 별개로 고쳐야 할 진짜 버그.
- `skill-rules.json` — 데드 fileTrigger 잔존: firebase/train/seoul/location/notification glob이 **0 매치**(services 하위 디렉토리화 영향으로 파일기반 자동활성 silent 파손). 과넓은 트리거(error-handling `**/services/**` 509매치) 잔존. (단 아카이브 항목 참조는 clean)
- `review.md` ↔ `code-review.md` — 단일화 미실행(채점표 잔존). SSOT 후보 `checklists/code-review.md` 자체가 web지향 stale(AOS残)이라 통합 불가 상태.
- `deploy-with-tests.md` — 부재 `src/backend` pytest 단계(L9,L19-23) 미제거

**§4 MOVE / §5 SPLIT:**
- 글로벌 `~/.claude/rules/coding-style.md` — 여전히 항상-로드 (대체 Skill 미생성)
- `MEMORY.md` 2계층화 — 미실행. **199→223줄로 오히려 증가** (#196 '의도적 제외' 명시)
- `monitoring-observability` SKILL — 330줄 그대로, `internals.md` 부재

**§7 / 글로벌:**
- `ethicalValidator.js` — 코어 KEEP는 OK, macOS 오탐 유발 Windows 전용 패턴(L27·L28의 Windows rmdir/del 정규식) SHRINK 미실행. ※ 본 검증 리포트 1차 작성도 이 패턴 오탐으로 차단됨 — 오탐 실재의 증거.
- 글로벌 `~/.claude/mcp.json` — memory/jina-reader/fetch 미정리 (repo 밖이라 harness 커밋 범위 외)
- 글로벌 `interaction.md` — context7/스타일 취향 섹션 미삭제
- 글로벌 `security.md` — RN무관 체크리스트 미축소 (보고서 L188이 MED-risk를 별도세션 제외로 명시)

---

## 메타-주의 (보고서 자체의 오류 1건)

§3 "CLAUDE.md **'rules 항상 로드' 사실오류 정정**" 권고는 **보고서 자기모순**이다. 같은 보고서 M1(L21)이 "Claude Code가 `<repo>/.claude/rules/`를 네이티브 자동 주입"이라 확인하고, 이 검증 세션의 시스템 컨텍스트에도 프로젝트 rules 9개가 실제 전부 주입돼 있다 → **'항상 로드'는 사실**. 따라서 CLAUDE.md가 해당 문구를 유지한 것이 정답이며, 이를 "안 고쳤다"고 감점하면 보고서 버그를 전파하는 것. (dedup/축소 권고는 별개로 실행됨.)

---

## 권고: 남은 작업 우선순위

1. **(진짜 버그) coverage 임계값 드리프트** — 문서 75/70/60 ≠ jest.config 15/20/20. 둘 중 무엇이 SoT인지 결정 후 일치시킬 것. 하네스 다이어트와 무관하게 위험.
2. **(silent 파손) skill-rules.json 데드 fileTrigger** — services 하위 디렉토리화로 glob 0매치 → 파일기반 Skill 자동활성 작동 안 함. glob 패턴 갱신.
3. **(컨텍스트 세금) MEMORY.md 2계층화** — 보고서가 "가장 큰 상시 인덱스 비용"으로 지목, 현재 223줄로 증가. §5 핵심.
4. 나머지 §3 SHRINK·글로벌 rules는 보고서 §9 프롬프트대로 LOW-RISK 묶음씩 사람 승인하에 진행.

---

## 누락(omission) 감사 — "DEFER인가 진짜 누락인가" (2-에이전트 적대 감사)

> 기준: harness-diet **plan 파일**(`.claude/plans/harness-diet-2026-06-07-plan.md`)의 APPLY/DEFER 버킷 + 6개 커밋 본문 마커. 원칙: **"안 됐다 ≠ 누락"** — 명시적으로 미뤘으면 DEFERRED, 아무도 언급조차 안 했으면 OMITTED.

**핵심 사실: plan은 의도적 incremental 설계였다.** APPLY는 "CLAUDE.md + .claude/skills/ 범위"의 안전한 소량만 담고, 나머지 전부를 **DEFER 리스트(L17~24)에 이름으로 명시 적재**했다(hooks·MCP·권한·글로벌 rules·프로젝트 rules SHRINK·MEMORY 2계층화·SKILL SPLIT·registry 구조·stale 타입). 이는 보고서 §M2 "블랭킷 삭제 위험" 경고를 그대로 따른 것. → NOT_DONE 대부분은 **plan DEFER에 박혀 있는 의도적 보류**다.

분포: **DONE 13 · DEFERRED 13 · KEEP 1 · OMITTED 2~3** (actionable 29건)

### ✅ 의도적 DEFER (누락 아님 — plan L17~24에 명시)
- commands-registry 구조(L24) · 프로젝트 rules SHRINK 4종 react-native-patterns/mandatory-docs/coverage-thresholds/seoul-api-limits(L22) · 글로벌 rules 3종 coding-style/interaction/security(L21) · MEMORY.md 2계층화·monitoring SPLIT(L23) · 모든 hooks 변경 hardGate/skillGate/ethical/settings(L19) · 글로벌 MCP(L20)
- mandatory-docs는 #196이 추가로 "overturn … 레이어 상이로 KEEP" 명시

### ❌ 진짜 누락 (silent omission — plan·6커밋 어디에도 분류 안 됨)
1. **`deploy-with-tests.md` (가장 명백, 두 에이전트 합의)** — plan·6커밋 언급 **0건**. 부재 backend 단계(`cd src/backend && python -m pytest`)가 잔존. **결정적**: diet는 동일한 "src/backend·dashboard 부재(AOS-import 잔재)" 패턴을 build-fix(#195)·tddGuard(#194)·explore/draft-commits(#197)에서 **전담 제거 캠페인**으로 처리했는데, 똑같은 패턴의 이 파일만 빠짐 = 일관성 갭.
2. **`skill-rules.json` §3 SHRINK (두 에이전트 합의)** — 데드 fileTrigger(firebase/train/seoul/location/notification glob 0매치)·과넓은 트리거. plan의 'skill-rules' 언급은 "react-web-development-aos 미참조" 정당화일 뿐 액션 아님. commands-registry와 **별개 파일**인데 DEFER에서 누락. 마지막 변경 cba130f(diet 이전).
3. **`review.md`↔`code-review.md` 단일화 (판정 경계 — 에이전트 불일치)** — master는 DEFERRED(파일이 무관한 이유로 touch됨), hunter는 OMITTED(단일화 액션 자체는 어디에도 명시 없음). 두 파일에 가한 변경은 verify-loop rename·gemini 참조 제거 같은 **무관한 댕글링 정리뿐**, 단일화 의도는 추적된 적 없음.

### 결론
NOT_DONE의 압도적 다수는 **설계된 DEFER**(누락 아님). 단 **명백한 silent omission 2건**(`skill-rules.json`, `deploy-with-tests.md`) + 판정 경계 1건(`review` 단일화)이 존재. **`deploy-with-tests.md`가 가장 시급** — 외래물 제거 캠페인이 같은 패턴 한 파일을 놓친 것이라, 의도적 보류가 아니라 진짜 실수.

### 처리 결과 (2026-06-14, 같은 세션 후속)
omission 수정 중 **cross-reference 스캔**(메모리: "제거 후 grep 스캔은 별도 단계")이 보고서가 enumerate하지 않은 AOS-import 잔재를 추가로 드러냄. 처리:
- ✅ `deploy-with-tests.md` — 부재 `src/backend` Python pytest 단계 → `cd functions && npx tsc --noEmit`(실 백엔드=Firebase Functions).
- ✅ `build-error-resolver.md` (cross-ref 신규 발견) — AOS `src/dashboard`+`src/backend` 감지 → 루트 RN + `functions/` 구조.
- ✅ `execute-tasks-file.md` (cross-ref 신규 발견, broken command) — 명령 전체가 부재 `phase_runner.py`/`src/backend/.venv`/`vitest`에 의존. **실제 LiveMetro tasks.md 스키마는 phase_runner의 waves 그래프가 아닌 단일-phase 기술자**(phase/status/parallelizable/dependencies/verification + 체크박스)로 확인됨 → 네이티브 절차(dispatching-parallel-agents + jest verification-loop)로 재작성. `livemetro-workflow.md` 참조는 이미 네이티브 계약이라 무변경.
- 🟡 `.claude/evals/README.md`(예시 경로)·`_aos-imports/`(의도적 격리) — 미처리(저영향/의도적).
- ❌ `skill-rules.json` 데드 fileTrigger — 별도 처리 대기.

검증: 3파일 전부 외래 의존 grep 0. (마크다운 harness 파일이라 tsc/lint/test 비대상.) **미커밋** — detached HEAD + 평행 세션 WIP(알림시간대/출퇴근 기능) 공존으로 자동 커밋 보류.
