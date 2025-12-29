#!/usr/bin/env ts-node

/**
 * Skills Guide Auto-Updater
 *
 * Automatically checks and updates the skills guide documentation
 * based on:
 * - Current project configuration (.claude/, skill-rules.json)
 * - Latest Claude Code version
 * - Latest React Native/Expo versions
 * - Current date (last update > 30 days)
 */

import * as fs from 'fs';
import * as path from 'path';

interface UpdateMetadata {
  lastUpdate: string;
  version: string;
  claudeCodeVersion: string;
  reactNativeVersion: string;
  expoVersion: string;
}

interface UpdateCheck {
  needsUpdate: boolean;
  daysSinceUpdate: number;
  outdatedVersions: string[];
  missingSkills: string[];
  missingAgents: string[];
}

class SkillsGuideUpdater {
  private readonly PROJECT_ROOT = path.resolve(__dirname, '..');
  private readonly SKILLS_GUIDE_DIR = path.join(this.PROJECT_ROOT, 'skills guide');
  private readonly METADATA_FILE = path.join(this.SKILLS_GUIDE_DIR, '.update-metadata.json');
  private readonly UPDATE_INTERVAL_DAYS = 30;

  /**
   * Main update function
   */
  async run(): Promise<void> {
    console.log('🔍 Checking Skills Guide for updates...\n');

    const check = await this.checkForUpdates();

    if (!check.needsUpdate) {
      console.log('✅ Skills Guide is up to date!');
      console.log(`   Last updated: ${this.getLastUpdateDate()} (${check.daysSinceUpdate} days ago)`);
      return;
    }

    console.log('⚠️  Skills Guide needs updating:\n');

    if (check.daysSinceUpdate >= this.UPDATE_INTERVAL_DAYS) {
      console.log(`   📅 Last update was ${check.daysSinceUpdate} days ago (threshold: ${this.UPDATE_INTERVAL_DAYS} days)`);
    }

    if (check.outdatedVersions.length > 0) {
      console.log('   📦 Outdated versions detected:');
      check.outdatedVersions.forEach(v => console.log(`      - ${v}`));
    }

    if (check.missingSkills.length > 0) {
      console.log('   🆕 New skills to document:');
      check.missingSkills.forEach(s => console.log(`      - ${s}`));
    }

    if (check.missingAgents.length > 0) {
      console.log('   🤖 New agents to document:');
      check.missingAgents.forEach(a => console.log(`      - ${a}`));
    }

    console.log('\n📝 Updating Skills Guide...\n');

    await this.performUpdates();

    console.log('✅ Skills Guide updated successfully!');
    console.log('   Run git diff to review changes');
  }

  /**
   * Check if updates are needed
   */
  private async checkForUpdates(): Promise<UpdateCheck> {
    const metadata = this.loadMetadata();
    const currentVersions = await this.getCurrentVersions();
    const projectSkills = this.getProjectSkills();
    const projectAgents = this.getProjectAgents();

    const daysSinceUpdate = this.getDaysSinceUpdate(metadata.lastUpdate);
    const needsUpdate = daysSinceUpdate >= this.UPDATE_INTERVAL_DAYS;

    const outdatedVersions: string[] = [];

    // Check version changes
    if (metadata.claudeCodeVersion !== currentVersions.claudeCodeVersion) {
      outdatedVersions.push(`Claude Code: ${metadata.claudeCodeVersion} → ${currentVersions.claudeCodeVersion}`);
    }

    if (metadata.reactNativeVersion !== currentVersions.reactNativeVersion) {
      outdatedVersions.push(`React Native: ${metadata.reactNativeVersion} → ${currentVersions.reactNativeVersion}`);
    }

    if (metadata.expoVersion !== currentVersions.expoVersion) {
      outdatedVersions.push(`Expo: ${metadata.expoVersion} → ${currentVersions.expoVersion}`);
    }

    // Check for new skills/agents not documented
    const documentedSkills = this.getDocumentedSkills();
    const missingSkills = projectSkills.filter(s => !documentedSkills.includes(s));

    const documentedAgents = this.getDocumentedAgents();
    const missingAgents = projectAgents.filter(a => !documentedAgents.includes(a));

    return {
      needsUpdate: needsUpdate || outdatedVersions.length > 0 || missingSkills.length > 0 || missingAgents.length > 0,
      daysSinceUpdate,
      outdatedVersions,
      missingSkills,
      missingAgents
    };
  }

