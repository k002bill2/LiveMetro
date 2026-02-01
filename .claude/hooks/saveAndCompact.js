#!/usr/bin/env node
/**
 * Save and Compact Automation Script for LiveMetro
 *
 * 현재 세션의 컨텍스트를 저장하고 체크포인트를 생성합니다.
 * /save-and-compact 명령어의 자동화 지원 스크립트입니다.
 *
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(process.cwd(), '.temp', 'memory');
const DEV_ACTIVE_DIR = path.join(process.cwd(), 'dev', 'active');
const CONTEXT_STATE_FILE = path.join(__dirname, '.context-state.json');

/**
 * 디렉토리 구조 확인 및 생성
 */
function ensureDirectories() {
  const dirs = [
    path.join(MEMORY_DIR, 'research_plans'),
    path.join(MEMORY_DIR, 'findings'),
    path.join(MEMORY_DIR, 'checkpoints'),
    path.join(MEMORY_DIR, 'context_snapshots')
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[SaveAndCompact] Created: ${dir}`);
    }
  }
}

/**
 * 활성 프로젝트 스캔
 */
function scanActiveProjects() {
  const projects = [];

  if (!fs.existsSync(DEV_ACTIVE_DIR)) {
    return projects;
  }

  const files = fs.readdirSync(DEV_ACTIVE_DIR);
  const contextFiles = files.filter(f => f.endsWith('-context.md'));

  for (const contextFile of contextFiles) {
    const projectName = contextFile.replace('-context.md', '');
    const tasksFile = `${projectName}-tasks.md`;

    projects.push({
      name: projectName,
      contextFile: path.join(DEV_ACTIVE_DIR, contextFile),
      tasksFile: path.join(DEV_ACTIVE_DIR, tasksFile),
      hasTasksFile: files.includes(tasksFile)
    });
  }

  return projects;
}

/**
 * 컨텍스트 상태 로드
 */
function loadContextState() {
  try {
    if (fs.existsSync(CONTEXT_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(CONTEXT_STATE_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }

  return {
    count: 0,
    start: Date.now(),
    estimatedTokens: 0
  };
}

/**
 * 체크포인트 생성
 */
function createCheckpoint(phase = 'session') {
  ensureDirectories();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const checkpointId = `cp_${phase}_${timestamp}`;
  const checkpointPath = path.join(MEMORY_DIR, 'checkpoints', `${checkpointId}.json`);

  const contextState = loadContextState();
  const activeProjects = scanActiveProjects();

  const checkpoint = {
    checkpoint_id: checkpointId,
    phase: phase,
    created_at: new Date().toISOString(),

    session: {
      start: new Date(contextState.start).toISOString(),
      interactions: contextState.count,
      estimated_tokens: contextState.estimatedTokens
    },

    active_projects: activeProjects.map(p => ({
      name: p.name,
      context_file: p.contextFile,
      tasks_file: p.hasTasksFile ? p.tasksFile : null
    })),

    state: {
      completed_subtasks: [],
      pending_subtasks: [],
      findings_count: countFindings()
    },

    recovery_instructions: 'Use /resume to restore this checkpoint'
  };

  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
  console.log(`[SaveAndCompact] Checkpoint created: ${checkpointPath}`);

  return checkpointPath;
}

/**
 * Findings 카운트
 */
function countFindings() {
  const findingsDir = path.join(MEMORY_DIR, 'findings');
  if (!fs.existsSync(findingsDir)) return 0;

  return fs.readdirSync(findingsDir).filter(f => f.endsWith('.md') || f.endsWith('.json')).length;
}

/**
 * 세션 요약 생성
 */
function generateSessionSummary() {
  const contextState = loadContextState();
  const activeProjects = scanActiveProjects();

  const now = new Date();
  const duration = Math.floor((Date.now() - contextState.start) / 60000);

  return {
    timestamp: now.toISOString(),
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0],
    duration_minutes: duration,
    interactions: contextState.count,
    estimated_tokens: contextState.estimatedTokens,
    active_projects: activeProjects.length,
    project_names: activeProjects.map(p => p.name)
  };
}

/**
 * 메인 실행
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'save';

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SAVE AND COMPACT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  switch (command) {
    case 'save':
    case 'checkpoint': {
      ensureDirectories();
      const checkpointPath = createCheckpoint('session');
      const summary = generateSessionSummary();

      console.log(`\n📍 Checkpoint Created`);
      console.log(`   Path: ${checkpointPath}`);
      console.log(`   Duration: ${summary.duration_minutes} minutes`);
      console.log(`   Interactions: ${summary.interactions}`);
      console.log(`   Estimated Tokens: ${(summary.estimated_tokens / 1000).toFixed(1)}K`);

      if (summary.active_projects > 0) {
        console.log(`\n📂 Active Projects: ${summary.project_names.join(', ')}`);
      }

      console.log(`\n💡 Next: Run /compact to compress context`);
      break;
    }

    case 'list': {
      const checkpointsDir = path.join(MEMORY_DIR, 'checkpoints');
      if (!fs.existsSync(checkpointsDir)) {
        console.log('No checkpoints found.');
        break;
      }

      const checkpoints = fs.readdirSync(checkpointsDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 10);

      console.log('Recent Checkpoints:');
      for (const cp of checkpoints) {
        console.log(`  - ${cp}`);
      }
      break;
    }

    case 'projects': {
      const projects = scanActiveProjects();
      if (projects.length === 0) {
        console.log('No active projects in dev/active/');
        break;
      }

      console.log('Active Projects:');
      for (const p of projects) {
        console.log(`  - ${p.name}`);
        console.log(`    Context: ${p.contextFile}`);
        if (p.hasTasksFile) {
          console.log(`    Tasks: ${p.tasksFile}`);
        }
      }
      break;
    }

    default:
      console.log('Usage: saveAndCompact.js [save|checkpoint|list|projects]');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main();
