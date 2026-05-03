#!/usr/bin/env node
/**
 * Output Secret Filter Hook (PostToolUse, Bash matcher)
 * Detects secrets in tool output and emits a stderr warning if any masking occurred.
 *
 * NOTE: PostToolUse hooks cannot rewrite the output Claude sees — this hook is a
 * passive detector that flags leaks. The masked text is computed for diff comparison
 * only; it is not surfaced back into the tool result. The value is the warning so
 * the operator notices a leak in the live transcript.
 *
 * Replaces .claude/hooks/outputSecretFilter.sh — removes python3 dependency,
 * unifies hook stack on node.
 *
 * @hook-config
 * {"event": "PostToolUse", "matcher": "Bash", "command": "node .claude/hooks/outputSecretFilter.js 2>/dev/null || true"}
 */

const RULES = [
  // API key env-var assignments (key=value or key: value)
  [/(EXPO_PUBLIC_[A-Z_]+=)[^ "']+/g,             '$1[REDACTED]'],
  [/(FIREBASE_[A-Z_]+=)[^ "']+/g,                '$1[REDACTED]'],
  [/(GOOGLE_[A-Z_]+=)[^ "']+/g,                  '$1[REDACTED]'],
  [/(API_KEY=)[^ "']+/g,                         '$1[REDACTED]'],
  [/(SECRET_KEY=)[^ "']+/g,                      '$1[REDACTED]'],

  // Bearer tokens
  [/Bearer [A-Za-z0-9._\-]+/g,                   'Bearer [REDACTED]'],

  // AWS Access Key (AKIA + 16 chars)
  [/AKIA[0-9A-Z]{16}/g,                          'AKIA[REDACTED]'],

  // AWS Secret Key (40-char base64 after assignment)
  [/(aws_secret_access_key[=: ]+)[A-Za-z0-9/+=]{40}/g, '$1[REDACTED]'],

  // GitHub Personal Access Tokens
  [/ghp_[A-Za-z0-9_]{36}/g,                      'ghp_[REDACTED]'],
  [/github_pat_[A-Za-z0-9_]{82}/g,               'github_pat_[REDACTED]'],

  // Private key blocks (RSA/EC/DSA)
  [/-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |DSA )?PRIVATE KEY-----/g,
   '[PRIVATE KEY REDACTED]'],

  // Firebase config values
  [/(apiKey['": ]+)[A-Za-z0-9_\-]{20,}/g,        '$1[REDACTED]'],
  [/(authDomain['": ]+)[^"',]+/g,                '$1[REDACTED]'],
  [/(messagingSenderId['": ]+)[0-9]{10,}/g,      '$1[REDACTED]'],

  // npm tokens
  [/npm_[A-Za-z0-9]{36}/g,                       'npm_[REDACTED]'],

  // Generic token=xxx (≥20 chars)
  [/(token[=: ]+["']?)[A-Za-z0-9._\-]{20,}/g,    '$1[REDACTED]'],

  // Firebase service-account JSON fields
  [/("private_key"\s*:\s*")[^"]+(")/g,           '$1[REDACTED]$2'],
  [/("client_email"\s*:\s*")[^"]+(")/g,          '$1[REDACTED]$2'],
  [/("private_key_id"\s*:\s*")[^"]+(")/g,        '$1[REDACTED]$2'],

  // Expo push tokens
  [/(Expo(?:nent)?PushToken)\[[^\]]+\]/g,        '$1[REDACTED]'],

  // OAuth client secret
  [/(client[_-]?secret[=: "']+)[A-Za-z0-9._\-]{16,}/g, '$1[REDACTED]'],

  // Google API key (AIza + 35 chars)
  [/AIza[A-Za-z0-9_\-]{35}/g,                    'AIza[REDACTED]'],

  // Slack tokens (xoxb-, xoxp-, xoxa-, xoxs-)
  [/xox[baps]-[A-Za-z0-9\-]+/g,                  'xox*-[REDACTED]'],

  // Stripe keys (sk_live, sk_test, pk_live, rk_live + ≥20 chars)
  [/(sk|pk|rk)_(live|test)_[A-Za-z0-9]{20,}/g,   '$1_$2_[REDACTED]'],

  // JWT (eyJ...eyJ...sig)
  [/eyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, '[JWT_REDACTED]'],
];

function maskSecrets(text) {
  let masked = text;
  for (const [pattern, replacement] of RULES) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      if (!input.trim()) return process.exit(0);
      const event = JSON.parse(input);
      const output = event.tool_output ?? event.stdout ?? '';
      if (!output) return process.exit(0);

      const masked = maskSecrets(String(output));
      if (masked !== String(output)) {
        process.stderr.write('⚠️  [OutputSecretFilter] 시크릿이 마스킹되었습니다.\n');
      }
      process.exit(0);
    } catch (_) {
      process.exit(0); // fail-open
    }
  });

  setTimeout(() => process.exit(0), 4000);
}

if (require.main === module) {
  main();
}

module.exports = { maskSecrets, RULES };