  /**
   * Perform the actual updates
   */
  private async performUpdates(): Promise<void> {
    const currentVersions = await this.getCurrentVersions();
    const today = new Date().toISOString().split('T')[0];

    // Update all markdown files with new date
    const files = [
      'README.md',
      'Claude Code 완벽 가이드북 2025.md',
      'Quick Reference.md',
      '실전 예제.md',
      'CLAUDE.md 템플릿.md',
      '프로젝트별 템플릿.md'
    ];

    for (const file of files) {
      const filePath = path.join(this.SKILLS_GUIDE_DIR, file);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf-8');

        // Update "마지막 업데이트" or "Last Updated"
        content = content.replace(
          /(?:마지막 업데이트|Last Updated|최신 업데이트):\s*\d{4}-\d{2}-\d{2}/g,
          `마지막 업데이트: ${today}`
        );

        // Update version numbers
        content = content.replace(
          /Claude Code CLI v\d+\.\d+\.\d+\+?/g,
          `Claude Code CLI ${currentVersions.claudeCodeVersion}`
        );

        content = content.replace(
          /React Native \d+\.\d+(\.\d+)?/g,
          `React Native ${currentVersions.reactNativeVersion}`
        );

        content = content.replace(
          /Expo ~?\d+/g,
          `Expo ${currentVersions.expoVersion}`
        );

        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`   ✓ Updated ${file}`);
      }
    }

    // Update metadata
    this.saveMetadata({
      lastUpdate: today,
      version: '2.0',
      ...currentVersions
    });

    console.log(`   ✓ Updated metadata (${this.METADATA_FILE})`);
  }

  /**
   * Get current project versions
   */
  private async getCurrentVersions(): Promise<{
    claudeCodeVersion: string;
    reactNativeVersion: string;
    expoVersion: string;
  }> {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(this.PROJECT_ROOT, 'package.json'), 'utf-8')
    );

    return {
      claudeCodeVersion: 'v2.0.80+', // Could be fetched from `claude --version`
      reactNativeVersion: packageJson.dependencies?.['react-native']?.replace(/[\^~]/, '') || '0.72.0',
      expoVersion: packageJson.dependencies?.['expo']?.replace(/[\^~]/, '') || '49.0.0'
    };
  }

  /**
   * Get skills from .claude/skills/
   */
  private getProjectSkills(): string[] {
    const skillsDir = path.join(this.PROJECT_ROOT, '.claude', 'skills');
    if (!fs.existsSync(skillsDir)) return [];

    return fs.readdirSync(skillsDir).filter(item => {
      const itemPath = path.join(skillsDir, item);
      return fs.statSync(itemPath).isDirectory();
    });
  }

  /**
   * Get agents from .claude/agents/
   */
  private getProjectAgents(): string[] {
    const agentsDir = path.join(this.PROJECT_ROOT, '.claude', 'agents');
    if (!fs.existsSync(agentsDir)) return [];

    return fs.readdirSync(agentsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));
  }

  /**
   * Get documented skills from README.md
   */
  private getDocumentedSkills(): string[] {
    const readmePath = path.join(this.SKILLS_GUIDE_DIR, 'README.md');
    if (!fs.existsSync(readmePath)) return [];

    const content = fs.readFileSync(readmePath, 'utf-8');
    const skillMatches = content.matchAll(/├── ([a-z-]+)\//g);

    return Array.from(skillMatches).map(m => m[1]);
  }

  /**
   * Get documented agents from README.md
   */
  private getDocumentedAgents(): string[] {
    const readmePath = path.join(this.SKILLS_GUIDE_DIR, 'README.md');
    if (!fs.existsSync(readmePath)) return [];

    const content = fs.readFileSync(readmePath, 'utf-8');
    const agentMatches = content.matchAll(/├── ([a-z-]+)\.md/g);

    return Array.from(agentMatches).map(m => m[1]);
  }

  /**
   * Load metadata
   */
  private loadMetadata(): UpdateMetadata {
    if (!fs.existsSync(this.METADATA_FILE)) {
      return {
        lastUpdate: '2025-12-28',
        version: '2.0',
        claudeCodeVersion: 'v2.0.70+',
        reactNativeVersion: '0.72.0',
        expoVersion: '49.0.0'
      };
    }

    return JSON.parse(fs.readFileSync(this.METADATA_FILE, 'utf-8'));
  }

  /**
   * Save metadata
   */
  private saveMetadata(metadata: UpdateMetadata): void {
    fs.writeFileSync(this.METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  /**
   * Get last update date
   */
  private getLastUpdateDate(): string {
    const metadata = this.loadMetadata();
    return metadata.lastUpdate;
  }

  /**
   * Calculate days since last update
   */
  private getDaysSinceUpdate(lastUpdate: string): number {
    const lastDate = new Date(lastUpdate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
}

// Run if called directly
if (require.main === module) {
  const updater = new SkillsGuideUpdater();
  updater.run().catch(error => {
    console.error('❌ Error updating skills guide:', error);
    process.exit(1);
  });
}

export default SkillsGuideUpdater;
