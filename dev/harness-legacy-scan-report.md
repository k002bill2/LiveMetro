# Harness Legacy Scan — 읽기 전용 감사 리포트

> 생성: 2026-06-07 · 워크플로우 `harness-legacy-scan` (Run `wf_05974fe2-07b`)
> 규모: 36개 설계 에이전트(실측 109 spawn) · 4.39M 토큰 · 35분 · 1,469 tool calls
> 모드: **READ-ONLY** — 이 감사는 어떤 하네스 파일/훅/MCP/권한도 변경하지 않았다. 분류만 수행.

파이프라인: **Inventory(37항목) → Analysis(202 findings / 32에이전트) → Planning(106 분류 / dedup) → Adversarial(75 반박)**

분류 에이전트는 전부 `agentType: 'Plan'`(Edit/Write 도구 없음)으로 띄워 읽기 전용을 도구 수준에서 강제했다.

---

## ⚠️ 핵심 메타-발견 (먼저 읽을 것)

### M1. 항상-로드 컨텍스트 세금 ≈ 800줄은 **실재한다** (검증됨)
이 리포트를 생성한 세션의 시스템 컨텍스트(`claudeMd` 블록)에 다음이 **실제로 전부 주입**되어 있음을 직접 확인했다:
- 글로벌 `~/.claude/CLAUDE.md`(3) + 글로벌 rules 7개(≈261)
- 프로젝트 `CLAUDE.md`(94) + 프로젝트 `.claude/rules/` 10개(≈243)
- `MEMORY.md` 인덱스(199)

→ **매 세션 ≈ 800줄**. Inventory가 "MEMORY.md는 항상-로드 아님"이라 한 분류와, 일부 Adversarial이 "rule 주입 메커니즘이 없다(@import 부재)"고 한 반박은 **둘 다 사실과 다르다**. Claude Code는 `~/.claude/rules/`와 `<repo>/.claude/rules/`를 네이티브로 자동 주입하며, 프로젝트 메모리도 자동 주입한다. 따라서 컨텍스트 절감 기회는 **진짜다**.

### M2. 그러나 Adversarial이 "무엇을" 줄일지는 바로잡았다
Adversarial 75건 판정: **UPHOLD 3 / MODIFY 57 / REVERSE 15**. Planner의 "이 rule들을 줄여라" 제안 다수가 **개별 검증에서 근거 오류로 철회**됐다. 특히 `path-aliases`, `typescript-strict`, `subscription-cleanup`, `error-handling`, `livemetro-workflow`(프로젝트) 및 `date-calculation`, `golden-principles`, `verification`(글로벌)은 "기계적으로 강제되니 불필요/네이티브 중복"이라는 전제가 **실제 설정과 불일치**해 KEEP으로 뒤집혔다.

> 교훈: 컨텍스트 세금은 실재하지만, **블랭킷 삭제는 위험**하다. 안전한 절감은 (a) 명백히 깨진/미사용 항목 제거, (b) 도메인 한정 rule을 온디맨드(Skill·서브디렉토리 CLAUDE.md)로 이동, (c) 거대 인덱스(MEMORY.md) 2계층화 — 이 셋에 집중.

### M3. 최종 분류 분포 (Adversarial 반영 후)
`KEEP 46 · SHRINK 43 · DELETE 6 · CONVERT 5 · SPLIT 4 · MOVE 2` (Adversarial이 43건의 Planner action을 변경)
위험도: `LOW 65 · MEDIUM 38 · HIGH 3` · 자동화 가능: `auto 13 · manual 93`

---

## 1. 전체 요약

LiveMetro는 RN/Expo 단일 앱이지만 하네스는 **코드베이스 대비 과적재**다:
- **항상-로드 ≈ 800줄**(rules 17개 + CLAUDE.md + MEMORY.md) — 작업 무관 세션에도 상시 비용.
- **ON_DEMAND**: Skill 22개(SKILL.md 합 ≈ 3,968줄, 63~340줄 편차), 슬래시 커맨드 30개, 서브에이전트 11개.
- **EVENT_TRIGGERED**: 훅 16개가 PreToolUse(Edit/Write에 6훅 체인)·PostToolUse·UserPromptSubmit·SubagentStop·SessionStart/End 전 이벤트에 다중 연결.
- **REFERENCE**: skill-rules.json(632) + 레지스트리 2개 + MCP 설정 3개.

