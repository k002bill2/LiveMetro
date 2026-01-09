# Layer 4: Executive Function Layer - 작업 분해 및 조정 가이드

## 개요

**목적**: 작업 분해, 리소스 할당, 동적 재할당, 충돌 해결
**범위**: Primary Agent (조정 권한)
**강제 수준**: Required (필수)

---

## 1. 작업 분해 가이드라인

### 1.1 분해 원칙

```
사용자 요청 → 전략적 목표 정의 → 하위 작업 분해 → 에이전트 할당 → 실행 → 통합
```

| 원칙 | 설명 | 예시 |
|------|------|------|
| **원자성** | 각 하위 작업은 독립적으로 완료 가능해야 함 | "KiiPS-FD 빌드" vs "KiiPS 전체 빌드" |
| **명확한 경계** | 작업 간 의존성과 경계 명확히 정의 | FD → IL 의존성 명시 |
| **검증 가능** | 각 작업의 완료 조건이 측정 가능해야 함 | "BUILD SUCCESS" 메시지 확인 |
| **적절한 크기** | 너무 크지도 작지도 않은 적절한 크기 | 5-15분 내 완료 가능 |

### 1.2 KiiPS 작업 분해 패턴

#### 패턴 A: 서비스 빌드 및 배포

```json
{
  "task_type": "service_build_deploy",
  "decomposition": [
    {
      "id": "T1",
      "name": "SVN 업데이트",
      "agent": "kiips-developer",
      "skill": null,
      "command": "svn up",
      "dependencies": [],
      "estimated_time": "30s"
    },
    {
      "id": "T2",
      "name": "서비스 빌드",
      "agent": "kiips-developer",
      "skill": "kiips-maven-builder",
      "command": "cd KiiPS-HUB && mvn clean package -pl :KiiPS-{SERVICE} -am",
      "dependencies": ["T1"],
      "estimated_time": "3min"
    },
    {
      "id": "T3",
      "name": "API 테스트",
      "agent": "kiips-developer",
      "skill": "kiips-api-tester",
      "command": "test API endpoints",
      "dependencies": ["T2"],
      "estimated_time": "2min"
    },
    {
      "id": "T4",
      "name": "서비스 배포",
      "agent": "primary-coordinator",
      "skill": "kiips-service-deployer",
      "command": "./start.sh",
      "dependencies": ["T3"],
      "estimated_time": "1min"
    },
    {
      "id": "T5",
      "name": "로그 분석",
      "agent": "kiips-developer",
      "skill": "kiips-log-analyzer",
      "command": "analyze service logs",
      "dependencies": ["T4"],
      "estimated_time": "1min"
    },
    {
      "id": "T6",
      "name": "체크리스트 검증",
      "agent": "checklist-generator",
      "skill": null,
      "command": "generate deployment checklist",
      "dependencies": ["T5"],
      "estimated_time": "30s"
    }
  ],
  "total_estimated_time": "8min"
}
```

#### 패턴 B: 다중 서비스 병렬 빌드

```json
{
  "task_type": "multi_service_parallel_build",
  "decomposition": [
    {
      "id": "T1",
      "name": "공통 모듈 빌드",
      "agent": "primary-coordinator",
      "skill": "kiips-maven-builder",
      "command": "cd KiiPS-HUB && mvn clean install -pl :KiiPS-COMMON,:KiiPS-UTILS -am",
      "dependencies": [],
      "priority": "critical",
      "estimated_time": "2min"
    },
    {
      "id": "T2a",
      "name": "KiiPS-FD 빌드",
      "agent": "secondary_a",
      "skill": "kiips-maven-builder",
      "command": "cd KiiPS-HUB && mvn clean package -pl :KiiPS-FD -am",
      "dependencies": ["T1"],
      "parallel_group": "services",
      "estimated_time": "2min"
    },
    {
      "id": "T2b",
      "name": "KiiPS-IL 빌드",
      "agent": "secondary_b",
      "skill": "kiips-maven-builder",
      "command": "cd KiiPS-HUB && mvn clean package -pl :KiiPS-IL -am",
      "dependencies": ["T1"],
      "parallel_group": "services",
      "estimated_time": "2min"
    },
    {
      "id": "T2c",
      "name": "KiiPS-PG 빌드",
      "agent": "secondary_c",
      "skill": "kiips-maven-builder",
      "command": "cd KiiPS-HUB && mvn clean package -pl :KiiPS-PG -am",
      "dependencies": ["T1"],
      "parallel_group": "services",
      "estimated_time": "2min"
    },
    {
      "id": "T3",
      "name": "빌드 결과 통합",
      "agent": "primary-coordinator",
      "skill": null,
      "command": "verify all builds, create report",
      "dependencies": ["T2a", "T2b", "T2c"],
      "estimated_time": "1min"
    }
  ],
  "parallel_efficiency": "3x",
  "total_estimated_time": "5min"
}
```

