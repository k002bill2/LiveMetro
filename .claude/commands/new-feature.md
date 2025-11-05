---
description: Plan and scaffold a new feature with best practices
---

Plan and scaffold a new feature following LiveMetro best practices:

**Step 1: Requirements Analysis**
1. Clarify the feature requirements
2. Identify affected components and services
3. Check relevant Skills:
   - `react-native-development` for UI components
   - `firebase-integration` for backend
   - `location-services` for GPS features
   - `notification-system` for alerts

**Step 2: Architecture Planning**
1. Determine if this needs:
   - New screens or components?
   - API integration or data management?
   - Location services or geofencing?
   - Push notifications?
2. Identify the 3-tier data flow (API → Firebase → AsyncStorage)
3. Plan custom hooks if needed

**Step 3: Create Dev Docs**
1. Use `/dev-docs` command to create planning documents
2. Structure the plan into phases:
   - Phase 1: Data layer (services, API)
   - Phase 2: Business logic (hooks, state)
   - Phase 3: UI components
   - Phase 4: Integration & testing

**Step 4: Scaffold Structure**
Create necessary files following project structure:
```
src/
├── components/[domain]/    # UI components
├── hooks/                  # Custom hooks
├── models/                 # TypeScript types
├── screens/                # Screen components
├── services/               # Business logic
└── utils/                  # Utilities
```

**Step 5: Implementation Checklist**
- [ ] TypeScript interfaces in `models/`
- [ ] Service layer implementation
- [ ] Custom hooks for state management
- [ ] UI components with accessibility
- [ ] Screen integration
- [ ] Error handling and loading states
- [ ] Tests (if applicable)
- [ ] Documentation updates

**Best Practices to Follow:**
- Use Seoul subway colors from `colorUtils.ts`
- Implement 3-tier caching via `dataManager`
- Add proper error boundaries
- Include accessibility labels
- Follow naming conventions
- Use path aliases (@components, @hooks, etc.)

After scaffolding, confirm the structure and begin implementation phase by phase.
