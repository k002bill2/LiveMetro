#!/usr/bin/env node
/**
 * File Lock Hook (Advisory)
 * 병렬 에이전트가 같은 파일을 동시에 편집하는 last-write-wins 방지.
 *
 * 동작:
 *   - PreToolUse Edit|Write  → acquire: file_path를 in-flight 등록, 다른 holder가 60s 내 활성이면 BLOCK
 *   - PostToolUse Edit|Write → release: file_path 등록 해제
 *
 * 한계 (의도된 advisory):
 *   - 같은 Claude 세션의 sub-agent는 ppid 동일 → 구분 불가 (Claude가 도구 호출을 직렬화하므로 실제 문제 적음)
 *   - 외부 프로세스(gemini-bridge 등) 또는 stale lock(60s+)은 효과적으로 감지
 *   - JSON/파일 손상 시 fail-open (작업 중단 < 데이터 손실 위험)
 *
 * @hook-config
 * {"event": "PreToolUse",  "matcher": "Edit|Write", "command": "node .claude/hooks/fileLock.js acquire"}
 * {"event": "PostToolUse", "matcher": "Edit|Write", "command": "node .claude/hooks/fileLock.js release 2>/dev/null || true"}
 */

const fs = require('fs');
const path = require('path');

const LOCK_DIR = path.join(__dirname, '..', '.locks');
const LOCK_FILE = path.join(LOCK_DIR, 'in-flight.json');
const STALE_MS = 60_000;

function loadLocks() {
  try {
    if (!fs.existsSync(LOCK_FILE)) return {};
    const raw = fs.readFileSync(LOCK_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function saveLocks(locks) {
  try {
    if (!fs.existsSync(LOCK_DIR)) fs.mkdirSync(LOCK_DIR, { recursive: true });
    fs.writeFileSync(LOCK_FILE, JSON.stringify(locks, null, 2));
  } catch (_) {
    // fail-open
  }
}

function isStale(lock) {
  return !lock?.timestamp || (Date.now() - lock.timestamp) > STALE_MS;
}

function gcStaleLocks(locks) {
  let changed = false;
  for (const [file, lock] of Object.entries(locks)) {
    if (isStale(lock)) {
      delete locks[file];
      changed = true;
    }
  }
  return changed;
}

function main() {
  const mode = process.argv[2]; // 'acquire' or 'release'
  if (mode !== 'acquire' && mode !== 'release') {
    process.exit(0);
  }

  const myPid = process.ppid; // parent (Claude or spawning agent)

  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(input);
      const filePath = event?.tool_input?.file_path;
      const sessionId = event?.session_id || 'unknown';

      if (!filePath || typeof filePath !== 'string') {
        process.exit(0);
      }

      const locks = loadLocks();
      gcStaleLocks(locks);

      if (mode === 'acquire') {
        const existing = locks[filePath];
        if (existing && !isStale(existing) && existing.pid !== myPid && existing.sessionId !== sessionId) {
          const response = {
            decision: 'block',
            reason: `[FILE_LOCK] '${filePath}' is held by another agent (pid=${existing.pid}, session=${existing.sessionId}, started ${new Date(existing.timestamp).toISOString()}). ` +
                    `If parallel work is required, use Agent isolation: "worktree" or wait for the holder to finish.`
          };
          process.stdout.write(JSON.stringify(response));
          process.exit(0);
        }
        locks[filePath] = { pid: myPid, sessionId, timestamp: Date.now() };
        saveLocks(locks);
      } else if (mode === 'release') {
        if (locks[filePath]) {
          delete locks[filePath];
          saveLocks(locks);
        }
      }
      process.exit(0);
    } catch (_) {
      process.exit(0); // fail-open
    }
  });

  // safety timeout — never block Claude
  setTimeout(() => process.exit(0), 4000);
}

if (require.main === module) {
  main();
}

module.exports = { loadLocks, saveLocks, isStale, gcStaleLocks };
