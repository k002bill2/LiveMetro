/**
 * Stop Event Hook for LiveMetro
 * React Native/Expo 코드 변경 후 자동 검증
 *
 * Claude의 응답이 완료된 후 실행되어:
 * 1. 코드 변경사항 분석
 * 2. React Native 패턴 검증
 * 3. 자동 테스트 실행 (선택적)
 *
 * @version 1.0.0-LiveMetro
 */

const fs = require('fs');
const path = require('path');

/**
 * Hook entry point
 * @param {object} context - Hook 실행 컨텍스트
 */
async function onStopEvent(context) {
  try {
    const editedFiles = context.editedFiles || [];

    if (editedFiles.length === 0) {
      return;
    }

    // 1. 코드 변경사항 분석
    await analyzeCodeChanges(editedFiles);

    // 2. 테스트 커버리지 알림 (TS/TSX 파일 변경 시)
    const tsFiles = editedFiles.filter(f =>
      f.endsWith('.ts') || f.endsWith('.tsx')
    );

    if (tsFiles.length > 0) {
      displayTestReminder(tsFiles);
    }

  } catch (error) {
    console.error('[StopEvent] Error:', error.message);
  }
}

/**
 * 코드 변경사항 분석
 */
async function analyzeCodeChanges(editedFiles) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 CODE CHANGES SELF-CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📁 Changes detected in ${editedFiles.length} file(s)\n`);

  const reminders = new Set();
  const fileCategories = {
    components: [],
    hooks: [],
    services: [],
    screens: [],
    navigation: [],
    other: []
  };

  for (const filePath of editedFiles) {
    await analyzeFile(filePath, reminders);
    categorizeFile(filePath, fileCategories);
  }

  // 파일 카테고리별 요약
  for (const [category, files] of Object.entries(fileCategories)) {
    if (files.length > 0) {
      console.log(`**${category}**: ${files.length} file(s)`);
    }
  }

  // 체크리스트 표시
  if (reminders.size > 0) {
    console.log('\n**Self-check Questions:**');
    Array.from(reminders).forEach(reminder => {
      console.log(`❓ ${reminder}`);
    });
  } else {
    console.log('\n✅ No critical patterns detected');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
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
    const ext = path.extname(filePath);

    // TypeScript/TSX 파일 패턴 검사
    if (ext === '.ts' || ext === '.tsx') {
      checkTypeScriptPatterns(content, filePath, reminders);
    }

  } catch (error) {
    console.error(`[StopEvent] Error analyzing ${filePath}:`, error.message);
  }
}

/**
 * TypeScript/React Native 파일 패턴 검사
 */
function checkTypeScriptPatterns(content, filePath, reminders) {
  // useEffect cleanup 체크
  if (/useEffect\s*\(/.test(content)) {
    if (/subscribe|interval|setTimeout|addEventListener/i.test(content)) {
      if (!/return\s*\(\s*\)\s*=>|return\s*cleanup|return\s*\(\)/.test(content)) {
        reminders.add('useEffect에 cleanup 함수가 있나요? (구독/타이머 정리)');
      }
    }
  }

  // any 타입 체크
  if (/:\s*any\b/.test(content)) {
    reminders.add('any 타입이 사용되었습니다. 구체적인 타입으로 대체하세요.');
  }

  // console.log 체크
  if (/console\.(log|debug|info)\(/.test(content)) {
    reminders.add('console.log가 남아있습니다. 프로덕션 전 제거하세요.');
  }

  // 에러 처리 체크
  if (/try\s*{/.test(content)) {
    if (!/catch.*Sentry|ErrorBoundary|handleError/.test(content)) {
      reminders.add('에러 처리가 Sentry로 전송되나요?');
    }
  }

  // API 호출 체크
  if (/fetch\(|axios\.|seoulSubwayApi/.test(content)) {
    reminders.add('API 호출에 에러 처리와 로딩 상태가 있나요?');
  }

  // AsyncStorage 체크
  if (/AsyncStorage/.test(content)) {
    reminders.add('AsyncStorage 작업에 try-catch가 있나요?');
  }

  // Navigation 체크
  if (/navigation\.(navigate|push|replace)/.test(content)) {
    reminders.add('네비게이션 파라미터 타입이 정의되어 있나요?');
  }
}

/**
 * 파일 카테고리화
 */
function categorizeFile(filePath, categories) {
  const lowerPath = filePath.toLowerCase();

  if (lowerPath.includes('/components/')) {
    categories.components.push(filePath);
  } else if (lowerPath.includes('/hooks/')) {
    categories.hooks.push(filePath);
  } else if (lowerPath.includes('/services/')) {
    categories.services.push(filePath);
  } else if (lowerPath.includes('/screens/')) {
    categories.screens.push(filePath);
  } else if (lowerPath.includes('/navigation/')) {
    categories.navigation.push(filePath);
  } else {
    categories.other.push(filePath);
  }
}

/**
 * 테스트 알림 표시
 */
function displayTestReminder(tsFiles) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 TEST REMINDER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`${tsFiles.length} TypeScript file(s) modified.\n`);
  console.log('**Recommended Actions:**');
  console.log('• npm test -- --coverage (테스트 실행)');
  console.log('• npm run type-check (타입 검사)');
  console.log('• /verify-app (전체 검증)');
  console.log('\n**Coverage Thresholds:**');
  console.log('• Statements: 75%');
  console.log('• Functions: 70%');
  console.log('• Branches: 60%');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

module.exports = { onStopEvent };
