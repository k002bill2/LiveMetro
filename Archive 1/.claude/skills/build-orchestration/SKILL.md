---
name: build-orchestration
description: Maven Multi-Module 빌드 워크플로우 오케스트레이션 패턴
type: orchestration
manager: build-manager
relatedSkills:
  - kiips-maven-builder
priority: high
---

# Build Orchestration Skill

## Purpose

Maven Multi-Module 프로젝트의 빌드 워크플로우를 조정하고 최적화하는 오케스트레이션 패턴입니다. build-manager가 의존성 해결, 병렬 빌드 그룹 식별, 워커 할당, 결과 집계를 수행할 때 사용합니다.

## Core Orchestration Patterns

### Pattern 1: Dependency Resolution Strategy

**목적**: Maven Multi-Module의 의존성 순서 자동 해결

```
의존성 트리 분석
    ↓
COMMON (기반)
    ↓
UTILS (공통 DAO)
    ↓
Business Services (병렬 그룹)
├─ KiiPS-FD
├─ KiiPS-IL
├─ KiiPS-PG
└─ ...
```

**Manager의 역할**:
- `pom.xml` 분석하여 의존성 그래프 생성
- 빌드 순서 결정 (topological sort)
- 병렬 가능한 서비스 그룹 식별

**Worker의 역할**:
- 실제 Maven 명령 실행 (`mvn clean package -pl :모듈명 -am`)
- 빌드 로그 모니터링
- 아티팩트 검증 (`target/*.jar` 또는 `target/*.war` 확인)

### Pattern 2: Parallel Build Coordination

**목적**: 독립적인 서비스들의 병렬 빌드로 시간 단축

```
Manager: 병렬 그룹 식별
    ↓
Group 1: KiiPS-FD, KiiPS-IL, KiiPS-PG (동시 빌드 가능)
    ↓
Worker-1: Build KiiPS-FD (3분)
Worker-2: Build KiiPS-IL (2.5분) || 병렬 실행
Worker-3: Build KiiPS-PG (3.2분)
    ↓
Manager: 결과 집계 및 검증
```

**예상 효과**: 순차 빌드 8.7분 → 병렬 빌드 3.2분 (2.6배 속도 향상)

**Manager의 조정 로직**:
1. 각 워커에게 독립적인 빌드 작업 할당
2. 진행 상황 모니터링 (0-100%)
3. 실패 시 재시도 또는 에스컬레이션
4. 모든 워커 완료 후 통합 검증

### Pattern 3: Incremental Build Optimization

**목적**: 변경된 모듈만 선택적으로 빌드

**조건 판단**:
```javascript
if (변경된 파일이 KiiPS-COMMON에만 있음) {
  buildOrder = [COMMON, UTILS, 의존하는_서비스들]
} else if (변경된 파일이 KiiPS-FD에만 있음) {
  buildOrder = [FD] // FD만 빌드
}
```

**Manager의 역할**:
- SVN 변경사항 분석 (`svn status`)
- 영향 범위 결정 (어떤 모듈들이 재빌드 필요한가?)
- 최소 빌드 계획 수립

### Pattern 4: Build Failure Recovery

**목적**: 빌드 실패 시 자동 복구 또는 에스컬레이션

**Recovery Flow**:
```
Worker: Build failed (컴파일 에러)
    ↓
Manager: 에러 분석
    ↓
├─ 일시적 에러 (네트워크 타임아웃) → 재시도 (최대 2회)
├─ 의존성 누락 → COMMON/UTILS 먼저 빌드 후 재시도
└─ 코드 에러 → Primary에게 에스컬레이션 (개발자 수정 필요)
```

**Manager의 판단 기준**:
- `BUILD FAILURE` 로그 패턴 분석
- 실패 원인 분류 (컴파일 에러 vs 의존성 에러 vs 네트워크 에러)
- 자동 복구 가능 여부 결정

## Worker Assignment Strategy

### 단일 서비스 빌드

```
User: "KiiPS-FD 빌드해줘"
    ↓
build-manager 활성화
    ↓
Worker-1에게 할당: Build KiiPS-FD
    ↓
Manager 대기 (진행률 모니터링)
    ↓
Worker-1 완료 보고 (SUCCESS)
    ↓
Manager → Primary 보고
```

### 멀티 서비스 병렬 빌드

```
User: "KiiPS-FD, IL, PG 빌드해줘"
    ↓
build-manager 활성화
    ↓
의존성 분석: COMMON → UTILS 필요
    ↓
Sequential: COMMON, UTILS 빌드 (Worker-1)
    ↓
Parallel: FD (Worker-2), IL (Worker-3), PG (Worker-4)
    ↓
Manager 집계: 5개 중 5개 성공
    ↓
Manager → Primary 보고
```

## Progress Aggregation

Manager는 워커들의 진행 상황을 집계하여 Primary에게 보고합니다:

```javascript
workerProgress = {
  'worker-1': { task: 'Build COMMON', progress: 100, status: 'completed' },
  'worker-2': { task: 'Build KiiPS-FD', progress: 75, status: 'in_progress' },
  'worker-3': { task: 'Build KiiPS-IL', progress: 60, status: 'in_progress' }
}

managerProgress = {
  overallProgress: Math.floor((100 + 75 + 60) / 3), // 78%
  workersActive: 2,
  workersCompleted: 1,
  estimatedTimeRemaining: 90 // seconds (based on average build time)
}
```

## Quality Checkpoints

