#!/usr/bin/env node
/**
 * Resume Context Automation Script for LiveMetro
 *
 * 저장된 체크포인트와 컨텍스트를 복원합니다.
 * /resume 명령어의 자동화 지원 스크립트입니다.
 *
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(process.cwd(), '.temp', 'memory');
const DEV_ACTIVE_DIR = path.join(process.cwd(), 'dev', 'active');
const CONTEXT_STATE_FILE = path.join(__dirname, '.context-state.json');

/**
 * 체크포인트 목록 조회
 */
function listCheckpoints(limit = 10) {
  const checkpointsDir = path.join(MEMORY_DIR, 'checkpoints');

  if (!fs.existsSync(checkpointsDir)) {
    return [];
  }

  const files = fs.readdirSync(checkpointsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit);

  return files.map(f => {
    const filePath = path.join(checkpointsDir, f);
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        file: f,
        path: filePath,
        id: content.checkpoint_id,
        phase: content.phase,
        created_at: content.created_at,
        projects: content.active_projects?.length || 0
      };
    } catch (e) {
      return { file: f, path: filePath, error: e.message };
    }
  });
}

/**
 * 체크포인트 로드
 */
function loadCheckpoint(checkpointId) {
  const checkpointsDir = path.join(MEMORY_DIR, 'checkpoints');

  // 전체 ID 또는 부분 매칭
  const files = fs.readdirSync(checkpointsDir)
    .filter(f => f.includes(checkpointId) && f.endsWith('.json'));

  if (files.length === 0) {
    return null;
  }

  const filePath = path.join(checkpointsDir, files[0]);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * 최신 체크포인트 로드
 */
function loadLatestCheckpoint() {
  const checkpoints = listCheckpoints(1);

  if (checkpoints.length === 0) {
    return null;
  }

  return JSON.parse(fs.readFileSync(checkpoints[0].path, 'utf-8'));
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

    const contextPath = path.join(DEV_ACTIVE_DIR, contextFile);
    const tasksPath = path.join(DEV_ACTIVE_DIR, tasksFile);

    const contextContent = fs.readFileSync(contextPath, 'utf-8');
    const hasTasksFile = files.includes(tasksFile);

    // 간단한 메타데이터 추출
    const statusMatch = contextContent.match(/Status:\s*(.+)/i);
    const progressMatch = contextContent.match(/Progress:\s*(\d+)%/i);
    const updatedMatch = contextContent.match(/Last Updated:\s*(.+)/i);

    projects.push({
      name: projectName,
      contextFile: contextPath,
      tasksFile: hasTasksFile ? tasksPath : null,
      status: statusMatch ? statusMatch[1].trim() : 'Unknown',
      progress: progressMatch ? parseInt(progressMatch[1]) : 0,
      lastUpdated: updatedMatch ? updatedMatch[1].trim() : 'Unknown'
    });
  }

  return projects;
}

/**
 * 프로젝트 컨텍스트 요약 생성
 */
function generateProjectSummary(project) {
  const contextContent = fs.readFileSync(project.contextFile, 'utf-8');

  // 섹션 추출
  const sections = {};
  const sectionRegex = /^##\s+(.+)$/gm;
  let match;
  let lastSection = null;
  let lastIndex = 0;

  while ((match = sectionRegex.exec(contextContent)) !== null) {
    if (lastSection) {
      sections[lastSection] = contextContent.slice(lastIndex, match.index).trim();
    }
    lastSection = match[1];
    lastIndex = match.index + match[0].length;
  }

  if (lastSection) {
    sections[lastSection] = contextContent.slice(lastIndex).trim();
  }

  return {
    project: project.name,
    status: project.status,
    progress: project.progress,
    lastUpdated: project.lastUpdated,
    sections: Object.keys(sections)
  };
}

/**
 * 미완료 태스크 추출
 */
function extractPendingTasks(project, limit = 5) {
  if (!project.tasksFile || !fs.existsSync(project.tasksFile)) {
    return [];
  }

  const content = fs.readFileSync(project.tasksFile, 'utf-8');
  const taskRegex = /^-\s*\[\s*\]\s*(.+)$/gm;
  const tasks = [];
  let match;

  while ((match = taskRegex.exec(content)) !== null && tasks.length < limit) {
    tasks.push(match[1].trim());
  }

  return tasks;
}

/**
 * 컨텍스트 상태 초기화
 */
