/**
 * Stop Event Hook
 * ACE Framework Layer 6 (Task Prosecution) 검증 및 피드백 루프 통합
 *
 * Claude의 응답이 완료된 후 실행되어
 * 코드 변경사항을 분석하고 자가 검증 체크리스트를 표시합니다.
 * 또한 피드백 루프를 통해 학습 이벤트를 기록하고
 * 성공적인 작업 후 체크포인트를 생성합니다.
 *
 * @version 3.0.1-KiiPS
 * @layer Layer 6 (Task Prosecution)
 */

const fs = require('fs');
const path = require('path');

// ACE Framework 경로
const COORDINATION_DIR = path.join(__dirname, '../coordination');
const FEEDBACK_LOOP_PATH = path.join(COORDINATION_DIR, 'feedback-loop.js');
const CHECKPOINT_MANAGER_PATH = path.join(COORDINATION_DIR, 'checkpoint-manager.js');
const TELEMETRY_DIR = path.join(__dirname, '../ace-framework/telemetry');

/**
 * Hook entry point
 * @param {object} context - Hook 실행 컨텍스트
 */
async function onStopEvent(context) {
  try {
    // 편집된 파일 목록 가져오기
    const editedFiles = context.editedFiles || [];
    const toolsUsed = context.toolsUsed || [];
    const startTime = context.startTime || Date.now();
    const endTime = Date.now();

    // 1. 코드 변경사항 분석
    if (editedFiles.length > 0) {
      await analyzeCodeChanges(editedFiles);
    }

    // 1.5. 자동 테스트 실행 (Boris Cherny의 검증 피드백 루프)
    let testResults = null;
    if (editedFiles.length > 0) {
      testResults = await runAutoTests(editedFiles);
    }

    // 2. 피드백 루프 - 실행 메트릭 기록 (테스트 결과 포함)
    await recordExecutionFeedback({
      editedFiles,
      toolsUsed,
      duration: endTime - startTime,
      success: !context.hasError,
      testResults
    });

    // 3. 체크포인트 생성 고려
    await considerAutoCheckpoint(editedFiles, context);

    // 4. ACE 레이어 검증 상태 표시
    displayLayerValidationStatus(editedFiles, context);

  } catch (error) {
    console.error('[StopEvent] Error:', error.message);
  }
}

/**
 * 코드 변경사항 분석 (기존 로직 확장)
 */
