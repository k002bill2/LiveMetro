#!/usr/bin/env node
/**
 * Skills Auto-Activation System
 * Automatically activates relevant skills based on user prompt
 */

const fs = require('fs');
const path = require('path');

// Get prompt from command line argument
const prompt = process.argv[2] || '';

// Load skill rules
const rulesPath = path.join(process.cwd(), 'skill-rules.json');
if (!fs.existsSync(rulesPath)) {
  process.exit(0);
}

const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
const activatedSkills = [];

// Analyze prompt against rules
for (const [skillName, rule] of Object.entries(rules)) {
  // Check keywords
  const hasKeyword = rule.promptTriggers.keywords.some(keyword =>
    prompt.toLowerCase().includes(keyword.toLowerCase())
  );

  // Check intent patterns
  const hasIntent = rule.promptTriggers.intentPatterns.some(pattern =>
    new RegExp(pattern, 'i').test(prompt)
  );

  if (hasKeyword || hasIntent) {
    activatedSkills.push({
      name: skillName,
      priority: rule.priority,
      enforcement: rule.enforcement,
      type: rule.type
    });
  }
}

// Output activation message if skills detected
if (activatedSkills.length > 0) {
  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  activatedSkills.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 SKILL ACTIVATION CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Relevant skills detected for this task:\n');

  activatedSkills.forEach(skill => {
    const icon = skill.priority === 'critical' ? '🔴' : skill.priority === 'high' ? '🟡' : '🟢';
    console.log(`${icon} ${skill.name} (${skill.type}, ${skill.enforcement})`);
  });

  console.log('\n💡 IMPORTANT: Load and follow guidelines from these skills.');
  console.log('   Check .claude/skills/[skill-name]/SKILL.md for details.\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