#### 패턴 C: 기능 개발

```json
{
  "task_type": "feature_development",
  "decomposition": [
    {
      "id": "T1",
      "name": "요구사항 분석",
      "agent": "primary-coordinator",
      "skill": "kiips-feature-planner",
      "dependencies": [],
      "estimated_time": "3min"
    },
    {
      "id": "T2",
      "name": "아키텍처 검토",
      "agent": "kiips-architect",
      "skill": null,
      "dependencies": ["T1"],
      "estimated_time": "5min"
    },
    {
      "id": "T3",
      "name": "구현",
      "agent": "kiips-developer",
      "skill": null,
      "dependencies": ["T2"],
      "estimated_time": "varies"
    },
    {
      "id": "T4",
      "name": "코드 리뷰",
      "agent": "checklist-generator",
      "skill": null,
      "dependencies": ["T3"],
      "estimated_time": "2min"
    },
    {
      "id": "T5",
      "name": "테스트",
      "agent": "kiips-developer",
      "skill": "kiips-api-tester",
      "dependencies": ["T3"],
      "parallel_with": "T4",
      "estimated_time": "3min"
    },
    {
      "id": "T6",
      "name": "통합 및 배포",
      "agent": "primary-coordinator",
      "skill": "kiips-service-deployer",
      "dependencies": ["T4", "T5"],
      "estimated_time": "2min"
    }
  ]
}
```

---

## 2. 동적 재할당 규칙

### 2.1 재할당 트리거 조건

| 조건 | 임계값 | 조치 |
|------|--------|------|
| **진행 편차** | > 30% 지연 | 작업 재분배 또는 지원 에이전트 투입 |
| **에이전트 차단** | > 30초 대기 | 다른 에이전트로 위임 |
| **에러 발생** | 2회 연속 실패 | 에스컬레이션 또는 대안 접근 |
| **능력 불일치** | < 0.7 매칭 | 더 적합한 에이전트로 재할당 |

### 2.2 재할당 프로세스

```python
class DynamicTaskReallocator:
    def __init__(self):
        self.monitoring_interval = 30  # seconds
        self.deviation_threshold = 0.3  # 30%

    def monitor_and_adapt(self, execution_state):
        """
        실행 상태를 모니터링하고 필요시 재할당
        """
        # 1. 현재 상태 평가
        deviation = self.calculate_plan_deviation(execution_state)

        # 2. 재할당 필요 여부 판단
        if deviation > self.deviation_threshold:
            return self.execute_reallocation(execution_state)

        return None

    def execute_reallocation(self, state):
        """
        재할당 실행
        """
        blocked_agents = [a for a in state.agents if a.is_blocked]
        idle_agents = [a for a in state.agents if a.workload < 0.3]
        overloaded_agents = [a for a in state.agents if a.workload > 0.9]

        reallocation_plan = []

        # 시나리오 1: 차단된 에이전트 → 유휴 에이전트
        for blocked in blocked_agents:
            for idle in idle_agents:
                if self.can_delegate(blocked.current_task, idle):
                    reallocation_plan.append({
                        'type': 'delegate',
                        'from': blocked.id,
                        'to': idle.id,
                        'task': blocked.current_task,
                        'reason': 'blocked_agent_idle_available'
                    })

        # 시나리오 2: 과부하 에이전트 → 유휴 에이전트
        for overloaded in overloaded_agents:
            splittable_tasks = [t for t in overloaded.tasks if t.splittable]
            for task in splittable_tasks:
                for idle in idle_agents:
                    if self.can_delegate(task, idle):
                        reallocation_plan.append({
                            'type': 'split',
                            'from': overloaded.id,
                            'to': idle.id,
                            'task': task,
                            'reason': 'load_balancing'
                        })

        return reallocation_plan
```

