#!/usr/bin/env ts-node
/**
 * Claude Code Configuration Backup Script
 *
 * This script creates timestamped backups of the .claude/ directory
 * to preserve skills, agents, commands, and configuration files.
 *
 * Usage:
 *   npm run backup:claude
 *   npm run backup:claude -- --output=/custom/path
 */

import * as fs from 'fs';
import * as path from 'path';

interface BackupOptions {
  sourceDir: string;
  backupDir: string;
  maxBackups: number;
  compress: boolean;
}

const DEFAULT_OPTIONS: BackupOptions = {
  sourceDir: path.join(process.cwd(), '.claude'),
  backupDir: path.join(process.cwd(), '.claude-backups'),
  maxBackups: 10, // Keep last 10 backups
  compress: false,
};

/**
 * Creates a timestamped backup directory name
 */
function getBackupDirName(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T');
  const date = timestamp[0] ?? 'unknown-date';
  const timePart = timestamp[1] ?? '00-00-00.000Z';
  const time = timePart.split('.')[0];
  return `backup-${date}_${time}`;
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

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
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
 * Cleans up old backups, keeping only the most recent ones
 */
function cleanupOldBackups(backupDir: string, maxBackups: number): void {
  if (!fs.existsSync(backupDir)) {
    return;
  }

  const backups = fs.readdirSync(backupDir)
    .filter(name => name.startsWith('backup-'))
    .map(name => ({
      name,
      path: path.join(backupDir, name),
      mtime: fs.statSync(path.join(backupDir, name)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  // Remove old backups
  const toRemove = backups.slice(maxBackups);

  for (const backup of toRemove) {
    console.log(`🗑️  Removing old backup: ${backup.name}`);
    fs.rmSync(backup.path, { recursive: true, force: true });
  }

  if (toRemove.length > 0) {
    console.log(`✨ Cleaned up ${toRemove.length} old backup(s)\n`);
  }
}

/**
 * Creates backup metadata file
 */
function createMetadata(backupPath: string, sourceSize: number): void {
  const metadata = {
    timestamp: new Date().toISOString(),
    sourceDir: '.claude',
    backupSize: formatBytes(sourceSize),
    backupSizeBytes: sourceSize,
    files: [] as string[],
  };

  // Collect all backed up files
  function collectFiles(dir: string, baseDir: string = ''): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = path.join(baseDir, entry.name);

      if (entry.isDirectory()) {
        collectFiles(path.join(dir, entry.name), relativePath);
      } else {
        metadata.files.push(relativePath);
      }
    }
  }

  collectFiles(backupPath);

  const metadataPath = path.join(backupPath, 'backup-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Main backup function
 */
function createBackup(options: BackupOptions = DEFAULT_OPTIONS): void {
  console.log('🔄 Claude Code Configuration Backup\n');
  console.log('─'.repeat(50));

  // Validate source directory
  if (!fs.existsSync(options.sourceDir)) {
    console.error(`❌ Error: Source directory not found: ${options.sourceDir}`);
    process.exit(1);
  }

  // Create backup directory if it doesn't exist
  if (!fs.existsSync(options.backupDir)) {
    fs.mkdirSync(options.backupDir, { recursive: true });
    console.log(`📁 Created backup directory: ${options.backupDir}\n`);
  }

  // Calculate source size
  const sourceSize = getDirectorySize(options.sourceDir);
  console.log(`📊 Source size: ${formatBytes(sourceSize)}`);

  // Create timestamped backup directory
  const backupName = getBackupDirName();
  const backupPath = path.join(options.backupDir, backupName);

  console.log(`📦 Creating backup: ${backupName}`);

  try {
    // Copy directory
    const startTime = Date.now();
    copyDirectory(options.sourceDir, backupPath);
    const duration = Date.now() - startTime;

    // Create metadata
    createMetadata(backupPath, sourceSize);

    console.log(`✅ Backup completed in ${duration}ms`);
    console.log(`📂 Backup location: ${backupPath}\n`);

    // Cleanup old backups
    cleanupOldBackups(options.backupDir, options.maxBackups);

    // Show backup summary
    const allBackups = fs.readdirSync(options.backupDir)
      .filter(name => name.startsWith('backup-'));

    console.log('─'.repeat(50));
    console.log(`✨ Total backups: ${allBackups.length}`);
    console.log(`📁 Backup directory: ${options.backupDir}`);
    console.log('─'.repeat(50));

  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): Partial<BackupOptions> {
  const args = process.argv.slice(2);
  const options: Partial<BackupOptions> = {};

  for (const arg of args) {
    if (arg.startsWith('--output=')) {
      const value = arg.split('=')[1];
      if (value) {
        options.backupDir = value;
      }
    } else if (arg.startsWith('--max-backups=')) {
      const value = arg.split('=')[1];
      if (value) {
        options.maxBackups = parseInt(value, 10);
      }
    } else if (arg === '--compress') {
      options.compress = true;
    }
  }

  return options;
}

// Execute backup
if (require.main === module) {
  const customOptions = parseArgs();
  const options = { ...DEFAULT_OPTIONS, ...customOptions };
  createBackup(options);
}

export { createBackup, BackupOptions };
