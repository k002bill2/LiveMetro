/**
 * Build Checker Hook (Optional)
 * 
 * 코드 변경 후 자동으로 빌드를 실행하여
 * 컴파일 에러를 빠르게 감지합니다.
 */

const { exec } = require('child_process');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

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
    
    // 수정된 모듈 감지
    const editedModules = getEditedModules(editedFiles);
    
    if (editedModules.size === 0) {
      return;
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔨 BUILD VERIFICATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 각 모듈에서 빌드 실행
    for (const modulePath of editedModules) {
      await checkBuild(modulePath);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('[BuildChecker] Error:', error.message);
  }
}

/**
 * 수정된 파일로부터 모듈 경로 추출
 * @param {Array} files - 파일 경로 배열
 * @returns {Set} - 모듈 경로 Set
 */
function getEditedModules(files) {
  const modules = new Set();
  
  for (const filePath of files) {
    // Java 파일만 체크
    if (!filePath.endsWith('.java')) {
      continue;
    }
    
    // KiiPS 모듈 패턴 매칭
    const match = filePath.match(/(KiiPS-[A-Z]+|KIIPS-[A-Z]+)/);
    if (match) {
      const moduleName = match[1];
      // 프로젝트 루트 기준으로 모듈 경로 생성
      modules.add(moduleName);
    }
  }
  
  return modules;
}

/**
 * 특정 모듈에서 Maven 빌드 실행
 * @param {string} moduleName - 모듈 이름
 */
async function checkBuild(moduleName) {
  console.log(`🔨 Running build in ${moduleName}...`);
  
  try {
    const { stdout, stderr } = await execAsync(
      'mvn clean compile -DskipTests',
      {
        cwd: path.join(process.cwd(), moduleName),
        timeout: 60000 // 60초 타임아웃
      }
    );
    
    // 빌드 성공
    if (stdout.includes('BUILD SUCCESS')) {
      console.log(`✅ Build successful in ${moduleName}`);
      return;
    }
    
    // 빌드 실패 - 에러 추출
    const errors = extractBuildErrors(stderr + stdout);
    
    if (errors.length === 0) {
      console.log(`⚠️  Build completed with warnings in ${moduleName}`);
    } else if (errors.length < 5) {
      console.log(`\n❌ Build failed in ${moduleName}:\n`);
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      console.log('\n💡 Please fix these errors before continuing.\n');
    } else {
      console.log(`\n❌ ${errors.length} compilation errors found in ${moduleName}!`);
      console.log('💡 Consider reviewing the changes or running build manually:\n');
      console.log(`   cd ${moduleName} && mvn clean compile\n`);
    }
    
  } catch (error) {
    // 빌드 명령 실패
    if (error.code === 'ETIMEDOUT') {
      console.log(`⏱️  Build timeout in ${moduleName} (exceeded 60s)`);
    } else {
      console.log(`❌ Build error in ${moduleName}: ${error.message}`);
    }
  }
}

/**
 * Maven 출력에서 컴파일 에러 추출
 * @param {string} output - Maven 출력
 * @returns {Array} - 에러 메시지 배열
 */
function extractBuildErrors(output) {
  const errors = [];
  const lines = output.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // [ERROR] 라인 찾기
    if (line.includes('[ERROR]') && line.includes('.java:')) {
      // 파일명과 라인 번호 추출
      const match = line.match(/\[ERROR\]\s+(.+\.java):\[(\d+),(\d+)\]\s+(.+)/);
      if (match) {
        const [, file, lineNum, col, message] = match;
        const fileName = path.basename(file);
        errors.push(`${fileName}:${lineNum} - ${message.trim()}`);
      }
    }
  }
  
  return errors.slice(0, 10); // 최대 10개까지만
}

// Export for Claude Code Hook system
module.exports = { onStopEvent };
