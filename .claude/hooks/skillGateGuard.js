/**
 * Skill Gate Guard — 스킬 라우팅 강제 (LiveMetro adaptation)
 *
 * 두 가지 역할을 하나의 스크립트로 수행:
 *
 * 1) PostToolUse:Skill — 호출된 스킬명을 마커 파일에 기록
 *    매칭: Skill 도구 사용 후
 *
 * 2) PreToolUse:Edit|Write — 파일 타입에 맞는 스킬이 호출되었는지 확인
 *    매칭: Edit|Write 도구 사용 전
 *
 * 스킬 요구사항 (livemetro-workflow.md 기반):
 *   - src/.*\.tsx 편집 (테스트 제외) → react-native-development 스킬 필요
 *   - functions/src/.*\.ts 편집 (테스트 제외) → firebase-integration 스킬 필요
 *   - .test.* / .spec.* 작성 → test-automation 스킬 필요
 *
 * 경고 조건: 권장 스킬이 세션 내에서 한 번도 호출되지 않은 경우
 * 쿨다운: 파일 타입별 1회 경고 후 5분간 재경고 안 함
 *
 * v2.0 (2026-08-09): BLOCK(exit 2) → WARN(exit 0) 강등.
 *   사유: 같은 스킬 라우팅 규칙이 3중으로 걸려 있다 —
 *     (1) 스킬 설명 전체가 시스템 프롬프트에 상주,
 *     (2) superpowers:using-superpowers 가 "1%라도 해당하면 필수 호출"을 강제,
 *     (3) 이 훅.
 *   셋 중 이 훅만 도구 호출을 되돌렸다. 모델이 스킬을 모른다는 전제가 이미 성립하지 않으므로
 *   판단을 대체하지 않고 신호만 남긴다. 안전 목적 차단(pathProtection)과는 성격이 다르다.
 *
 * @version 2.0.0-livemetro
 */

const fs = require('fs');
const path = require('path');

const MARKER_DIR = '/tmp/claude-skill-gate-livemetro';
const COOLDOWN_DIR = '/tmp/claude-skill-gate-cooldown-livemetro';
const COOLDOWN_SECONDS = 300;

// 파일 패턴 → 필수 스킬 매핑 (LM 스킬 + AOS-import 합집합)
const SKILL_REQUIREMENTS = [
  {
    pattern: /(^|\/)src\/.*\.tsx$/,
    exclude: /\.(test|spec)\.tsx$/,
    skill: 'react-native-development',
    label: 'RN 컴포넌트',
  },
  {
    pattern: /(^|\/)functions\/src\/.*\.ts$/,
    exclude: /\.(test|spec)\.ts$/,
    skill: 'firebase-integration',
    label: 'Firebase Functions',
  },
  {
    pattern: /\.(test|spec)\.(tsx|ts)$/,
    exclude: null,
    skill: 'test-automation',
    label: '테스트 파일',
  },
];

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
}

function isSkillInvoked(skillName) {
  const markerFile = path.join(MARKER_DIR, skillName);
  return fs.existsSync(markerFile);
}

function recordSkill(skillName) {
  ensureDir(MARKER_DIR);
  fs.writeFileSync(
    path.join(MARKER_DIR, skillName),
    String(Math.floor(Date.now() / 1000))
  );
}

function isInCooldown(key) {
  const hash = Buffer.from(key).toString('base64url').slice(0, 32);
  const file = path.join(COOLDOWN_DIR, hash);
  if (fs.existsSync(file)) {
    try {
      const ts = parseInt(fs.readFileSync(file, 'utf8'), 10);
      if (Date.now() / 1000 - ts < COOLDOWN_SECONDS) return true;
    } catch { /* ignore */ }
  }
  return false;
}

function setCooldown(key) {
  ensureDir(COOLDOWN_DIR);
  const hash = Buffer.from(key).toString('base64url').slice(0, 32);
  fs.writeFileSync(
    path.join(COOLDOWN_DIR, hash),
    String(Math.floor(Date.now() / 1000))
  );
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(input);
      const toolName = event.tool_name || '';

      if (toolName === 'Skill') {
        const skillName = event.tool_input?.skill || '';
        if (skillName) {
          recordSkill(skillName);
        }
        return process.exit(0);
      }

      const filePath = event.tool_input?.file_path || '';
      if (!filePath) return process.exit(0);

      for (const req of SKILL_REQUIREMENTS) {
        if (!req.pattern.test(filePath)) continue;
        if (req.exclude && req.exclude.test(filePath)) continue;

        if (isSkillInvoked(req.skill)) continue;

        const cooldownKey = `${req.skill}:${req.label}`;
        if (isInCooldown(cooldownKey)) continue;

        setCooldown(cooldownKey);
        const basename = path.basename(filePath);
        console.log(
          `\n[WARN] Skill Gate: ${req.label} 편집 — '${req.skill}' 스킬 미호출.\n` +
          `파일: ${basename}\n` +
          `권고: 도메인 규칙이 필요하면 Skill('${req.skill}') 을 호출하세요. (차단하지 않음)\n`
        );
        return process.exit(0);
      }

      process.exit(0);
    } catch {
      process.exit(0);
    }
  });
  setTimeout(() => process.exit(0), 3000);
}

main();
