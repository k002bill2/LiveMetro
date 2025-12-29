# Claude Code Configuration

This directory contains the complete Claude Code configuration for LiveMetro, including Skills, Agents, Commands, and MCP server integrations.

## Directory Structure

```
.claude/
├── README.md                           # This file
├── SETUP_GUIDE.md                      # Detailed setup instructions
├── mcp.json                            # MCP server configurations
├── settings.local.json                 # Local settings
├── skills/                             # Agent Skills
│   ├── react-native-development/       # React Native UI development
│   ├── firebase-integration/           # Firebase services
│   ├── api-integration/                # Seoul Open Data API
│   ├── location-services/              # GPS and geolocation
│   ├── notification-system/            # Push notifications
│   ├── test-automation/                # 🆕 Test generation and coverage
│   └── subway-data-processor/          # 🆕 Seoul subway data parsing
├── agents/                             # Sub-agents
│   ├── mobile-ui-specialist.md         # React Native UI/UX expert
│   ├── backend-integration-specialist.md # Firebase/API integration
│   └── performance-optimizer.md        # 🆕 Performance optimization
├── commands/                           # Custom commands
│   ├── test-coverage.md                # 🆕 Coverage analysis
│   └── check-health.md                 # 🆕 Project health check
└── hooks/                              # Automation hooks (empty)
```

## What is Claude Code?

Claude Code is Anthropic's AI-powered development assistant that helps with coding tasks through:
- **Skills**: Reusable expertise modules for specific domains
- **Agents**: Specialized AI assistants for complex tasks
- **Commands**: Custom workflows and automations
- **MCP**: External tool integrations

---

## 🌟 Agent Skills

### Core Skills (Project-Specific)

#### 1. **react-native-development** ✅
- **Purpose**: React Native component development with TypeScript
- **Use When**: Creating UI components, screens, or implementing navigation
- **Key Features**:
  - Component architecture guidance
  - React Navigation patterns
  - TypeScript strict mode compliance
  - Mobile-specific optimizations

#### 2. **firebase-integration** ✅
- **Purpose**: Firebase Auth, Firestore, and real-time data
- **Use When**: Working with user authentication or database operations
- **Key Features**:
  - Real-time subscriptions (onSnapshot)
  - Firestore query optimization
  - Proper subscription cleanup
  - Offline persistence strategies

#### 3. **api-integration** ✅
- **Purpose**: Seoul Open Data API integration
- **Use When**: Fetching subway arrival data or timetables
- **Key Features**:
  - API endpoint configurations
  - Timeout and retry logic
  - Error handling strategies
  - Response validation

#### 4. **location-services** ✅
- **Purpose**: GPS tracking and geolocation features
- **Use When**: Implementing location-based features (nearby stations)
- **Key Features**:
  - Permission handling (iOS/Android)
  - Background location tracking
  - Distance calculations
  - Battery optimization

#### 5. **notification-system** ✅
- **Purpose**: Push notifications and arrival alerts
- **Use When**: Setting up notification features
- **Key Features**:
  - Expo Notifications setup
  - Scheduled notifications
  - Notification permissions
  - Deep linking from notifications

### Advanced Skills (Quality & Performance)

#### 6. **test-automation** 🆕
- **Purpose**: Generate comprehensive Jest tests
- **Use When**: Writing tests, improving coverage, or TDD
- **Key Features**:
  - Component testing with React Native Testing Library
  - Hook testing patterns
  - Firebase/API mocking
  - Coverage analysis
- **Target Coverage**: 75% statements, 70% functions

#### 7. **subway-data-processor** 🆕
- **Purpose**: Process Seoul subway data and normalize API responses
- **Use When**: Parsing Seoul API, handling timetables, or data transformation
- **Key Features**:
  - Korean text parsing ("2분후[1번째전]")
  - Direction normalization (상행 → up)
  - Station name fuzzy matching
  - Service disruption detection
  - Multi-tier caching (Seoul API → Firebase → Cache)

---

## 🤖 Sub-agents

### 1. **mobile-ui-specialist** ✅
- **Model**: Sonnet
- **Tools**: edit, create, read, grep
- **Expertise**: React Native UI/UX, component design, responsive layouts
- **Use For**: Creating screens, optimizing UI, implementing design systems

