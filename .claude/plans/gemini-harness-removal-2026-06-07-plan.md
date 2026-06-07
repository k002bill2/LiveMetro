# Gemini CLI 하네스 완전 제거 계획 (2026-06-07)

`harness-diet-2026-06-07-plan.md`가 DEFER로 미뤘던 **Gemini CLI 연동 전면 제거**를 사용자 명시 승인하에 실행.
방식: **완전 삭제(git rm)** · **GEMINI.md 포함**.

## DELETE (Gemini 전용)
- `.claude/gemini-bridge/` — 런타임 상태 dir (gitignore·미추적) → `rm -rf` (git 변경 없음)
- `.claude/scripts/gemini-bridge.js` — 브릿지 본체
- `.claude/hooks/geminiAutoTrigger.js` — PostToolUse 트리거 (depend 테스트 없음)
- `.claude/commands/gemini-review.md`, `.claude/commands/gemini-scan.md`
- `GEMINI.md` — Gemini CLI 프로젝트 컨텍스트

## EDIT (공유 파일 surgical)
- `.claude/settings.json` — PostToolUse Edit|Write의 geminiAutoTrigger 블록 제거 (fileLock release만 잔존)
- `.claude/hooks/userPromptSubmit.js` — `checkPendingGeminiReviews`/`extractReviewSummary` 함수 + 호출부(40-42) 제거
- `.claude/hooks/fileLock.js:12` — 주석의 "(gemini-bridge 등)" 제거
- `.claude/commands-registry.json` — gemini-review/scan 엔트리 제거
- `.claude/commands/review.md:152` — Gemini Cross-Review 줄 제거
- `docs/claude/automation.md` — Gemini CLI Integration 섹션 + 훅 테이블 행 + 인라인 언급 제거
- `docs/claude/commands-and-skills.md` — gemini 커맨드 2줄 + 카운트 20→18
- `CLAUDE.md` — 82/84/92줄 Gemini 언급 제거
- `.claude/docs/architecture-diagram.html` — Gemini 노드/연결 제거

## KEEP (과거 기록·거짓양성)
- `src/utils/colorUtils.ts:110`, `src/hooks/__tests__/useTrainSchedule.test.ts:370` — 과거 리뷰 크레딧 주석 (앱코드 동결)
- `dev/archive/**`, `dev/harness-legacy-scan-report.md`, `docs/planning/**` — 역사적 기록

## VERIFY
1. `settings.json`/`commands-registry.json` JSON 유효 + 참조 훅 파일 전부 존재
2. 잔존 훅(userPromptSubmit/fileLock/docEnforcer) 샘플 stdin 무크래시 실행
3. `docEnforcer.test.js` 통과
4. 활성 트리(아카이브·과거 기록 제외) gemini 댕글링 참조 0