가장 두꺼운 부채 패턴 4가지:
1. **제품기능 중복** — plan/review/code-review/security 계열 커맨드·에이전트가 네이티브 플랜 모드·`/review`·`/security-review`·서브에이전트와 겹침. 훅 일부(hardGate/tdd/skillGate/verification)도 네이티브 플랜·검증·Skill 자동탐색과 겹침.
2. **명백히 깨진/고아 항목** — 존재하지 않는 경로를 참조하는 stale 커맨드·훅·외래 Skill.
3. **항상-로드 과적재** — 도메인 한정 rule(functions/api/RN)이 무관 세션에도 주입.
4. **MCP 중복** — `.mcp.json`의 `memory` 서버(잘못된 패키지명 추정 + 미사용)가 파일기반 MEMORY와 중복, `context7`은 글로벌 상속과 이중.

**권고 자세**: 과감하되 안전장치는 보존. 6건 DELETE + 5건 CONVERT는 거의 순이득(대부분 깨진/미사용). 43건 SHRINK는 점진. KEEP 46건(특히 안전 훅·기계강제 rule)은 건드리지 말 것.

---

## 2. 유지해야 할 항목 (KEEP — 46건, 핵심만)

**안전 필수 (절대 KEEP):**
- `.claude/hooks/pathProtection.js` — fail-closed 경로 보호, 오탐 방지 우수.
- `.claude/hooks/ethicalValidator.js` (코어) — secret/위험명령 차단. *(단, macOS 오탐 유발 Windows 패턴만 SHRINK 후보 → §7)*
- `.claude/hooks/outputSecretFilter.js` — 출력 시크릿 필터.
- `.claude/rules/seoul-api-limits.md`의 rate-limit/timeout 코어 — 실제 반복 실수(429 차단) 방어. *(BANNED 표 일부만 SHRINK)*
- `.claude/rules/subscription-cleanup.md` — Adversarial REVERSE: react-native-patterns의 cleanup 1케이스보다 **상위집합**(5개 독립 카테고리). 병합하면 손실.

**기계강제처럼 보이지만 실제론 텍스트 규칙이 필요 (Adversarial REVERSE로 KEEP):**
- `.claude/rules/path-aliases.md` — tsconfig paths는 "해석"만 보장하고 상대경로 사용을 **금지하지 못함**. 규칙 유지 가치 있음.
- `.claude/rules/typescript-strict.md` — `strict:true`는 implicit any만 잡음. 명시적 `: any`/`as any`는 합법 → 규칙이 잡는 것.
- `.claude/rules/error-handling.md` — skill-rules.json fileTrigger로 온디맨드처럼 동작, 빈배열/null 정책은 고유.
- `.claude/rules/livemetro-workflow.md` — Skill 라우팅 9행 중 훅은 3행만 강제. 라우팅 SSOT로 KEEP.

**글로벌 (Adversarial REVERSE로 KEEP, 단 §M2 caveat):**
- `~/.claude/rules/date-calculation.md`, `golden-principles.md`, `verification.md` — Planner는 "네이티브 중복"이라 SHRINK 제안했으나 근거(주입 안 됨/훅이 대체)가 거짓으로 판정 → KEEP. **사용자 판단 포인트**: 컨텍스트 절감을 원하면 이 3개가 1순위 SHRINK 후보지만, 근거를 정확히("네이티브 동작과 중복" 검증) 세운 뒤에만.

**기타 KEEP:** `firebase-integration`, `notification-system`, `location-services`, `test-automation`, `verification-loop` 등 실제 코드 도메인과 정합하는 Skill, `run-eval`/eval 시스템(고유), `settings.local.json`(sandbox 전제 + WebFetch 스코프 모범적), `AGENTS.md`(CLAUDE.md 심링크 — 정상).

