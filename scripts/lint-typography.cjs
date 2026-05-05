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
 * Enforcement scope (Phase 31.1):
 *   Default mode scans every staged tsx/ts file under src/. Phase 31
 *   reached audit baseline 0 across the entire src/ tree, so a per-
 *   directory allow-list is no longer needed — any new directory is
 *   automatically enforced from its first commit. Phase history
 *   (per-directory rollout 21~31) lives in git log.
 *
 * Usage:
 *   node scripts/lint-typography.cjs                  # scan staged tsx/ts under src/
 *   node scripts/lint-typography.cjs --all            # alias of default (back-compat)
 *   node scripts/lint-typography.cjs <file> [<file>]  # scan given files
 *
 * Full-src audit (no git context):
 *   find src -type f \( -name '*.ts' -o -name '*.tsx' \) | xargs node scripts/lint-typography.cjs
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const WEIGHT_RE = /\bfontWeight:\s*['"`](?:[1-9]00|normal|bold)['"`]/;
const SIBLING_RE = /\bfontFamily:|\btypeStyle\(|\bweightToFontFamily\(/;
const WINDOW = 15;

const args = process.argv.slice(2);
const explicitFiles = args.filter((a) => !a.startsWith('--'));

function listFiles() {
  if (explicitFiles.length > 0) return explicitFiles;
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
      .filter((f) => f.startsWith('src/'));
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
