# harness-diet 실행 계획 (2026-06-07)

`harness-legacy-scan` 리포트(`dev/harness-legacy-scan-report.md`) §8 low-risk 목록 중 **CLAUDE.md + .claude/skills/ 범위**만 적용. 영구삭제·hooks·MCP·권한·앱코드·테스트실행 금지. 불확실 항목은 수동 보류.

## APPLY (이번 단계)
1. **Archive** (`git mv` → `.claude/archive/harness-diet-2026-06-07/`, 영구삭제 아님)
   - `.claude/skills/react-web-development-aos/` (RN 앱에 web 스킬, skill-rules.json 미참조)
   - `.claude/commands/verify-loop.md` (AOS-import: src/backend·src/dashboard 참조, verify-app 중복)
   - `.claude/commands/run-workflow.md` (AOS-import: npm run dev, placeholder description, start-dev 중복)
2. **Dangling-ref 정리**
   - `/verify-loop` → `/verify-app` (code-review.md, plan.md, tdd.md)
   - `run-workflow` 엔트리 제거 (commands-registry.json)
3. **CLAUDE.md** 사실오류/stale 수치 정정 (rules "7개"→정확화, 커맨드/스킬 하드코딩 수치 제거)
4. **Skill 명확화** (4개): "사용하지 말아야 할 때" 섹션 추가 + description 레이어 경계 명시
   - station-info(소비자 조회) / subway-data-processor(정규화) / route-fare-calculation(경로·요금) / api-integration(외부 호출)

## DEFER (수동 승인 필요)
- `build-fix.md` 아카이브 (verificationGuard.js 훅이 `/build-fix` 참조 → 훅 편집 필요, 금지)
- 모든 hooks 변경(tddGuard/hardGate/skillGate/gemini/ethical/settings.json)
- MCP(.mcp.json memory/context7), 권한
- 글로벌 `~/.claude/rules/` (interaction/security/coding-style) — 범위 밖
- 프로젝트 `.claude/rules/` SHRINK/MOVE (livemetro-functions→functions/CLAUDE.md 등) — 범위 밖
- MEMORY.md 2계층 분할, 모든 SKILL.md SPLIT (긴 스킬은 stale 콘텐츠 선검토 필요)
- commands-registry.json 구조 변경, skill 내 stale 콘텐츠 정정(route-fare A*, subway-data-processor 타입)