### 2. **backend-integration-specialist** ✅
- **Model**: Sonnet
- **Tools**: edit, create, read, grep, bash
- **Expertise**: Firebase integration, API design, data synchronization
- **Use For**: Backend service layer, real-time data, API optimization

### 3. **performance-optimizer** 🆕
- **Model**: Sonnet
- **Tools**: edit, read, grep, bash
- **Expertise**: React optimization, memory leak detection, bundle analysis
- **Use For**:
  - Identifying unnecessary re-renders
  - Fixing memory leaks (Firebase subscriptions)
  - Optimizing FlatList performance
  - Bundle size reduction
  - 60 FPS optimization

---

## 🔧 Custom Commands

### 1. **test-coverage** 🆕
```bash
/test-coverage
```

**Purpose**: Analyze test coverage and identify gaps

**What It Does**:
1. Runs `npm test -- --coverage`
2. Identifies files below coverage thresholds
3. Prioritizes high-impact coverage gaps
4. Suggests specific tests to write
5. Offers to create test stubs

**Output**: Detailed report with actionable recommendations

### 2. **check-health** 🆕
```bash
/check-health
```

**Purpose**: Comprehensive project health check

**What It Checks**:
1. ✅ TypeScript type errors (`npm run type-check`)
2. ✅ ESLint issues (`npm run lint`)
3. ✅ Test suite passing (`npm test`)
4. ✅ Build verification (`npm run build:development`)
5. ✅ Dependency vulnerabilities (`npm audit`)
6. ✅ Project structure validation

**Output**: Health score (0-100%) with quick fix suggestions

---

## 📦 MCP Servers (External Tools)

### 1. **codex-cli** ✅ Enabled
- **Purpose**: Code snippet and developer tool access
- **No API Key Required**
- **Usage**: Provides access to code examples and development utilities

### 2. **context7** ✅ Enabled
- **Purpose**: Upstash Context7 for semantic code search and context retrieval
- **No API Key Required**
- **Usage**: Enhanced codebase understanding and semantic search

### 3. **magic** ✅ Enabled
- **Purpose**: 21st.dev Magic UI component library
- **API Key Required**: `TWENTYFIRST_API_KEY`
- **Usage**: Access to pre-built React components and UI patterns
- **Get API Key**: https://21st.dev

### 4. **tavily** ✅ Enabled
- **Purpose**: Web search and research capabilities
- **API Key Required**: `TAVILY_API_KEY`
- **Usage**: Real-time web search for documentation, APIs, and current information
- **Get API Key**: https://tavily.com

### 5. **morphllm-fast-apply** ⏸️ Disabled
- **Purpose**: Morph LLM fast code application and generation
- **API Key Required**: `MORPH_API_KEY`
- **Usage**: Rapid code generation and transformation
- **Get API Key**: https://morph.so
- **Status**: Currently disabled - enable in `mcp.json` when needed

### 6. **playwright** ✅ Enabled
- **Purpose**: Browser automation and testing
- **No API Key Required**
- **Usage**: Web scraping, automated testing, and browser interaction

### 7. **serena** ✅ Enabled
- **Purpose**: IDE assistant with context-aware suggestions
- **No API Key Required**
- **Requirement**: Python with `uvx` installed
- **Usage**: Enhanced IDE integration and contextual assistance

### 8. **filesystem** ⏸️ Disabled
- **Purpose**: Direct filesystem access beyond workspace
- **No API Key Required**
- **Path**: `/Users/younghwankang/Work`
- **Status**: Disabled for security - enable only when needed

## Setup Instructions

### 1. Install Required API Keys

Add the following to your `.env` file in the project root:

```bash
# MCP Server API Keys
TWENTYFIRST_API_KEY=your_21st_dev_key_here
TAVILY_API_KEY=your_tavily_key_here
MORPH_API_KEY=your_morph_key_here  # Optional
```

### 2. Restart Claude Code

After adding API keys, restart Claude Code for changes to take effect:

```bash
# If using CLI
claude-code restart

# Or simply close and reopen your IDE
```

### 3. Verify MCP Servers

You can verify that MCP servers are running by checking Claude Code's status:

```bash
claude-code mcp list
```

## Enabling/Disabling Servers

To enable or disable a server, edit [mcp.json](mcp.json):

```json
{
  "mcpServers": {
    "server-name": {
      "disabled": true  // Change to false to enable
    }
  }
}
```1

