/**
 * Stop Validator Hook - Post-Response Self-Validation
 *
 * @description 응답 완료 후 편집된 .ts/.tsx 파일에서 위험 패턴을
 *   자동 검사하여 경고 메시지를 출력합니다.
 * @event Stop
 *
 * @hook-config
 * {"event": "Stop", "matcher": "", "command": "node .claude/hooks/stopValidator.js 2>/dev/null || true"}
 *
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

const RISKY_PATTERNS = [
  {
    regex: /console\.log\s*\(/,
    message: 'console.log detected in production code',
    exclude: /__tests__|\.test\.|\.spec\.|jest\.setup/,
  },
  {
    regex: /:\s*any\b/,
    message: '`any` type usage detected (use specific type or `unknown`)',
    exclude: /__tests__|\.test\.|\.d\.ts/,
  },
  {
    regex: /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    message: 'Possible hardcoded secret detected',
    exclude: /__tests__|\.test\.|\.example/,
  },
];

function getModifiedFiles() {
  try {
    const output = execSync('git diff --name-only HEAD 2>/dev/null', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout: 3000,
    });
    return output
      .trim()
      .split('\n')
      .filter(f => /\.(ts|tsx)$/.test(f) && !/__tests__/.test(f));
  } catch {
    return [];
  }
}

function scanFile(filePath, pattern) {
  if (pattern.exclude && pattern.exclude.test(filePath)) return [];

  try {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    if (!fs.existsSync(fullPath)) return [];

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const matches = [];

    for (let i = 0; i < lines.length; i++) {
      if (pattern.regex.test(lines[i])) {
        matches.push({ file: filePath, line: i + 1, message: pattern.message });
      }
    }
    return matches;
  } catch {
    return [];
  }
}

function main() {
  const files = getModifiedFiles();
  if (files.length === 0) return;

  const warnings = [];

  for (const file of files) {
    for (const pattern of RISKY_PATTERNS) {
      const matches = scanFile(file, pattern);
      warnings.push(...matches);
    }
  }

  if (warnings.length === 0) return;

  const grouped = {};
  for (const w of warnings) {
    if (!grouped[w.message]) grouped[w.message] = [];
    grouped[w.message].push(`${w.file}:${w.line}`);
  }

  const lines = ['[POST-RESPONSE VALIDATION]'];
  for (const [message, locations] of Object.entries(grouped)) {
    lines.push(`  ${message}`);
    for (const loc of locations.slice(0, 3)) {
      lines.push(`    - ${loc}`);
    }
    if (locations.length > 3) {
      lines.push(`    ... and ${locations.length - 3} more`);
    }
  }

  console.log(lines.join('\n'));
}

main();