---

## 3. 줄여야 할 항목 (SHRINK — 43건, 대표)

| 경로 | 문제 | 위험 | auto |
|------|------|------|------|
| `CLAUDE.md`(프로젝트) | "rules 항상 로드" 사실오류 정정 + 중복 표/요약 축소 | MED | no |
| `.claude/rules/react-native-patterns.md` | RN BANNED의 **SSOT 허브**로 삼고 path-aliases/cleanup 중복 흡수 | MED | no |
| `.claude/rules/mandatory-docs.md` | 습관성 "반드시 Read" 문구는 네이티브와 충돌 → 축소, 라우팅 인덱스 역할만 보존 | MED | no |
| `.claude/rules/coverage-thresholds.md` | 문서-게이트 불일치(잘못된 임계값 주입 위험). jest.config SSOT 참조로 | MED | no |
| `.claude/rules/seoul-api-limits.md` | rate-limit 코어 KEEP, BANNED 표는 api-integration Skill로 | MED | no |
| `~/.claude/rules/interaction.md` | 스타일 취향→output-style, context7→MCP 자동. State Assumptions만 잔존 | LOW | **yes** |
| `~/.claude/rules/security.md` | 시크릿 코어 보존, RN 무관 체크리스트 + 네이티브 중복 프로토콜 축소 | MED | no |
| `.claude/skills/route-fare-calculation` | 삭제된 A* 등 stale 정정 + File Map 갱신(잘못된 코드 유도 방지) | MED | no |
| `.claude/skills/subway-data-processor` | stale 타입 정정 + 과넓은 description 축소 | MED | no |
| `.claude/skill-rules.json` | 데드 fileTrigger + 과넓은 트리거 + 레지스트리 불일치 정리 | MED | no |
| `.claude/commands/review.md` ↔ `code-review.md` | 이중 채점 표 → checklists SSOT 참조, 둘을 단일화 | MED | no |
| `.claude/commands/deploy-with-tests.md` | 부재 backend 단계만 제거, RN/EAS 부분 보존 | MED | no |

---

## 4. 전역 지침 → Skill/도메인으로 옮길 항목 (MOVE)

| 경로 | 추천 위치 | 근거 |
|------|----------|------|
| `.claude/rules/livemetro-functions.md`(48줄) | `functions/CLAUDE.md` (서브디렉토리 자동 컨텍스트) 또는 `firebase-integration` Skill | functions/ 진입 시에만 자동 로드 → always-load 비용 제거. mandatory-docs 라우팅은 유지 |
| `~/.claude/rules/coding-style.md` | 온디맨드 coding-style Skill 또는 skill `reference.md` | orphan + golden-principles와 광범위 중복. 코드 예제는 온디맨드가 적합 |

> 추가 MOVE 후보(점진): `coverage-thresholds`(→test-automation), `react-native-patterns` 일부(→react-native-development), `seoul-api-limits` BANNED 표(→api-integration). 모두 "도메인 작업 시에만 필요"한데 항상 로드되는 패턴.

---

## 5. Skill → reference.md / examples.md 로 분리할 항목 (SPLIT)

| 경로 | 분리 방식 |
|------|----------|
| `MEMORY.md`(199줄, 평면 인덱스) | **2계층화**: 코어 항상-로드(최근/핵심 포인터) + 도메인별 reference로 분산. 가장 큰 상시 인덱스 비용 절감 |
| `.claude/skills/monitoring-observability`(330줄) | 내부 흐름을 별도 `references/internals.md`로, SKILL.md 본문 슬림화 |
| `.claude/skills/cc-feature-implementer-main` | name 불일치(자동탐색 깨짐) 정정 + 과넓은 트리거 축소 + 중복 체크리스트 reference 이동 |

> 300줄+ Skill 추가 분리 후보: `route-fare-calculation`(340), `audio-accessibility`(302), `crowdsourced-congestion`(273), `theme-i18n-system`(254), `user-trust-reputation`(247), `statistics-analytics`(241). 단 §6/§7에서 일부는 미사용 검토가 먼저.