### 2.3 재할당 메시지 형식

```json
{
  "type": "task_reallocation",
  "timestamp": "ISO8601",
  "original_assignment": {
    "agent_id": "secondary_a",
    "task_id": "T2a",
    "task_name": "KiiPS-FD 빌드"
  },
  "new_assignment": {
    "agent_id": "secondary_b",
    "reason": "original_agent_blocked"
  },
  "context_transfer": {
    "progress": 30,
    "partial_results": [],
    "resources_to_transfer": ["lock_kiips_fd"]
  },
  "notified_agents": ["primary-coordinator", "secondary_a", "secondary_b"]
}
```

---

## 3. 충돌 해결 프로토콜

### 3.1 충돌 유형

| 유형 | 설명 | 해결 방법 |
|------|------|----------|
| **파일 충돌** | 동일 파일 동시 수정 시도 | Primary 우선, Secondary 대기 |
| **리소스 충돌** | 동일 리소스 동시 요청 | FIFO 큐 처리 |
| **의존성 충돌** | 순환 의존성 감지 | 순환 끊기, 순차 실행 |
| **전략 충돌** | 접근 방식 불일치 | Primary 결정권 |

### 3.2 파일 충돌 해결

```
상황: Primary와 Secondary 모두 config.json 수정 시도

해결 흐름:
1. Primary 변경 즉시 적용 (workspace-write 권한)
2. Secondary 변경 임시 파일로 저장: config.json.secondary-b.tmp
3. Primary에게 알림
4. Primary가 diff 검토: diff config.json config.json.secondary-b.tmp
5. Primary 결정: 수락 / 거부 / 부분 병합
6. conflict_log.json에 기록
```

### 3.3 데드락 방지

```javascript
const DEADLOCK_PREVENTION = {
  // 락 획득 타임아웃
  lockTimeout: 30000, // 30초

  // 순환 대기 감지
  detectCircularWait: true,

  // 해결 방법: 가장 최근 요청 중단
  resolution: 'abort_youngest',

  // 락 순서 강제 (데드락 방지)
  lockOrdering: [
    'KiiPS-HUB',
    'KiiPS-COMMON',
    'KiiPS-UTILS',
    'KiiPS-APIGateway',
    'KiiPS-Login',
    'KiiPS-UI',
    // 비즈니스 서비스는 이름 순
    'KiiPS-AC',
    'KiiPS-BATCH',
    'KiiPS-EL',
    'KiiPS-FD',
    'KiiPS-IL',
    'KiiPS-KSD',
    'KiiPS-LP',
    'KiiPS-MOBILE',
    'KiiPS-PG',
    'KiiPS-RT',
    'KiiPS-SY'
  ]
};
```

---

## 4. KiiPS 서비스별 작업 할당 패턴

### 4.1 모듈 분류 및 권한

| 모듈 분류 | 포함 서비스 | Primary Only | Secondary 허용 |
|----------|------------|--------------|---------------|
| **Core** | HUB, COMMON, UTILS | ✅ | ❌ |
| **Gateway** | APIGateway, Login | ✅ | ❌ |
| **UI** | UI | ✅ | ❌ |
| **Business** | FD, IL, PG, AC, SY, LP, EL, RT | ❌ | ✅ |
| **Support** | BATCH, MOBILE, KSD, AI | ❌ | ✅ |

### 4.2 서비스 의존성 맵

```
KiiPS-HUB (Parent POM)
├── KiiPS-COMMON (공통 서비스)
│   └── KiiPS-UTILS (공통 DAO)
│       ├── KiiPS-FD (펀드)
│       ├── KiiPS-IL (투자)
│       ├── KiiPS-PG (프로그램)
│       ├── KiiPS-AC (회계)
│       ├── KiiPS-SY (시스템)
│       ├── KiiPS-LP (LP 관리)
│       ├── KiiPS-EL (전자문서)
│       ├── KiiPS-RT (리포팅)
│       ├── KiiPS-BATCH (배치)
│       ├── KiiPS-MOBILE (모바일)
│       ├── KiiPS-KSD (KSD 연동)
│       └── KiiPS-AI (AI 서비스)
├── KiiPS-APIGateway (게이트웨이)
├── KiiPS-Login (인증)
└── KiiPS-UI (웹 인터페이스)
```

