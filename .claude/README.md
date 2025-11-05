# Claude Code Configuration for LiveMetro

> Advanced AI-assisted development setup with auto-activating skills, intelligent hooks, and structured workflows

## 🎯 Overview

This configuration transforms Claude Code into a specialized LiveMetro development assistant with:

- **Auto-Activating Skills**: Automatically loads relevant guidelines based on your work
- **Intelligent Hooks**: Pre/post tool execution automation
- **Dev Docs System**: External memory for complex multi-phase tasks
- **Custom Commands**: Shortcuts for common workflows
- **Specialized Agents**: Domain-specific sub-agents for focused work

## 📁 Directory Structure

```
.claude/
├── README.md                    # This file
├── skills/                      # Auto-activating skills
│   ├── react-native-development/
│   ├── firebase-integration/
│   ├── location-services/
│   ├── notification-system/
│   └── api-integration/
├── agents/                      # Specialized sub-agents
│   ├── mobile-ui-specialist.md
│   └── backend-integration-specialist.md
├── commands/                    # Custom workflow commands
│   ├── dev-docs.md
│   ├── update-dev-docs.md
│   └── new-feature.md
└── hooks/                       # Automation hooks
    ├── skillActivation.js       # Auto-load relevant skills
    └── selfCheck.js             # Code quality validation

.claudecode.json                 # Permissions & hook configuration
skill-rules.json                 # Skill activation rules
dev/                            # Dev docs system
├── README.md
├── active/                     # Current tasks
└── completed/                  # Archived tasks
```

## 🚀 Quick Start

### First Time Setup

1. **Verify installation**:
   ```bash
   # Check files exist
   ls -la .claude/ .claudecode.json skill-rules.json
   ```

2. **Make hooks executable** (if not already):
   ```bash
   chmod +x .claude/hooks/*.js
   ```

3. **Restart Claude Code** to load the configuration

4. **Test the setup**:
   ```
   "Create a new React Native component for displaying train information"
   ```

   You should see the Skills activation message with `react-native-development` loaded.

### Daily Workflow

1. **Start with clear context**:
   ```
   /clear
   ```

2. **For new features**:
   ```
   /new-feature
   ```

3. **For multi-phase tasks**:
   ```
   /dev-docs
   ```

4. **Before context compaction**:
   ```
   /update-dev-docs
   ```

## 🎨 Skills System

### Available Skills

| Skill | Triggers | Purpose |
|-------|----------|---------|
| **react-native-development** | component, screen, UI, React Native | Component creation, styling, accessibility |
| **firebase-integration** | firebase, firestore, auth, database | Backend services, real-time data |
| **location-services** | location, GPS, tracking, nearby | Location features, geofencing |
| **notification-system** | notification, alert, push | Push notifications, scheduling |
| **api-integration** | API, endpoint, fetch, seoul | Seoul API, data management |

### How Skills Work

Skills are **automatically activated** based on your prompts:

```
You: "Create a component to display nearby subway stations"

🎯 SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟡 react-native-development (domain, suggest)
🟡 location-services (domain, suggest)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Claude: [Follows guidelines from both skills]
```

### Skill Priority Levels

- 🔴 **Critical**: Always checked (error-handling, data-management)
- 🟡 **High**: Checked for domain tasks (react-native, firebase, etc.)
- 🟢 **Medium**: Checked when relevant
- ⚪ **Low**: Only when explicitly mentioned

## 🤖 Sub-Agents

Specialized agents for focused work:

### Mobile UI Specialist
```
@mobile-ui-specialist Create a train arrival card component
```
**Expertise**: React Native UI, accessibility, performance optimization

### Backend Integration Specialist
```
@backend-integration-specialist Set up real-time train arrival subscriptions
```
**Expertise**: Firebase, API integration, 3-tier caching

## 🔧 Custom Commands

### `/dev-docs`
Create comprehensive planning documents for multi-phase tasks.

**Usage**: After approving a plan in planning mode

**Creates**:
- `dev/active/[task]/[task]-plan.md`
- `dev/active/[task]/[task]-context.md`
- `dev/active/[task]/[task]-tasks.md`

### `/update-dev-docs`
Update all dev docs with current progress before context compaction.

**Usage**: When context drops below 20%

**Updates**:
- Context with session summary
- Tasks with completed checkboxes
- Next steps based on progress

### `/new-feature`
Plan and scaffold a new feature following best practices.

**Usage**: When starting a new feature

**Process**:
1. Requirements analysis
2. Architecture planning
3. Dev docs creation
4. File scaffolding
5. Implementation checklist

## 🪝 Hooks System

### UserPromptSubmit Hook
**Trigger**: Before Claude sees your message

**Action**: Analyzes prompt and activates relevant skills

**Example**:
```
You type: "Add Firebase authentication"
Hook runs: Detects "firebase" and "auth" keywords
Result: firebase-integration skill activated
Claude sees: Your prompt + skill activation notice
```

### PostToolUse Hook
**Trigger**: After Write tool for TypeScript files

**Action**: Runs ESLint with auto-fix