function resetContextState() {
  const state = {
    count: 0,
    start: Date.now(),
    lastReminder: 0,
    estimatedTokens: 0,
    snapshotsTaken: 0,
    lastSnapshotAt: 0
  };

  fs.writeFileSync(CONTEXT_STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}

/**
 * 메인 실행
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'auto';

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('RESUME CONTEXT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  switch (command) {
    case 'auto':
    case 'latest': {
      // 활성 프로젝트 먼저 체크
      const projects = scanActiveProjects();

      if (projects.length === 0) {
        // 체크포인트에서 복원 시도
        const checkpoint = loadLatestCheckpoint();

        if (!checkpoint) {
          console.log('❌ No active projects or checkpoints found.\n');
          console.log('To start a new project:');
          console.log('  1. Describe your task');
          console.log('  2. Use /save-and-compact to save progress\n');
          break;
        }

        console.log(`📍 Restoring from checkpoint: ${checkpoint.checkpoint_id}`);
        console.log(`   Created: ${checkpoint.created_at}`);
        console.log(`   Phase: ${checkpoint.phase}\n`);
        break;
      }

      // 프로젝트가 1개면 자동 선택
      const project = projects.length === 1 ? projects[0] : null;

      if (!project) {
        console.log('📂 Multiple active projects found:\n');
        projects.forEach((p, i) => {
          console.log(`  [${i + 1}] ${p.name}`);
          console.log(`      Status: ${p.status}`);
          console.log(`      Progress: ${p.progress}%`);
          console.log(`      Updated: ${p.lastUpdated}\n`);
        });
        console.log('Specify project: node resumeContext.js project <name>\n');
        break;
      }

      // 컨텍스트 복원
      const summary = generateProjectSummary(project);
      const tasks = extractPendingTasks(project);

      console.log(`✅ CONTEXT RESTORED: ${project.name}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log(`## Status`);
      console.log(`Progress: ${project.progress}%`);
      console.log(`Last Updated: ${project.lastUpdated}`);
      console.log(`Sections: ${summary.sections.join(', ')}\n`);

      if (tasks.length > 0) {
        console.log(`## Pending Tasks (Top ${tasks.length})`);
        tasks.forEach((t, i) => {
          console.log(`  ${i + 1}. [ ] ${t}`);
        });
        console.log('');
      }

      // 컨텍스트 상태 리셋
      resetContextState();
      console.log('💡 Context monitor reset. Ready to continue.\n');
      break;
    }

    case 'list': {
      const checkpoints = listCheckpoints(10);

      if (checkpoints.length === 0) {
        console.log('No checkpoints found.\n');
        break;
      }

      console.log('Recent Checkpoints:\n');
      checkpoints.forEach(cp => {
        if (cp.error) {
          console.log(`  ❌ ${cp.file} (error: ${cp.error})`);
        } else {
          console.log(`  📍 ${cp.id}`);
          console.log(`     Phase: ${cp.phase}`);
          console.log(`     Created: ${cp.created_at}`);
          console.log(`     Projects: ${cp.projects}\n`);
        }
      });
      break;
    }

    case 'checkpoint': {
      const checkpointId = args[1];

      if (!checkpointId) {
        console.log('Usage: resumeContext.js checkpoint <checkpoint_id>\n');
        break;
      }

      const checkpoint = loadCheckpoint(checkpointId);

      if (!checkpoint) {
        console.log(`Checkpoint not found: ${checkpointId}\n`);
        break;
      }

      console.log(`📍 Checkpoint: ${checkpoint.checkpoint_id}`);
      console.log(`   Created: ${checkpoint.created_at}`);
      console.log(`   Phase: ${checkpoint.phase}`);
      console.log(`   Session: ${checkpoint.session.interactions} interactions`);
      console.log(`   Projects: ${checkpoint.active_projects.map(p => p.name).join(', ')}\n`);

      resetContextState();
      console.log('💡 Context monitor reset. Ready to continue.\n');
      break;
    }

    case 'projects': {
      const projects = scanActiveProjects();

      if (projects.length === 0) {
        console.log('No active projects in dev/active/\n');
        break;
      }

      console.log('Active Projects:\n');
      projects.forEach(p => {
        console.log(`  📂 ${p.name}`);
        console.log(`     Status: ${p.status}`);
        console.log(`     Progress: ${p.progress}%`);
        console.log(`     Updated: ${p.lastUpdated}\n`);
      });
      break;
    }

    case 'project': {
      const projectName = args[1];

      if (!projectName) {
        console.log('Usage: resumeContext.js project <project_name>\n');
        break;
      }

      const projects = scanActiveProjects();
      const project = projects.find(p => p.name === projectName || p.name.includes(projectName));

      if (!project) {
        console.log(`Project not found: ${projectName}\n`);
        break;
      }

      const summary = generateProjectSummary(project);
      const tasks = extractPendingTasks(project);

      console.log(`✅ CONTEXT RESTORED: ${project.name}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log(`## Status`);
      console.log(`Progress: ${project.progress}%`);
      console.log(`Last Updated: ${project.lastUpdated}\n`);

      if (tasks.length > 0) {
        console.log(`## Pending Tasks`);
        tasks.forEach((t, i) => {
          console.log(`  ${i + 1}. [ ] ${t}`);
        });
        console.log('');
      }

      resetContextState();
      console.log('💡 Context monitor reset. Ready to continue.\n');
      break;
    }

    default:
      console.log('Usage: resumeContext.js [auto|latest|list|checkpoint|projects|project]\n');
      console.log('Commands:');
      console.log('  auto       - Auto-detect and restore (default)');
      console.log('  latest     - Restore from latest checkpoint');
      console.log('  list       - List all checkpoints');
      console.log('  checkpoint - Restore specific checkpoint');
      console.log('  projects   - List active projects');
      console.log('  project    - Restore specific project\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main();
