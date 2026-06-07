# Claude Code 파워유저 활용 가이드: CLAUDE.md · Skills · Hooks

> **리서치 산출물** — 2026-06-07 생성. `deep-research` 멀티에이전트 워크플로우(웹 검색 fan-out → 출처 fetch → **3표 적대적 검증** → 합성)로 작성.
> 질문: "Claude Code 사용자들이 CLAUDE.md / Skill / Hook을 어떻게 다르게 쓰는가 — 효과적 패턴, 파워유저 기법, 흔한 실수."

## 검증 방법론 & 신뢰도

- 22개 출처 fetch → 110개 주장 추출 → 적대적 검증(주장당 회의론자 3명, 2/3 반박 시 폐기).
- **✅ 고신뢰**: 공식 문서 출처 + 3-0/2-0 만장일치 검증 통과 (약 17건).
- **⚠️ 논쟁적/미확정**: 검증자 일부만 가동(서버 rate-limit) + 반박 표 존재 (hook 2건, GitHub 이슈 출처).
- **검증 불가(이번 회차)**: claude.com/blog 4건은 서버 rate-limit로 검증 중단 — *반박된 것이 아니라 표를 못 모음*. 별도 표기.

| 단계 | 수치 |
|------|------|
| 검색 각도 | 5 |
| fetch 출처 | 22 |
| 추출 주장 | 110 |
| 검증 시도 | 35 (25 + 재검증 10) |
| ✅ 확정 | ~17 |
| ⚠️ 논쟁적 | 2 |
| 검증 불가 | 4 |

---

## 메타 패턴: 세 기능의 역할 분담

세 기능은 "언제 로드되는가"와 "지키는 것이 보장되는가"라는 두 축으로 명확히 갈린다. 파워유저는 이 차이를 정확히 이해하고 각 정보를 올바른 그릇에 담는다.

| 기능 | 로딩 시점 | 강제력 | 담아야 할 것 |
|------|-----------|--------|--------------|
| **CLAUDE.md** | 매 세션 항상 로드 | 권고적(advisory) — 준수 보장 없음 | 항상 적용되는 **사실(facts)** |
| **Skill** | 필요할 때 on-demand | 권고적(advisory) | 가끔 쓰는 도메인 **절차(procedures)** |
| **Hook** | 이벤트 발생 시 결정적 실행 | 결정적(deterministic) — 실행 보장 | 예외 없이 **반드시 일어나야 할 동작** |