---

## 6. 삭제 후보 (DELETE — 6건)

| 경로 | 신뢰도 | 위험 | 근거 |
|------|--------|------|------|
| `.claude/skills/react-web-development-aos/SKILL.md` | HIGH | LOW | 프로젝트 부적합 외래 Skill(RN 앱에 web). 미사용 + 의존성 부재 + 오활성 |
| `.claude/skills/react-web-development-aos/references/react-patterns.md` | HIGH | LOW | 위 Skill 하위 참조 동반 제거 |
| `.claude/commands/verify-loop.md` | HIGH | LOW | stale 경로(동작 불가) + `verify-app` 중복 + 고아 |
| `.claude/commands/run-workflow.md` | HIGH | LOW | 잘못된 명령 + placeholder description + `start-dev` 중복 |
| `.claude/hooks/tddGuard.js` | HIGH | LOW* | 데드 훅(존재하지 않는 경로 참조, 안전효과 0). **단 settings.json PreToolUse 체인에 연결 → §7로 승격** |
| `.claude/commands-registry.json` | MED | MED | 네이티브 frontmatter 자동탐색이 대체. drift 심함. sync-registry CONVERT와 연동 |

> `.claude/commands/build-fix.md`는 CONVERT(존재하지 않는 경로 참조로 동작 불가, 네이티브 build-fix로 대체).

---

## 7. 사람이 직접 승인해야 하는 위험한 변경 (hooks / settings / mcp / 안전)

이 항목들은 **상호의존**(훅 ↔ settings.json 체인)이거나 안전·권한 핵심이라 절대 자동 처리 금지.

**훅 (settings.json 체인과 묶여 단독 변경 시 PreToolUse 파손):**
- `tddGuard.js` DELETE — 데드지만 settings.json에서 참조 제거를 **함께** 해야 함.
- `hardGateGuard.js` → 네이티브 플랜 모드가 더 정밀하게 대체, 현재 plan 파일 1개로 사실상 무력. DELETE 후보지만 플랜 정책 변경.
- `skillGateGuard.js` → 네이티브 Skill 자동탐색과 동일 목적, 세션 첫 편집 차단은 마찰. DELETE 후보지만 livemetro-workflow 라우팅 SSOT와 연동.
- `geminiAutoTrigger.js` → 자동 트리거를 온디맨드 `/gemini-review`로 CONVERT(외부 호출 비용·산출물 누적 제거).
- `fileLock.js` → ROI 낮으나 gemini-bridge 병렬 충돌 방지 실효 + fail-open 무해. **보수적 KEEP** 권고.
- `ethicalValidator.js` SHRINK — 코어(git/db/secrets/위험명령)는 **절대 KEEP**, macOS 오탐 유발 Windows 패턴만 제거.

**권한/설정:**
- `.claude/settings.json` (HIGH risk) — 위 훅 결정 반영 + PreToolUse 6훅 체인을 **안전 필수 2~3훅 중심**으로 축소. 권한 자세(와일드카드 스코프·스킵 플래그) 재검토.
- `.mcp.json` (MED) — `memory` 서버(잘못된 패키지 + 미사용 + 파일기반 중복) 제거, `context7`은 글로벌 상속과 이중.
- `~/.claude/mcp.json`(글로벌) (MED) — 미사용/네이티브 중복 서버 정리.

---

## 8. /harness-diet 로 넘겨도 되는 low-risk 변경 (auto, hooks/settings/mcp 제외)

전부 신뢰도 높고 위험 LOW이며 훅 체인과 무관 — 안전하게 자동 처리 가능:

