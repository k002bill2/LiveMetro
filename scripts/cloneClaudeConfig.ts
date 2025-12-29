#!/usr/bin/env ts-node
/**
 * Clone Claude Code Configuration to Another Project
 *
 * This script safely clones Claude Code configuration from LiveMetro
 * to another project, with compatibility checks and customization options.
 *
 * Usage:
 *   npm run clone:claude -- --target=/path/to/other/project
 *   npm run clone:claude -- --target=/path/to/other/project --dry-run
 *   npm run clone:claude -- --target=/path/to/other/project --backup=backup-2025-12-29_14-30-00
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface CloneOptions {
  sourceDir: string;
  targetProjectDir: string;
  backupName?: string;
  dryRun: boolean;
  skipPrompts: boolean;
  includeLocalSettings: boolean;
}

interface CompatibilityIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  file?: string;
  suggestion?: string;
}

/**
 * Analyzes compatibility issues when cloning configuration
 */
function checkCompatibility(
  sourceDir: string,
  targetProjectDir: string
): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];

  // Check if target project exists
  if (!fs.existsSync(targetProjectDir)) {
    issues.push({
      severity: 'error',
      category: 'Target Project',
      message: `Target project directory does not exist: ${targetProjectDir}`,
      suggestion: 'Verify the target path is correct',
    });
    return issues;
  }

  // Check if target has package.json (is it a Node project?)
  const targetPackageJson = path.join(targetProjectDir, 'package.json');
  if (!fs.existsSync(targetPackageJson)) {
    issues.push({
      severity: 'warning',
      category: 'Project Type',
      message: 'Target project does not have package.json',
      suggestion: 'Some skills may assume Node.js/npm project structure',
    });
  } else {
    // Check if it's a React Native project
    try {
      const pkgContent = JSON.parse(fs.readFileSync(targetPackageJson, 'utf-8'));
      const deps = { ...pkgContent.dependencies, ...pkgContent.devDependencies };

      if (!deps['react-native'] && !deps['expo']) {
        issues.push({
          severity: 'warning',
          category: 'Technology Stack',
          message: 'Target project is not a React Native/Expo project',
          suggestion:
            'LiveMetro skills are optimized for React Native. You may need to customize skills for your stack.',
        });
      }

      if (!deps['firebase']) {
        issues.push({
          severity: 'info',
          category: 'Dependencies',
          message: 'Target project does not use Firebase',
          suggestion: 'firebase-integration skill may not be relevant',
        });
      }
    } catch (error) {
      issues.push({
        severity: 'warning',
        category: 'Package Analysis',
        message: 'Could not parse target package.json',
      });
    }
  }

  // Check if target already has .claude directory
  const targetClaudeDir = path.join(targetProjectDir, '.claude');
  if (fs.existsSync(targetClaudeDir)) {
    issues.push({
      severity: 'warning',
      category: 'Existing Configuration',
      message: 'Target project already has .claude directory',
      suggestion: 'Existing configuration will be backed up before cloning',
    });
  }

  // Check for hardcoded paths in source
  const potentialPathFiles = [
    path.join(sourceDir, 'mcp.json'),
    path.join(sourceDir, 'settings.local.json'),
  ];

  for (const file of potentialPathFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');

      // Check for absolute paths
      if (content.includes('/Users/') || content.includes('C:\\')) {
        issues.push({
          severity: 'warning',
          category: 'Hardcoded Paths',
          message: `${path.basename(file)} may contain hardcoded absolute paths`,
          file: path.basename(file),
          suggestion: 'Review and update paths after cloning',
        });
      }

      // Check for LiveMetro-specific references
      if (content.toLowerCase().includes('livemetro')) {
        issues.push({
          severity: 'info',
          category: 'Project References',
          message: `${path.basename(file)} contains LiveMetro-specific references`,
          file: path.basename(file),
          suggestion: 'Update project-specific references after cloning',
        });
      }
    }
  }

  // Check skill files for project-specific content
  const skillsDir = path.join(sourceDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    const projectSpecificSkills = [
      'react-native-development',
      'firebase-integration',
      'subway-data-processor',
    ];

    for (const skillName of projectSpecificSkills) {
      const skillPath = path.join(skillsDir, skillName);
      if (fs.existsSync(skillPath)) {
        issues.push({
          severity: 'info',
          category: 'Skill Customization',
          message: `Skill '${skillName}' is LiveMetro-specific`,
          suggestion: 'Review and adapt skill content for target project',
        });
      }
    }
  }

  return issues;
}