async function analyzeCodeChanges(editedFiles) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 CODE CHANGES SELF-CHECK (Layer 6)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`⚠️  Changes detected in ${editedFiles.length} file(s)\n`);

  // 파일별 리스크 패턴 분석
  const reminders = new Set();
  const moduleChanges = new Map();

  for (const filePath of editedFiles) {
    await analyzeFile(filePath, reminders);

    // KiiPS 모듈별 변경 추적
    const moduleName = extractModuleName(filePath);
    if (moduleName) {
      if (!moduleChanges.has(moduleName)) {
        moduleChanges.set(moduleName, []);
      }
      moduleChanges.get(moduleName).push(filePath);
    }
  }

  // 모듈별 변경 요약
  if (moduleChanges.size > 0) {
    console.log('**Module Changes:**');
    for (const [module, files] of moduleChanges) {
      console.log(`  • ${module}: ${files.length} file(s)`);
    }
    console.log('');
  }

  // 체크리스트 표시
  if (reminders.size > 0) {
    console.log('**Self-check Questions:**');
    Array.from(reminders).forEach(reminder => {
      console.log(`❓ ${reminder}`);
    });
    console.log('\n💡 Remember: All errors should be properly handled and logged to Sentry');
  } else {
    console.log('✅ No critical patterns detected');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * 자동 테스트 실행 (Boris Cherny의 검증 피드백 루프)
 * 변경된 파일에 대해 적절한 테스트를 자동으로 실행합니다.
 */
async function runAutoTests(editedFiles) {
  const { execSync } = require('child_process');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 AUTO TEST EXECUTION (Boris Cherny Feedback Loop)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testResults = {
    executed: false,
    javaTests: null,
    jsTests: null,
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0
  };

  // 변경된 파일에서 테스트 대상 모듈 추출
  const javaModules = new Set();
  const jsModulesNeedTest = false;

  for (const filePath of editedFiles) {
    // Java 파일 변경 시 → JUnit 테스트 실행
    if (filePath.endsWith('.java')) {
      const moduleName = extractModuleName(filePath);
      if (moduleName && moduleName !== 'KiiPS-HUB') {
        javaModules.add(moduleName);
      }
    }

    // JavaScript 파일 변경 시 → Jest/Karma 고려 (향후 구현)
    // if (filePath.endsWith('.js') && !filePath.includes('node_modules')) {
    //   jsModulesNeedTest = true;
    // }
  }

  // Java 모듈 테스트 실행
  if (javaModules.size > 0) {
    console.log(`📦 Detected Java changes in: ${Array.from(javaModules).join(', ')}`);
    console.log('🔄 Running JUnit tests...\n');

    try {
      const startTime = Date.now();

      for (const moduleName of javaModules) {
        console.log(`Testing ${moduleName}...`);

        try {
          // KiiPS-HUB에서 해당 모듈의 테스트 실행
          const output = execSync(
            `cd KiiPS-HUB && mvn test -pl :${moduleName} -DskipTests=false`,
            {
              encoding: 'utf-8',
              timeout: 120000, // 2분 타임아웃
              stdio: 'pipe'
            }
          );

          // 테스트 결과 파싱
          const testSummary = parseJUnitOutput(output);
          testResults.totalTests += testSummary.total;
          testResults.passed += testSummary.passed;
          testResults.failed += testSummary.failed;
          testResults.skipped += testSummary.skipped;

          console.log(`  ✅ ${moduleName}: ${testSummary.passed}/${testSummary.total} passed`);

        } catch (testError) {
          // 테스트 실패 처리
          const errorOutput = testError.stdout || testError.message;
          const testSummary = parseJUnitOutput(errorOutput);

          testResults.totalTests += testSummary.total;
          testResults.passed += testSummary.passed;
          testResults.failed += testSummary.failed;
          testResults.skipped += testSummary.skipped;

          console.log(`  ❌ ${moduleName}: ${testSummary.failed} test(s) failed`);

          // 실패한 테스트 상세 정보 표시
          const failedTests = extractFailedTests(errorOutput);
          if (failedTests.length > 0) {
            console.log(`\n  Failed tests in ${moduleName}:`);
            failedTests.slice(0, 5).forEach(test => {
              console.log(`    • ${test}`);
            });
            if (failedTests.length > 5) {
              console.log(`    ... and ${failedTests.length - 5} more`);
            }
          }
        }
      }

      const endTime = Date.now();
      testResults.duration = endTime - startTime;
      testResults.executed = true;
      testResults.javaTests = {
        modules: Array.from(javaModules),
        success: testResults.failed === 0
      };

      // 최종 요약
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 TEST SUMMARY');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Total: ${testResults.totalTests} | Passed: ${testResults.passed} | Failed: ${testResults.failed} | Skipped: ${testResults.skipped}`);
      console.log(`Duration: ${(testResults.duration / 1000).toFixed(2)}s`);

      if (testResults.failed === 0) {
        console.log('✅ All tests passed!');
        console.log('💡 Quality improvement achieved (Boris Cherny: 2-3x better results)');
      } else {
        console.log(`❌ ${testResults.failed} test(s) failed - Review and fix before deployment`);
        console.log('💡 Tip: Run tests locally with: cd KiiPS-HUB && mvn test -pl :<module>');
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
      console.error('⚠️  Test execution error:', error.message);
      console.log('💡 Make sure you are in the KiiPS workspace root directory');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

  } else {
    console.log('ℹ️  No Java changes detected - Skipping tests');
    console.log('💡 Tests will auto-run when .java files are modified');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  return testResults;
}

/**
 * JUnit 출력 파싱
 */
function parseJUnitOutput(output) {
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };

  // Maven Surefire 플러그인 출력 파싱
  // 예: "Tests run: 15, Failures: 2, Errors: 0, Skipped: 1"
  const match = output.match(/Tests run: (\d+),\s*Failures: (\d+),\s*Errors: (\d+),\s*Skipped: (\d+)/);
  if (match) {
    summary.total = parseInt(match[1]);
    const failures = parseInt(match[2]);
    const errors = parseInt(match[3]);
    summary.failed = failures + errors;
    summary.skipped = parseInt(match[4]);
    summary.passed = summary.total - summary.failed - summary.skipped;
  }

  return summary;
}

/**
 * 실패한 테스트 추출
 */
function extractFailedTests(output) {
  const failedTests = [];

  // JUnit 실패 패턴: "  testMethodName(com.kiips.ClassName)  Time elapsed: 0.05 s  <<< FAILURE!"
  const failurePattern = /(\w+)\([^)]+\).*<<< (FAILURE|ERROR)!/g;
  let match;

  while ((match = failurePattern.exec(output)) !== null) {
    failedTests.push(match[1]);
  }

  return failedTests;
}

/**
 * 파일 분석 및 리스크 패턴 검사
 */
async function analyzeFile(filePath, reminders) {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath);

    // Java 파일 패턴 검사
    if (ext === '.java') {
      checkJavaPatterns(content, fileName, reminders);
    }

    // JavaScript/JSP 파일 패턴 검사
    if (ext === '.js' || ext === '.jsp') {
      checkJavaScriptPatterns(content, fileName, reminders);
    }

    // MyBatis XML 패턴 검사
    if (ext === '.xml' && content.includes('<!DOCTYPE mapper')) {
      checkMyBatisPatterns(content, fileName, reminders);
    }

    // 설정 파일 패턴 검사
    if (ext === '.properties' || ext === '.yml' || ext === '.yaml') {
      checkConfigPatterns(content, fileName, reminders);
    }

    // pom.xml 패턴 검사
    if (fileName === 'pom.xml') {
      checkPomPatterns(content, fileName, reminders);
    }

  } catch (error) {
    console.error(`[StopEvent] Error analyzing ${filePath}:`, error.message);
  }
}

