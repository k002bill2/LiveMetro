# Dev Docs 시스템 구축 가이드
#claude-code #dev-docs #context-management #2026-03-update

> 최신 업데이트: 2026-03-06 | Claude Code v2.1.x
>
> 참고: Claude Code 2.1에서 자동 메모리 기능(`~/.claude/projects/.../memory/`)이 추가되었지만,
> 대규모 작업에서는 여전히 Dev Docs 3-파일 시스템이 더 체계적입니다.
> 자동 메모리는 세션 간 패턴/규칙 기억에, Dev Docs는 작업별 진행 관리에 적합합니다.
>
> Context auto-compaction 시 이미지가 자동 보존됩니다 (2.1 개선사항).
>
> Claude = 극도로 자신감 넘치는 주니어 개발자 with 심각한 건망증
>
> 이 시스템으로 Claude가 길을 잃지 않게 관리!

## 🎯 왜 필요한가?

### 문제점
- Claude가 30분 후 원래 계획 잊어버림
- 갑자기 엉뚱한 방향으로 개발 시작
- Auto-compaction 후 컨텍스트 완전 상실
- "관련 없는 TypeScript 에러들이니 괜찮아요!" 😱

### 해결책: 3-파일 시스템
모든 대규모 작업을 3개 문서로 관리

## 📁 Dev Docs 구조

```
project/
└── dev/
    └── active/
        └── [task-name]/
            ├── [task-name]-plan.md     # 승인된 계획
            ├── [task-name]-context.md  # 핵심 결정사항
            └── [task-name]-tasks.md    # 체크리스트
```

## 📝 각 문서의 역할

### 1. Plan 문서 (계획)
```markdown
# User Dashboard Feature Plan

## Executive Summary
Adding comprehensive user dashboard with order history, favorites, 
settings, and activity feed.

## Phase 1: Backend API (Week 1)
### Tasks
- [ ] Create dashboard controller
- [ ] Add order history endpoint
- [ ] Implement favorites system
- [ ] Add activity tracking

### Technical Decisions
- Use Redis for activity caching
- Paginate order history (20 items/page)
- Soft delete for favorites

## Phase 2: Frontend Components (Week 2)
### Tasks
- [ ] Dashboard layout component
- [ ] Order history table
- [ ] Favorites grid
- [ ] Settings form

## Success Metrics
- Page load < 2 seconds
- All endpoints < 200ms response
- 100% test coverage
```

### 2. Context 문서 (상황 기록)
```markdown
# User Dashboard - Context

## Last Updated: 2025-01-03 14:30

## Key Files
- `backend/src/controllers/DashboardController.ts`
- `frontend/src/pages/Dashboard.tsx`
- `shared/types/dashboard.types.ts`

## Important Decisions
- **2025-01-03**: Decided to use Redis for caching
- **2025-01-03**: Favorites limited to 100 items per user
- **2025-01-03**: Using tanstack-table for order history

## Current Issues
- [ ] Performance issue with large order histories
- [x] ~~CORS error on favorites endpoint~~ (Fixed)

## Dependencies
- Redis client upgraded to v4.5
- Added tanstack-table v8.10
- New environment variable: REDIS_CACHE_TTL

## Next Steps
1. Optimize database query for order history
2. Add loading skeletons for better UX
3. Implement real-time activity updates
```

### 3. Tasks 문서 (체크리스트)
```markdown
# User Dashboard - Tasks

## Backend (8/12 complete)
- [x] Create dashboard controller
- [x] Setup Redis connection
- [x] Order history endpoint
- [x] Pagination implementation
- [x] Favorites CRUD operations
- [x] Activity tracking service
- [x] Add authentication middleware
- [x] Write unit tests
- [ ] Performance optimization
- [ ] Rate limiting
- [ ] Caching layer
- [ ] Integration tests

## Frontend (3/10 complete)
- [x] Dashboard layout
- [x] Routing setup
- [x] API client setup
- [ ] Order history component
- [ ] Favorites grid
- [ ] Activity feed
- [ ] Settings panel
- [ ] Loading states
- [ ] Error boundaries
- [ ] E2E tests

## Documentation (0/3 complete)
- [ ] API documentation
- [ ] User guide
- [ ] Deployment notes
```

## 🚀 워크플로우

### Step 1: Planning Mode 시작
```bash
# Claude에게 계획 요청
"I need to implement a user dashboard. Put this into planning mode 
and create a comprehensive plan."

# 또는 specialized agent 사용
"@strategic-plan-architect Create a plan for user dashboard feature"
```

### Step 2: 계획 검토 및 승인
```bash
# 계획 검토
"This looks good, but let's add real-time notifications"

# 승인 후 Dev Docs 생성
/dev-docs  # Custom command
# 또는
"Create dev docs for this approved plan"
```

