/**
 * Agent Memory - Self-Evolution System
 * 에이전트 학습 기록/조회 유틸리티
 *
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname);
const SHARED_FILE = path.join(MEMORY_DIR, 'shared-learnings.jsonl');
const MAX_ENTRIES_PER_FILE = 500;

/**
 * 학습 이벤트 기록
 * @param {Object} event - 학습 이벤트
 * @param {string} event.agentId - 에이전트 ID
 * @param {string} event.eventType - success | failure | pattern | insight
 * @param {string} event.taskContext - 태스크 설명
 * @param {string} event.learning - 배운 내용
 * @param {number} [event.confidence=0.7] - 신뢰도 (0.0-1.0)
 * @param {string[]} [event.tags=[]] - 태그
 * @param {string[]} [event.relatedFiles=[]] - 관련 파일
 */
function recordLearning(event) {
  const entry = {
    timestamp: new Date().toISOString(),
    agentId: event.agentId,
    eventType: event.eventType || 'insight',
    taskContext: event.taskContext || '',
    learning: event.learning,
    confidence: event.confidence ?? 0.7,
    tags: event.tags || [],
    relatedFiles: event.relatedFiles || [],
  };

  // 에이전트별 파일에 기록
  const agentFile = path.join(MEMORY_DIR, `${sanitizeFilename(event.agentId)}.jsonl`);
  appendEntry(agentFile, entry);

  // confidence 0.8 이상이면 공유 학습에도 기록
  if (entry.confidence >= 0.8) {
    appendEntry(SHARED_FILE, entry);
  }

  return entry;
}

/**
 * 관련 학습 조회
 * @param {Object} query
 * @param {string} [query.agentId] - 특정 에이전트 (없으면 shared)
 * @param {string[]} [query.tags] - 태그 필터
 * @param {string} [query.eventType] - 이벤트 유형 필터
 * @param {number} [query.minConfidence=0.5] - 최소 신뢰도
 * @param {number} [query.limit=10] - 최대 결과 수
 * @returns {Object[]} 매칭된 학습 이벤트들
 */
function queryLearnings(query = {}) {
  const minConfidence = query.minConfidence ?? 0.5;
  const limit = query.limit ?? 10;

  // 조회 대상 파일 결정
  let targetFile;
  if (query.agentId) {
    targetFile = path.join(MEMORY_DIR, `${sanitizeFilename(query.agentId)}.jsonl`);
  } else {
    targetFile = SHARED_FILE;
  }

  if (!fs.existsSync(targetFile)) {
    return [];
  }

  const lines = fs.readFileSync(targetFile, 'utf8').trim().split('\n').filter(Boolean);
  let entries = lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);

  // 필터링
  entries = entries.filter((e) => e.confidence >= minConfidence);

  if (query.tags && query.tags.length > 0) {
    entries = entries.filter((e) =>
      query.tags.some((tag) => e.tags.includes(tag))
    );
  }

  if (query.eventType) {
    entries = entries.filter((e) => e.eventType === query.eventType);
  }

  // 최신 + 높은 신뢰도 우선 정렬
  entries.sort((a, b) => {
    const confDiff = b.confidence - a.confidence;
    if (Math.abs(confDiff) > 0.1) return confDiff;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return entries.slice(0, limit);
}

/**
 * 학습을 프롬프트 컨텍스트로 포맷
 * @param {Object[]} learnings - queryLearnings 결과
 * @returns {string} 에이전트 프롬프트에 삽입할 텍스트
 */
function formatForPrompt(learnings) {
  if (!learnings || learnings.length === 0) {
    return '';
  }

  let text = '\n## Previous Learnings (Agent Memory)\n\n';
  for (const l of learnings) {
    const icon = l.eventType === 'failure' ? '⚠️' : l.eventType === 'success' ? '✅' : '💡';
    text += `${icon} [${l.confidence.toFixed(1)}] ${l.learning}\n`;
    if (l.taskContext) {
      text += `   Context: ${l.taskContext}\n`;
    }
    text += '\n';
  }
  return text;
}

/**
 * 오래된/낮은 신뢰도 항목 정리
 * @param {number} [maxAgeDays=30] - 최대 보존 일수
 * @param {number} [minConfidence=0.3] - 최소 신뢰도
 */
function pruneOldEntries(maxAgeDays = 30, minConfidence = 0.3) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const files = fs.readdirSync(MEMORY_DIR).filter((f) => f.endsWith('.jsonl'));

  for (const file of files) {
    const filePath = path.join(MEMORY_DIR, file);
    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);

    const kept = lines.filter((line) => {
      try {
        const entry = JSON.parse(line);
        const entryDate = new Date(entry.timestamp);
        // 높은 신뢰도는 항상 보존
        if (entry.confidence >= 0.8) return true;
        // 낮은 신뢰도 + 오래된 항목 제거
        return entry.confidence >= minConfidence && entryDate >= cutoff;
      } catch {
        return false;
      }
    });

    if (kept.length < lines.length) {
      fs.writeFileSync(filePath, kept.join('\n') + '\n');
    }
  }
}

// --- Helpers ---

function appendEntry(filePath, entry) {
  const line = JSON.stringify(entry) + '\n';

  // 파일 크기 제한 확인
  if (fs.existsSync(filePath)) {
    const lineCount = fs.readFileSync(filePath, 'utf8').trim().split('\n').length;
    if (lineCount >= MAX_ENTRIES_PER_FILE) {
      // 오래된 절반 제거
      const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
      const half = Math.floor(lines.length / 2);
      fs.writeFileSync(filePath, lines.slice(half).join('\n') + '\n');
    }
  }

  fs.appendFileSync(filePath, line);
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

module.exports = {
  recordLearning,
  queryLearnings,
  formatForPrompt,
  pruneOldEntries,
};
