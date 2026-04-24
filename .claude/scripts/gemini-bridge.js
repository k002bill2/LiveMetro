/**
 * Gemini Bridge - Claude Code <-> Gemini CLI Integration
 *
 * @description Claude Code와 Gemini CLI 간 크로스 검증 브릿지.
 *   코드 변경 리뷰, 대규모 분석, 독립 태스크 위임을 지원합니다.
 * @event PostToolUse (Edit|Write) - geminiAutoTrigger.js에서 호출
 * @event UserPromptSubmit - userPromptSubmit.js에서 결과 주입
 * @param {string} mode - 실행 모드: review | scan | parallel | status
 * @param {string[]} [files] - 대상 파일 목록 (review/scan 모드)
 *
 * Modes:
 *   review  - Cross-verify code changes via Gemini
 *   scan    - Large-context codebase analysis
 *   parallel - Delegate independent tasks
 *   status  - Show current Gemini job status
 *
 * All results saved to .claude/gemini-bridge/
 * Gemini is READ-ONLY: never edits src/ files.
 *
 * @version 1.1.0
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');

// --- Constants ---
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BRIDGE_DIR = path.join(PROJECT_ROOT, '.claude', 'gemini-bridge');
const REVIEWS_DIR = path.join(BRIDGE_DIR, 'reviews');
const STATE_FILE = path.join(PROJECT_ROOT, '.claude', 'gemini-bridge', 'state.json');
const ERRORS_LOG = path.join(BRIDGE_DIR, 'errors.log');
const GEMINI_BIN = '/opt/homebrew/bin/gemini';
const GEMINI_MD = path.join(PROJECT_ROOT, 'GEMINI.md');

const TIMEOUT_REVIEW = 180_000;
const TIMEOUT_SCAN = 300_000;
const DAILY_LIMIT = 900;

// --- State Management ---

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const state = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      if (state.date !== today) {
        state.date = today;
        state.callCount = 0;
        state.activeJobs = [];
      }
      return state;
    }
  } catch (e) {
    logError('loadState', e);
  }
  return {
    date: new Date().toISOString().slice(0, 10),
    callCount: 0,
    dailyLimit: DAILY_LIMIT,
    activeJobs: [],
    pendingReviews: []
  };
}

function saveState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  } catch (e) {
    logError('saveState', e);
  }
}

function canCallGemini(state) {
  return state.callCount < (state.dailyLimit || DAILY_LIMIT);
}

function incrementCallCount(state) {
  state.callCount++;
  saveState(state);
}

// --- Error Logging ---

function logError(context, error) {
  try {
    if (!fs.existsSync(BRIDGE_DIR)) fs.mkdirSync(BRIDGE_DIR, { recursive: true });
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${context}] ${error.message || error}\n`;
    fs.appendFileSync(ERRORS_LOG, entry);
  } catch (_) {}
}

// --- Gemini Invocation ---

function callGemini(prompt, options = {}) {
  const { timeoutMs = TIMEOUT_REVIEW, outputFormat = 'text' } = options;
  const TMPFILE_THRESHOLD = 200_000;

  return new Promise((resolve) => {
    if (!fs.existsSync(GEMINI_BIN)) {
      resolve({ success: false, output: '', error: 'Gemini binary not found at ' + GEMINI_BIN });
      return;
    }

    if (!fs.existsSync(BRIDGE_DIR)) {
      try { fs.mkdirSync(BRIDGE_DIR, { recursive: true }); } catch (_) {}
    }

    const useTmpFile = prompt.length > TMPFILE_THRESHOLD;
    let tmpFile = null;

    if (useTmpFile) {
      tmpFile = path.join(BRIDGE_DIR, `.prompt-${Date.now()}.tmp`);
      try {
        fs.writeFileSync(tmpFile, prompt);
      } catch (e) {
        resolve({ success: false, output: '', error: 'Failed to write temp prompt: ' + e.message });
        return;
      }
    }

    const args = [];
    const readOnlyPrefix = 'CRITICAL CONSTRAINT: You are a READ-ONLY reviewer. You MUST NOT use any tools that write, edit, or delete files (WriteFile, EditFile, ReplaceInFile, etc). Only analyze and respond with text. ';

    if (useTmpFile) {
      args.push('-p', readOnlyPrefix + 'Analyze the content provided via stdin. Follow all instructions within the stdin content.');
    } else {
      args.push('-p', readOnlyPrefix + prompt);
    }

    args.push('--output-format', outputFormat);
    args.push('--yolo');

    let stdout = '';
    let stderr = '';
    let killed = false;

    const child = spawn(GEMINI_BIN, args, {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        TERM: 'dumb',
        NODE_OPTIONS: '--max-old-space-size=2048'
      },
      stdio: [useTmpFile ? 'pipe' : 'ignore', 'pipe', 'pipe']
    });

    if (useTmpFile) {
      const content = fs.readFileSync(tmpFile, 'utf8');
      child.stdin.on('error', () => {});
      child.stdin.write(content, () => {
        try { child.stdin.end(); } catch (_) {}
      });
    }

    const timer = setTimeout(() => {
      killed = true;
      try { process.kill(child.pid, 'SIGTERM'); } catch (_) {}
      setTimeout(() => {
        try { process.kill(child.pid, 'SIGKILL'); } catch (_) {}
      }, 5000);
    }, timeoutMs);

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (tmpFile) {
        try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (_) {}
      }

      if (killed) {
        resolve({ success: false, output: stdout, error: `Timeout after ${timeoutMs}ms` });
      } else if (code !== 0) {
        resolve({ success: false, output: stdout, error: `Exit code ${code}: ${stderr.slice(0, 500)}` });
      } else {
        resolve({ success: true, output: stdout });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (tmpFile) {
        try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (_) {}
      }
      resolve({ success: false, output: '', error: err.message });
    });
  });
}

// --- Review Mode ---

async function runReview(files = []) {
  const state = loadState();

  const staleThreshold = Date.now() - (TIMEOUT_REVIEW + 30_000);
  const staleCount = state.activeJobs.length;
  state.activeJobs = state.activeJobs.filter(j => {
    const startTime = new Date(j.startedAt).getTime();
    return startTime > staleThreshold;
  });
  if (state.activeJobs.length < staleCount) {
    saveState(state);
  }

  if (!canCallGemini(state)) {
    console.log('[GEMINI] Daily limit reached (' + state.callCount + '/' + state.dailyLimit + '). Skipping review.');
    return { skipped: true, reason: 'daily_limit' };
  }

  let diff;
  try {
    if (files.length > 0) {
      diff = execSync(`git diff HEAD -- ${files.map(f => `"${f}"`).join(' ')}`, {
        cwd: PROJECT_ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024
      });
    } else {
      diff = execSync('git diff HEAD', {
        cwd: PROJECT_ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024
      });
    }
  } catch (e) {
    try {
      diff = execSync('git diff', {
        cwd: PROJECT_ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024
      });
    } catch (e2) {
      logError('runReview:git-diff', e2);
      return { skipped: true, reason: 'git_diff_failed' };
    }
  }

  if (!diff || diff.trim().length === 0) {
    return { skipped: true, reason: 'no_changes' };
  }

  const diffHash = crypto.createHash('md5').update(diff).digest('hex').slice(0, 12);
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  const recentDuplicate = (state.pendingReviews || []).find(r => {
    return r.diffHash === diffHash && new Date(r.timestamp).getTime() > tenMinAgo;
  });
  if (recentDuplicate) {
    return { skipped: true, reason: 'duplicate_diff', existingReview: recentDuplicate.id };
  }

  const maxDiffLen = 30_000; // Reduced from 50K to speed up Gemini response time
  if (diff.length > maxDiffLen) {
    diff = truncateDiffSmart(diff, maxDiffLen);
  }

  let recentCommits = '';
  try {
    recentCommits = execSync('git log --oneline -5 2>/dev/null', {
      cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 3000
    }).trim();
  } catch (_) {}

  let geminiContext = '';
  try {
    if (fs.existsSync(GEMINI_MD)) {
      geminiContext = fs.readFileSync(GEMINI_MD, 'utf8');
    }
  } catch (_) {}

  const prompt = buildReviewPrompt(diff, geminiContext, recentCommits);

  const jobId = `review-${Date.now()}`;
  state.activeJobs.push({ id: jobId, mode: 'review', startedAt: new Date().toISOString() });
  incrementCallCount(state);

  const result = await callGemini(prompt, { timeoutMs: TIMEOUT_REVIEW, outputFormat: 'text' });

  const updatedState = loadState();
  updatedState.activeJobs = updatedState.activeJobs.filter(j => j.id !== jobId);

  let validatedReview = result.success ? result.output : null;
  let validationMeta = null;
  if (result.success && validatedReview) {
    const validation = validateReviewIssues(validatedReview, diff);
    if (validation.modified) {
      validationMeta = { removedCount: validation.removedCount, filtered: true };
      validatedReview = validation.filteredText;
    }
  }

  const reviewResult = {
    id: jobId,
    timestamp: new Date().toISOString(),
    status: result.success ? 'completed' : 'failed',
    filesReviewed: files.length > 0 ? files : ['(all changed files)'],
    diffLength: diff.length,
    review: validatedReview,
    rawReview: (validationMeta && result.output !== validatedReview) ? result.output : undefined,
    validation: validationMeta || undefined,
    error: result.error || null
  };

  if (result.success) {
    updatedState.pendingReviews.push({
      id: jobId,
      timestamp: reviewResult.timestamp,
      status: 'completed',
      diffHash
    });
  }

  saveState(updatedState);
  saveReview(reviewResult);
  cleanupReviews();

  return reviewResult;
}

function truncateDiffSmart(diff, maxLen) {
  const fileSections = diff.split(/(?=^diff --git )/m);
  const maxPerFile = Math.floor(maxLen / Math.max(fileSections.length, 1));
  let result = '';
  let truncatedCount = 0;

  for (const section of fileSections) {
    if (result.length + section.length <= maxLen) {
      result += section;
    } else {
      const remaining = maxLen - result.length;
      if (remaining > 200) {
        const truncated = section.slice(0, Math.min(remaining, maxPerFile));
        result += truncated + '\n... [FILE TRUNCATED]\n';
        truncatedCount++;
      } else {
        truncatedCount++;
      }
    }
  }

  if (truncatedCount > 0) {
    result += `\n... [${truncatedCount} file(s) truncated to fit ${Math.round(maxLen / 1024)}KB limit]\n`;
  }

  return result;
}

function buildReviewPrompt(diff, geminiContext, recentCommits = '') {
  const contextBlock = geminiContext
    ? `\n\nPROJECT CONTEXT:\n${geminiContext}\n`
    : '';

  const activeSkills = detectSkillsFromDiff(diff);
  const skillBlock = activeSkills.length > 0
    ? `\nACTIVATED SKILLS: ${activeSkills.join(', ')}\nApply the review criteria from these skills to the diff below.\n`
    : '';

  const commitsBlock = recentCommits
    ? `\nRECENT COMMITS (for intent context):\n${recentCommits}\n`
    : '';

  return `You are a verification partner reviewing Claude Code's changes for a LiveMetro project (React Native + Expo + Firebase mobile app for Seoul subway real-time arrivals).
${contextBlock}${skillBlock}${commitsBlock}
CRITICAL INSTRUCTION FOR READING THE DIFF:
The content below is a UNIFIED DIFF produced by \`git diff\`.
- Lines starting with \`+\` are ADDED lines (the \`+\` is NOT part of the code)
- Lines starting with \`-\` are REMOVED lines (the \`-\` is NOT part of the code)
- Lines starting with \`@@\` are hunk headers showing line numbers
- Do NOT report diff format characters as syntax errors
- Operators like \`!==\`, \`===\`, \`!=\`, \`>=\` are valid JS/TS operators
- When evaluating syntax, mentally strip the leading \`+\` or \`-\` prefix first

Focus ONLY on issues that local static analysis would miss:
1. Cross-file consistency (interface changes propagated?)
2. Security boundaries (auth, validation, secrets)
3. Performance at scale (N+1, re-render storms, missing memo)
4. Error propagation gaps (async errors surfaced to user?)
5. Type safety across frontend-backend boundary

Skip: formatting, naming conventions, simple type issues (already caught by linters).

Respond in this EXACT format (no preamble, no tool-use reasoning, ONLY the structured output):
ISSUES:
- [severity:critical|warning|info] file:line - description

VERDICT: approve | needs-attention
SUMMARY: (1 sentence)

If no issues:
ISSUES: none
VERDICT: approve
SUMMARY: Changes look good.

DIFF:
${diff}`;
}

// --- Skill Detection ---

function detectSkillsFromDiff(diff) {
  const skills = new Set();

  skills.add('code-review');

  const securityFilePatterns = [
    /auth[._/]/i, /\.env/i, /secret/i, /credential/i, /oauth/i
  ];
  const securityContentPatterns = [
    /auth[._/](?!or)/i, /password/i, /secret/i,
    /cors/i, /oauth/i, /credential/i,
    /sanitize/i, /validate.*input/i
  ];
  const hasSecurityFile = securityFilePatterns.some(p => {
    return diff.split('\n').some(line =>
      (/^diff --git|^---|^\+\+\+/.test(line)) && p.test(line)
    );
  });
  const securityContentMatches = securityContentPatterns.filter(p => p.test(diff)).length;
  if (hasSecurityFile || securityContentMatches >= 2) {
    skills.add('security-audit');
  }

  const hasFrontend = /src\/(types|hooks|components|screens)/.test(diff);
  const hasBackend = /src\/services/.test(diff);
  if (hasFrontend && hasBackend) {
    skills.add('type-safety');
  }

  if (/\.(types|models)\.(ts|py)/.test(diff) || /interface\s+\w+|class\s+\w+.*BaseModel/.test(diff)) {
    skills.add('type-safety');
  }

  const archPatterns = [
    /^diff --git.*new file/m,
    /from\s+\.\.|import.*from\s+['"]@\//,
    /router\.(get|post|put|delete|patch)/i,
    /create<.*State>/,
  ];
  if (archPatterns.some(p => p.test(diff))) {
    skills.add('architecture-check');
  }

  return [...skills];
}

// --- Post-Validation Filter ---

function validateReviewIssues(reviewText, diff) {
  const lines = reviewText.split('\n');
  let removedCount = 0;
  let modified = false;
  const filteredLines = [];

  const diffFiles = new Set();
  const diffSections = {};
  const fileHeaderRegex = /^diff --git a\/(.+?) b\/(.+)$/;
  let currentFile = null;

  for (const line of diff.split('\n')) {
    const fileMatch = line.match(fileHeaderRegex);
    if (fileMatch) {
      currentFile = fileMatch[2];
      diffFiles.add(currentFile);
      diffSections[currentFile] = [];
    }
    if (currentFile && /^@@/.test(line)) {
      const hunkMatch = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (hunkMatch) {
        const start = parseInt(hunkMatch[1], 10);
        const count = parseInt(hunkMatch[2] || '1', 10);
        diffSections[currentFile].push({ start, end: start + count - 1 });
      }
    }
  }

  const escapedOperatorPattern = /\\!==|\\===|\\!=|\\>=|\\<=|\\&&|\\\|\|/;

  let inIssuesBlock = false;
  let currentIssueLines = [];
  let issueRemoved = false;
  let criticalOrWarningCount = 0;

  function flushIssue() {
    if (currentIssueLines.length === 0) return;
    if (issueRemoved) {
      removedCount++;
      modified = true;
    } else {
      for (const il of currentIssueLines) {
        filteredLines.push(il);
        if (/\[severity:(critical|warning)\]/.test(il)) {
          criticalOrWarningCount++;
        }
      }
    }
    currentIssueLines = [];
    issueRemoved = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^ISSUES:/i.test(trimmed)) {
      inIssuesBlock = true;
      filteredLines.push(line);
      continue;
    }

    if (inIssuesBlock && /^(VERDICT|SUMMARY):/i.test(trimmed)) {
      flushIssue();
      inIssuesBlock = false;

      if (/^VERDICT:/i.test(trimmed) && criticalOrWarningCount === 0 && removedCount > 0) {
        filteredLines.push('VERDICT: approve');
        modified = true;
        continue;
      }

      filteredLines.push(line);
      continue;
    }

    if (!inIssuesBlock) {
      filteredLines.push(line);
      continue;
    }

    if (/^\s*-\s*\[severity:/.test(line)) {
      flushIssue();
      currentIssueLines = [line];

      if (escapedOperatorPattern.test(line)) {
        issueRemoved = true;
        continue;
      }

      const fileRef = line.match(/\]\s+([^\s:]+):(\d+)/);
      if (fileRef) {
        const refFile = fileRef[1];
        const refLine = parseInt(fileRef[2], 10);

        const fileInDiff = diffFiles.has(refFile) ||
          [...diffFiles].some(f => f.endsWith('/' + refFile) || f === refFile);

        if (!fileInDiff) {
          currentIssueLines = [line.replace(/\[severity:(critical|warning)\]/, '[severity:info][phantom-file]')];
          if (/\[severity:(critical|warning)\]/.test(line)) modified = true;
          continue;
        }

        const matchingDiffFile = [...diffFiles].find(f => f.endsWith('/' + refFile) || f === refFile);
        if (matchingDiffFile && diffSections[matchingDiffFile]) {
          const ranges = diffSections[matchingDiffFile];
          const inRange = ranges.some(r => refLine >= r.start && refLine <= r.end);
          if (!inRange && ranges.length > 0) {
            currentIssueLines = [line.replace(/\[severity:(critical|warning)\]/, '[severity:info][out-of-hunk]')];
            if (/\[severity:(critical|warning)\]/.test(line)) modified = true;
          }
        }
      }
    } else {
      currentIssueLines.push(line);
    }
  }

  flushIssue();

  const result = filteredLines.join('\n');
  if (removedCount > 0 && !/\[severity:/.test(result) && /^ISSUES:\s*$/m.test(result)) {
    return {
      filteredText: result.replace(/^ISSUES:\s*$/m, 'ISSUES: none'),
      removedCount,
      modified: true
    };
  }

  return { filteredText: result, removedCount, modified };
}

// --- Scan Mode ---

async function runScan(options = {}) {
  const { scope = 'full', analysisType = 'architecture' } = options;

  const state = loadState();
  if (!canCallGemini(state)) {
    console.log('[GEMINI] Daily limit reached. Skipping scan.');
    return { skipped: true, reason: 'daily_limit' };
  }

  let sourceContent = '';
  try {
    sourceContent = collectSource(scope);
  } catch (e) {
    logError('runScan:collectSource', e);
    return { skipped: true, reason: 'source_collection_failed', error: e.message };
  }

  if (!sourceContent || sourceContent.length === 0) {
    return { skipped: true, reason: 'no_source_files' };
  }

  const maxLen = 40_000; // Reduced from 120K for faster Gemini response
  if (sourceContent.length > maxLen) {
    sourceContent = sourceContent.slice(0, maxLen) + '\n\n... [TRUNCATED - ' +
      Math.round(sourceContent.length / 1024) + 'KB total, showing first ' +
      Math.round(maxLen / 1024) + 'KB] ...';
  }

  let geminiContext = '';
  try {
    if (fs.existsSync(GEMINI_MD)) {
      geminiContext = fs.readFileSync(GEMINI_MD, 'utf8');
    }
  } catch (_) {}

  const prompt = buildScanPrompt(sourceContent, analysisType, scope, geminiContext);

  const jobId = `scan-${Date.now()}`;
  state.activeJobs.push({ id: jobId, mode: 'scan', startedAt: new Date().toISOString() });
  incrementCallCount(state);

  const result = await callGemini(prompt, { timeoutMs: TIMEOUT_SCAN, outputFormat: 'text' });

  const updatedState = loadState();
  updatedState.activeJobs = updatedState.activeJobs.filter(j => j.id !== jobId);

  const scanResult = {
    id: jobId,
    timestamp: new Date().toISOString(),
    status: result.success ? 'completed' : 'failed',
    scope,
    analysisType,
    sourceLength: sourceContent.length,
    analysis: result.success ? result.output : null,
    error: result.error || null
  };

  saveState(updatedState);
  saveReview(scanResult);
  cleanupReviews();

  return scanResult;
}

function collectSource(scope) {
  const files = [];
  const extensions = {
    backend: ['.ts'],
    frontend: ['.ts', '.tsx'],
    full: ['.ts', '.tsx']
  };

  const dirs = {
    backend: [path.join(PROJECT_ROOT, 'src', 'services')],
    frontend: [path.join(PROJECT_ROOT, 'src')],
    full: [path.join(PROJECT_ROOT, 'src')]
  };

  const targetDirs = dirs[scope] || dirs.full;
  const targetExts = extensions[scope] || extensions.full;

  for (const dir of targetDirs) {
    collectFilesRecursive(dir, targetExts, files);
  }

  let result = '';
  for (const filePath of files) {
    try {
      const relativePath = path.relative(PROJECT_ROOT, filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      result += `\n${'='.repeat(60)}\n`;
      result += `FILE: ${relativePath}\n`;
      result += `${'='.repeat(60)}\n`;
      result += content + '\n';
    } catch (_) {}
  }

  return result;
}

function collectFilesRecursive(dir, extensions, result) {
  if (!fs.existsSync(dir)) return;

  const skipDirs = ['node_modules', '__pycache__', '.git', 'dist', 'build', '.venv', 'venv'];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.includes(entry.name)) {
          collectFilesRecursive(fullPath, extensions, result);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          result.push(fullPath);
        }
      }
    }
  } catch (_) {}
}

function buildScanPrompt(source, analysisType, scope, geminiContext) {
  const analysisInstructions = {
    architecture: `Analyze the overall architecture:
1. Component dependency graph - are there circular dependencies?
2. Layer separation - does the code respect service/screen boundaries?
3. API contract consistency - do types match Firebase schemas?
4. Missing abstractions or over-engineering?`,

    deps: `Analyze the import/dependency graph:
1. Circular import chains
2. Unused imports
3. Heavy transitive dependencies
4. Opportunities for lazy loading`,

    'dead-code': `Identify dead code:
1. Exported functions/components never imported elsewhere
2. Unreachable code paths
3. Unused variables, types, or interfaces
4. Deprecated patterns still present`,

    security: `Security audit:
1. Authentication/authorization gaps
2. Input validation missing
3. Secrets or credentials in code
4. Firebase rules vulnerabilities
5. Insecure defaults`
  };

  const instructions = analysisInstructions[analysisType] || analysisInstructions.architecture;
  const contextBlock = geminiContext ? `\nPROJECT CONTEXT:\n${geminiContext}\n` : '';

  const skillMap = {
    architecture: 'architecture-check',
    security: 'security-audit',
    deps: 'architecture-check',
    'dead-code': 'architecture-check'
  };
  const skill = skillMap[analysisType] || 'architecture-check';

  return `You are analyzing the ${scope} scope of a LiveMetro project (React Native + Expo + Firebase).
${contextBlock}
ACTIVATED SKILL: ${skill}
ANALYSIS TYPE: ${analysisType}

${instructions}

Respond in this format:
FINDINGS:
- [severity:critical|warning|info] file:line - description

RECOMMENDATIONS:
- [priority:high|medium|low] description

SUMMARY: (2-3 sentences)

SOURCE CODE:
${source}`;
}

// --- Parallel Mode ---

async function runParallel(task, prompt) {
  const state = loadState();
  if (!canCallGemini(state)) {
    return { skipped: true, reason: 'daily_limit' };
  }

  const jobId = `parallel-${Date.now()}`;
  state.activeJobs.push({ id: jobId, mode: 'parallel', task, startedAt: new Date().toISOString() });
  incrementCallCount(state);

  const result = await callGemini(prompt, { timeoutMs: TIMEOUT_SCAN, outputFormat: 'text' });

  const updatedState = loadState();
  updatedState.activeJobs = updatedState.activeJobs.filter(j => j.id !== jobId);

  const parallelResult = {
    id: jobId,
    timestamp: new Date().toISOString(),
    mode: 'parallel',
    task,
    status: result.success ? 'completed' : 'failed',
    output: result.success ? result.output : null,
    error: result.error || null
  };

  if (result.success) {
    updatedState.pendingReviews.push({
      id: jobId,
      timestamp: parallelResult.timestamp,
      status: 'completed'
    });
  }

  saveState(updatedState);
  saveReview(parallelResult);
  cleanupReviews();

  return parallelResult;
}

// --- Status Mode ---

function showStatus() {
  const state = loadState();

  console.log('\n' + '='.repeat(50));
  console.log('GEMINI BRIDGE STATUS');
  console.log('='.repeat(50));
  console.log(`Date: ${state.date}`);
  console.log(`API Calls: ${state.callCount} / ${state.dailyLimit}`);
  console.log(`Active Jobs: ${state.activeJobs.length}`);
  console.log(`Pending Reviews: ${state.pendingReviews.filter(r => r.status === 'completed').length}`);

  if (state.activeJobs.length > 0) {
    console.log('\nActive:');
    for (const job of state.activeJobs) {
      console.log(`  - [${job.mode}] ${job.id} (started: ${job.startedAt})`);
    }
  }

  if (state.pendingReviews.length > 0) {
    const pending = state.pendingReviews.filter(r => r.status === 'completed');
    if (pending.length > 0) {
      console.log('\nPending Reviews:');
      for (const review of pending) {
        console.log(`  - ${review.id} (${review.timestamp})`);
      }
    }
  }

  console.log('='.repeat(50) + '\n');

  return state;
}

// --- Review Storage ---

function saveReview(result) {
  try {
    if (!fs.existsSync(REVIEWS_DIR)) fs.mkdirSync(REVIEWS_DIR, { recursive: true });
    const filePath = path.join(REVIEWS_DIR, `${result.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2) + '\n');
  } catch (e) {
    logError('saveReview', e);
  }
}

function loadReview(reviewId) {
  try {
    const filePath = path.join(REVIEWS_DIR, `${reviewId}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    logError('loadReview', e);
  }
  return null;
}

function cleanupReviews(maxReviews = 50) {
  try {
    if (!fs.existsSync(REVIEWS_DIR)) return { removed: 0 };

    const files = fs.readdirSync(REVIEWS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(REVIEWS_DIR, f),
        mtime: fs.statSync(path.join(REVIEWS_DIR, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime);

    let removed = 0;
    if (files.length > maxReviews) {
      const toRemove = files.slice(maxReviews);
      for (const file of toRemove) {
        try { fs.unlinkSync(file.path); removed++; } catch (_) {}
      }
    }

    const state = loadState();
    const existingIds = new Set(
      fs.readdirSync(REVIEWS_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
    );
    state.pendingReviews = state.pendingReviews.filter(r => existingIds.has(r.id));
    saveState(state);

    return { removed, remaining: files.length - removed };
  } catch (e) {
    logError('cleanupReviews', e);
    return { removed: 0, error: e.message };
  }
}

// --- Exports ---

module.exports = {
  runReview,
  runScan,
  runParallel,
  showStatus,
  loadState,
  saveState,
  canCallGemini,
  loadReview,
  cleanupReviews,
  callGemini,
  validateReviewIssues,
  detectSkillsFromDiff,
  BRIDGE_DIR,
  REVIEWS_DIR,
  STATE_FILE
};

// --- CLI Entry Point ---

// --- Background Runner ---
// Spawns a detached child that runs the actual Gemini call and saves results to disk.
// Returns immediately with job ID so Claude Code doesn't get killed by process timeout.

function runInBackground(mode, cliArgs) {
  const scriptContent = `
    process.on('uncaughtException', (e) => {
      require('fs').appendFileSync(${JSON.stringify(ERRORS_LOG)}, '[' + new Date().toISOString() + '] [bg-' + '${mode}] ' + e.message + '\\n');
      process.exit(1);
    });
    const bridge = require(${JSON.stringify(path.join(PROJECT_ROOT, '.claude', 'scripts', 'gemini-bridge.js'))});
    (async () => {
      ${mode === 'review' ? `
        const result = await bridge.runReview(${JSON.stringify(cliArgs)});
        if (result.status === 'completed') {
          console.log('[GEMINI-BG] Review completed: ' + result.id);
        }
      ` : mode === 'scan' ? `
        const result = await bridge.runScan(${JSON.stringify({ scope: cliArgs[0] || 'full', analysisType: cliArgs[1] || 'architecture' })});
        if (result.status === 'completed') {
          console.log('[GEMINI-BG] Scan completed: ' + result.id);
        }
      ` : ''}
      process.exit(0);
    })();
  `;

  const child = spawn('node', ['-e', scriptContent], {
    cwd: PROJECT_ROOT,
    stdio: 'ignore',
    detached: true
  });
  child.unref();
  return child.pid;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args[0] || 'status';
  const useBackground = args.includes('--bg') || args.includes('--background');
  const filteredArgs = args.filter(a => a !== '--bg' && a !== '--background');

  (async () => {
    try {
      switch (mode) {
        case 'review': {
          const files = filteredArgs.slice(1);
          if (useBackground) {
            const pid = runInBackground('review', files);
            console.log(`[GEMINI] Review started in background (PID: ${pid}). Check results with: node .claude/scripts/gemini-bridge.js status`);
          } else {
            console.log('[GEMINI] Starting review...');
            const result = await runReview(files);
            if (result.skipped) {
              console.log('[GEMINI] Review skipped:', result.reason);
            } else if (result.status === 'completed') {
              console.log('[GEMINI] Review completed:', result.id);
              console.log('\n' + result.review);
            } else {
              console.log('[GEMINI] Review failed:', result.error);
            }
          }
          break;
        }

        case 'scan': {
          const scope = filteredArgs[1] || 'full';
          const analysisType = filteredArgs[2] || 'architecture';
          if (useBackground) {
            const pid = runInBackground('scan', [scope, analysisType]);
            console.log(`[GEMINI] Scan started in background (PID: ${pid}). Check results with: node .claude/scripts/gemini-bridge.js status`);
          } else {
            console.log(`[GEMINI] Starting ${analysisType} scan (${scope})...`);
            const result = await runScan({ scope, analysisType });
            if (result.skipped) {
              console.log('[GEMINI] Scan skipped:', result.reason);
            } else if (result.status === 'completed') {
              console.log('[GEMINI] Scan completed:', result.id);
              console.log('\n' + result.analysis);
            } else {
              console.log('[GEMINI] Scan failed:', result.error);
            }
          }
          break;
        }

        case 'parallel': {
          const task = filteredArgs[1] || 'custom-task';
          let prompt = '';
          process.stdin.setEncoding('utf8');
          process.stdin.on('data', (chunk) => { prompt += chunk; });
          process.stdin.on('end', async () => {
            if (!prompt.trim()) {
              console.log('[GEMINI] No prompt provided on stdin for parallel mode.');
              process.exit(0);
            }
            const result = await runParallel(task, prompt);
            if (result.status === 'completed') {
              console.log('[GEMINI] Parallel task completed:', result.id);
              console.log('\n' + result.output);
            } else {
              console.log('[GEMINI] Parallel task failed:', result.error);
            }
            process.exit(0);
          });
          return;
        }

        case 'status':
          showStatus();
          break;

        case 'latest': {
          // Show most recent review/scan result
          try {
            if (!fs.existsSync(REVIEWS_DIR)) { console.log('[GEMINI] No reviews found.'); break; }
            const files = fs.readdirSync(REVIEWS_DIR).filter(f => f.endsWith('.json'))
              .map(f => ({ name: f, path: path.join(REVIEWS_DIR, f), mtime: fs.statSync(path.join(REVIEWS_DIR, f)).mtimeMs }))
              .sort((a, b) => b.mtime - a.mtime);
            if (files.length === 0) { console.log('[GEMINI] No reviews found.'); break; }
            const latest = JSON.parse(fs.readFileSync(files[0].path, 'utf8'));
            console.log(`[GEMINI] Latest result: ${latest.id} (${latest.status})`);
            console.log(latest.review || latest.analysis || latest.output || '(no output)');
          } catch (e) { console.log('[GEMINI] Error reading latest:', e.message); }
          break;
        }

        case 'cleanup': {
          const maxReviews = parseInt(filteredArgs[1], 10) || 50;
          console.log(`[GEMINI] Cleaning up reviews (keeping last ${maxReviews})...`);
          const result = cleanupReviews(maxReviews);
          console.log(`[GEMINI] Removed ${result.removed} old reviews, ${result.remaining} remaining.`);
          break;
        }

        default:
          console.log('Usage: gemini-bridge.js <review|scan|parallel|status|latest|cleanup> [--bg] [args...]');
      }
    } catch (e) {
      logError('cli', e);
      console.error('[GEMINI] Error:', e.message);
    }

    process.exit(0);
  })();
}
