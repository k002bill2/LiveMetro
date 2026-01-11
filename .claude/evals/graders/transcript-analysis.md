# Transcript Analysis Grader

트랜스크립트 분석 그레이더. 에이전트의 행동 패턴, 효율성, 도구 사용을 분석합니다.

## 개요

Anthropic 블로그 핵심 원칙: "평가자가 정확하게 작동하는지 아는 유일한 방법은 트랜스크립트를 읽는 것"

이 그레이더는 에이전트가 **어떻게** 문제를 해결했는지 분석합니다:
- 턴 수 효율성
- 도구 사용 패턴
- 실패 복구 전략
- 불필요한 반복 감지

## 분석 영역

| 영역 | 측정 항목 | 기준 |
|------|----------|------|
| 효율성 | 턴 수, 도구 호출 수 | max_turns, max_tool_calls |
| 도구 사용 | 필수/금지 도구 | required_tools, disallowed_tools |
| 행동 패턴 | 반복, 루프, 포기 | max_retries, no_loops |
| 품질 | 중간 검증, 에러 처리 | verification_steps |

## 그레이더 정의 (YAML)

```yaml
graders:
  - type: transcript
    weight: 0.2
    max_turns: 10
    max_tool_calls: 30
    required_tools:
      - Read
      - Edit
    disallowed_tools:
      - Write  # 기존 파일은 Edit 사용
    patterns:
      avoid:
        - "repeated_read"      # 같은 파일 3회 이상 읽기
        - "edit_without_read"  # 읽기 없이 편집
        - "infinite_loop"      # 같은 작업 반복
      expect:
        - "verification"       # 변경 후 검증 단계
        - "incremental"        # 점진적 접근
```

## 분석 로직

### 1. 기본 메트릭 수집

```typescript
interface TranscriptMetrics {
  total_turns: number;
  total_tool_calls: number;
  tools_used: Map<string, number>;  // 도구별 호출 횟수
  duration_seconds: number;
  tokens_used: number;
}
```

### 2. 패턴 분석

```typescript
// 반복 읽기 감지
function detectRepeatedReads(events: Event[]): boolean {
  const readCounts = new Map<string, number>();
  for (const event of events) {
    if (event.tool === 'Read') {
      const path = event.params.file_path;
      const count = (readCounts.get(path) || 0) + 1;
      readCounts.set(path, count);
      if (count >= 3) return true;  // 같은 파일 3회 이상
    }
  }
  return false;
}

// 읽기 없이 편집 감지
function detectEditWithoutRead(events: Event[]): boolean {
  const readFiles = new Set<string>();
  for (const event of events) {
    if (event.tool === 'Read') {
      readFiles.add(event.params.file_path);
    }
    if (event.tool === 'Edit') {
      if (!readFiles.has(event.params.file_path)) {
        return true;  // 읽지 않은 파일 편집
      }
    }
  }
  return false;
}

// 무한 루프 감지
function detectInfiniteLoop(events: Event[]): boolean {
  const window = 5;  // 최근 5개 이벤트
  for (let i = window; i < events.length; i++) {
    const recent = events.slice(i - window, i);
    const pattern = JSON.stringify(recent.map(e => e.tool));
    const previous = events.slice(i - window * 2, i - window);
    if (JSON.stringify(previous.map(e => e.tool)) === pattern) {
      return true;  // 같은 패턴 반복
    }
  }
  return false;
}
```

### 3. 검증 단계 확인

```typescript
// 변경 후 검증 확인
function hasVerificationStep(events: Event[]): boolean {
  let hasEdit = false;
  for (const event of events) {
    if (event.tool === 'Edit') {
      hasEdit = true;
    }
    // 편집 후 타입체크, 테스트, 린트 실행
    if (hasEdit && event.tool === 'Bash') {
      if (event.params.command.includes('type-check') ||
          event.params.command.includes('test') ||
          event.params.command.includes('lint')) {
        return true;
      }
    }
  }
  return false;
}
```

## 출력 형식

```json
{
  "grader": "transcript",
  "metrics": {
    "total_turns": 8,
    "max_turns": 10,
    "turns_ok": true,

    "total_tool_calls": 24,
    "max_tool_calls": 30,
    "tool_calls_ok": true,

    "duration_seconds": 145,
    "tokens_used": 12500
  },

  "tools": {
    "used": ["Read", "Edit", "Bash", "Grep"],
    "required": ["Read", "Edit"],
    "required_present": true,
    "disallowed": ["Write"],
    "disallowed_absent": true
  },

  "patterns": {
    "avoided": {
      "repeated_read": true,
      "edit_without_read": true,
      "infinite_loop": true
    },
    "expected": {
      "verification": true,
      "incremental": true
    }
  },

  "issues": [],
  "score": 1.0,
  "summary": "Efficient execution: 8 turns, all patterns correct"
}
```

## 점수 계산

```typescript
function calculateScore(analysis: TranscriptAnalysis): number {
  let score = 1.0;

  // 턴 수 초과 감점
  if (analysis.total_turns > analysis.max_turns) {
    const overrun = (analysis.total_turns - analysis.max_turns) / analysis.max_turns;
    score -= Math.min(overrun * 0.5, 0.3);  // 최대 30% 감점
  }

  // 도구 호출 초과 감점
  if (analysis.total_tool_calls > analysis.max_tool_calls) {
    const overrun = (analysis.total_tool_calls - analysis.max_tool_calls) / analysis.max_tool_calls;
    score -= Math.min(overrun * 0.3, 0.2);  // 최대 20% 감점
  }

  // 필수 도구 미사용 감점
  if (!analysis.required_tools_present) {
    score -= 0.2;
  }

  // 금지 도구 사용 감점
  if (!analysis.disallowed_tools_absent) {
    score -= 0.3;
  }

  // 안티패턴 감점
  for (const pattern of analysis.bad_patterns) {
    score -= 0.1;  // 패턴당 10% 감점
  }

  return Math.max(score, 0);
}
```

## 대화형 에이전트 특화

대화형 에이전트의 경우 추가 분석:

```yaml
graders:
  - type: transcript
    conversation_specific:
      max_turns: 10
      require_empathy: true      # 공감 표현 필수
      require_resolution: true   # 해결책 제시 필수
      avoid_repetition: true     # 같은 내용 반복 금지
```

## 연구 에이전트 특화

연구 에이전트의 경우 추가 분석:

```yaml
graders:
  - type: transcript
    research_specific:
      min_sources: 3              # 최소 출처 수
      require_citations: true     # 인용 필수
      verify_claims: true         # 주장 검증
```

## 참고

- Anthropic 블로그: "The only way to know if your grader is working correctly is to read transcripts"
- 트랜스크립트 분석은 평가 품질 보장의 핵심
