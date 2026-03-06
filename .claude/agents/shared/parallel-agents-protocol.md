---
name: parallel-agents-protocol
description: Parallel Agents Safety Protocol with ACE Framework for LiveMetro multi-agent execution
---

# Parallel Agents Safety Protocol v3.2.0
## ACE Framework Integration - LiveMetro Project

## Document Information
- **Version**: 3.2.0
- **Last Updated**: 2026-02-01
- **Status**: Active - ACE Framework Integrated for LiveMetro
- **Scope**: Multi-agent parallel execution for LiveMetro React Native + Firebase
- **Framework**: Based on Autonomous Cognitive Entity (ACE) Framework
- **Project**: LiveMetro - Seoul Metro Real-time Arrival App

---

## 1. ACE Framework Foundation

### 1.1 ACE Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: ASPIRATIONAL LAYER                                 │
│ Purpose: Define ethical principles and universal constraints│
│ Scope: All agents, all operations                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: GLOBAL STRATEGY LAYER                              │
│ Purpose: Maintain overall mission and long-term goals       │
│ Scope: Primary Agent (with user input)                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: AGENT MODEL LAYER                                  │
│ Purpose: Self-awareness of capabilities and limitations     │
│ Scope: All agents (individual self-assessment)              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: EXECUTIVE FUNCTION LAYER                           │
│ Purpose: Task decomposition and resource allocation         │
│ Scope: Primary Agent (coordination)                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: COGNITIVE CONTROL LAYER                            │
│ Purpose: Task selection and conflict prevention             │
│ Scope: All agents (local execution control)                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 6: TASK PROSECUTION LAYER                             │
│ Purpose: Actual execution with tools and skills             │
│ Scope: All agents (parallel operation)                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ FEEDBACK LOOPS (Cross-Layer)                                │
│ Purpose: Continuous learning and protocol evolution         │
│ Scope: All layers (bidirectional feedback)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Principles - LiveMetro

### 2.1 Aspirational Layer: Ethical Principles

#### 2.1.1 Core Mission (Heuristic Imperatives)

**1. Reduce Suffering**
- 앱 안정성 보장 (크래시 최소화)
- Seoul Open Data API Rate Limit 존중 (30초 최소 폴링)
- Firebase 비용 최적화 (불필요한 읽기/쓰기 방지)
- 사용자 승인 없는 위험 작업 방지 (HITL)

**2. Increase Prosperity**
- 병렬 처리로 개발 효율 극대화
- 테스트 커버리지 75%+ 유지
- 접근성 레이블 필수 (모든 사용자 지원)
- 오프라인 캐싱으로 사용자 경험 개선

**3. Increase Understanding**
- TypeScript strict mode (any 타입 금지)
- 명확한 문서화 (CLAUDE.md, Dev Docs)
- 투명한 에러 메시지
- @경로 별칭 사용 (가독성)

#### 2.1.2 Universal Ethical Constraints

| Constraint | Description | LiveMetro Context |
|------------|-------------|-------------------|
| **Data Integrity** | 사용자 데이터 손실 방지 | AsyncStorage, Firebase 백업 |
| **Transparency** | 에러/충돌 숨기지 않음 | 에러 바운더리 필수 |
| **Harm Prevention** | 시스템 손상 작업 금지 | 30초 API 폴링 준수 |
| **Respect Boundaries** | 권한 범위 초과 금지 | 에이전트별 워크스페이스 격리 |
| **Privacy** | 사용자 위치 정보 보호 | 위치 권한 최소 요청 |

---

## 3. Agent Roles - LiveMetro

### 3.1 Primary Agent (Lead Orchestrator)

**Model**: Opus

**Core Responsibilities:**
- 태스크 분해 및 서브에이전트 할당
- 복잡도 평가 (Effort Scaling)
- 충돌 해결 및 통합
- 사용자 커뮤니케이션

**Exclusive Permissions:**
- 공유 파일 수정 (src/models/, src/types/)
- 충돌하는 변경사항 병합
- HITL 승인 최종 결정
- 최종 결과물 프레젠테이션