Manager가 각 단계에서 강제하는 품질 체크포인트:

### Checkpoint 1: Pre-Build Validation
- ✓ `pom.xml` 존재 및 유효성
- ✓ Parent POM (KiiPS-HUB) 접근 가능
- ✓ 의존성 모듈 (COMMON, UTILS) 빌드 완료 여부

### Checkpoint 2: Build Artifact Verification
- ✓ `target/` 디렉토리 생성됨
- ✓ JAR/WAR 파일 존재 (`target/*.jar` 또는 `target/*.war`)
- ✓ 파일 크기 > 0 (빈 아티팩트 방지)

### Checkpoint 3: Log Analysis
- ✓ `BUILD SUCCESS` 메시지 존재
- ✓ `BUILD FAILURE` 메시지 없음
- ✓ 경고 메시지 < 10개 (과도한 경고 방지)

## Escalation Triggers

Manager가 Primary에게 에스컬레이션하는 조건:

1. **Shared Module Build Required**
   - KiiPS-COMMON, KiiPS-UTILS 수정 필요 시 (primaryOnly: true)
   - Manager는 빌드만 가능, 수정은 Primary 전용

2. **Cascading Build Failures**
   - 3개 이상의 서비스 빌드 동시 실패
   - 공통 원인 가능성 (Parent POM 문제 등)

3. **Resource Exhaustion**
   - 모든 워커가 사용 중이고 대기 큐 > 5개
   - Primary가 추가 워커 할당 결정

## Example Workflows

### Workflow 1: 단일 서비스 빌드 (KiiPS-FD)

```
User: "KiiPS-FD 빌드해줘"

build-manager:
  1. Pre-build check
     - KiiPS-FD/pom.xml 확인 ✓
     - 의존성 (COMMON, UTILS) 빌드 상태 확인 ✓

  2. Worker 할당
     - kiips-developer에게 빌드 작업 위임

  3. 빌드 실행 (Worker)
     - cd KiiPS-HUB/
     - mvn clean package -pl :KiiPS-FD -am -DskipTests=true
     - 진행률 보고: 25% → 50% → 75% → 100%

  4. Artifact 검증
     - ls -la ../KiiPS-FD/target/KiiPS-FD-0.0.1-SNAPSHOT.jar ✓
     - 파일 크기: 45.2 MB ✓

  5. Primary 보고
     - "KiiPS-FD 빌드 완료 (3분 12초)"
```

### Workflow 2: 멀티 서비스 병렬 빌드 (FD, IL, PG)

```
User: "KiiPS-FD, IL, PG 빌드해줘"

build-manager:
  1. 의존성 분석
     - 공통 의존성: KiiPS-COMMON, KiiPS-UTILS
     - 병렬 가능: FD, IL, PG (상호 독립)

  2. Sequential Phase: 공통 모듈
     - Worker-1: Build COMMON (2분) → SUCCESS
     - Worker-1: Build UTILS (1.5분) → SUCCESS

  3. Parallel Phase: 비즈니스 서비스
     - Worker-2: Build FD (3분)   ┐
     - Worker-3: Build IL (2.5분) ├─ 동시 실행
     - Worker-4: Build PG (3.2분) ┘

  4. 결과 집계
     - COMMON: SUCCESS (2분)
     - UTILS: SUCCESS (1.5분)
     - FD: SUCCESS (3분)
     - IL: SUCCESS (2.5분)
     - PG: SUCCESS (3.2분)
     - 총 소요 시간: 6.7분 (순차: 14.2분 대비 52% 단축)

  5. Primary 보고
     - "5개 모듈 빌드 완료 (병렬 최적화로 6분 42초)"
```

### Workflow 3: 빌드 실패 복구 (의존성 에러)

```
User: "KiiPS-FD 빌드해줘"

build-manager:
  1. Worker-1: Build FD
     - mvn clean package -pl :KiiPS-FD -am
     - FAILURE: Could not resolve dependencies for KiiPS-COMMON

  2. 에러 분석
     - 원인: KiiPS-COMMON 아티팩트 누락
     - 복구 전략: COMMON 먼저 빌드

  3. 복구 시도
     - Worker-1: Build COMMON → SUCCESS
     - Worker-1: Build UTILS → SUCCESS (COMMON에 의존)
     - Worker-1: Retry Build FD → SUCCESS

  4. Primary 보고
     - "KiiPS-FD 빌드 완료 (의존성 자동 해결 후 재시도)"
```

## Related Skills

- **kiips-maven-builder**: Manager가 이 스킬을 활용하여 워커에게 실제 빌드 실행 위임
- **checklist-generator**: 빌드 전후 체크리스트 생성 (아티팩트 검증 등)

## Best Practices

1. **항상 KiiPS-HUB에서 빌드**: 의존성 해결 보장
2. **병렬 빌드 우선**: 독립적인 서비스는 동시 빌드로 시간 단축
3. **실패 시 즉시 에스컬레이션 금지**: 자동 복구 시도 (최대 2회) 후 에스컬레이션
4. **진행 상황 투명하게 보고**: 30초마다 또는 상태 변경 시 Primary에게 보고
5. **Shared Module 수정 금지**: Manager는 COMMON/UTILS 빌드만 가능, 수정은 Primary 전용

---

**Manager**: build-manager
**Managed Skills**: kiips-maven-builder
**Delegates To**: kiips-developer
**Key Value**: 2.6배 빌드 속도 향상 (병렬 조정)