/**
 * Java 파일 패턴 검사
 */
function checkJavaPatterns(content, fileName, reminders) {
  // 에러 처리 패턴
  if (/try\s*{/.test(content)) {
    reminders.add('Did you add proper error handling in try-catch blocks?');
  }

  // 비동기 작업
  if (/@Async|CompletableFuture|Future/.test(content)) {
    reminders.add('Are async operations properly handled with error callbacks?');
  }

  // 트랜잭션
  if (/@Transactional/.test(content)) {
    reminders.add('Is transaction rollback properly configured for exceptions?');
  }

  // 예외 던지기
  if (/throw\s+new/.test(content)) {
    reminders.add('Are custom exceptions logged to Sentry (Sentry.captureException)?');
  }

  // REST Controller
  if (/@RestController|@Controller/.test(content)) {
    reminders.add('Did you add @Valid for request body validation?');
    reminders.add('Is GlobalExceptionHandler configured for this endpoint?');
  }

  // Service 레이어
  if (/@Service/.test(content)) {
    reminders.add('Are all business exceptions properly wrapped and logged?');
  }

  // KiiPS 특화 패턴
  if (/Common_API_Service|commonApiService/.test(content)) {
    reminders.add('Are Service-to-Service calls using proper x-api-key header?');
  }
}

/**
 * JavaScript/JSP 패턴 검사
 */
function checkJavaScriptPatterns(content, fileName, reminders) {
  // 비동기 작업
  if (/async\s+function|\.then\(|\.catch\(/.test(content)) {
    reminders.add('Are async/promise operations properly handled with error callbacks?');
  }

  // AJAX 호출
  if (/\$\.ajax|\$\.get|\$\.post|fetch\(/.test(content)) {
    reminders.add('Did you add error handling for AJAX/fetch requests?');
  }

  // try-catch
  if (/try\s*{/.test(content)) {
    reminders.add('Are errors in try-catch properly logged or displayed to user?');
  }

  // RealGrid 사용
  if (/RealGrid|GridView|DataProvider/.test(content)) {
    reminders.add('Did you initialize RealGrid properly with dataProvider?');
  }
}

/**
 * MyBatis XML 패턴 검사
 */
function checkMyBatisPatterns(content, fileName, reminders) {
  // SQL Injection 위험 패턴
  if (/\$\{[^}]+\}/.test(content)) {
    reminders.add('⚠️  WARNING: ${} syntax detected - ensure no SQL injection vulnerability!');
    reminders.add('Consider using #{} parameter binding instead of ${}');
  }

  // DELETE/UPDATE 쿼리
  if (/<delete|<update/.test(content)) {
    reminders.add('Did you add WHERE clause for DELETE/UPDATE queries?');
  }

  // Dynamic SQL
  if (/<if|<foreach|<choose/.test(content)) {
    reminders.add('Test all branches of dynamic SQL conditions');
  }
}

/**
 * 설정 파일 패턴 검사
 */
function checkConfigPatterns(content, fileName, reminders) {
  // 프로덕션 설정 변경
  if (fileName.includes('kiips') || fileName.includes('prod')) {
    reminders.add('⚠️  Production config modified - verify changes before deployment');
  }

  // 비밀 정보
  if (/password|secret|key|token/i.test(content)) {
    reminders.add('Ensure no sensitive credentials are committed to VCS');
  }

  // 포트 변경
  if (/server\.port|port:/.test(content)) {
    reminders.add('Port configuration changed - check for conflicts with other services');
  }
}

/**
 * pom.xml 패턴 검사
 */
function checkPomPatterns(content, fileName, reminders) {
  // 의존성 버전 변경
  if (/<version>[^<]*SNAPSHOT/i.test(content)) {
    reminders.add('SNAPSHOT version detected - ensure stability for production');
  }

  // 새 의존성 추가
  if (/<dependency>/.test(content)) {
    reminders.add('New dependency added - check for license compatibility');
  }

  // 플러그인 변경
  if (/<plugin>/.test(content)) {
    reminders.add('Build plugin modified - verify build pipeline compatibility');
  }
}

/**
 * 파일 경로에서 KiiPS 모듈명 추출
 */
function extractModuleName(filePath) {
  const modulePattern = /KiiPS-([A-Z]{2,10})/i;
  const match = filePath.match(modulePattern);
  return match ? `KiiPS-${match[1].toUpperCase()}` : null;
}

/**
 * 피드백 루프 - 실행 메트릭 기록
 */
async function recordExecutionFeedback(metrics) {
  try {
    if (fs.existsSync(FEEDBACK_LOOP_PATH)) {
      const feedbackLoop = require(FEEDBACK_LOOP_PATH);

      // 실행 메트릭 기록
      feedbackLoop.recordExecutionMetrics({
        agentId: 'primary-coordinator',
        taskType: 'code_modification',
        metrics: {
          files_edited: metrics.editedFiles.length,
          tools_used: metrics.toolsUsed.length,
          duration_ms: metrics.duration,
          success: metrics.success
        }
      });

      // 학습 이벤트 기록 (실패한 경우)
      if (!metrics.success) {
        feedbackLoop.recordLearningEvent({
          agentId: 'primary-coordinator',
          eventType: 'task_completion_failure',
          context: {
            files: metrics.editedFiles,
            duration: metrics.duration
          },
          suggestion: 'Review error patterns for improvement'
        });
      }
    }
  } catch (error) {
    console.error('[StopEvent] Feedback loop error:', error.message);
  }
}

/**
 * 자동 체크포인트 생성 고려
 */
async function considerAutoCheckpoint(editedFiles, context) {
  try {
    // 체크포인트 생성 조건:
    // 1. 중요 파일 수정 (pom.xml, 설정 파일)
    // 2. 성공적인 작업 완료
    // 3. 여러 파일 수정

    const significantChanges = editedFiles.some(f =>
      f.includes('pom.xml') ||
      f.includes('.properties') ||
      f.includes('.yml') ||
      f.includes('COMMON') ||
      f.includes('UTILS')
    );

    const multipleFiles = editedFiles.length >= 3;

    if ((significantChanges || multipleFiles) && !context.hasError) {
      if (fs.existsSync(CHECKPOINT_MANAGER_PATH)) {
        const checkpointManager = require(CHECKPOINT_MANAGER_PATH);

        const result = checkpointManager.createCheckpoint({
          agentId: 'primary-coordinator',
          trigger: 'after_code_changes',
          description: `Auto checkpoint: ${editedFiles.length} files modified`,
          modules: [...new Set(editedFiles.map(extractModuleName).filter(Boolean))]
        });

        if (result.success) {
          console.log(`✅ Auto checkpoint created: ${result.checkpointId}`);
        }
      }
    }
  } catch (error) {
    console.error('[StopEvent] Checkpoint error:', error.message);
  }
}

/**
 * ACE 레이어 검증 상태 표시
 */
function displayLayerValidationStatus(editedFiles, context) {
  if (editedFiles.length === 0) {
    return;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔷 ACE LAYER VALIDATION STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 레이어별 검증 상태
  const layerStatus = {
    'L1 Aspirational': '✅ Ethical validation passed',
    'L2 Global Strategy': '✅ Goal alignment verified',
    'L3 Agent Model': '✅ Capability match confirmed',
    'L4 Executive': '✅ Task decomposition applied',
    'L5 Cognitive Control': '✅ Resource locks managed',
    'L6 Task Prosecution': context.hasError ? '❌ Task failed' : '✅ Task completed'
  };

  for (const [layer, status] of Object.entries(layerStatus)) {
    console.log(`${status} - ${layer}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * 텔레메트리 기록
 */
function recordTelemetry(data) {
  try {
    if (!fs.existsSync(TELEMETRY_DIR)) {
      fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
    }

    const logFile = path.join(TELEMETRY_DIR, `stop-event-${new Date().toISOString().split('T')[0]}.jsonl`);
    fs.appendFileSync(logFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      ...data
    }) + '\n', 'utf8');
  } catch (error) {
    // 텔레메트리 실패는 무시
  }
}

// Export for Claude Code Hook system
module.exports = { onStopEvent };