### 3.2 Secondary Agents (Specialists)

| Agent | Model | Domain | Workspace | Tools |
|-------|-------|--------|-----------|-------|
| `mobile-ui-specialist` | sonnet | React Native UI, Firebase, Seoul API | `.temp/agent_workspaces/mobile-ui/` | Edit, Write, Read, Grep, Glob, Bash |
| `test-automation-specialist` | haiku | Jest, RNTL | `.temp/agent_workspaces/test-automation/` | Edit, Write, Read, Grep, Glob, Bash |
| `quality-validator` | haiku | 최종 검증 | `.temp/agent_workspaces/quality-validator/` | Edit, Write, Read, Grep, Glob, Bash |

**Restrictions:**
- 다른 에이전트가 락한 파일 수정 불가
- 전략적 결정 불가 (Layer 2 제한)
- 범위 변경 시 Primary 승인 필요

---

## 4. Resource Management

### 4.1 Working Directory Isolation

```
/Users/younghwankang/Work/LiveMetro/
├── src/
│   ├── components/      # mobile-ui-specialist
│   │   ├── train/       # 열차 관련 컴포넌트
│   │   ├── station/     # 역 관련 컴포넌트
│   │   └── common/      # 공통 컴포넌트
│   ├── screens/         # mobile-ui-specialist
│   ├── services/        # mobile-ui-specialist
│   │   ├── firebase/    # Firebase 서비스
│   │   ├── api/         # Seoul API 연동
│   │   └── cache/       # 캐시 서비스
│   ├── hooks/           # mobile-ui-specialist
│   ├── models/          # Primary (공유)
│   ├── types/           # Primary (공유)
│   └── navigation/      # mobile-ui-specialist
├── __tests__/           # test-automation-specialist
├── .temp/
│   ├── agent_workspaces/
│   │   ├── mobile-ui/
│   │   ├── test-automation/
│   │   └── quality-validator/
│   ├── memory/          # 체크포인트, 컨텍스트
│   └── coordination/    # 파일 락
└── dev/
    └── active/          # Dev Docs 작업 디렉토리
```

### 4.2 Tool Access Matrix

| Tool | Primary | Secondary | Notes |
|------|---------|-----------|-------|
| Bash | Full | Restricted | 시스템 변경 금지 |
| Edit | Full | Workspace only | 할당된 워크스페이스만 |
| Read | Full | Full | 읽기는 안전 |
| Write | Full | Workspace only | 락 필요 |
| Grep | Full | Full | 병렬 안전 |
| Task (agents) | Full | Restricted | Primary 승인 필요 |

### 4.3 File Lock Protocol

```json
{
  "operation": "file_lock_request",
  "agent": "mobile-ui-specialist",
  "file": "src/components/train/StationCard.tsx",
  "operation_type": "write",
  "estimated_duration": "30s",
  "timestamp": "2026-02-01T14:30:00Z"
}
```

**Lock Directory**: `.temp/coordination/locks/`

**Lock States:**
- `Available`: 리소스 사용 가능
- `Locked`: 에이전트가 독점 접근 중
- `Queued`: 여러 에이전트 대기 중 (FIFO)
- `Released`: 작업 완료, 락 해제

---

## 5. Skill Auto-Invocation Protocol

### 5.1 LiveMetro Skill Mapping

| File Operation | Required Skill | Timing |
|----------------|---------------|--------|
| React Native Component | `react-native-development` | 컴포넌트 생성 전 |
| Navigation Screen | `react-native-development` | 스크린 추가 전 |
| Firebase Service | `firebase-integration` | 서비스 수정 전 |
| Seoul API Call | `api-integration` | API 연동 전 |
| Location Feature | `location-services` | 위치 기능 추가 전 |
| Push Notification | `notification-system` | 알림 구현 전 |
| Subway Data Parse | `subway-data-processor` | 데이터 처리 전 |
| Jest Test | `test-automation` | 테스트 작성 전 |

### 5.2 Skill Selection Logic

