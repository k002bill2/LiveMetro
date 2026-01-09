#!/bin/bash
# PreCompact Hook - Auto-save Dev Docs before compact
# Triggered when context window is full and auto-compact starts

INPUT=$(cat)
TRIGGER=$(echo "$INPUT" | jq -r '.trigger')

if [ "$TRIGGER" = "auto" ]; then
  # Update Dev Docs timestamps
  for file in dev/active/*-context.md; do
    if [ -f "$file" ]; then
      sed -i '' "s/Last Updated:.*/Last Updated: $(date '+%Y-%m-%d %H:%M')/" "$file"
    fi
  done

  echo "✅ Dev Docs auto-saved before compact"
fi

exit 0
