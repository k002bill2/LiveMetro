#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const sourceDir = path.join(repoRoot, '.claude', 'commands');
const promptsDir = path.join(repoRoot, '.codex', 'prompts', 'commands');
const skillDir = path.join(repoRoot, '.codex', 'skills', 'livemetro-commands');
const skillAgentsDir = path.join(skillDir, 'agents');
const codexHome = process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex');
const userSkillDir = path.join(codexHome, 'skills', 'livemetro-commands');

function parseFrontmatter(raw, fallbackName) {
  if (!raw.startsWith('---\n')) {
    return { metadata: { name: fallbackName }, body: raw.trimStart() };
  }

  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) {
    return { metadata: { name: fallbackName }, body: raw.trimStart() };
  }

  const frontmatter = raw.slice(4, end);
  const body = raw.slice(end + 5).trimStart();
  const metadata = { name: fallbackName };

  for (const line of frontmatter.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    const value = match[2].trim();
    metadata[key] = value.length > 0 ? value : null;
  }

  return { metadata, body };
}

function quoteYaml(value) {
  return JSON.stringify(String(value ?? ''));
}

function commandPrompt({ name, description, argumentHint, allowedTools, sourcePath, body }) {
  const metadata = [
    '---',
    `name: ${quoteYaml(name)}`,
    `description: ${quoteYaml(description)}`,
    `source: ${quoteYaml(sourcePath)}`,
    'converted_from: "claude-code-command"',
  ];

  if (argumentHint) metadata.push(`argument_hint: ${quoteYaml(argumentHint)}`);
  if (allowedTools) metadata.push(`allowed_tools_advisory: ${quoteYaml(allowedTools)}`);
  metadata.push('---');

  const advisory = allowedTools
    ? `- Claude Code allowed-tools was \`${allowedTools}\`; in Codex this is advisory context, not a hard runtime allowlist.`
    : '- This command did not declare Claude Code allowed-tools; use the currently available Codex tools conservatively.';

  const args = argumentHint
    ? `- If the user supplies text after the command name, treat it as \`ARGUMENTS\` matching: \`${argumentHint}\`.`
    : '- If the user supplies text after the command name, treat it as `ARGUMENTS` for any `$ARGUMENTS` references.';

  return `${metadata.join('\n')}

# /${name} - Codex Prompt

Use this prompt when the user asks Codex to run \`/${name}\`, mentions \`${name}\`, or asks for the equivalent LiveMetro workflow.

## Codex Adaptation Rules

- Follow repository instructions in \`AGENTS.md\`, \`CLAUDE.md\`, and referenced LiveMetro rule files.
${args}
${advisory}
- Execute shell commands through Codex tools from the LiveMetro repo root unless the command explicitly changes directory.
- Stop on failure when the original command says to stop, report the failed step, and do not continue to later destructive or deployment steps.
- Preserve unrelated local work. Stage, commit, push, deploy, or reset only when the original command explicitly requires it and the user request authorizes it.
- Prefer current repo state over stale registry data. If a referenced file is missing, inspect the live workspace before deciding how to proceed.

## Original Command Body

${body.trim()}
`;
}

function skillMarkdown(commands) {
  const commandList = commands
    .map((command) => `- \`/${command.name}\` -> \`.codex/prompts/commands/${command.name}.md\`: ${command.description}`)
    .join('\n');

  return `---
name: livemetro-commands
description: Execute LiveMetro slash-command workflows converted from .claude/commands for Codex. Use when the user invokes or asks about /verify-app, /check-health, /deploy-with-tests, /commit-push-pr, /start-dev, /review, /code-review, /test-coverage, /draft-commits, /quick-commit, /checkpoint, /dev-docs, /execute-tasks-file, /update-dev-docs, /resume, /save-and-compact, /session-wrap, /simplify-code, /tdd, /plan, /explore, /config-backup, /sync-registry, /run-eval, or /eval-dashboard in /Users/younghwankang/Work/LiveMetro.
---

# LiveMetro Commands for Codex

This skill maps LiveMetro command-style requests to Codex prompt files generated from \`.claude/commands/*.md\`.

## Workflow

1. Normalize the requested command name by removing the leading slash.
2. Read \`.codex/prompts/commands/<command>.md\` from the current LiveMetro repo.
3. Follow the prompt's "Codex Adaptation Rules" and "Original Command Body".
4. If the prompt file is missing, fall back to \`.claude/commands/<command>.md\` and apply the same adaptation rules.
5. Treat Claude Code \`allowed-tools\` metadata as advisory only; Codex tool availability and sandbox policy are authoritative.
6. Preserve unrelated local work and inspect current repo state before staging, committing, pushing, deploying, or deleting files.

## Available Commands

${commandList}

## Sync

Regenerate prompts and this skill after changing \`.claude/commands/*.md\`:

\`\`\`bash
node scripts/sync-codex-command-prompts.mjs
npm run codex:install-commands-skill
\`\`\`
`;
}

function openaiYaml() {
  return `interface:
  display_name: "LiveMetro Commands"
  short_description: "Run LiveMetro command prompts in Codex"
  default_prompt: "Use $livemetro-commands to run /verify-app in LiveMetro."

policy:
  allow_implicit_invocation: true
`;
}

function installUserSkill() {
  if (!process.env.HOME && !process.env.CODEX_HOME) {
    throw new Error('Cannot resolve Codex home. Set CODEX_HOME or HOME.');
  }

  fs.rmSync(userSkillDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(userSkillDir), { recursive: true });
  fs.cpSync(skillDir, userSkillDir, { recursive: true });
  console.log(`Installed Codex skill in ${userSkillDir}`);
}

function main() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing source directory: ${path.relative(repoRoot, sourceDir)}`);
  }

  fs.mkdirSync(promptsDir, { recursive: true });
  fs.mkdirSync(skillAgentsDir, { recursive: true });

  const files = fs
    .readdirSync(sourceDir)
    .filter((file) => file.endsWith('.md'))
    .sort();

  const commands = [];

  for (const file of files) {
    const sourcePath = path.join('.claude', 'commands', file);
    const fallbackName = path.basename(file, '.md');
    const raw = fs.readFileSync(path.join(sourceDir, file), 'utf8');
    const { metadata, body } = parseFrontmatter(raw, fallbackName);
    const name = metadata.name || fallbackName;
    const description = metadata.description || `${name} command`;
    const argumentHint = metadata['argument-hint'];
    const allowedTools = metadata['allowed-tools'];

    commands.push({ name, description, argumentHint, allowedTools, sourcePath, body });
    fs.writeFileSync(
      path.join(promptsDir, `${name}.md`),
      commandPrompt({ name, description, argumentHint, allowedTools, sourcePath, body }),
      'utf8',
    );
  }

  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMarkdown(commands), 'utf8');
  fs.writeFileSync(path.join(skillAgentsDir, 'openai.yaml'), openaiYaml(), 'utf8');

  console.log(`Generated ${commands.length} Codex command prompts in ${path.relative(repoRoot, promptsDir)}`);
  console.log(`Generated Codex skill in ${path.relative(repoRoot, skillDir)}`);

  if (args.has('--install-user-skill')) {
    installUserSkill();
  }
}

main();