```typescript
function selectSkill(taskType: string): string {
  const skillMap: Record<string, string> = {
    'ui_component': 'react-native-development',
    'screen': 'react-native-development',
    'navigation': 'react-native-development',
    'firebase': 'firebase-integration',
    'api': 'api-integration',
    'location': 'location-services',
    'notification': 'notification-system',
    'subway_data': 'subway-data-processor',
    'test': 'test-automation'
  };
  return skillMap[taskType] ?? 'general';
}
```

---

## 6. Parallel Execution Patterns

### 6.1 Pattern: Fan-Out / Fan-In

```
Primary (Lead Orchestrator)
  ↓ [Fan-Out: 독립 서브태스크 분배]
┌─────────────────────────────────────┐
│ mobile-ui-specialist (UI + 서비스)   │
│ test-automation-specialist (테스트)   │
└─────────────────────────────────────┘
  ↓ [Fan-In: 결과 수집 및 통합]
Primary (통합 및 검증)
```

**효율 향상**: ~2-3x 속도 향상

### 6.2 Example: 새 기능 구현

**User Request:** "즐겨찾기 역 기능 추가"

**Layer 4 (Executive Function) - Task Decomposition:**

```json
{
  "primary_task": "즐겨찾기 역 기능 구현",
  "complexity": "moderate",
  "subtasks": [
    {
      "agent": "mobile-ui-specialist",
      "task": "Firebase favorites 서비스 + StationCard 즐겨찾기 버튼 + FavoritesScreen",
      "skill": "react-native-development",
      "output": ["src/services/favorites/favoritesService.ts", "src/components/station/StationCard.tsx", "src/screens/FavoritesScreen.tsx"],
      "dependencies": []
    },
    {
      "agent": "test-automation-specialist",
      "task": "즐겨찾기 기능 테스트",
      "skill": "test-automation",
      "output": "__tests__/services/favorites.test.ts",
      "dependencies": ["mobile_ui_complete"]
    }
  ]
}
```

### 6.3 Execution Timeline

```
T0:00  Primary: mobile-ui-specialist 호출
       ├─ Firebase favoritesService.ts 구현
       ├─ StationCard 즐겨찾기 버튼
       └─ FavoritesScreen

T0:20  mobile-ui: 완료
       └─ .temp/agent_workspaces/mobile-ui/proposals/

T0:21  Primary: test-automation-specialist 호출
       └─ 전체 기능 테스트

T0:31  test: 완료

순차 실행: ~45분
병렬 실행: ~31분
속도 향상: 1.5x
```

---

## 7. HITL (Human-in-the-Loop) Integration

### 7.1 Risk Classification

| Risk Level | Actions | Approval |
|------------|---------|----------|
| LOW | Read, Grep, Glob | 자동 |
| MEDIUM | Write, Edit (assigned workspace) | 자동 |
| HIGH | Bash (system), Delete, Firebase 규칙 수정 | 승인 필요 |
| CRITICAL | Deploy, 프로덕션 변경 | 반드시 승인 |

### 7.2 Approval Flow

```typescript
if (toolRiskLevel === "HIGH") {
  const approvalRequest = {
    approval_id: crypto.randomUUID(),
    agent: currentAgent,
    action: toolName,
    parameters: toolParams,
    justification: "이유 설명",
    timestamp: new Date().toISOString()
  };
  await waitForApproval(approvalRequest);
}
```

---

## 8. Error Handling and Recovery

### 8.1 Checkpoint Strategy

```json
{
  "checkpoints": [
    {
      "id": "cp_phase_session_2026-02-01T14-30-00",
      "timestamp": "T0:00",
      "state": "Initial state",
      "files_snapshot": [],
      "validation": "passed"
    },
    {
      "id": "cp_phase_backend_2026-02-01T14-45-00",
      "timestamp": "T15:00",
      "state": "Backend service complete",
      "files_snapshot": ["src/services/favorites/favoritesService.ts"],
      "validation": "type-check passed"
    }
  ]
}
```

**Checkpoint Location**: `.temp/memory/checkpoints/`

