#!/usr/bin/env node
/**
 * Typography lint — guard the Wanted Design System invariant:
 *
 *   "If a TextStyle uses `fontWeight: '<numeric>'`, then within the same
 *   object literal it must also reference one of:
 *     - fontFamily: ...
 *     - typeStyle('<key>', ...)
 *     - weightToFontFamily('<weight>')
 *
 * Background: Pretendard ships as 9 separate font faces (no PostScript
 * "Pretendard" alias). RN's `fontWeight` alone falls back to system fonts.
 * See modernTheme.ts and `project_pretendard_wiring.md` for details.
 *
 * Usage:
 *   node scripts/lint-typography.cjs                  # scan staged tsx/ts
 *   node scripts/lint-typography.cjs <file> [<file>]  # scan given files
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const WEIGHT_RE = /\bfontWeight:\s*['"`](?:[1-9]00|normal|bold)['"`]/;
const SIBLING_RE = /\bfontFamily:|\btypeStyle\(|\bweightToFontFamily\(/;
const WINDOW = 15;

/**
 * Enforcement set — directories where Pretendard wiring is already
 * complete and must stay that way. Files outside these prefixes are
 * scanned only when `--all` is passed (so we can audit, but pre-commit
 * stays surgical).
 *
 * Extend this list whenever a new directory is migrated.
 *   Phase 21: design/, station/, styles/
 *   Phase 22: screens/statistics/, components/statistics/
 *   Phase 23: screens/settings/
 *   Phase 24: screens/auth/
 *   Phase 25: screens/delays/
 *   Phase 26: screens/prediction/
 */
const HARD_PREFIXES = [
  'src/components/design/',
  'src/components/station/',
  'src/components/statistics/',
  'src/screens/auth/',
  'src/screens/delays/',
  'src/screens/prediction/',
  'src/screens/settings/',
  'src/screens/statistics/',
  'src/styles/',
];

const args = process.argv.slice(2);
const allMode = args.includes('--all');
const explicitFiles = args.filter((a) => !a.startsWith('--'));

function listFiles() {
  if (explicitFiles.length > 0) return explicitFiles;
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
    });
    const staged = out
      .split('\n')
      .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
      .filter((f) => f.startsWith('src/'));
    if (allMode) return staged;
    return staged.filter((f) => HARD_PREFIXES.some((p) => f.startsWith(p)));
  } catch {
    return [];
  }
}

function scanFile(file) {
  const violations = [];
  if (!fs.existsSync(file)) return violations;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!WEIGHT_RE.test(lines[i])) continue;
    const start = Math.max(0, i - WINDOW);
    const end = Math.min(lines.length, i + WINDOW + 1);
    const window = lines.slice(start, end).join('\n');
    if (!SIBLING_RE.test(window)) {
      violations.push({ line: i + 1, text: lines[i].trim() });
    }
  }
  return violations;
}

function main() {
  const files = listFiles();
  if (files.length === 0) return 0;
  let total = 0;
  for (const file of files) {
    const violations = scanFile(file);
    for (const v of violations) {
      console.error(`${file}:${v.line}: fontWeight without fontFamily/typeStyle/weightToFontFamily`);
      console.error(`    ${v.text}`);
      total++;
    }
  }
  if (total > 0) {
    console.error(
      `\n✘ ${total} typography violation(s). ` +
        `Pretendard requires a weight-suffixed PostScript family name; ` +
        `use weightToFontFamily(weight) or typeStyle(key) from src/styles/modernTheme.ts.`,
    );
    return 1;
  }
  return 0;
}

process.exit(main());
