# LiveMetro Claude Code Setup Guide

> **Setup Completed**: 2025-12-27
> **Environment**: macOS with Claude Code
> **Project**: LiveMetro - React Native Subway App

---

## 🎉 Setup Summary

Your LiveMetro project is now fully configured with Claude Code's advanced features!

### ✅ Completed Setup

#### 1. **Directory Structure**
```
liveMetro/
├── .claude/
│   ├── skills/                          # 5 specialized skills
│   │   ├── react-native-development/
│   │   ├── firebase-integration/
│   │   ├── api-integration/
│   │   ├── location-services/
│   │   └── notification-system/
│   ├── agents/                          # 2 specialized agents
│   │   ├── mobile-ui-specialist.md
│   │   └── backend-integration-specialist.md
│   ├── commands/                        # Custom commands (ready to add)
│   ├── hooks/                           # Hooks scripts (ready to add)
│   ├── mcp.json                         # MCP server configuration
│   └── README.md                        # MCP setup guide
├── .claudecode.json                     # Hooks & permissions
├── skill-rules.json                     # Skill auto-activation rules
└── CLAUDE.md                            # Project context (already exists)
```

#### 2. **Skills Created**

| Skill | Purpose | Auto-Activation Triggers |
|-------|---------|-------------------------|
| **react-native-development** | React Native component development, navigation, hooks | Keywords: component, screen, navigation, hooks |
| **firebase-integration** | Firebase auth, Firestore queries, real-time subscriptions | Keywords: firebase, firestore, authentication |
| **api-integration** | Seoul Open Data API integration, retry logic | Keywords: API, seoul, subway, arrival |
| **location-services** | GPS, geolocation, nearby stations | Keywords: location, GPS, nearby, coordinates |
| **notification-system** | Push notifications, arrival alerts | Keywords: notification, push, alert |

#### 3. **Sub-agents Created**

| Agent | Role | Tools | Model |
|-------|------|-------|-------|
| **mobile-ui-specialist** | React Native UI/UX expert | edit, create, read, grep | sonnet |
| **backend-integration-specialist** | Firebase & API integration expert | edit, create, read, grep, bash | sonnet |

#### 4. **Automatic Features**

##### Skill Auto-Activation
Skills will automatically activate when you:
- Mention relevant keywords (e.g., "component", "firebase", "notification")
- Work with specific files (e.g., `src/components/*.tsx`)
- Use certain code patterns (e.g., `import React`, `firestore()`)

##### Post-Edit Hooks
Automatically runs after editing files:
- **TypeScript files (.ts, .tsx)**: Runs `npm run type-check`
- **All TypeScript files**: Runs `npm run lint --fix`

##### Security Protection
Prevents accidental exposure of:
- `.env*` files (blocked from read/write)
- `google-services.json` (blocked)
- Dangerous commands (`sudo`, `rm -rf`)

---

## 🚀 Quick Start

### Using Skills

Skills will activate automatically! Just work naturally:

```bash
# Example 1: Creating a component
"Create a new StationCard component that displays station name and line color"
# → react-native-development skill automatically activates

# Example 2: Firebase work
"Add a Firestore subscription to listen for train updates"
# → firebase-integration skill automatically activates

# Example 3: Location feature
"Implement nearby station finder using user's GPS location"
# → location-services skill automatically activates
```

### Using Sub-agents

Invoke agents for specialized tasks:

```bash
# For UI/UX work
"@mobile-ui-specialist Create a responsive train arrival list component"

# For backend integration
"@backend-integration-specialist Implement the multi-tier data fallback strategy"
```

### Checking Skill Status

```bash
# List all available skills
"Show me all available skills"

# Check if a skill is loaded
"Is the react-native-development skill active?"
```

---

## 📖 Skill Reference

### react-native-development
**Use for**: Creating components, screens, navigation, custom hooks

**Key patterns**:
- Component structure with TypeScript
- Performance optimization (memo, useMemo, useCallback)
- Navigation with React Navigation
- Error handling and loading states

**Example**:
```
"Create a new TrainArrivalCard component following the react-native-development guidelines"
```

### firebase-integration
**Use for**: Firestore queries, real-time subscriptions, authentication

**Key patterns**:
- Service layer pattern (singleton classes)
- Real-time subscriptions with cleanup
- Error handling for Firebase operations
- Multi-tier fallback strategy

**Example**:
```
"Set up a Firestore subscription for real-time train updates using firebase-integration patterns"
```

### api-integration
**Use for**: Seoul API calls, retry logic, data parsing

**Key patterns**:
- API service class with retry logic
- Timeout handling
- Response parsing and normalization
- Service disruption detection

**Example**:
```
"Integrate the Seoul subway arrival API with proper error handling and retries"
```

### location-services
**Use for**: GPS, geolocation, finding nearby stations

**Key patterns**:
- Permission handling (iOS & Android)
- useLocation custom hook
- Distance calculation
- Finding nearby stations