### 8.2 Rollback Procedure

1. **Emergency halt** - 모든 에이전트 정지
2. **Lock release** - 모든 파일 락 해제
3. **Checkpoint restore** - 마지막 유효 체크포인트로 복원
4. **User notification** - 인시던트 리포트 전송

---

## 9. Quality Gates

### 9.1 Pre-Execution Validation

- [ ] 태스크 분해 검토 완료
- [ ] 파일 충돌 없음 확인
- [ ] 모든 에이전트 자기 평가 완료 (>0.70)
- [ ] 롤백 체크포인트 정의됨
- [ ] 윤리적 검토 통과

### 9.2 Post-Execution Validation

- [ ] 모든 서브태스크 완료
- [ ] TypeScript 타입 체크 통과 (`npm run type-check`)
- [ ] ESLint 통과 (`npm run lint`, 에러 0개)
- [ ] Jest 테스트 통과 (`npm test -- --coverage`)
- [ ] 커버리지 목표 달성:
  - Statements: 75%+
  - Functions: 70%+
  - Branches: 60%+
- [ ] 접근성 레이블 확인
- [ ] useEffect cleanup 함수 확인

---

## 10. Ethical Veto Protocol

### 10.1 Veto Triggers

| Trigger | Severity | Action |
|---------|----------|--------|
| API Rate Limit 위반 시도 | CRITICAL | 즉시 중단 |
| Firebase 키 하드코딩 | CRITICAL | 즉시 중단 |
| 접근성 레이블 누락 | HIGH | 경고 후 수정 요청 |
| useEffect cleanup 누락 | HIGH | 경고 후 수정 요청 |
| any 타입 사용 | MEDIUM | 수정 요청 |
| 상대 경로 import | LOW | 권고 |

### 10.2 Veto Message Format

```json
{
  "type": "ethical_veto",
  "invoked_by": "mobile-ui-specialist",
  "target_action": "API 호출 간격 10초 설정",
  "concern": "Seoul API 30초 최소 폴링 규칙 위반",
  "principle_violated": "harm_prevention",
  "severity": "critical",
  "status": "operation_halted",
  "suggested_alternative": "폴링 간격을 30초 이상으로 설정"
}
```

---

## 11. Quick Reference

### Agent Decision Matrix

| Situation | Primary | Secondary |
|-----------|---------|-----------|
| Ethical concern | Invoke veto | Escalate |
| Task exceeds capability | Reassign | Decline |
| File locked | Wait/abort | Wait |
| Tool failure | Retry | Report |

### Tool Call Cheat Sheet

```bash
# Skill invocation
Skill react-native-development    # UI 작업
Skill firebase-integration        # Firebase 작업
Skill api-integration             # Seoul API 작업
Skill test-automation             # 테스트 작성

# Task agent invocation (parallel)
Task
  description: "Implement feature X"
  subagent_type: "mobile-ui-specialist"
  prompt: "Create StationCard component with accessibility"

# Verification
/verify-app                       # 전체 검증
/check-health                     # 헬스 체크
```

### Effort Scaling Quick Reference

| Complexity | Agents | Token Cost | Example |
|------------|--------|------------|---------|
| Trivial | 0 | ~1K | 타이포 수정 |
| Simple | 1 | ~5K | 단일 컴포넌트 |
| Moderate | 2-3 | ~50K | UI + API + Tests |
| Complex | 5+ | ~150K | 시스템 전체 변경 |

---

## Document Control

**Change Log:**

| Version | Date | Changes |
|---------|------|---------|
| 3.0 | 2025-01-03 | ACE Framework Integration |
| 3.0.1 | 2025-01-03 | Initial adaptation |
| 3.1.0 | 2025-01-26 | Intermediate version |
| 3.2.0 | 2026-02-01 | **LiveMetro Complete Adaptation**: React Native + Firebase, Seoul API 30초 폴링, 한국어 문서화, 에이전트 역할 정의 |

**Distribution:**
- LiveMetro Development Team
- Claude Code agents working on LiveMetro
- Multi-agent orchestration projects
