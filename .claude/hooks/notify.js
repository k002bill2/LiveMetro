#!/usr/bin/env node
/**
 * Notification Hook (macOS)
 * Sends a desktop notification via osascript without shell interpolation.
 *
 * Why this exists: the previous one-liner
 *   `jq -r '.message' | xargs -I{} osascript -e 'display notification "{}"'`
 * is vulnerable to AppleScript injection if `message` contains `"` or `\` —
 * a malicious or accidental payload could close the string and run arbitrary
 * AppleScript. This script reads the JSON event from stdin, sanitizes the
 * message, and passes it to osascript via spawn argv (no shell parsing).
 *
 * @hook-config
 * {"event": "Notification", "matcher": "", "command": "node .claude/hooks/notify.js"}
 */

const { spawn } = require('child_process');

let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    if (!input.trim()) return process.exit(0);
    const event = JSON.parse(input);
    const raw = String(event.message ?? '');

    const safe = raw
      .replace(/[\\"]/g, '')
      .replace(/[\r\n\t]/g, ' ')
      .slice(0, 200);
    if (!safe) return process.exit(0);

    const child = spawn(
      'osascript',
      ['-e', `display notification "${safe}" with title "Claude Code"`],
      { stdio: 'ignore', detached: true }
    );
    child.unref();
  } catch (_) {
    // fail-open: a broken notification must never block Claude
  }
  process.exit(0);
});

setTimeout(() => process.exit(0), 3000);
