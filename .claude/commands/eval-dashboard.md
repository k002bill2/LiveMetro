---
description: AI 에이전트 평가 결과 대시보드 - 추세 분석 및 저성능 태스크 식별
allowed-tools: Bash(node:*), Read, Grep, Glob
---

# Eval Dashboard

AI 에이전트 평가 결과를 시각화하고 분석합니다.

## Instructions

다음 단계를 순서대로 실행하세요:

### Step 1: 결과 디렉토리 스캔

```bash
ls -la .claude/evals/results/ 2>/dev/null || echo "No results found"
```

### Step 2: 최근 결과 수집

최근 7일간의 평가 결과를 수집합니다:

```bash
find .claude/evals/results -name "*.json" -mtime -7 -type f 2>/dev/null | head -50
```

### Step 3: 대시보드 출력

다음 형식으로 대시보드를 출력합니다:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 EVAL DASHBOARD - LiveMetro AI Agent Evaluation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📅 Period: [시작일] ~ [종료일]

## 📈 Overall Metrics

| Metric | Value | Trend |
|--------|-------|-------|
| Total Runs | N | ↑/↓/→ |
| Pass Rate | N% | ↑/↓/→ |
| Avg Score | N.NN | ↑/↓/→ |
| pass@1 | N.NN | ↑/↓/→ |
| pass@3 | N.NN | ↑/↓/→ |

## 🎯 By Category

| Category | Runs | Pass | Score | pass@3 |
|----------|------|------|-------|--------|
| ui_component | N | N% | N.NN | N.NN |
| service | N | N% | N.NN | N.NN |
| bug_fix | N | N% | N.NN | N.NN |

## 🔴 Low Performers (Score < 0.70)

| Task ID | Category | Score | Issue |
|---------|----------|-------|-------|
| task_xxx | category | N.NN | 주요 문제점 |

## 🟢 Top Performers (Score ≥ 0.90)

| Task ID | Category | Score |
|---------|----------|-------|
| task_xxx | category | N.NN |

## 📊 Agent Performance

| Agent | Tasks | Avg Score | Pass Rate |
|-------|-------|-----------|-----------|
| mobile-ui-specialist | N | N.NN | N% |
| backend-integration-specialist | N | N.NN | N% |
| test-automation-specialist | N | N.NN | N% |

## 🔄 Trend Analysis

### Score Trend (Last 7 Days)
[간단한 ASCII 차트 또는 설명]

### Saturation Check
- pass@3 = 1.0 도달 태스크: N개
- 포화 경고: [있으면 표시]

## 💡 Recommendations

1. [개선 제안 1]
2. [개선 제안 2]
3. [개선 제안 3]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 4: 저성능 태스크 분석

Score < 0.70인 태스크에 대해:
- 실패한 코드 검사 식별
- LLM 평가에서 낮은 점수 영역 확인
- 개선 제안 생성

### Step 5: 포화도 경고

pass@k = 1.0에 도달한 태스크 식별:
- 해당 태스크 목록 표시
- 더 어려운 변형 제안
- 새로운 태스크 추가 권고

## Output Format

### JSON Summary (선택적)

`--json` 인자가 있으면 JSON 형식으로도 출력:

```json
{
  "period": {
    "start": "2026-01-25",
    "end": "2026-02-01"
  },
  "metrics": {
    "total_runs": 42,
    "pass_rate": 0.78,
    "avg_score": 0.82,
    "pass_at_1": 0.65,
    "pass_at_3": 0.89
  },
  "by_category": [...],
  "low_performers": [...],
  "top_performers": [...],
  "agent_performance": [...],
  "recommendations": [...]
}
```

## Usage Examples

```bash
# 기본 대시보드
/eval-dashboard

# 특정 기간
/eval-dashboard --days 14

# JSON 출력 포함
/eval-dashboard --json

# 특정 카테고리만
/eval-dashboard --category ui_component
```

## Related Commands

- `/run-eval` - 평가 실행
- `/check-health` - 프로젝트 헬스 체크
- `/verify-app` - 앱 검증

---
**Version**: 1.0.0
