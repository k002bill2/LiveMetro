/**
 * Auto Formatter Hook (PostToolUse)
 * Boris Cherny's Principle: "PostToolUse 훅을 통해 코드 포매팅을 처리하여 CI 오류를 방지"
 *
 * Write/Edit 도구 사용 후 자동으로 코드 포매팅 및 린팅을 수행합니다.
 *
 * @version 1.0.0
 * @layer PostToolUse Hook
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Hook entry point
 * @param {object} event - PostToolUse 이벤트 객체
 */
async function onPostToolUse(event) {
  try {
    // Write 또는 Edit 도구만 처리
    if (event.tool !== 'Write' && event.tool !== 'Edit') {
      return { success: true, skipped: true, reason: 'Not a Write/Edit tool' };
    }

    const filePath = event.parameters.file_path;

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    // 포매팅 대상 파일 확인
    const ext = path.extname(filePath);
    const supportedExtensions = ['.java', '.js', '.jsx', '.ts', '.tsx', '.scss', '.css'];

    if (!supportedExtensions.includes(ext)) {
      return { success: true, skipped: true, reason: `Unsupported file type: ${ext}` };
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ AUTO FORMATTER (Boris Cherny PostToolUse Hook)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📄 File: ${path.basename(filePath)}`);

    const results = {
      formatted: false,
      linted: false,
      formatter: null,
      linter: null,
      issues: [],
      timestamp: new Date().toISOString()
    };

    // 1. 포매팅 실행
    results.formatter = await runFormatter(filePath, ext);
    if (results.formatter.success) {
      results.formatted = true;
      console.log(`✅ Formatted with: ${results.formatter.tool}`);
    } else {
      console.log(`⚠️  Formatting skipped: ${results.formatter.reason}`);
    }

    // 2. 린팅 실행
    results.linter = await runLinter(filePath, ext);
    if (results.linter.success) {
      results.linted = true;
      console.log(`✅ Linted with: ${results.linter.tool}`);

      if (results.linter.issues.length > 0) {
        console.log(`\n⚠️  ${results.linter.issues.length} linter issue(s) found:`);
        results.linter.issues.slice(0, 5).forEach(issue => {
          console.log(`   • ${issue}`);
        });
        if (results.linter.issues.length > 5) {
          console.log(`   ... and ${results.linter.issues.length - 5} more`);
        }
      } else {
        console.log(`✅ No linter issues found`);
      }
    } else {
      console.log(`ℹ️  Linting skipped: ${results.linter.reason}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return { success: true, results };

  } catch (error) {
    console.error('[AutoFormatter] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 파일 타입별 포매터 실행
 */
async function runFormatter(filePath, ext) {
  try {
    switch (ext) {
      case '.java':
        return await formatJava(filePath);

      case '.js':
      case '.jsx':
      case '.ts':
      case '.tsx':
        return await formatJavaScript(filePath);

      case '.scss':
      case '.css':
        return await formatStylesheet(filePath);

      default:
        return { success: false, reason: `No formatter for ${ext}` };
    }
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

/**
 * Java 파일 포매팅 (google-java-format)
 */
async function formatJava(filePath) {
  try {
    // google-java-format 설치 확인
    execSync('which google-java-format', { stdio: 'pipe' });

    // 포매팅 실행 (in-place)
    execSync(`google-java-format --replace "${filePath}"`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    return { success: true, tool: 'google-java-format' };

  } catch (error) {
    // google-java-format 미설치 시
    if (error.message.includes('which')) {
      return {
        success: false,
        reason: 'google-java-format not installed. Install: brew install google-java-format'
      };
    }

    // 포매팅 오류
    return { success: false, reason: error.message };
  }
}

/**
 * JavaScript/TypeScript 파일 포매팅 (Prettier)
 */
async function formatJavaScript(filePath) {
  try {
    // Prettier 설치 확인 (로컬 또는 글로벌)
    let prettierCmd = 'npx prettier';

    try {
      execSync('which prettier', { stdio: 'pipe' });
      prettierCmd = 'prettier';
    } catch (e) {
      // npx로 fallback
    }

    // 포매팅 실행
    execSync(`${prettierCmd} --write "${filePath}"`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    return { success: true, tool: 'prettier' };

  } catch (error) {
    return {
      success: false,
      reason: 'Prettier not available. Install: npm install -g prettier'
    };
  }
}

/**
 * SCSS/CSS 파일 포매팅 (stylelint + prettier)
 */
async function formatStylesheet(filePath) {
  try {
    // Prettier로 SCSS/CSS 포매팅
    let prettierCmd = 'npx prettier';

    try {
      execSync('which prettier', { stdio: 'pipe' });
      prettierCmd = 'prettier';
    } catch (e) {
      // npx로 fallback
    }

    execSync(`${prettierCmd} --write "${filePath}"`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    return { success: true, tool: 'prettier (SCSS)' };

  } catch (error) {
    return { success: false, reason: error.message };
  }
}

/**
 * 파일 타입별 린터 실행
 */
async function runLinter(filePath, ext) {
  try {
    switch (ext) {
      case '.java':
        return await lintJava(filePath);

      case '.js':
      case '.jsx':
      case '.ts':
      case '.tsx':
        return await lintJavaScript(filePath);

      case '.scss':
      case '.css':
        return await lintStylesheet(filePath);

      default:
        return { success: false, reason: `No linter for ${ext}` };
    }
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

/**
 * Java 파일 린팅 (Checkstyle)
 */
async function lintJava(filePath) {
  try {
    // Checkstyle 설치 확인
    execSync('which checkstyle', { stdio: 'pipe' });

    // Checkstyle 실행 (Google Style)
    const output = execSync(
      `checkstyle -c /google_checks.xml "${filePath}"`,
      {
        encoding: 'utf-8',
        stdio: 'pipe'
      }
    );

    // 이슈 파싱
    const issues = parseCheckstyleOutput(output);

    return { success: true, tool: 'checkstyle', issues };

  } catch (error) {
    // Checkstyle 미설치 또는 오류
    if (error.message.includes('which')) {
      return {
        success: false,
        reason: 'Checkstyle not installed. Install: brew install checkstyle'
      };
    }

    // Checkstyle 오류 발생 시에도 이슈 파싱 시도
    const issues = parseCheckstyleOutput(error.stdout || error.message);
    return { success: true, tool: 'checkstyle', issues };
  }
}

/**
 * JavaScript/TypeScript 파일 린팅 (ESLint)
 */
async function lintJavaScript(filePath) {
  try {
    let eslintCmd = 'npx eslint';

    try {
      execSync('which eslint', { stdio: 'pipe' });
      eslintCmd = 'eslint';
    } catch (e) {
      // npx로 fallback
    }

    // ESLint 실행 (JSON 형식)
    const output = execSync(`${eslintCmd} --format json "${filePath}"`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    // JSON 파싱
    const results = JSON.parse(output);
    const issues = [];

    if (results.length > 0 && results[0].messages) {
      results[0].messages.forEach(msg => {
        issues.push(`Line ${msg.line}: ${msg.message} (${msg.ruleId})`);
      });
    }

    return { success: true, tool: 'eslint', issues };

  } catch (error) {
    // ESLint 미설치 또는 파싱 오류
    if (error.message.includes('which')) {
      return {
        success: false,
        reason: 'ESLint not available. Install: npm install -g eslint'
      };
    }

    // ESLint 오류 시에도 결과 반환 시도
    try {
      const results = JSON.parse(error.stdout || '[]');
      const issues = [];
      if (results.length > 0 && results[0].messages) {
        results[0].messages.forEach(msg => {
          issues.push(`Line ${msg.line}: ${msg.message} (${msg.ruleId})`);
        });
      }
      return { success: true, tool: 'eslint', issues };
    } catch (e) {
      return { success: false, reason: error.message };
    }
  }
}

/**
 * SCSS/CSS 파일 린팅 (stylelint)
 */
async function lintStylesheet(filePath) {
  try {
    let stylelintCmd = 'npx stylelint';

    try {
      execSync('which stylelint', { stdio: 'pipe' });
      stylelintCmd = 'stylelint';
    } catch (e) {
      // npx로 fallback
    }

    // stylelint 실행 (JSON 형식)
    const output = execSync(`${stylelintCmd} --formatter json "${filePath}"`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    // JSON 파싱
    const results = JSON.parse(output);
    const issues = [];

    if (results.length > 0 && results[0].warnings) {
      results[0].warnings.forEach(warning => {
        issues.push(`Line ${warning.line}: ${warning.text}`);
      });
    }

    return { success: true, tool: 'stylelint', issues };

  } catch (error) {
    if (error.message.includes('which')) {
      return {
        success: false,
        reason: 'stylelint not available. Install: npm install -g stylelint'
      };
    }

    return { success: false, reason: error.message };
  }
}

/**
 * Checkstyle 출력 파싱
 */
function parseCheckstyleOutput(output) {
  const issues = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Checkstyle 오류 패턴: "[ERROR] /path/to/file.java:42: ..."
    if (line.includes('[ERROR]') || line.includes('[WARN]')) {
      const match = line.match(/:(\d+):\s*(.+)/);
      if (match) {
        issues.push(`Line ${match[1]}: ${match[2]}`);
      }
    }
  }

  return issues;
}

// Export for Claude Code Hook system
module.exports = { onPostToolUse };
