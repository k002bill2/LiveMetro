/**
 * PostCompact Hook - Context Recovery after Compaction
 *
 * @description /compact 실행 후 사용 가능한 스킬, 활성 dev docs,
 *   미커밋 변경사항을 요약하여 압축된 컨텍스트에 재주입합니다.
 * @event PostCompact
 *
 * @hook-config
 * {"event": "PostCompact", "matcher": "", "command": "node .claude/hooks/postCompact.js 2>/dev/null || true"}
 *
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function getHighPrioritySkills() {
  try {
    const rulesPath = path.join(PROJECT_ROOT, '.claude', 'skill-rules.json');
    if (!fs.existsSync(rulesPath)) return [];

    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    return Object.entries(rules)
      .filter(([, rule]) => rule.priority === 'critical' || rule.priority === 'high')
      .map(([name, rule]) => `${name} (${rule.enforcement})`);
  } catch {
    return [];
  }
}

function getActiveDevDocs() {
  try {
    const devDir = path.join(PROJECT_ROOT, 'dev', 'active');
    if (!fs.existsSync(devDir)) return [];

    return fs.readdirSync(devDir).filter(f => f.endsWith('.md'));
  } catch {
    return [];
  }
}

function getUncommittedCount() {
  try {
    const output = execSync('git status --porcelain 2>/dev/null', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout: 3000,
    });
    return output.trim().split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function main() {
  const skills = getHighPrioritySkills();
  const devDocs = getActiveDevDocs();
  const uncommitted = getUncommittedCount();

  const parts = ['[POST-COMPACT CONTEXT RECOVERY]'];

  if (skills.length > 0) {
    parts.push(`Skills (high/critical): ${skills.join(', ')}`);
  }

  if (devDocs.length > 0) {
    parts.push(`Active dev-docs: ${devDocs.join(', ')}`);
    parts.push('Use /resume to restore full task context.');
  }

  if (uncommitted > 0) {
    parts.push(`Uncommitted changes: ${uncommitted} files`);
  }

  parts.push('Use /save-and-compact for safe context compression.');

  console.log(parts.join('\n'));
}

main();
