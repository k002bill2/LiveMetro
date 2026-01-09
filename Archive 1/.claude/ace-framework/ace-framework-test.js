/**
 * ACE Framework Test Suite
 * 프레임워크 검증 및 시나리오 테스트
 *
 * @version 3.0.1-KiiPS
 */

const fs = require('fs');
const path = require('path');

// 경로 설정
const ACE_DIR = __dirname;
const COORDINATION_DIR = path.join(__dirname, '../coordination');
const HOOKS_DIR = path.join(__dirname, '../hooks');
const AGENTS_DIR = path.join(__dirname, '../agents');

// 테스트 결과 저장
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

/**
 * 테스트 실행 헬퍼
 */
function test(name, fn) {
  try {
    fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASS' });
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

/**
 * 테스트 스킵
 */
function skip(name, reason) {
  testResults.skipped++;
  testResults.tests.push({ name, status: 'SKIP', reason });
  console.log(`⏭️  SKIP: ${name} (${reason})`);
}

/**
 * 어서션
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertExists(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(message || `File not found: ${filePath}`);
  }
}

// =============================================================================
// SECTION 1: 파일 구조 검증
// =============================================================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📁 SECTION 1: File Structure Validation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('ACE Framework directory exists', () => {
  assertExists(ACE_DIR, 'ACE Framework directory missing');
});

test('ace-config.json exists', () => {
  assertExists(path.join(ACE_DIR, 'ace-config.json'));
});

test('layer1-aspirational.md exists', () => {
  assertExists(path.join(ACE_DIR, 'layer1-aspirational.md'));
});

test('layer3-agent-model.json exists', () => {
  assertExists(path.join(ACE_DIR, 'layer3-agent-model.json'));
});

test('layer4-executive.md exists', () => {
  assertExists(path.join(ACE_DIR, 'layer4-executive.md'));
});

test('Checkpoints directory exists', () => {
  assertExists(path.join(ACE_DIR, 'checkpoints'));
});

test('Telemetry directory exists', () => {
  assertExists(path.join(ACE_DIR, 'telemetry'));
});

test('Coordination directory exists', () => {
  assertExists(COORDINATION_DIR);
});

test('file-lock-manager.js exists', () => {
  assertExists(path.join(COORDINATION_DIR, 'file-lock-manager.js'));
});

test('checkpoint-manager.js exists', () => {
  assertExists(path.join(COORDINATION_DIR, 'checkpoint-manager.js'));
});

test('task-allocator.js exists', () => {
  assertExists(path.join(COORDINATION_DIR, 'task-allocator.js'));
});

test('feedback-loop.js exists', () => {
  assertExists(path.join(COORDINATION_DIR, 'feedback-loop.js'));
});

// =============================================================================
// SECTION 2: 설정 파일 검증
// =============================================================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚙️  SECTION 2: Configuration Validation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('ace-config.json is valid JSON', () => {
  const content = fs.readFileSync(path.join(ACE_DIR, 'ace-config.json'), 'utf8');
  JSON.parse(content);
});

test('ace-config.json has required fields', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ACE_DIR, 'ace-config.json'), 'utf8'));
  assert(config.version, 'Missing version');
  assert(config.aceFramework, 'Missing aceFramework');
  assert(config.agentHierarchy, 'Missing agentHierarchy');
});

test('ACE Framework has 6 layers defined', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ACE_DIR, 'ace-config.json'), 'utf8'));
  // layers is an object with layer keys, not an array
  const coreLayerCount = Object.keys(config.aceFramework.layers).filter(k => k.startsWith('layer')).length;
  assertEqual(coreLayerCount, 6, 'Should have 6 core layers (layer1-layer6)');
});

test('Primary coordinator is defined', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ACE_DIR, 'ace-config.json'), 'utf8'));
  assert(config.agentHierarchy.primary, 'Missing primary agent');
  assertEqual(config.agentHierarchy.primary.id, 'primary-coordinator');
});

test('Secondary agents are defined', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ACE_DIR, 'ace-config.json'), 'utf8'));
  assert(config.agentHierarchy.secondary, 'Missing secondary agents');
  assert(config.agentHierarchy.secondary.length >= 3, 'Should have at least 3 secondary agents');
});

test('layer3-agent-model.json is valid JSON', () => {
  const content = fs.readFileSync(path.join(ACE_DIR, 'layer3-agent-model.json'), 'utf8');
  JSON.parse(content);
});

test('layer3 has agent definitions', () => {
  const layer3 = JSON.parse(fs.readFileSync(path.join(ACE_DIR, 'layer3-agent-model.json'), 'utf8'));
  assert(layer3.agents, 'Missing agents');
  assert(Object.keys(layer3.agents).length >= 4, 'Should have at least 4 agents');
});

// =============================================================================
// SECTION 3: 에이전트 파일 검증
// =============================================================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🤖 SECTION 3: Agent Files Validation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('primary-coordinator.md exists', () => {
  assertExists(path.join(AGENTS_DIR, 'primary-coordinator.md'));
});

test('kiips-developer.md exists', () => {
  assertExists(path.join(AGENTS_DIR, 'kiips-developer.md'));
});

test('kiips-architect.md exists', () => {
  assertExists(path.join(AGENTS_DIR, 'kiips-architect.md'));
});

test('checklist-generator.md exists', () => {
  assertExists(path.join(AGENTS_DIR, 'checklist-generator.md'));
});

test('kiips-developer has ACE hierarchy metadata', () => {
  const content = fs.readFileSync(path.join(AGENTS_DIR, 'kiips-developer.md'), 'utf8');
  assert(content.includes('hierarchy: secondary'), 'Missing hierarchy metadata');
  assert(content.includes('ace_layer:'), 'Missing ace_layer metadata');
});

test('kiips-architect has ACE hierarchy metadata', () => {
  const content = fs.readFileSync(path.join(AGENTS_DIR, 'kiips-architect.md'), 'utf8');
  assert(content.includes('hierarchy: secondary'), 'Missing hierarchy metadata');
  assert(content.includes('role: strategic_advisor'), 'Missing role metadata');
});

// =============================================================================
// SECTION 4: Hook 파일 검증
// =============================================================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🪝 SECTION 4: Hook Files Validation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('ethicalValidator.js exists', () => {
  assertExists(path.join(HOOKS_DIR, 'ethicalValidator.js'));
});

test('parallelCoordinator.js exists', () => {
  assertExists(path.join(HOOKS_DIR, 'parallelCoordinator.js'));
});

test('userPromptSubmit.js exists', () => {
  assertExists(path.join(HOOKS_DIR, 'userPromptSubmit.js'));
});

test('stopEvent.js exists', () => {
  assertExists(path.join(HOOKS_DIR, 'stopEvent.js'));
});

test('ethicalValidator.js has onPreToolUse export', () => {
  const validator = require(path.join(HOOKS_DIR, 'ethicalValidator.js'));
  assert(typeof validator.onPreToolUse === 'function', 'Missing onPreToolUse function');
});

test('ethicalValidator.js has BLOCKED_OPERATIONS', () => {
  const validator = require(path.join(HOOKS_DIR, 'ethicalValidator.js'));
  assert(validator.BLOCKED_OPERATIONS, 'Missing BLOCKED_OPERATIONS');
  assert(validator.BLOCKED_OPERATIONS.database, 'Missing database blocked operations');
});

// =============================================================================
// SECTION 5: Coordination 모듈 검증
// =============================================================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔗 SECTION 5: Coordination Modules Validation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('file-lock-manager exports required functions', () => {
  const lockManager = require(path.join(COORDINATION_DIR, 'file-lock-manager.js'));
  assert(typeof lockManager.acquireLock === 'function', 'Missing acquireLock');
  assert(typeof lockManager.releaseLock === 'function', 'Missing releaseLock');
  assert(typeof lockManager.getLockStatus === 'function', 'Missing getLockStatus');
  assert(typeof lockManager.detectDeadlock === 'function', 'Missing detectDeadlock');
});

test('file-lock-manager has KIIPS_MODULES defined', () => {
  const lockManager = require(path.join(COORDINATION_DIR, 'file-lock-manager.js'));
  assert(lockManager.KIIPS_MODULES, 'Missing KIIPS_MODULES');
  assert(lockManager.KIIPS_MODULES['KiiPS-FD'], 'Missing KiiPS-FD module');
});

test('checkpoint-manager exports required functions', () => {
  const cpManager = require(path.join(COORDINATION_DIR, 'checkpoint-manager.js'));
  assert(typeof cpManager.createCheckpoint === 'function', 'Missing createCheckpoint');
  assert(typeof cpManager.listCheckpoints === 'function', 'Missing listCheckpoints');
  assert(typeof cpManager.getCheckpoint === 'function', 'Missing getCheckpoint');
});

test('task-allocator exports required functions', () => {
  const taskAllocator = require(path.join(COORDINATION_DIR, 'task-allocator.js'));
  assert(typeof taskAllocator.allocateTask === 'function', 'Missing allocateTask');
  assert(typeof taskAllocator.decomposeTask === 'function', 'Missing decomposeTask');
  assert(typeof taskAllocator.assignAgent === 'function', 'Missing assignAgent');
});

test('feedback-loop exports required functions', () => {
  const feedbackLoop = require(path.join(COORDINATION_DIR, 'feedback-loop.js'));
  assert(typeof feedbackLoop.recordExecutionMetrics === 'function', 'Missing recordExecutionMetrics');
  assert(typeof feedbackLoop.recordLearningEvent === 'function', 'Missing recordLearningEvent');
});

// =============================================================================
// SECTION 6: 시나리오 테스트
// =============================================================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎬 SECTION 6: Scenario Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

test('Scenario: Ethical validation blocks dangerous operations', () => {
  const validator = require(path.join(HOOKS_DIR, 'ethicalValidator.js'));

  // DROP TABLE should be blocked
  const result = validator.validateEthically('Bash', { command: 'DROP TABLE users' }, {});
  assert(!result.allowed, 'DROP TABLE should be blocked');
  assert(result.blockedReasons.length > 0, 'Should have blocked reasons');
});

test('Scenario: Ethical validation allows safe operations', () => {
  const validator = require(path.join(HOOKS_DIR, 'ethicalValidator.js'));

  // Normal SELECT should be allowed
  const result = validator.validateEthically('Bash', { command: 'SELECT * FROM users WHERE id = 1' }, {});
  assert(result.allowed, 'Normal SELECT should be allowed');
});

test('Scenario: Lock acquisition for KiiPS module', () => {
  // Fresh require to avoid cache issues
  delete require.cache[require.resolve(path.join(COORDINATION_DIR, 'file-lock-manager.js'))];
  const lockManager = require(path.join(COORDINATION_DIR, 'file-lock-manager.js'));

  // Clear any existing locks first (safely)
  try {
    lockManager.releaseAllLocks({ agentId: 'primary-coordinator', reason: 'test cleanup' });
  } catch (e) {
    // Ignore cleanup errors
  }

  // Acquire lock
  const result = lockManager.acquireLock({
    agentId: 'test-agent',
    module: 'KiiPS-FD',
    operation: 'write',
    estimatedDuration: 5000,
    purpose: 'Test'
  });

  assert(result.success, 'Lock acquisition should succeed');
  assert(result.lockId || result.type === 'EXISTING', 'Should return lockId or be existing');

  // Clean up
  if (result.lockId) {
    lockManager.releaseLock({ lockId: result.lockId, agentId: 'test-agent' });
  }
});

test('Scenario: Lock conflict detection', () => {
  // Fresh require to avoid cache issues
  delete require.cache[require.resolve(path.join(COORDINATION_DIR, 'file-lock-manager.js'))];
  const lockManager = require(path.join(COORDINATION_DIR, 'file-lock-manager.js'));

  // Clear any existing locks first (safely)
  try {
    lockManager.releaseAllLocks({ agentId: 'primary-coordinator', reason: 'test cleanup' });
  } catch (e) {
    // Ignore cleanup errors
  }

  // First agent acquires lock
  const result1 = lockManager.acquireLock({
    agentId: 'agent-1',
    module: 'KiiPS-IL',
    operation: 'write',
    estimatedDuration: 10000,
    purpose: 'Test 1'
  });

  // Second agent tries to acquire same module
  const result2 = lockManager.acquireLock({
    agentId: 'agent-2',
    module: 'KiiPS-IL',
    operation: 'write',
    estimatedDuration: 10000,
    purpose: 'Test 2'
  });

  assert(result1.success, 'First lock should succeed');
  assert(!result2.success, 'Second lock should fail (conflict)');
  assert(result2.error === 'LOCK_HELD', 'Should indicate lock is held');

  // Clean up
  if (result1.lockId) {
    lockManager.releaseLock({ lockId: result1.lockId, agentId: 'agent-1' });
  }
});

test('Scenario: Checkpoint creation', () => {
  const cpManager = require(path.join(COORDINATION_DIR, 'checkpoint-manager.js'));

  const result = cpManager.createCheckpoint({
    agentId: 'test-agent',
    trigger: 'test',
    description: 'Test checkpoint',
    modules: ['KiiPS-FD']
  });

  assert(result.success, 'Checkpoint creation should succeed');
  assert(result.checkpointId, 'Should return checkpointId');

  // Verify checkpoint exists
  const getResult = cpManager.getCheckpoint(result.checkpointId);
  assert(getResult.success, 'Should be able to retrieve checkpoint');

  // Clean up
  cpManager.deleteCheckpoint(result.checkpointId);
});

test('Scenario: Task allocation', () => {
  const taskAllocator = require(path.join(COORDINATION_DIR, 'task-allocator.js'));

  const result = taskAllocator.allocateTask({
    taskType: 'service_build',
    parameters: { serviceName: 'KiiPS-FD' }
  });

  assert(result.success, 'Task allocation should succeed');
  assert(result.execution, 'Should have execution plan');
  assert(result.execution.subtaskCount > 0, 'Should have subtasks');
});

// =============================================================================
// 결과 요약
// =============================================================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 TEST RESULTS SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`✅ Passed: ${testResults.passed}`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`⏭️  Skipped: ${testResults.skipped}`);
console.log(`📝 Total: ${testResults.passed + testResults.failed + testResults.skipped}`);

if (testResults.failed > 0) {
  console.log('\n❌ FAILED TESTS:');
  testResults.tests
    .filter(t => t.status === 'FAIL')
    .forEach(t => console.log(`   - ${t.name}: ${t.error}`));
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Exit code based on results
process.exit(testResults.failed > 0 ? 1 : 0);
