#!/usr/bin/env node
/**
 * Self-Check Hook
 * Validates code quality after Claude's responses
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get recently modified files from git
function getRecentlyModifiedFiles() {
  try {
    const output = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
    return output.split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
}

// Risk patterns to check
const riskPatterns = [
  {
    pattern: /try\s*{[\s\S]*?}\s*catch/,
    message: '❓ Are all errors properly logged and handled?',
    severity: 'medium'
  },
  {
    pattern: /async\s+function|async\s*\(/,
    message: '❓ Are async operations properly awaited and error-handled?',
    severity: 'medium'
  },
  {
    pattern: /firebase\.|firestore\./,
    message: '❓ Are Firebase operations wrapped with proper error handling?',
    severity: 'high'
  },
  {
    pattern: /AsyncStorage\./,
    message: '❓ Is AsyncStorage usage properly error-handled?',
    severity: 'medium'
  },
  {
    pattern: /\.then\(|\.catch\(/,
    message: '⚠️  Consider using async/await instead of .then()/.catch()',
    severity: 'low'
  },
  {
    pattern: /console\.(log|warn|error)/,
    message: '💡 Consider using proper logging service instead of console',
    severity: 'low'
  },
  {
    pattern: /any/,
    message: '⚠️  Found TypeScript "any" - consider using proper types',
    severity: 'medium'
  }
];

const modifiedFiles = getRecentlyModifiedFiles();
const reminders = new Set();
let hasHighSeverity = false;

// Check modified files
for (const file of modifiedFiles) {
  if (!file.match(/\.(ts|tsx|js|jsx)$/)) continue;

  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    for (const { pattern, message, severity } of riskPatterns) {
      if (pattern.test(content)) {
        reminders.add(`${message} (${file})`);
        if (severity === 'high') hasHighSeverity = true;
      }
    }
  } catch (error) {
    // Skip files that can't be read
  }
}

// Output reminders if found
if (reminders.size > 0) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 CODE QUALITY SELF-CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`⚠️  Changes detected in ${modifiedFiles.length} file(s)\n`);
  console.log('Self-check reminders:\n');

  reminders.forEach(reminder => {
    console.log(reminder);
  });

  console.log('\n💡 Remember: All code should follow project guidelines');
  console.log('   Check CLAUDE.md and vooster-docs/ for standards\n');

  if (hasHighSeverity) {
    console.log('🔴 HIGH PRIORITY ISSUES DETECTED - Please review carefully\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Type checking reminder
const tsFiles = modifiedFiles.filter(f => f.match(/\.(ts|tsx)$/));
if (tsFiles.length > 0) {
  console.log('💡 TIP: Run "npm run type-check" to verify TypeScript types\n');
}