- CLAUDE.md는 시스템 프롬프트가 아니라 그 뒤에 **user message로 전달**되는 컨텍스트다. Claude가 읽고 따르려 하지만, 특히 모호하거나 상충하는 지시에 대해서는 엄격한 준수가 보장되지 않는다 ✅ ([memory](https://code.claude.com/docs/en/memory)).
- 따라서 "반드시 일어나야 하는" 동작은 CLAUDE.md가 아니라 Hook으로 옮겨야 한다. Hook은 권고적 지시와 달리 결정적이며 동작을 보장한다 ✅ ([best-practices](https://code.claude.com/docs/en/best-practices)).
- CLAUDE.md 섹션이 "사실"이 아니라 "절차"로 자라났다면 그것은 Skill로 분리하라는 신호다 ✅ ([skills](https://code.claude.com/docs/en/skills)).

---

## 1. CLAUDE.md

### (1) 효과적 패턴 / 베스트 프랙티스

- **파일당 200줄 미만 유지**. 긴 파일은 컨텍스트를 더 소모하고 준수율을 떨어뜨린다 ✅ ([memory](https://code.claude.com/docs/en/memory)).
- **항상 광범위하게 적용되는 규칙만 담는다**. 매 세션 로드되므로, 가끔만 관련 있는 도메인 지식/워크플로우는 Skill로 보낸다 ✅ ([best-practices](https://code.claude.com/docs/en/best-practices)).
- **강조어로 준수율을 높인다**. `IMPORTANT`, `YOU MUST` 같은 표현이 adherence를 개선한다 ✅ ([best-practices](https://code.claude.com/docs/en/best-practices)).

### (2) 파워유저 기법

- **줄 단위 가지치기 테스트**: 각 줄마다 "이 줄을 지우면 Claude가 실수를 하게 되는가?"를 묻는다. 아니라면 잘라낸다 ✅ ([best-practices](https://code.claude.com/docs/en/best-practices)).
- **사실 vs 절차 분류**: CLAUDE.md 한 섹션이 절차로 비대해졌으면 Skill로 추출. 같은 multi-step 지시를 반복해서 붙여넣고 있다면 그것도 Skill 신호다 ✅ ([skills](https://code.claude.com/docs/en/skills)).
- **권고를 결정으로 승격**: 절대 어기면 안 되는 규칙은 CLAUDE.md 텍스트가 아니라 Hook으로 변환한다 ✅ ([best-practices](https://code.claude.com/docs/en/best-practices)).

### (3) 흔한 실수 / 안티패턴

| 안티패턴 | 증상 | 해결 |
|----------|------|------|
| **Over-specified / bloated CLAUDE.md** | 파일이 너무 길어 중요한 규칙이 노이즈에 묻히고 Claude가 절반을 무시 | 무자비하게 가지치기(ruthlessly prune) ✅ ([best-practices](https://code.claude.com/docs/en/best-practices)) |
| **사실에 절차를 섞음** | 섹션이 점점 multi-step 가이드로 비대 | Skill로 분리 ✅ ([skills](https://code.claude.com/docs/en/skills)) |
| **"반드시"를 텍스트로만 명시** | advisory라 준수 보장 안 됨 | Hook으로 결정적 강제 ✅ ([best-practices](https://code.claude.com/docs/en/best-practices)) |

> 핵심 경고: bloated CLAUDE.md는 실제 지시를 **무시하게 만든다**. 길수록 잘 지키는 게 아니라 그 반대다 ✅.

---

## 2. Skills

### (1) 효과적 패턴 / 베스트 프랙티스

- **SKILL.md 본문 500줄 미만**. 상세 레퍼런스는 별도 파일로 분리한다. 스킬이 로드되면 그 내용은 turn을 넘어 컨텍스트에 남아 **매 줄이 반복 토큰 비용**이 된다 ✅ ([skills](https://code.claude.com/docs/en/skills), [agent-skills/best-practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)).
- **Progressive disclosure 3단계 설계**: (1) Claude가 관련성을 판단하는 name+description, (2) SKILL.md 본문, (3) 필요할 때만 로드되는 링크된 reference 파일 ✅ ([agent-skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)).
- **description은 3인칭으로, "무엇을 하는가" + "언제 쓰는가"를 모두 포함** ✅ ([agent-skills/best-practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)).

### (2) 파워유저 기법

- **메타데이터 = 트리거 엔진**: 스킬 작성의 핵심은 YAML frontmatter의 name과 description을 다듬는 것이다. Claude는 이 메타데이터로 스킬을 트리거/로드할지 결정한다 ✅ ([agent-skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)).
- **핵심 use case를 맨 앞에, 자연어 키워드 포함**: description + when_to_use 결합 텍스트는 스킬 목록에서 **1,536자에서 잘린다**. 가장 중요한 용례를 앞에 배치하라 ✅ ([skills](https://code.claude.com/docs/en/skills)).
- **CLAUDE.md → Skill 전환 판단**: 같은 지시/체크리스트/multi-step 절차를 반복 붙여넣거나, CLAUDE.md 섹션이 사실이 아닌 절차로 자랐을 때 Skill을 만든다 ✅ ([skills](https://code.claude.com/docs/en/skills)).

### (3) 흔한 실수 / 안티패턴

| 안티패턴 | 문제 | 해결 |
|----------|------|------|
| **Monolithic / oversized SKILL.md** | 500줄 한계 초과, 컨텍스트 낭비 | 별도 파일로 split, SKILL.md에서 이름으로 참조 ✅ ([agent-skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills), [agent-skills/best-practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)) |
| **모호한 description** | "Helps with documents" 같은 표현은 트리거 실패 유발 | 3인칭 + 무엇/언제 명시 ✅ ([agent-skills/best-practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)) |
| **reference 중첩 과다** | one-level보다 깊은 reference는 부분만 읽힘(head -100 미리보기) → 정보 누락 | reference는 SKILL.md에서 **one level deep**로 유지 ✅ ([agent-skills/best-practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)) |

---

## 3. Hooks

### (1) 효과적 패턴 / 베스트 프랙티스

- **결정적 제어가 본질**: Hook은 LLM이 실행을 "선택"하기를 기대하는 대신, 특정 동작이 **항상 일어나도록** 보장한다. 규칙 강제, 작업 자동화, 도구 통합에 쓴다 ✅ ([hooks-guide](https://code.claude.com/docs/en/hooks-guide)).
- **정석 패턴(canonical patterns)** ✅ ([hooks-guide](https://code.claude.com/docs/en/hooks-guide)):
  - PostToolUse `Edit|Write` → 편집 후 **auto-format**
  - PreToolUse exit-2 → **보호 파일 편집 차단**
  - Notification → **알림**
  - SessionStart → **compaction 후 컨텍스트 재주입**

### (2) 파워유저 기법

**Exit code를 활용한 제어 흐름** ✅ ([hooks-guide](https://code.claude.com/docs/en/hooks-guide)):

| Exit code | 동작 |
|-----------|------|
| `0` | 진행. **UserPromptSubmit / SessionStart**에서는 stdout이 Claude 컨텍스트에 주입됨 |
| `2` | **차단**. stderr에 이유를 쓰면 Claude가 피드백으로 받음 |
| 그 외 | 에러와 함께 진행 |

- **stdout 주입으로 동적 컨텍스트 공급**: exit 0 + UserPromptSubmit/SessionStart 조합으로 매 프롬프트/세션 시작 시 최신 정보를 컨텍스트에 밀어넣을 수 있다 ✅.
- **exit 2 + stderr로 피드백 루프**: 단순 차단이 아니라 "왜 막혔는지"를 Claude에게 전달해 스스로 교정하게 만든다 ✅.
- **CLAUDE.md 규칙의 Hook 승격**: advisory 규칙 중 zero-exception이어야 하는 것을 Hook으로 옮기면 보장된다 ✅ ([best-practices](https://code.claude.com/docs/en/best-practices)).

### (3) 흔한 실수 / 안티패턴

| 안티패턴 | 문제 | 신뢰도 / 비고 |
|----------|------|-------------|
| **환경변수로 도구 데이터 기대** | `$TOOL_NAME`, `$TOOL_ARGS` 등 env-var로 데이터를 읽으려 하면 hook이 조용히 무동작. Claude Code는 JSON payload를 hook의 **stdin으로 pipe**함 → stdin에서 JSON 파싱해야 함 | ⚠️ 논쟁적 (0-1). 단, **본 레포 `ethicalValidator.js`가 실제로 stdin JSON을 파싱**(`process.stdin … JSON.parse`)하므로 메커니즘 자체는 로컬 코드로 확증됨 ([issue #6305](https://github.com/anthropics/claude-code/issues/6305)) |
| **auto-allow 도구를 PreToolUse hook으로 가드 시도** | `permissions.allow`에 등록된 도구는 PreToolUse hook 파이프라인을 우회할 수 있어 보안 가드레일로 부적합할 수 있음 | ⚠️ 논쟁적 (0-1). 공식 문서로 교차 확인 권장 ([issue #6305](https://github.com/anthropics/claude-code/issues/6305)) |

---

## 검증 불가 (이번 회차 — 반박된 것 아님)

서버 rate-limit로 검증자가 가동되지 못해 표를 모으지 못한 주장 (출처: [claude.com/blog](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills)). 추후 재검증 대상:

- 검증(verification) 스킬이 Claude 출력 품질에 내부적으로 가장 큰 측정 효과를 냈다.
- 스킬 description은 사람 가독성보다 **모델 발견(model discovery)**을 위해, 명시적 호출 트리거 중심으로 작성해야 한다.
- 스킬에서 가장 가치 높은 섹션은 **Gotchas** — 실제 실패 지점에서 만들고 시간이 지나며 갱신.
- 스킬 과잉명세("railroading") 안티패턴 — 좋은 스킬은 기본 코딩을 설명하지 않고 Claude를 평소 사고에서 끌어낸다.

---

## 출처

| # | 출처 | 등급 |
|---|------|------|
| 1 | [CLAUDE.md / Memory](https://code.claude.com/docs/en/memory) | 공식 ✅ |
| 2 | [Best Practices](https://code.claude.com/docs/en/best-practices) | 공식 ✅ |
| 3 | [Skills](https://code.claude.com/docs/en/skills) | 공식 ✅ |
| 4 | [Hooks Guide](https://code.claude.com/docs/en/hooks-guide) | 공식 ✅ |
| 5 | [Agent Skills Best Practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices) | 공식 ✅ |
| 6 | [Equipping Agents for the Real World with Agent Skills (Anthropic Engineering)](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) | 공식 ✅ |
| 7 | [Lessons from building Claude Code: how we use skills](https://claude.com/blog/lessons-from-building-claude-code-how-we-use-skills) | 공식 (검증 불가) |
| 8 | [claude-code GitHub Issue #6305](https://github.com/anthropics/claude-code/issues/6305) | 커뮤니티 ⚠️ |
