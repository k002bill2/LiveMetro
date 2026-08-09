#!/bin/bash
# TypeScript Type Check Hook (PostToolUse Edit|Write)
# Runs `tsc --noEmit` on .ts/.tsx edits, prioritizing error lines over output truncation.
#
# Why grep+head over `head -20`: head -20 cuts the FIRST 20 lines (often setup/info),
# losing actual error lines. We grep for `error TS` and show top 15 — guarantees
# errors are visible if any exist.
#
# Workspace routing (2026-08-09): this repo has TWO tsconfig workspaces — the root RN app
# and functions/. Previously verificationGuard.js (PostToolUse:Write) typechecked both while
# this hook (Edit|Write) typechecked only root, so a Write of a .ts file paid ~26s of tsc
# (root 12s + functions 2s + root 12s again) and an Edit skipped functions/ entirely.
# verificationGuard.js is removed; this hook now routes to the workspace that owns the edited
# file, so each edit pays ONE typecheck: ~2s inside functions/, ~12s elsewhere.
#
# Input: stdin JSON event (Claude Code hook contract). Reads tool_input.file_path via jq.
# Skips: test files (*.test.*, *.spec.*), non-TS files, missing jq.

INPUT=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

[ -z "$FILE" ] && exit 0
echo "$FILE" | grep -qE '\.tsx?$' || exit 0
echo "$FILE" | grep -qE '\.(test|spec)\.' && exit 0

ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
[ -z "$ROOT" ] && exit 0
cd "$ROOT" || exit 0

# Route to the owning workspace. Paths may be absolute or repo-relative, so match on the
# functions/ segment rather than a prefix.
if echo "$FILE" | grep -qE '(^|/)functions/'; then
  WORKSPACE="functions"
  cd "$ROOT/functions" || exit 0
else
  WORKSPACE="root"
fi

OUT=$(npx tsc --noEmit --pretty 2>&1)
COUNT=$(echo "$OUT" | grep -cE 'error TS' || true)

if [ "${COUNT:-0}" -gt 0 ]; then
  echo "[TS:${WORKSPACE}] ${COUNT} error(s):"
  echo "$OUT" | grep -E 'error TS' | head -15
fi

exit 0
