# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**LiveMetro**: React Native Expo app for Seoul subway real-time arrivals.

| Technology | Version |
|------------|---------|
| React Native | 0.72 |
| Expo SDK | ~49 |
| TypeScript | 5.1+ (strict) |
| Firebase | Auth, Firestore |
| Navigation | React Navigation 6.x |

## Essential Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Start Expo dev server |
| `npm test` | Run Jest tests |
| `npm run lint` | ESLint with auto-fix |
| `npm run type-check` | TypeScript check |
| `npm run build:production` | Production build |

## Architecture

```
Data Flow: Seoul API → Firebase → AsyncStorage (Cache)

Navigation:
RootNavigator → Main (BottomTabs) → Home | Favorites | Alerts | Settings

State: AuthContext + Custom Hooks (no Redux)
```

## Path Aliases

| Alias | Path |
|-------|------|
| `@` | `src/` |
| `@components` | `src/components` |
| `@screens` | `src/screens` |
| `@services` | `src/services` |
| `@models` | `src/models` |
| `@utils` | `src/utils` |
| `@hooks` | `src/hooks` |

**Use path aliases, not relative imports.**

## Critical Rules

1. **TypeScript strict mode** - no `any`, explicit return types
2. **Cleanup subscriptions** in useEffect return functions
3. **Seoul API** - 30s minimum polling interval
4. **Coverage thresholds**: 75% statements, 70% functions, 60% branches
5. **Error handling** - return empty arrays/null instead of throwing

## Reference Documentation

For detailed information, see:

- [Architecture Details](docs/claude/architecture.md) - Data flow, navigation, state management
- [API Reference](docs/claude/api-reference.md) - Seoul Metro API, Firebase collections
- [Development Patterns](docs/claude/development-patterns.md) - Adding screens, hooks, services
- [Testing Guide](docs/claude/testing.md) - Jest config, coverage, test patterns