**Example**:
```
"Implement location permission request and find nearby stations feature"
```

### notification-system
**Use for**: Push notifications, arrival alerts, scheduling

**Key patterns**:
- useNotifications custom hook
- Permission handling
- Scheduling notifications
- Notification preferences management

**Example**:
```
"Set up push notifications for train arrival alerts"
```

---

## 🎯 Agent Reference

### mobile-ui-specialist
**Best for**: UI component design, layouts, styling, UX patterns

**Expertise**:
- React Native component architecture
- Responsive design for various screen sizes
- Accessibility (a11y) compliance
- Performance optimization (FlatList, memo)
- Platform-specific styling

**Example invocation**:
```
"@mobile-ui-specialist Design a subway map screen with pan and zoom functionality"
```

### backend-integration-specialist
**Best for**: Firebase integration, API calls, data synchronization

**Expertise**:
- Firestore queries and subscriptions
- Seoul Open Data API integration
- Multi-tier fallback strategy (API → Firebase → Cache)
- Custom hooks for data fetching
- Error handling and retry logic

**Example invocation**:
```
"@backend-integration-specialist Implement the data manager with automatic fallback to Firebase when Seoul API fails"
```

---

## 🔧 Advanced Features

### Customizing Skill Rules

Edit `skill-rules.json` to modify when skills activate:

```json
{
  "react-native-development": {
    "enforcement": "suggest",    // suggest | require | block
    "priority": "high",          // critical | high | normal | low
    "promptTriggers": {
      "keywords": ["your", "custom", "keywords"],
      "intentPatterns": ["custom.*pattern"]
    }
  }
}
```

### Adding Custom Hooks

Create TypeScript files in `.claude/hooks/`:

```typescript
// .claude/hooks/myHook.ts
export async function onUserPromptSubmit(prompt: string, context: any) {
  // Custom logic here
  return prompt;
}
```

Then register in `.claudecode.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "script": ".claude/hooks/myHook.ts" }
    ]
  }
}
```

### Creating New Skills

```bash
# 1. Create directory
mkdir -p .claude/skills/my-new-skill

# 2. Create SKILL.md
# Follow the template from existing skills

# 3. Add to skill-rules.json
# Define triggers and activation rules

# 4. Restart Claude Code
```

---

## 💡 Pro Tips

### 1. **Let Skills Work Automatically**
Don't manually invoke skills - they'll activate when needed based on your keywords and file patterns.

### 2. **Use Agents for Specialized Work**
When you need deep expertise (UI design, backend integration), explicitly invoke the agent with `@agent-name`.

### 3. **Check Auto-Approval Settings**
Safe commands are auto-approved in `.claudecode.json`:
- `Read`, `Grep`, `Glob`
- `git status`, `git diff`, `git log`
- `npm run *`

### 4. **Monitor Type Checking**
After editing TypeScript files, Claude will automatically run type-check. Watch for errors!

### 5. **Leverage MCP Servers**
You have powerful MCP servers configured:
- **magic**: UI component generation
- **tavily**: Web search for documentation
- **context7**: Semantic codebase search

---

## 🐛 Troubleshooting

### Skills Not Activating?

1. **Check skill-rules.json**: Ensure your keywords match
2. **Restart Claude Code**: Skills load on startup
3. **View logs**: Check if skills are loaded

### Hooks Not Running?

1. **Check .claudecode.json syntax**: Must be valid JSON
2. **Verify file paths**: Hooks must point to existing files
3. **Check permissions**: Ensure scripts are executable

### Type Check Failing?

1. **Run manually**: `npm run type-check`
2. **Fix errors**: Address TypeScript errors
3. **Disable hook temporarily**: Remove from `.claudecode.json`

---

## 📚 Additional Resources

### Official Documentation
- [Claude Code Docs](https://docs.claude.com/en/docs/claude-code)
- [Agent Skills Guide](https://docs.claude.com/en/docs/claude-code/skills)
- [Sub-agents Documentation](https://docs.claude.com/en/docs/claude-code/sub-agents)

### Project Documentation
- `CLAUDE.md`: Project context and guidelines
- `.claude/README.md`: MCP server setup
- `skills guide/`: Complete Claude Code guide collection

### Community
- [Claude Developers Discord](https://discord.gg/anthropic)
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code)

---

## 🎉 You're Ready!

Your LiveMetro project now has:
- ✅ 5 specialized skills for React Native, Firebase, APIs, Location, and Notifications
- ✅ 2 expert sub-agents for UI and backend work
- ✅ Automatic skill activation based on context
- ✅ Post-edit hooks for type checking and linting
- ✅ Security protections for sensitive files
- ✅ MCP servers for enhanced capabilities

**Start coding with Claude Code and watch the skills activate automatically!** 🚀

---

*Last Updated: 2025-12-27*
*Environment: macOS + Claude Code*
*Project: LiveMetro React Native App*

#claude-code #livemetro #react-native #setup-complete