## Security Notes

- **API Keys**: Never commit API keys to version control. They are loaded from `.env`
- **Filesystem Server**: Disabled by default for security. Only enable when you need access outside the workspace
- **Environment Variables**: Use `${VARIABLE_NAME}` syntax in `mcp.json` to reference `.env` variables

## Troubleshooting

### Server Not Starting

1. Check that required dependencies are installed:
   ```bash
   # For npx-based servers (most)
   node --version  # Should be 18+

   # For serena
   python3 --version
   pip install uv
   ```

2. Verify API keys are set in `.env`

3. Check Claude Code logs for error messages

### API Key Issues

If you see authentication errors:
- Verify the API key is correct in `.env`
- Ensure there are no extra spaces or quotes
- Restart Claude Code after changing `.env`

## Useful MCP Servers for LiveMetro

Given this is a React Native/Expo project, the most useful servers are:

1. **magic**: UI component generation (React components)
2. **tavily**: Research React Native/Expo documentation
3. **playwright**: Testing web versions
4. **context7**: Better codebase understanding
5. **codex-cli**: Code snippet reference

---

## 🚀 Quick Start Guide

### For New Features

1. **Check Project Context**
   ```bash
   "Read CLAUDE.md to understand the LiveMetro architecture"
   ```

2. **Use Appropriate Skill**
   ```bash
   # UI work
   "Using react-native-development skill, create a StationCard component"

   # Data processing
   "Using subway-data-processor skill, parse this Seoul API response"

   # Testing
   "Using test-automation skill, generate tests for useRealtimeTrains"
   ```

3. **Verify Quality**
   ```bash
   /check-health
   ```

### For Bug Fixes

1. **Analyze the Issue**
   ```bash
   "Using firebase-integration skill, investigate why subscriptions aren't cleaning up"
   ```

2. **Fix Performance Issues**
   ```bash
   "@performance-optimizer Analyze re-render issues in TrainArrivalList"
   ```

3. **Add Tests**
   ```bash
   "Using test-automation skill, create tests to prevent regression"
   ```

### For Code Reviews

1. **Check Coverage**
   ```bash
   /test-coverage
   ```

2. **Review Performance**
   ```bash
   "@performance-optimizer Review recent changes for performance impact"
   ```

3. **Health Check**
   ```bash
   /check-health
   ```

---

## 📊 Configuration Files

### skill-rules.json (Project Root)
Defines automatic skill activation rules based on:
- **Keywords**: "firebase", "navigation", "test", etc.
- **Intent Patterns**: Regex patterns for user prompts
- **File Patterns**: Paths that trigger skills automatically

### .claudecode.json (Project Root)
Controls permissions and hooks:
- **Permissions**: Allowed/denied tool usage
- **PostToolUse Hooks**: Auto-run after edits (type-check, lint)
- **Auto-approve**: Pre-approved safe operations

---

## 💡 Best Practices

### 1. Skill Selection
- ✅ **Use specific skills**: "Using react-native-development skill..."
- ✅ **Let auto-activation work**: skill-rules.json handles common cases
- ❌ **Don't over-specify**: Trust Claude to use appropriate skills

### 2. Agent Delegation
- ✅ **Complex tasks**: "@performance-optimizer Analyze bundle size"
- ✅ **Specialized work**: "@mobile-ui-specialist Design the station detail screen"
- ❌ **Simple tasks**: Don't use agents for basic edits

### 3. Command Usage
- ✅ **Regular checks**: Run `/check-health` before commits
- ✅ **Coverage tracking**: Run `/test-coverage` weekly
- ✅ **Automate**: Add commands to git hooks

### 4. Workflow Integration
```bash
# Daily routine
1. /check-health  # Morning health check
2. Work on features (skills auto-activate)
3. /test-coverage  # Ensure quality
4. /check-health  # Pre-commit verification
```

---

## 🔄 Maintenance

### Adding New Skills

1. Create skill directory:
   ```bash
   mkdir -p .claude/skills/new-skill
   ```

2. Create SKILL.md with frontmatter:
   ```markdown
   ---
   name: new-skill
   description: What it does and when to use it
   ---

   # Content here
   ```

