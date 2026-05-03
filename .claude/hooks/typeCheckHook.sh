#!/bin/bash
# TypeScript Type Check Hook (PostToolUse Edit|Write)
# Runs `tsc --noEmit` on .ts/.tsx edits, prioritizing error lines over output truncation.
#
# Why grep+head over `head -20`: head -20 cuts the FIRST 20 lines (often setup/info),
# losing actual error lines. We grep for `error TS` and show top 15 — guarantees
# errors are visible if any exist.
#
# Skips: test files (*.test.*, *.spec.*), non-TS files

FILE="${TOOL_INPUT_FILE_PATH:-}"

# Guard: file must exist and be .ts/.tsx (not test/spec)
[ -z "$FILE" ] && exit 0
echo "$FILE" | grep -qE '\.tsx?$' || exit 0
echo "$FILE" | grep -qE '\.(test|spec)\.' && exit 0

cd /Users/younghwankang/Work/LiveMetro || exit 0

OUT=$(npx tsc --noEmit --pretty 2>&1)
COUNT=$(echo "$OUT" | grep -cE 'error TS' || true)

if [ "${COUNT:-0}" -gt 0 ]; then
  echo "[TS] ${COUNT} error(s):"
  echo "$OUT" | grep -E 'error TS' | head -15
fi

exit 0