/**
 * Displays compatibility issues
 */
function displayIssues(issues: CompatibilityIssue[]): void {
  if (issues.length === 0) {
    console.log('✅ No compatibility issues found!\n');
    return;
  }

  console.log('\n🔍 Compatibility Analysis:\n');
  console.log('─'.repeat(80));

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');

  if (errors.length > 0) {
    console.log('\n❌ ERRORS (must fix):');
    errors.forEach(issue => {
      console.log(`   • ${issue.message}`);
      if (issue.suggestion) {
        console.log(`     → ${issue.suggestion}`);
      }
    });
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (review recommended):');
    warnings.forEach(issue => {
      console.log(`   • ${issue.message}`);
      if (issue.suggestion) {
        console.log(`     → ${issue.suggestion}`);
      }
    });
  }

  if (infos.length > 0) {
    console.log('\n💡 INFO (good to know):');
    infos.forEach(issue => {
      console.log(`   • ${issue.message}`);
      if (issue.suggestion) {
        console.log(`     → ${issue.suggestion}`);
      }
    });
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`Total: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info\n`);
}

/**
 * Asks user for confirmation
 */
async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Recursively copies directory
 */
function copyDirectory(src: string, dest: string, excludeFiles: string[] = []): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip excluded files
    if (excludeFiles.includes(entry.name)) {
      console.log(`   ⏭️  Skipping: ${entry.name}`);
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath, excludeFiles);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Creates a customization guide file
 */
function createCustomizationGuide(targetProjectDir: string, issues: CompatibilityIssue[]): void {
  const guidePath = path.join(targetProjectDir, '.claude', 'CUSTOMIZATION_NEEDED.md');

  const content = `# Claude Code Configuration Customization Guide

This configuration was cloned from LiveMetro project on ${new Date().toISOString()}.

## ⚠️ Action Required

The following items need to be reviewed and customized for your project:

${issues
  .filter(i => i.severity !== 'info')
  .map(issue => `### ${issue.category}\n- **Issue**: ${issue.message}\n- **Action**: ${issue.suggestion || 'Review and update as needed'}\n`)
  .join('\n')}

## 📝 Recommended Customization Steps

### 1. Update Project References

Search for "LiveMetro" in all files and replace with your project name:

\`\`\`bash
cd .claude
grep -r "LiveMetro" . --exclude-dir=node_modules
\`\`\`

### 2. Review Skills

Check each skill in \`.claude/skills/\` and:
- Remove skills not relevant to your project
- Update skill descriptions and examples
- Customize technical stack references

### 3. Update MCP Configuration

In \`.claude/mcp.json\`:
- Update API keys in your \`.env\` file
- Review enabled/disabled servers
- Update any hardcoded paths

### 4. Customize Agents

In \`.claude/agents/\`:
- Update agent descriptions for your domain
- Adjust tool permissions if needed
- Customize expertise areas

### 5. Review Commands

In \`.claude/commands/\`:
- Verify commands work with your project structure
- Update npm script references
- Customize health check criteria

### 6. Update skill-rules.json

If your project has different file structure or patterns, update:
- File pattern triggers
- Keyword triggers
- Priority settings

## 🧹 Cleanup

After customization, delete this file:

\`\`\`bash
rm .claude/CUSTOMIZATION_NEEDED.md
\`\`\`

## 📚 Resources

- [Claude Code Documentation](https://claude.ai/code)
- [Original LiveMetro Config](https://github.com/your-repo/.claude)
- [Skills Guide](../skills\\ guide/)
`;

  fs.writeFileSync(guidePath, content);
  console.log(`\n📝 Created customization guide: ${guidePath}`);
}

/**
 * Main clone function
 */
