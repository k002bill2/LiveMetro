#!/usr/bin/env ts-node
/**
 * Claude Code Configuration Restore Script
 *
 * This script restores Claude Code configuration from a backup.
 * It can list available backups and restore from a specific backup.
 *
 * Usage:
 *   npm run restore:claude               # Interactive mode - shows list
 *   npm run restore:claude -- --list     # List all backups
 *   npm run restore:claude -- --backup=backup-2025-12-29_10-30-00
 *   npm run restore:claude -- --latest   # Restore from latest backup
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface BackupInfo {
  name: string;
  path: string;
  timestamp: Date;
  size: number;
  metadata?: any;
}

const DEFAULT_BACKUP_DIR = path.join(process.cwd(), '.claude-backups');
const DEFAULT_TARGET_DIR = path.join(process.cwd(), '.claude');

/**
 * Gets all available backups
 */
function listBackups(backupDir: string): BackupInfo[] {
  if (!fs.existsSync(backupDir)) {
    console.log('⚠️  No backups found. Backup directory does not exist.');
    return [];
  }

  const backups = fs.readdirSync(backupDir)
    .filter(name => name.startsWith('backup-'))
    .map(name => {
      const backupPath = path.join(backupDir, name);
      const stats = fs.statSync(backupPath);

      // Try to read metadata
      let metadata;
      const metadataPath = path.join(backupPath, 'backup-metadata.json');
      if (fs.existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        } catch (error) {
          // Ignore metadata read errors
        }
      }

      return {
        name,
        path: backupPath,
        timestamp: stats.mtime,
        size: getDirectorySize(backupPath),
        metadata,
      };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return backups;
}

/**
 * Gets size of directory in bytes
 */
function getDirectorySize(dirPath: string): number {
  let size = 0;

  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      size += getDirectorySize(fullPath);
    } else {
      const stats = fs.statSync(fullPath);
      size += stats.size;
    }
  }

  return size;
}

/**
 * Formats bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Displays available backups
 */
function displayBackups(backups: BackupInfo[]): void {
  console.log('\n📦 Available Backups:\n');
  console.log('─'.repeat(80));

  if (backups.length === 0) {
    console.log('No backups found.');
    console.log('─'.repeat(80));
    return;
  }

  backups.forEach((backup, index) => {
    const dateStr = backup.timestamp.toLocaleString();
    const size = formatBytes(backup.size);
    const files = backup.metadata?.files?.length || 'N/A';

    console.log(`${index + 1}. ${backup.name}`);
    console.log(`   📅 Date: ${dateStr}`);
    console.log(`   📊 Size: ${size}`);
    console.log(`   📄 Files: ${files}`);

    if (index === 0) {
      console.log('   ⭐ LATEST');
    }

    console.log();
  });

  console.log('─'.repeat(80));
}

/**
 * Recursively removes a directory
 */
function removeDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  fs.rmSync(dirPath, { recursive: true, force: true });
}

/**
 * Recursively copies a directory
 */
function copyDirectory(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip metadata file
    if (entry.name === 'backup-metadata.json') {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
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
 * Restores from a backup
 */
async function restoreBackup(
  backupPath: string,
  targetDir: string,
  skipConfirm: boolean = false
): Promise<void> {
  console.log('\n🔄 Claude Code Configuration Restore\n');
  console.log('─'.repeat(50));

  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Error: Backup not found: ${backupPath}`);
    process.exit(1);
  }

  console.log(`📦 Backup: ${path.basename(backupPath)}`);
  console.log(`📂 Target: ${targetDir}`);

  // Check if target directory exists
  if (fs.existsSync(targetDir)) {
    console.log(`\n⚠️  Warning: Target directory exists and will be replaced!`);

    if (!skipConfirm) {
      const proceed = await confirm('\nDo you want to continue? (y/N): ');

      if (!proceed) {
        console.log('❌ Restore cancelled.');
        process.exit(0);
      }
    }

    // Create backup of current config before restoring
    const currentBackupName = `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const currentBackupPath = path.join(DEFAULT_BACKUP_DIR, currentBackupName);

    console.log(`\n📦 Creating safety backup of current config...`);
    fs.mkdirSync(currentBackupPath, { recursive: true });
    copyDirectory(targetDir, currentBackupPath);
    console.log(`✅ Safety backup created: ${currentBackupName}`);

    // Remove current directory
    console.log(`\n🗑️  Removing current configuration...`);
    removeDirectory(targetDir);
  }

  try {
    console.log(`\n📥 Restoring configuration...`);
    const startTime = Date.now();

    copyDirectory(backupPath, targetDir);

    const duration = Date.now() - startTime;

    console.log(`✅ Restore completed in ${duration}ms`);
    console.log(`📂 Configuration restored to: ${targetDir}\n`);
    console.log('─'.repeat(50));
    console.log('✨ Claude Code configuration has been restored successfully!');
    console.log('─'.repeat(50));

  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

/**
 * Interactive mode - shows list and lets user choose
 */
async function interactiveMode(backupDir: string, targetDir: string): Promise<void> {
  const backups = listBackups(backupDir);

  if (backups.length === 0) {
    console.log('\n💡 Tip: Create a backup first with: npm run backup:claude');
    process.exit(0);
  }

  displayBackups(backups);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('\nEnter backup number to restore (or "q" to quit): ', async (answer) => {
    rl.close();

    if (answer.toLowerCase() === 'q') {
      console.log('❌ Restore cancelled.');
      process.exit(0);
    }

    const index = parseInt(answer, 10) - 1;

    if (isNaN(index) || index < 0 || index >= backups.length) {
      console.error('❌ Invalid selection.');
      process.exit(1);
    }

    const selectedBackup = backups[index];
    if (!selectedBackup) {
      console.error('❌ Invalid backup selection.');
      process.exit(1);
    }
    await restoreBackup(selectedBackup.path, targetDir);
  });
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);

  const options = {
    list: false,
    latest: false,
    backup: null as string | null,
    yes: false,
  };

  for (const arg of args) {
    if (arg === '--list') {
      options.list = true;
    } else if (arg === '--latest') {
      options.latest = true;
    } else if (arg.startsWith('--backup=')) {
      const value = arg.split('=')[1];
      options.backup = value ?? null;
    } else if (arg === '-y' || arg === '--yes') {
      options.yes = true;
    }
  }

  return options;
}

// Main execution
async function main() {
  const options = parseArgs();
  const backupDir = DEFAULT_BACKUP_DIR;
  const targetDir = DEFAULT_TARGET_DIR;

  if (options.list) {
    // List mode
    const backups = listBackups(backupDir);
    displayBackups(backups);
    return;
  }

  if (options.latest) {
    // Restore from latest
    const backups = listBackups(backupDir);

    if (backups.length === 0) {
      console.log('❌ No backups found.');
      process.exit(1);
    }

    const latestBackup = backups[0];
    if (!latestBackup) {
      console.log('❌ No backups found.');
      process.exit(1);
    }

    await restoreBackup(latestBackup.path, targetDir, options.yes);
    return;
  }

  if (options.backup) {
    // Restore from specific backup
    const backupPath = path.join(backupDir, options.backup);
    await restoreBackup(backupPath, targetDir, options.yes);
    return;
  }

  // Interactive mode
  await interactiveMode(backupDir, targetDir);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

export { restoreBackup, listBackups };