### Step 3: 구현 시작
```bash
# Context 부족 경고 (보통 15% 이하)
# ESC 눌러서 중단하고 dev docs 생성

"Let's start implementing Phase 1 of the dashboard feature. 
Check the dev docs first."

# Claude가 자동으로 3개 파일 모두 읽고 시작
```

### Step 4: 주기적 업데이트
```bash
# 작업 완료시마다
"Update the tasks file - mark the controller creation as complete"

# Context 부족할 때
/update-dev-docs  # Custom command
# 또는
"Update all dev docs with current progress and next steps"
```

### Step 5: 세션 재시작
```bash
# 새 세션에서
"Continue working on the dashboard feature"

# Claude가 자동으로 dev docs 읽고 이어서 작업
```

## 🛠️ Custom Commands 설정

### /dev-docs Command
```markdown
# .claude/commands/dev-docs.md
---
description: Create comprehensive dev docs for approved plan
---

Based on the approved plan, create three development documents:

1. Create `dev/active/[task-name]/[task-name]-plan.md`
   - Copy the full approved plan
   - Add timeline and phases
   - Include success metrics

2. Create `dev/active/[task-name]/[task-name]-context.md`
   - List all relevant files
   - Document key architectural decisions
   - Note any constraints or dependencies
   - Add "Next Steps" section

3. Create `dev/active/[task-name]/[task-name]-tasks.md`
   - Convert plan into detailed checklist
   - Group by component/service
   - Use checkbox format
   - Add estimates if possible

Remember to timestamp everything!
```

### /update-dev-docs Command
```markdown
# .claude/commands/update-dev-docs.md
---
description: Update dev docs before context compaction
---

Update all active dev docs:

1. In context.md:
   - Update "Last Updated" timestamp
   - Add any new decisions made
   - Update "Current Issues" section
   - Revise "Next Steps" based on progress

2. In tasks.md:
   - Mark completed items with [x]
   - Add any new tasks discovered
   - Update completion counts
   - Reorder by priority if needed

3. Add a session summary:
   - What was accomplished
   - Any blockers encountered
   - Critical next actions

Keep updates concise but comprehensive!
```

## 📊 실제 효과 측정

### Before Dev Docs
- 계획 준수율: 40%
- Context 후 작업 재개 성공률: 20%
- 평균 탈선 시간: 45분마다

### After Dev Docs
- 계획 준수율: 95%
- Context 후 작업 재개 성공률: 90%
- 평균 탈선 시간: 거의 없음

## 💡 Pro Tips

### 1. 작업 크기 제한
```bash
# 너무 큰 작업 X
"Implement the entire application"

# 적절한 크기 ✓
"Implement user dashboard with 4 main components"
```

### 2. 섹션별 구현
```bash
# 한번에 전체 구현 X
"Implement everything in the plan"

# 섹션별로 구현 ✓
"Let's implement Phase 1, tasks 1-3 only"
```

### 3. 정기적 리뷰
```bash
# 매 5-6개 작업마다
"Review the changes we just made using code-reviewer agent"
```

### 4. Context 관리
```bash
# Context 20% 이하가 되면
"Save progress to dev docs and prepare for compaction"

# Compaction 후
"Continue from dev docs"
```

## 🎯 체크리스트 자동화

### Hook으로 자동 업데이트
```typescript
// .claude/hooks/taskUpdater.ts
export async function onStopEvent(context: any) {
  // 완료된 작업 감지
  const completedTasks = detectCompletedTasks(context);
  
  if (completedTasks.length > 0) {
    // tasks.md 자동 업데이트
    updateTasksFile(completedTasks);
    
    console.log(`
✅ ${completedTasks.length} tasks marked complete
📋 Updated dev/active/*/tasks.md
    `);
  }
}
```

## 🗂️ 완료된 작업 아카이빙

```bash
# 작업 완료 후
mv dev/active/user-dashboard dev/completed/2025-01/

# 나중에 참조 가능
ls dev/completed/
```

## 🔥 핵심 교훈

1. **계획 없이 시작 = 실패**
2. **문서화 = Claude의 기억**
3. **작은 단위로 구현 = 품질 보장**
4. **정기적 업데이트 = 연속성 유지**

---

*"Documentation is Claude's memory, and memory is everything"*

### 자동 메모리와의 관계 (Claude Code 2.1+)

| 기능 | 자동 메모리 | Dev Docs |
|------|-----------|----------|
| 위치 | `~/.claude/projects/.../memory/` | `dev/active/[task]/` |
| 용도 | 세션 간 패턴, 규칙 기억 | 작업별 계획/진행/결정 관리 |
| 자동화 | Claude가 자동 저장 | 수동 생성 필요 |
| 범위 | 프로젝트 전반 | 특정 작업/기능 |
| 추천 | 항상 활성화 | 대규모 작업 시 |

두 시스템을 함께 사용하면 가장 효과적입니다.

*마지막 업데이트: 2026-03-06 | Claude Code v2.1.x*

#dev-docs #context-management #planning #livemetro