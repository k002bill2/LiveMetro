#!/usr/bin/env node
/**
 * docEnforcer.test.js — Node:test (built-in) unit tests for docEnforcer hook
 *
 * Why plain Node test runner instead of jest:
 *   - jest.config.testMatch only includes src/**__tests____/. Pulling the hook
 *     into jest would require either a new testMatch entry (jest-expo overhead
 *     for a 90-line plain Node script) or a separate jest config (heavier).
 *   - The hook itself is CJS Node — testing it with Node's built-in runner
 *     keeps it dependency-free and runs in milliseconds.
 *   - Run with: `npm run test:hooks` (added in package.json) or directly:
 *     `node --test .claude/hooks/__tests__/docEnforcer.test.js`
 *
 * Coverage strategy (G5 closeout / NEXT_SESSION.md option #4):
 *   1. Positive: each of the 6 rules fires on at least one of its keywords
 *      and emits its label + doc path.
 *   2. Negative: unrelated prompts produce no output (silent exit 0).
 *   3. Graceful: malformed JSON / empty stdin both exit 0 without throwing.
 *   4. **REGRESSION NET (the core G5 fix)**: every rule's `doc` path is a
 *      tracked file on disk. Catches cross-project doc-path drift like the
 *      original LangGraph fork that triggered #138.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const HOOK_PATH = path.resolve(__dirname, '..', 'docEnforcer.js');
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * Invoke the hook with the given JSON-encoded stdin payload and capture
 * { stdout, stderr, status }. Times out at 3s to fence runaway hooks.
 */
function runHook(stdinJson) {
  const result = spawnSync('node', [HOOK_PATH], {
    input: typeof stdinJson === 'string' ? stdinJson : JSON.stringify(stdinJson),
    encoding: 'utf8',
    timeout: 3000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
  };
}

// ============================================================================
// Positive: each rule fires on at least one keyword
// ============================================================================

/**
 * Rule keyword → expected label/doc. Picks the most representative keyword
 * per rule so the test reads like documentation of the rule set.
 */
const RULE_FIRES = [
  { keyword: 'firebase auth', label: 'FIREBASE', doc: 'docs/FIREBASE_SETUP.md' },
  { keyword: 'navigation 구조 변경', label: 'ARCHITECTURE', doc: 'docs/claude/architecture.md' },
  { keyword: 'seoul api 폴링 주기', label: 'API', doc: 'docs/claude/api-reference.md' },
  { keyword: '새 화면 추가', label: 'PATTERNS', doc: 'docs/claude/development-patterns.md' },
  { keyword: 'jest 설정 검토', label: 'TESTING', doc: 'docs/claude/testing.md' },
  { keyword: 'eas build 트리거', label: 'BUILD', doc: 'docs/DEVELOPMENT.md' },
];

for (const { keyword, label, doc } of RULE_FIRES) {
  test(`fires rule [${label}] on keyword "${keyword}"`, () => {
    const { stdout, status } = runHook({ prompt: keyword });
    assert.equal(status, 0, 'hook should exit 0');
    assert.match(stdout, /docEnforcer 감지/, 'should print header');
    assert.ok(stdout.includes(`[${label}]`), `should include label ${label}`);
    assert.ok(stdout.includes(doc), `should include doc path ${doc}`);
  });
}

// ============================================================================
// Negative: unrelated prompts are silent
// ============================================================================

test('produces no output for unrelated prompt', () => {
  const { stdout, status } = runHook({ prompt: '오늘 점심 메뉴 추천해줘' });
  assert.equal(status, 0);
  assert.equal(stdout.trim(), '', 'should be silent on unrelated prompts');
});

test('produces no output for empty prompt', () => {
  const { stdout, status } = runHook({ prompt: '' });
  assert.equal(status, 0);
  assert.equal(stdout.trim(), '');
});

// ============================================================================
// Graceful failure modes
// ============================================================================

test('exits 0 on malformed JSON stdin', () => {
  const { status } = runHook('not-valid-json{{{');
  assert.equal(status, 0, 'hook should swallow JSON parse errors gracefully');
});

test('exits 0 on empty stdin', () => {
  const { status } = runHook('');
  assert.equal(status, 0);
});

test('accepts `message` field as alternative to `prompt`', () => {
  // docEnforcer reads `input.prompt || input.message` — verify the fallback
  // works so future hook envelope changes don't silently break the matcher.
  const { stdout, status } = runHook({ message: 'firebase auth' });
  assert.equal(status, 0);
  assert.ok(stdout.includes('[FIREBASE]'));
});

// ============================================================================
// Multi-rule matching
// ============================================================================

test('emits multiple rules when prompt matches several keyword groups', () => {
  // 'firebase' (FIREBASE) + 'seoul api' (API) — two independent matches.
  const { stdout, status } = runHook({
    prompt: 'firebase functions에서 seoul api 호출하는 부분',
  });
  assert.equal(status, 0);
  assert.ok(stdout.includes('[FIREBASE]'), 'should match FIREBASE rule');
  assert.ok(stdout.includes('[API]'), 'should match API rule');
});

// ============================================================================
// REGRESSION NET: every rule's doc path is a tracked file on disk
//
// This is the core guard added for G5 #138 — the previous hook was forked
// from a LangGraph project and referenced doc paths that did not exist in
// LiveMetro. This test fails the moment any rule.doc drifts off the
// filesystem, regardless of whether the matcher logic still works.
// ============================================================================

test('every rule.doc path exists on disk (G5 regression net)', () => {
  // Parse the rules out of the hook source instead of importing — the hook
  // is a CLI script that exits on import, so dynamic require would terminate
  // the test process. Source-level grep keeps the test independent.
  const hookSource = fs.readFileSync(HOOK_PATH, 'utf8');
  const docMatches = [...hookSource.matchAll(/doc:\s*'([^']+)'/g)].map(m => m[1]);

  assert.ok(docMatches.length >= 6, `expected at least 6 doc paths, found ${docMatches.length}`);

  for (const docPath of docMatches) {
    const absolutePath = path.join(REPO_ROOT, docPath);
    assert.ok(
      fs.existsSync(absolutePath),
      `doc path missing from repo: ${docPath}\n` +
        `  Resolved to: ${absolutePath}\n` +
        `  This usually means the hook references a doc from a different\n` +
        `  project (cross-project drift). Update the path in\n` +
        `  .claude/hooks/docEnforcer.js or create the doc.`,
    );
  }
});