### 4.3 빌드 순서 규칙

```markdown
## 필수 빌드 순서

1. **항상 먼저**: KiiPS-COMMON, KiiPS-UTILS
   - 모든 서비스가 의존하므로 변경 시 먼저 빌드

2. **Core 서비스**: KiiPS-HUB에서 -am 플래그로 자동 처리
   ```bash
   cd KiiPS-HUB && mvn clean package -pl :KiiPS-{SERVICE} -am
   ```

3. **병렬 빌드 가능**: 독립 비즈니스 서비스
   - FD, IL, PG, AC, SY, LP 등은 병렬 빌드 가능
   - 단, COMMON/UTILS 빌드 완료 후

4. **특별 주의**: UI (WAR 패키징)
   - 다른 서비스와 다른 패키징
   - 별도 배포 프로세스
```

---

## 5. 작업 할당 결정 매트릭스

### 5.1 작업 유형별 할당

| 작업 유형 | Primary | Architect | Developer | Checklist |
|----------|---------|-----------|-----------|-----------|
| 작업 분해 | ✅ | 자문 | - | - |
| 아키텍처 결정 | 승인 | ✅ | - | - |
| Maven 빌드 | 모니터링 | - | ✅ | - |
| API 테스트 | 모니터링 | - | ✅ | - |
| 서비스 배포 | ✅ | - | 지원 | - |
| 코드 리뷰 | 최종 승인 | 기술 리뷰 | - | ✅ |
| 품질 검증 | 최종 승인 | - | - | ✅ |
| 사용자 커뮤니케이션 | ✅ | - | - | - |

### 5.2 복잡도별 할당

| 복잡도 | 설명 | 추천 할당 |
|--------|------|----------|
| **Low** | 단일 파일, 명확한 변경 | Developer 직접 |
| **Medium** | 다중 파일, 단일 서비스 | Developer + Checklist |
| **High** | 다중 서비스, 통합 필요 | Primary 조정 + 병렬 에이전트 |
| **Critical** | 아키텍처 영향, 프로덕션 | Primary + Architect + 전체 검증 |

---

## 6. 진행 상태 추적

### 6.1 상태 보고 형식

```json
{
  "execution_id": "exec_20260104_001",
  "timestamp": "ISO8601",
  "overall_progress": 65,
  "phase": "task_prosecution",
  "tasks": [
    {
      "id": "T1",
      "name": "SVN 업데이트",
      "agent": "kiips-developer",
      "status": "completed",
      "progress": 100,
      "result": "success"
    },
    {
      "id": "T2",
      "name": "Maven 빌드",
      "agent": "kiips-developer",
      "status": "in_progress",
      "progress": 70,
      "estimated_remaining": "1min"
    }
  ],
  "blockers": [],
  "deviations": [],
  "next_checkpoint": "after_build_complete"
}
```

### 6.2 시각적 진행 표시

```
실행 상태: [====================       ] 65%

✅ T1: SVN 업데이트 (완료)
⚡ T2: Maven 빌드 (진행 중 70%)
⏳ T3: API 테스트 (대기 중)
⏳ T4: 서비스 배포 (대기 중)
```

---

## 7. 빠른 참조

### 7.1 작업 분해 체크리스트

- [ ] 전략적 목표 명확히 정의
- [ ] 원자적 하위 작업으로 분해
- [ ] 의존성 관계 명시
- [ ] 각 작업에 적합한 에이전트 할당
- [ ] 예상 시간 추정
- [ ] 검증 기준 정의
- [ ] 롤백 계획 수립

### 7.2 재할당 결정 흐름

```
진행 모니터링 (30초 간격)
       ↓
편차 > 30%? ─No→ 계속 모니터링
       ↓ Yes
차단된 에이전트 있음? ─Yes→ 유휴 에이전트로 위임
       ↓ No
과부하 에이전트 있음? ─Yes→ 작업 분할 및 재분배
       ↓ No
에러 발생? ─Yes→ 재시도 또는 에스컬레이션
       ↓ No
계속 모니터링
```

---

**Last Updated**: 2026-01-04
**Version**: 3.0.1-KiiPS
**Enforcement**: Required
