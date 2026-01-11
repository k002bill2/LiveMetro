# Coding Agent Rubric

코딩 에이전트(mobile-ui-specialist, backend-integration-specialist, performance-optimizer 등) 전용 평가 루브릭.

## 개요

Anthropic 블로그 권장: 코딩 에이전트는 **단위 테스트(객관적)** + **LLM 루브릭(코드 품질)** 조합 사용

## 평가 영역 (가중치)

| 영역 | 가중치 | 설명 |
|------|--------|------|
| 기능 정확성 | 30% | 요구사항 충족, 테스트 통과 |
| 코드 품질 | 25% | 가독성, 구조, 네이밍 |
| 아키텍처 준수 | 20% | 프로젝트 패턴 따름 |
| 성능 | 15% | 최적화, 메모이제이션 |
| 테스트 품질 | 10% | 커버리지, 엣지 케이스 |

---

## 1. 기능 정확성 (Functional Correctness) - 30%

요구사항을 정확히 구현했는가?

| 점수 | 기준 |
|------|------|
| **5** | 모든 요구사항 완벽 구현, 엣지 케이스 처리, 추가 개선 |
| **4** | 모든 필수 요구사항 구현, 일부 엣지 케이스 누락 |
| **3** | 대부분 요구사항 구현, 일부 기능 미완성 |
| **2** | 핵심 기능만 부분 구현, 테스트 실패 다수 |
| **1** | 거의 구현 안됨, 기본 기능 작동 안함 |

**체크리스트**:
- [ ] 모든 테스트가 통과하는가?
- [ ] 명시된 요구사항이 모두 구현되었는가?
- [ ] 엣지 케이스가 처리되었는가? (null, undefined, 빈 배열 등)
- [ ] 에러 상황이 적절히 처리되는가?

---

## 2. 코드 품질 (Code Quality) - 25%

읽기 쉽고 유지보수하기 좋은 코드인가?

| 점수 | 기준 |
|------|------|
| **5** | 자체 문서화된 코드, 완벽한 네이밍, 적절한 주석 |
| **4** | 잘 정리된 코드, 명확한 구조, 일관된 스타일 |
| **3** | 대체로 읽기 쉬움, 일부 불명확한 부분 |
| **2** | 읽기 어려움, 네이밍 혼란, 복잡한 로직 |
| **1** | 이해 불가, 스파게티 코드 |

**체크리스트**:
- [ ] 변수/함수명이 목적을 설명하는가?
- [ ] 함수가 단일 책임을 가지는가? (20줄 이하 권장)
- [ ] 중복 코드가 없는가?
- [ ] 매직 넘버/문자열이 상수로 추출되었는가?
- [ ] TypeScript strict 모드 준수하는가?

---

## 3. 아키텍처 준수 (Architecture Adherence) - 20%

프로젝트의 기존 패턴과 구조를 따르는가?

| 점수 | 기준 |
|------|------|
| **5** | 완벽한 패턴 준수, 기존 코드와 일관성 |
| **4** | 대부분 패턴 준수, 사소한 일탈 |
| **3** | 일부 패턴 미준수, 구조 혼재 |
| **2** | 패턴 무시, 기존 코드와 불일치 |
| **1** | 아키텍처 위반, 구조 파괴 |

**LiveMetro 특화 체크리스트**:
- [ ] 경로 별칭 사용 (`@components`, `@hooks` 등)?
- [ ] 컴포넌트/서비스/훅 분리 준수?
- [ ] 기존 유틸리티 함수 활용?
- [ ] 테마 시스템 (useTheme) 사용?
- [ ] 에러 처리 패턴 준수? (throw 대신 return null/[])

---

## 4. 성능 (Performance) - 15%

효율적이고 최적화된 코드인가?