3. Add to skill-rules.json (optional):
   ```json
   {
     "new-skill": {
       "type": "domain",
       "enforcement": "suggest",
       "priority": "high",
       "promptTriggers": {
         "keywords": ["keyword1", "keyword2"]
       }
     }
   }
   ```

### Updating Skills

- Skills are loaded on Claude Code startup
- Edit SKILL.md and restart Claude Code
- Test with: "Using new-skill, do something"

### Managing Agents

- Agents are in `.claude/agents/*.md`
- Edit frontmatter to change model or tools
- Test with: "@agent-name do something"

---

## 📝 Current Configuration Summary

**Total Skills**: 7 (5 core + 2 advanced)
**Total Agents**: 3 (2 specialists + 1 optimizer)
**Total Commands**: 2 (health + coverage)
**MCP Servers**: 7 (6 enabled + 1 optional)

**Coverage Target**: 75% statements, 70% functions, 60% branches
**Performance Target**: 60 FPS, < 2s startup, < 200ms API response

---

## 💾 Automated Backup System

LiveMetro includes a comprehensive automated backup system for Claude Code configuration to prevent configuration loss and enable easy restoration.

### Quick Commands

```bash
# Create a manual backup
npm run backup:claude

# List all available backups
npm run restore:claude:list

# Restore from latest backup
npm run restore:claude:latest

# Interactive restore (choose from list)
npm run restore:claude
```

### Automated Backup Triggers

1. **Git Pre-commit Hook** 🔄 Automatic
   - Triggers when `.claude/` directory has changes
   - Creates backup before commit
   - Optionally includes backup in commit

2. **GitHub Actions** ☁️ Scheduled
   - Daily backups at 2 AM UTC
   - Triggered on push to `main` when `.claude/` changes
   - Stores artifacts for 30 days
   - Manual trigger available in Actions tab

3. **Manual Backups** 🖱️ On-demand
   - Run `npm run backup:claude` anytime
   - Useful before major configuration changes

### Backup Features

- **Timestamped**: Each backup has unique timestamp (e.g., `backup-2025-12-29_14-30-00`)
- **Metadata**: Includes backup size, file count, and creation date
- **Safety**: Automatic pre-restore backup of current configuration
- **Retention**: Keeps last 10 backups locally (configurable)
- **Smart Cleanup**: Automatically removes old backups

### Backup Location

```
.claude-backups/
├── backup-2025-12-29_14-30-00/
│   ├── agents/
│   ├── skills/
│   ├── commands/
│   ├── mcp.json
│   └── backup-metadata.json
└── backup-2025-12-28_10-15-00/
```

### Detailed Documentation

For comprehensive backup documentation, including:
- Advanced usage and options
- Troubleshooting common issues
- CI/CD integration
- Recovery procedures

See: [docs/CLAUDE_BACKUP_GUIDE.md](../docs/CLAUDE_BACKUP_GUIDE.md)

---

## 🆘 Troubleshooting

### Skills Not Activating

1. **Check skill-rules.json**: Verify triggers match your prompt
2. **Explicit invocation**: "Using skill-name, do X"
3. **Check logs**: Look for skill loading errors

### Agent Not Responding

1. **Check naming**: Use exact agent name from .md file
2. **Use @ prefix**: "@agent-name do something"
3. **Verify model**: Check if model (sonnet/opus) is available

### Commands Not Working

1. **Check file exists**: `.claude/commands/command-name.md`
2. **Use / prefix**: "/command-name"
3. **Restart Claude**: Commands loaded at startup

### MCP Server Issues

1. **Check API keys**: Verify in `.env` file
2. **Check logs**: MCP server connection errors
3. **Restart Claude**: MCP servers connect at startup

---

## 📚 Additional Resources

### Official Documentation
- [Claude Code Overview](https://docs.anthropic.com/claude/docs/claude-code)
- [Agent Skills Guide](https://docs.anthropic.com/claude/docs/claude-code/skills)
- [MCP Documentation](https://modelcontextprotocol.io/)

### Project Documentation
- `CLAUDE.md`: Project architecture and guidelines
- `.claude/SETUP_GUIDE.md`: Detailed MCP setup
- `skills guide/`: Comprehensive Skills/Agents tutorials

---

**Last Updated**: 2025-12-29
**Configuration Version**: 2.1
**Claude Code Version**: v2.0.80+
**Backup System**: Enabled ✅
