/**
 * Verification Guard v2.0 (LiveMetro adaptation)
 *
 * PostToolUse:Write 시 TypeScript 변경을 감지하고 경량 tsc 검증을 실행한다.
 * 두 워크스페이스를 순회: 루트 RN 앱(src/, App.tsx)과 functions/ 서브프로젝트.
 *
 * 환경변수 오버라이드:
 *   TYPECHECK_CMD       — 루트 워크스페이스 tsc 명령 (default: npx tsc --noEmit --pretty false)
 *   FUNCTIONS_TYPECHECK — functions/ 워크스페이스 tsc 명령 (default: cd functions && npx tsc --noEmit --pretty false)
 *   TS_ERROR_THRESHOLD  — 차단 임계값 (default: 3)
 *
 * Exit codes:
 *   0 = 통과 또는 임계값 미만(경고)
 *   2 = 차단 (TS 에러 임계값 이상)
 *
 * @version 2.0.0-livemetro
 * @hook-config
 * {"event": "PostToolUse", "matcher": "Write", "command": "node .claude/hooks/verificationGuard.js", "timeout": 20}
 */

const { execSync } = require('child_process');

const TS_ERROR_THRESHOLD = parseInt(process.env.TS_ERROR_THRESHOLD || '3', 10);
const ROOT_TYPECHECK = process.env.TYPECHECK_CMD || 'npx tsc --noEmit --pretty false 2>&1 | head -20';
const FUNCTIONS_TYPECHECK = process.env.FUNCTIONS_TYPECHECK || 'cd functions && npx tsc --noEmit --pretty false 2>&1 | head -20';

function runTypecheck(label, cmd, timeoutMs) {
  try {
    execSync(cmd, { timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'], shell: '/bin/bash', cwd: process.cwd() });
    return { errors: 0, output: '' };
  } catch (err) {
    const output = (err.stdout || '').toString().trim();
    const errorCount = (output.match(/error TS/g) || []).length;
    return { errors: errorCount, output, label };
  }
}

function reportAndDecide(result) {
  if (result.errors === 0) return false;
  const head = result.output.split('\n').slice(0, 5).join('\n');
  if (result.errors >= TS_ERROR_THRESHOLD) {
    console.log(
      `\n[BLOCKED] TypeScript (${result.label}): ${result.errors} error(s) (threshold: ${TS_ERROR_THRESHOLD})\n` +
      `${head}\nACTION: 타입 에러를 먼저 수정하세요. /build-fix 사용 권장.\n`
    );
    return true;
  }
  console.log(`[Verification] TypeScript (${result.label}): ${result.errors} error(s) — threshold(${TS_ERROR_THRESHOLD}) 미만, 경고`);
  return false;
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(input);
      const filePath = event.tool_input?.file_path || '';
      if (!/\.(ts|tsx)$/.test(filePath)) return process.exit(0);

      let shouldBlock = false;

      if (filePath.includes('/functions/')) {
        const r = runTypecheck('functions', FUNCTIONS_TYPECHECK, 15000);
        shouldBlock = reportAndDecide(r) || shouldBlock;
      } else if (filePath.includes('/src/') || filePath.endsWith('App.tsx') || filePath.endsWith('App.ts')) {
        const r = runTypecheck('root', ROOT_TYPECHECK, 15000);
        shouldBlock = reportAndDecide(r) || shouldBlock;
      } else {
        return process.exit(0);
      }

      process.exit(shouldBlock ? 2 : 0);
    } catch {
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(0), 19000);
}

main();