**Example**:
```
Claude: Writes src/components/TrainCard.tsx
Hook runs: npx eslint --fix src/components/TrainCard.tsx
Result: Automatically formatted code
```

### Stop Hook
**Trigger**: After Claude's response completes

**Action**: Self-check for code quality issues

**Checks**:
- Error handling patterns
- Async/await usage
- TypeScript `any` usage
- Console.log statements
- Firebase operations

## 💡 Tips & Tricks

### 1. Explicit Skill Loading
If auto-activation doesn't work, mention explicitly:
```
"Load the firebase-integration skill and help me set up real-time subscriptions"
```

### 2. Multi-Skill Tasks
Some tasks trigger multiple skills automatically:
```
"Create a notification component for train delays"
→ Activates: react-native-development + notification-system
```

### 3. Dev Docs for Complex Work
Always use dev docs for tasks with:
- Multiple phases (3+)
- Many files (5+)
- Long duration (30+ minutes)
- Complex dependencies

### 4. Context Management
```bash
# Low context warning?
/update-dev-docs  # Save progress

# After compaction
"Continue with [task name]"  # Claude loads dev docs
```

### 5. Debugging Hooks
```bash
# Check hook execution logs
tail -f .claude/logs/hooks.log  # If logging is enabled

# Test skill activation manually
node .claude/hooks/skillActivation.js "create a firebase collection"
```

## 📊 Skill Rules Configuration

Edit `skill-rules.json` to customize skill activation:

```json
{
  "your-custom-skill": {
    "type": "domain",          // domain | guardrail | enhancement
    "enforcement": "suggest",  // suggest | require | block
    "priority": "high",        // critical | high | medium | low
    "promptTriggers": {
      "keywords": ["keyword1", "keyword2"],
      "intentPatterns": [
        "regex pattern 1",
        "regex pattern 2"
      ]
    },
    "fileTriggers": {
      "pathPatterns": ["src/path/**/*.ts"],
      "contentPatterns": ["import.*Something"]
    }
  }
}
```

## 🔒 Security & Permissions

Configured in `.claudecode.json`:

### Allowed
- ✅ Read any file in the project
- ✅ Edit/Write to `src/**`, `.claude/**`, `dev/**`
- ✅ Run npm, git, pm2 commands
- ✅ Use approved MCP tools

### Denied
- ❌ Read/Write `.env*` files
- ❌ Run `sudo` commands
- ❌ Run destructive `rm -rf` commands

## 🧪 Testing the Configuration

### Test 1: Skill Activation
```
Prompt: "Create a Firebase collection for train arrivals"
Expected: firebase-integration skill activates
```

### Test 2: Hook Execution
```
Action: Write a .tsx file
Expected: ESLint auto-formats the file
```

### Test 3: Self-Check
```
Action: Write code with try/catch
Expected: Self-check reminds about error logging
```

### Test 4: Dev Docs
```
Command: /dev-docs
Expected: Creates 3 markdown files in dev/active/
```

## 📚 Additional Resources

- **Project Guidelines**: [CLAUDE.md](../CLAUDE.md)
- **Architecture**: [vooster-docs/architecture.md](../vooster-docs/architecture.md)
- **Clean Code**: [vooster-docs/clean-code.md](../vooster-docs/clean-code.md)
- **Dev Docs Guide**: [dev/README.md](../dev/README.md)

## 🐛 Troubleshooting

### Skills Not Activating

**Problem**: Skills don't load automatically

**Solutions**:
1. Check `skill-rules.json` for typos
2. Verify hook script is executable: `ls -la .claude/hooks/`
3. Restart Claude Code
4. Manually mention skill: "Use the react-native-development skill"

### Hooks Not Running

**Problem**: PostToolUse hook not formatting files

**Solutions**:
1. Check `.claudecode.json` hooks configuration
2. Verify script has execute permissions
3. Test hook manually: `node .claude/hooks/selfCheck.js`

### Dev Docs Not Found

**Problem**: Claude doesn't load dev docs when continuing work

**Solutions**:
1. Explicitly mention: "Check dev/active/[task-name]/"
2. Use absolute paths when creating docs
3. Ensure docs were saved before context compaction

## 🎓 Learning Path

### Week 1: Basics
- Use custom commands (`/dev-docs`, `/new-feature`)
- Let skills auto-activate
- Complete 2-3 features with dev docs

### Week 2: Advanced
- Create custom skills for project-specific patterns
- Modify `skill-rules.json` for better activation
- Use sub-agents for specialized work

### Week 3: Mastery
- Write custom hooks for project automation
- Optimize skill activation rules
- Build project-specific agents

## 🤝 Contributing

To add new skills or agents:

1. **Create skill directory**: `.claude/skills/[skill-name]/`
2. **Write SKILL.md** with guidelines
3. **Add activation rules** to `skill-rules.json`
4. **Test activation** with relevant prompts
5. **Update this README**

---

**Configuration Version**: 1.0.0
**Last Updated**: 2025-11-06
**Project**: LiveMetro - Seoul Subway Real-time Notification App

*Built following the Skills Guide methodology for production-ready AI-assisted development.*