1. **DELETE** `.claude/skills/react-web-development-aos/` (SKILL.md + references/react-patterns.md) — 외래 미사용 Skill 전체.
2. **DELETE** `.claude/commands/verify-loop.md` — 깨진 고아 커맨드(verify-app 중복).
3. **DELETE** `.claude/commands/run-workflow.md` — 깨진 placeholder(start-dev 중복).
4. **CONVERT/DELETE** `.claude/commands/build-fix.md` — 동작 불가 stale 커맨드.
5. **SHRINK** 프로젝트 `CLAUDE.md` — 3줄 graphify 포인터 등 네이티브 Skill 자동탐색이 대체하는 군더더기.
6. **SHRINK** `~/.claude/rules/interaction.md` — 스타일 취향(→output-style)·context7 안내(→MCP 자동) 줄 삭제, State Assumptions만 잔존.

> ⚠️ 제외: `tddGuard.js`/`commands-registry.json`은 auto 플래그가 있었으나 settings.json·sync-registry 연동 때문에 §7(수동)로 이동시켰다.

---

## 9. /harness-diet 실행용 추천 프롬프트

```
/harness-diet 를 LOW-RISK 모드로 실행해줘. 아래 6개 항목만 처리하고, hooks·settings.json·.mcp.json·권한은 절대 건드리지 마.
각 변경은 개별 커밋으로 분리하고, 변경 전 git status가 clean한지 확인해.

DELETE:
1. .claude/skills/react-web-development-aos/ (디렉토리 전체 — 외래 미사용 Skill, RN 앱에 web 스킬)
2. .claude/commands/verify-loop.md (깨진 고아, verify-app 중복)
3. .claude/commands/run-workflow.md (깨진 placeholder, start-dev 중복)

CONVERT/검토 후 제거:
4. .claude/commands/build-fix.md (존재하지 않는 경로 참조로 동작 불가 — 네이티브 build-fix로 대체 가능한지 확인 후 제거)

SHRINK (줄 삭제만, 의미 보존):
5. CLAUDE.md — 네이티브 Skill 자동탐색이 대체하는 graphify 포인터/군더더기 축소 (단 rules·docs 라우팅 표는 유지)
6. ~/.claude/rules/interaction.md — 출력 스타일 취향·context7 안내 축소, "State Assumptions Before Coding"은 보존

처리 후:
- skill-rules.json / commands-registry.json 에 삭제된 항목 참조가 남으면 그 참조도 정리 (단 레지스트리 구조 자체는 변경 금지 — 별도 승인 필요)
- 각 삭제가 다른 커맨드/Skill/문서에서 참조되는지 grep으로 먼저 확인 (cross-reference scan)
- 완료 후 tsc/lint/test는 영향 없어야 하지만 /verify-app 으로 회귀 확인

이번에는 §7(hooks/settings/mcp/권한)과 §3 SHRINK 중 risk=MEDIUM 항목은 건드리지 마. 그건 별도 세션에서 사람 승인 후.
```

---

## 부록 A. 통계

- Findings 202건 (lens별: GlobalContextTax 51 · SkillQuality 96 · ProductOverlap 39 · SafetyPermission 16)
- Planner 분류 106건 → Adversarial이 43건 action 변경 (REVERSE 15 · MODIFY 57 · UPHOLD 3)
- 최종: KEEP 46 · SHRINK 43 · DELETE 6 · CONVERT 5 · SPLIT 4 · MOVE 2

## 부록 B. Adversarial이 보존(REVERSE)시킨 항목 — 줄이면 위험
date-calculation, golden-principles, verification(글로벌) · path-aliases, typescript-strict, subscription-cleanup, error-handling, livemetro-workflow(프로젝트) · agent-improvement, station-info, theme-i18n-system(Skill) · dev-docs, gemini-scan, sync-registry(커맨드). 각 항목은 "이 변경이 막아주던 실제 실수가 되살아남" 또는 "전제가 사실과 불일치"로 반박됨.

## 부록 C. 범위 메모
- `.cursor/rules/**`: 부재 (Cursor 미사용).
- `.claude/workflows/**`: 부재 (이 워크플로우는 동적 인라인 실행).
- 글로벌 `~/.claude/skills/` 62개: 본 감사 범위(프로젝트 `.claude/skills/**`) 밖 — 별도 감사 권장.