| 점수 | 기준 |
|------|------|
| **5** | 완벽한 최적화, memo/useCallback/useMemo 적절 사용 |
| **4** | 대부분 최적화됨, 주요 성능 이슈 없음 |
| **3** | 기본적 성능 고려, 일부 개선 여지 |
| **2** | 성능 고려 부족, 불필요한 렌더링 |
| **1** | 심각한 성능 문제, 메모리 누수 가능성 |

**체크리스트**:
- [ ] 컴포넌트에 React.memo() 적용?
- [ ] 콜백에 useCallback 사용?
- [ ] 계산값에 useMemo 사용?
- [ ] useEffect 의존성 배열 올바른가?
- [ ] 불필요한 상태 업데이트 없는가?
- [ ] useEffect cleanup 함수 존재?

---

## 5. 테스트 품질 (Test Quality) - 10%

작성된 테스트가 충분하고 의미있는가?

| 점수 | 기준 |
|------|------|
| **5** | 90%+ 커버리지, 엣지 케이스, 통합 테스트 |
| **4** | 75%+ 커버리지, 주요 경로 테스트 |
| **3** | 60%+ 커버리지, 기본 테스트 존재 |
| **2** | 낮은 커버리지, 테스트 불충분 |
| **1** | 테스트 없음 또는 무의미한 테스트 |

**체크리스트**:
- [ ] 컴포넌트 렌더링 테스트?
- [ ] 사용자 인터랙션 테스트?
- [ ] 에러 상태 테스트?
- [ ] 엣지 케이스 테스트?
- [ ] 모킹이 적절히 사용되었는가?

---

## 점수 계산

```typescript
interface CodingAgentScore {
  functional_correctness: number;  // 1-5
  code_quality: number;            // 1-5
  architecture_adherence: number;  // 1-5
  performance: number;             // 1-5
  test_quality: number;            // 1-5
}

function calculateFinalScore(scores: CodingAgentScore): number {
  const weights = {
    functional_correctness: 0.30,
    code_quality: 0.25,
    architecture_adherence: 0.20,
    performance: 0.15,
    test_quality: 0.10
  };

  const weightedSum =
    scores.functional_correctness * weights.functional_correctness +
    scores.code_quality * weights.code_quality +
    scores.architecture_adherence * weights.architecture_adherence +
    scores.performance * weights.performance +
    scores.test_quality * weights.test_quality;

  return weightedSum / 5;  // 0-1 스케일
}
```

---

## 평가 예시

```markdown
## 코딩 에이전트 평가: task_ui_001

### 1. 기능 정확성: 4/5 (30%)
- ✅ 모든 필수 요구사항 구현
- ✅ 테스트 8/8 통과
- ⚠️ 빈 배열 엣지 케이스 미처리

### 2. 코드 품질: 5/5 (25%)
- ✅ 명확한 네이밍 (StationCard, handlePress)
- ✅ 단일 책임 원칙 준수
- ✅ TypeScript strict 준수

### 3. 아키텍처 준수: 5/5 (20%)
- ✅ @components 경로 별칭 사용
- ✅ useTheme 훅 활용
- ✅ 기존 Card 컴포넌트 패턴 따름

### 4. 성능: 3/5 (15%)
- ✅ React.memo 적용
- ⚠️ useCallback 미사용 (인라인 함수)
- ⚠️ useMemo 누락 (스타일 계산)

### 5. 테스트 품질: 4/5 (10%)
- ✅ 82% 커버리지
- ✅ 렌더링, 클릭 테스트 포함
- ⚠️ 에러 상태 테스트 누락

---

**최종 점수**: 0.85 (B+)

**개선 제안**:
1. handlePress에 useCallback 적용
2. 빈 stationList 엣지 케이스 처리
3. 로딩/에러 상태 테스트 추가
```

---

## 참고

- Anthropic 블로그: "For coding agents, combine deterministic unit tests with LLM rubrics for code quality"
- 기본 code-quality.md 루브릭을 코딩 에이전트에 특화하여 확장
