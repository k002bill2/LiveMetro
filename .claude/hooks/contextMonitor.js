#!/usr/bin/env node
/**
 * Context Monitor Hook for LiveMetro
 *
 * 상호작용 횟수 및 토큰 사용량 기반으로 /save-and-compact 실행을 권장합니다.
 * Stop 이벤트에서 호출됩니다.
 *
 * @version 3.0.0
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '.context-state.json');
const MEMORY_DIR = path.join(process.cwd(), '.temp', 'memory');

const CONFIG = {
  // 상호작용 기반 임계값
  WARNING_THRESHOLD: 15,       // 경고 표시 횟수
  CRITICAL_THRESHOLD: 25,      // 강력 권고 횟수
  REMINDER_INTERVAL: 5,        // 알림 간격 (분)

  // 토큰 기반 임계값 (CLAUDE.md 권장)
  TOKEN_WARNING: 120000,       // 120K - 경고 임계값
  TOKEN_CRITICAL: 150000,      // 150K - 스냅샷 트리거
  TOKEN_SNAPSHOT_TRIGGER: 150000,

  // 예상 토큰 사용량 (상호작용당)
  ESTIMATED_TOKENS_PER_INTERACTION: 5000
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }

  return {
    count: 0,
    start: Date.now(),
    lastReminder: 0,
    estimatedTokens: 0,
    snapshotsTaken: 0,
    lastSnapshotAt: 0
  };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) { /* ignore */ }
}

function resetState() {
  const state = {
    count: 0,
    start: Date.now(),
    lastReminder: 0,
    estimatedTokens: 0,
    snapshotsTaken: 0,
    lastSnapshotAt: 0
  };
  saveState(state);
  console.log('[Context Monitor] State reset.');
  return state;
}

function getMinutes(start) {
  return Math.floor((Date.now() - start) / 60000);
}

function formatTokens(tokens) {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

function showStatus(state) {
  const mins = getMinutes(state.start);
  const tokens = formatTokens(state.estimatedTokens);
  const tokenPercent = Math.round((state.estimatedTokens / CONFIG.TOKEN_CRITICAL) * 100);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`CONTEXT MONITOR STATUS`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Interactions: ${state.count}`);
  console.log(`Session Duration: ${mins} minutes`);
  console.log(`Estimated Tokens: ${tokens} (${tokenPercent}% of limit)`);
  console.log(`Snapshots Taken: ${state.snapshotsTaken}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

function ensureMemoryDir() {
  const dirs = [
    path.join(MEMORY_DIR, 'research_plans'),
    path.join(MEMORY_DIR, 'findings'),
    path.join(MEMORY_DIR, 'checkpoints'),
    path.join(MEMORY_DIR, 'context_snapshots')
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function createContextSnapshot(state) {
  try {
    ensureMemoryDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = path.join(MEMORY_DIR, 'context_snapshots', `snap_${timestamp}.json`);

    const snapshot = {
      timestamp: new Date().toISOString(),
      session: {
        start: new Date(state.start).toISOString(),
        duration_minutes: getMinutes(state.start),
        interactions: state.count,
        estimated_tokens: state.estimatedTokens
      },
      trigger: state.estimatedTokens >= CONFIG.TOKEN_CRITICAL ? 'token_limit' : 'manual',
      recovery_hint: 'Use /resume to restore this context'
    };

    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

    state.snapshotsTaken++;
    state.lastSnapshotAt = Date.now();

    console.log(`[Context Monitor] Snapshot saved: ${snapshotPath}`);
    return snapshotPath;
  } catch (e) {
    console.error(`[Context Monitor] Snapshot failed: ${e.message}`);
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);

  // CLI commands
  if (args[0] === 'reset') {
    resetState();
    return;
  }

  if (args[0] === 'status') {
    showStatus(loadState());
    return;
  }

  if (args[0] === 'snapshot') {
    const state = loadState();
    createContextSnapshot(state);
    saveState(state);
    return;
  }

  // Hook mode - increment and check
  const state = loadState();
  state.count++;
  state.estimatedTokens += CONFIG.ESTIMATED_TOKENS_PER_INTERACTION;

  const mins = getMinutes(state.start);
  const sinceReminder = (Date.now() - state.lastReminder) / 60000;

  // Token-based critical check (highest priority)
  if (state.estimatedTokens >= CONFIG.TOKEN_CRITICAL) {
    console.log(`\n🔴 [Context Monitor] TOKEN LIMIT APPROACHING`);
    console.log(`   Estimated: ${formatTokens(state.estimatedTokens)} / ${formatTokens(CONFIG.TOKEN_CRITICAL)}`);
    console.log(`   Creating automatic snapshot...`);

    createContextSnapshot(state);

    console.log(`\n   ⚠️  STRONGLY RECOMMENDED: /save-and-compact then /compact\n`);
    state.lastReminder = Date.now();
    saveState(state);
    return;
  }

  // Token-based warning check
  if (state.estimatedTokens >= CONFIG.TOKEN_WARNING && sinceReminder >= CONFIG.REMINDER_INTERVAL) {
    console.log(`\n⚠️  [Context Monitor] Token usage at ${formatTokens(state.estimatedTokens)}`);
    console.log(`   Warning threshold: ${formatTokens(CONFIG.TOKEN_WARNING)}`);
    console.log(`   Consider: /save-and-compact soon\n`);
    state.lastReminder = Date.now();
    saveState(state);
    return;
  }

  // Skip if reminded recently
  if (sinceReminder < CONFIG.REMINDER_INTERVAL) {
    saveState(state);
    return;
  }

  // Interaction-based checks (fallback)
  if (state.count >= CONFIG.CRITICAL_THRESHOLD) {
    console.log(`\n[Context Monitor] ${state.count} interactions, ${mins}m elapsed`);
    console.log(`[Context Monitor] Estimated tokens: ${formatTokens(state.estimatedTokens)}`);
    console.log('[Context Monitor] Recommend: /save-and-compact then /compact\n');
    state.lastReminder = Date.now();
  } else if (state.count >= CONFIG.WARNING_THRESHOLD) {
    console.log(`\n[Context Monitor] ${state.count} interactions - consider saving soon\n`);
    state.lastReminder = Date.now();
  }

  saveState(state);
}

main();
