#!/usr/bin/env node
/**
 * Path Protection Hook
 * PreToolUse에서 Edit/Write의 대상 경로를 블랙리스트와 비교해 차단합니다.
 *
 * @hook-config
 * {"event": "PreToolUse", "matcher": "Edit|Write", "command": "node .claude/hooks/pathProtection.js"}
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'pathProtection.config.json');

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw);
    if (!Array.isArray(config.blocked_patterns)) {
      throw new Error('blocked_patterns must be array');
    }
    return config.blocked_patterns;
  } catch (e) {
    // Fail-open intentionally is dangerous; fail-closed with default minimal list instead.
    return ['.env', 'secrets', '.git/', 'google-services.json', 'eas.json', 'firestore.rules'];
  }
}

/**
 * Segment-based path matching. Avoids substring false positives like
 * `apartment-events.tsx` matching `.env`.
 *
 * Three pattern modes:
 *   1. Trailing '/' → directory: any segment must equal `pattern` minus '/'.
 *      e.g. 'secrets/' matches 'secrets/key.txt' but not 'mysecrets.json'.
 *   2. No '/' and looks like a file (contains '.') → exact segment match.
 *      e.g. '.env' matches '.env' or 'app/.env' but not 'apartment-events.tsx'.
 *   3. No '/' and no '.' → prefix match on the last segment only.
 *      e.g. 'serviceAccount' matches 'serviceAccountKey.json' (filename),
 *           but not 'serviceAccountUtils/foo.ts' (directory).
 */
function isBlocked(filePath, patterns) {
  if (!filePath || typeof filePath !== 'string') return null;
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  for (const pattern of patterns) {
    if (pattern.endsWith('/')) {
      const dir = pattern.slice(0, -1);
      if (segments.includes(dir)) return pattern;
    } else if (pattern.includes('.')) {
      if (segments.includes(pattern)) return pattern;
    } else {
      const last = segments[segments.length - 1];
      if (last === pattern || last.startsWith(pattern)) return pattern;
    }
  }
  return null;
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(input);
      const filePath = event?.tool_input?.file_path || '';
      const patterns = loadConfig();
      const matched = isBlocked(filePath, patterns);

      if (matched) {
        const response = {
          decision: 'block',
          reason: `[PATH_PROTECTION] '${matched}' 패턴이 포함된 파일 편집은 차단됩니다: ${filePath}`
        };
        process.stdout.write(JSON.stringify(response));
        process.exit(0);
      }

      process.exit(0);
    } catch (_) {
      process.exit(0);
    }
  });

  setTimeout(() => process.exit(0), 5000);
}

if (require.main === module) {
  main();
}

module.exports = { loadConfig, isBlocked };