async function cloneConfiguration(options: CloneOptions): Promise<void> {
  console.log('🔄 Clone Claude Code Configuration\n');
  console.log('─'.repeat(80));

  // Determine source directory
  let sourceDir: string;

  if (options.backupName) {
    const backupDir = path.join(process.cwd(), '.claude-backups');
    sourceDir = path.join(backupDir, options.backupName);

    if (!fs.existsSync(sourceDir)) {
      console.error(`❌ Error: Backup not found: ${sourceDir}`);
      process.exit(1);
    }

    console.log(`📦 Source: Backup ${options.backupName}`);
  } else {
    sourceDir = options.sourceDir;
    console.log(`📦 Source: Current .claude directory`);
  }

  console.log(`📂 Target: ${options.targetProjectDir}\n`);

  // Run compatibility check
  console.log('🔍 Running compatibility check...\n');
  const issues = checkCompatibility(sourceDir, options.targetProjectDir);
  displayIssues(issues);

  // Check for blocking errors
  const errors = issues.filter(i => i.severity === 'error');
  if (errors.length > 0) {
    console.error('❌ Cannot proceed due to errors. Please fix the issues above.');
    process.exit(1);
  }

  // Dry run mode
  if (options.dryRun) {
    console.log('🏃 Dry run mode - no files will be copied.\n');
    console.log('✅ Compatibility check complete. Run without --dry-run to proceed.');
    return;
  }

  // Confirm with user
  if (!options.skipPrompts) {
    const proceed = await confirm('\nDo you want to proceed with cloning? (y/N): ');

    if (!proceed) {
      console.log('❌ Clone cancelled.');
      process.exit(0);
    }
  }

  // Backup existing .claude directory if it exists
  const targetClaudeDir = path.join(options.targetProjectDir, '.claude');
  if (fs.existsSync(targetClaudeDir)) {
    const backupName = `claude-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const backupPath = path.join(options.targetProjectDir, backupName);

    console.log(`\n📦 Backing up existing .claude to: ${backupName}`);
    fs.renameSync(targetClaudeDir, backupPath);
  }

  // Copy configuration
  console.log('\n📥 Copying configuration...\n');

  const excludeFiles: string[] = [];

  // Optionally exclude settings.local.json
  if (!options.includeLocalSettings) {
    excludeFiles.push('settings.local.json');
  }

  try {
    copyDirectory(sourceDir, targetClaudeDir, excludeFiles);
    console.log('✅ Configuration copied successfully!\n');

    // Create customization guide
    createCustomizationGuide(options.targetProjectDir, issues);

    // Summary
    console.log('─'.repeat(80));
    console.log('\n✨ Clone Complete!\n');
    console.log('Next steps:');
    console.log('1. Read .claude/CUSTOMIZATION_NEEDED.md');
    console.log('2. Update project-specific references');
    console.log('3. Review and customize skills/agents');
    console.log('4. Test with: cd to target project and use Claude Code\n');
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('❌ Clone failed:', error);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): CloneOptions {
  const args = process.argv.slice(2);

  const options: CloneOptions = {
    sourceDir: path.join(process.cwd(), '.claude'),
    targetProjectDir: '',
    dryRun: false,
    skipPrompts: false,
    includeLocalSettings: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--target=')) {
      const value = arg.split('=')[1];
      if (value) {
        options.targetProjectDir = path.resolve(value);
      }
    } else if (arg.startsWith('--backup=')) {
      const value = arg.split('=')[1];
      if (value) {
        options.backupName = value;
      }
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '-y' || arg === '--yes') {
      options.skipPrompts = true;
    } else if (arg === '--include-local-settings') {
      options.includeLocalSettings = true;
    }
  }

  if (!options.targetProjectDir) {
    console.error('❌ Error: --target=/path/to/project is required');
    console.log('\nUsage:');
    console.log('  npm run clone:claude -- --target=/path/to/project');
    console.log('  npm run clone:claude -- --target=/path/to/project --dry-run');
    console.log('  npm run clone:claude -- --target=/path/to/project --backup=backup-name');
    process.exit(1);
  }

  return options;
}

// Execute
if (require.main === module) {
  const options = parseArgs();
  cloneConfiguration(options).catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

export { cloneConfiguration, checkCompatibility };
