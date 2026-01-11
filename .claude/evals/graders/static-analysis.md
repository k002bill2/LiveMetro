# Static Analysis Grader

정적 분석 그레이더. 외부 도구(ruff, mypy, ESLint, bandit 등)를 활용한 코드 품질 검증.

## 개요

Anthropic 블로그 권장: 코딩 에이전트 평가 시 정적 분석 도구를 결합하여 객관적 품질 측정

지원 도구:
- **TypeScript**: `tsc --noEmit`, ESLint
- **Python**: ruff, mypy, bandit
- **범용**: prettier (포맷팅)

## 그레이더 정의 (YAML)

```yaml
graders:
  - type: static_analysis
    weight: 0.25
    commands:
      - name: typescript
        cmd: "npx tsc --noEmit"
        pass_condition: "exit_code == 0"
        weight: 0.4

      - name: eslint
        cmd: "npm run lint -- --max-warnings 0"
        pass_condition: "exit_code == 0"
        weight: 0.3

      - name: prettier
        cmd: "npx prettier --check src/**/*.{ts,tsx}"
        pass_condition: "exit_code == 0"
        weight: 0.2

      - name: test_coverage
        cmd: "npm test -- --coverage --coverageReporters=json-summary"
        pass_condition: "coverage.statements >= 75"
        extract: "coverage/coverage-summary.json"
        weight: 0.1
```

## 도구별 설정

### TypeScript (tsc)

```yaml
- name: typescript
  cmd: "npx tsc --noEmit"
  pass_condition: "exit_code == 0"
  error_parsing:
    pattern: "^(.+)\\((\\d+),(\\d+)\\): error (TS\\d+): (.+)$"
    groups: [file, line, col, code, message]
  severity_map:
    error: 1.0      # 에러당 100% 감점
    warning: 0.1    # 경고당 10% 감점
```

### ESLint

```yaml
- name: eslint
  cmd: "npm run lint -- --format json"
  pass_condition: "errors == 0 && warnings <= 5"
  output_format: json
  severity_map:
    error: 0.5      # 에러당 50% 감점
    warning: 0.05   # 경고당 5% 감점
```

### Python: ruff + mypy + bandit

```yaml
- name: ruff
  cmd: "ruff check src/"
  pass_condition: "exit_code == 0"
  weight: 0.3

- name: mypy
  cmd: "mypy src/ --strict"
  pass_condition: "exit_code == 0"
  weight: 0.4

- name: bandit
  cmd: "bandit -r src/ -f json"
  pass_condition: "high == 0 && medium <= 2"
  output_format: json
  weight: 0.3
```

## 실행 로직

```typescript
interface StaticAnalysisResult {
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  passed: boolean;
  issues: Issue[];
}

interface Issue {
  file: string;
  line: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  message: string;
}

async function runStaticAnalysis(
  commands: CommandConfig[]
): Promise<StaticAnalysisResult[]> {
  const results: StaticAnalysisResult[] = [];

  for (const cmd of commands) {
    const start = Date.now();
    const proc = await exec(cmd.cmd, { timeout: 60000 });

    const result: StaticAnalysisResult = {
      command: cmd.name,
      exit_code: proc.exitCode,
      stdout: proc.stdout,
      stderr: proc.stderr,
      duration_ms: Date.now() - start,
      passed: evaluateCondition(proc, cmd.pass_condition),
      issues: parseIssues(proc.stdout, cmd.error_parsing)
    };

    results.push(result);
  }

  return results;
}
```

## 출력 형식

```json
{
  "grader": "static_analysis",
  "commands": [
    {
      "name": "typescript",
      "cmd": "npx tsc --noEmit",
      "exit_code": 0,
      "passed": true,
      "duration_ms": 3200,
      "issues": [],
      "score": 1.0
    },
    {
      "name": "eslint",
      "cmd": "npm run lint",
      "exit_code": 1,
      "passed": false,
      "duration_ms": 1500,
      "issues": [
        {
          "file": "src/components/Station.tsx",
          "line": 42,
          "severity": "error",
          "code": "no-unused-vars",
          "message": "'unusedVar' is defined but never used"
        }
      ],
      "score": 0.5
    },
    {
      "name": "prettier",
      "cmd": "npx prettier --check",
      "exit_code": 0,
      "passed": true,
      "duration_ms": 800,
      "issues": [],
      "score": 1.0
    }
  ],
  "summary": {
    "total_commands": 3,
    "passed": 2,
    "failed": 1,
    "total_issues": 1,
    "errors": 1,
    "warnings": 0
  },
  "score": 0.85,
  "weighted_score": 0.88
}
```

## 점수 계산

```typescript
function calculateScore(results: StaticAnalysisResult[], config: CommandConfig[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const cmdConfig = config[i];
    const weight = cmdConfig.weight || 1.0 / results.length;

    let cmdScore = result.passed ? 1.0 : 0.0;

    // 부분 점수: 이슈 수에 따른 감점
    if (!result.passed && result.issues.length > 0) {
      const errors = result.issues.filter(i => i.severity === 'error').length;
      const warnings = result.issues.filter(i => i.severity === 'warning').length;

      cmdScore = Math.max(0, 1.0 - (errors * 0.2) - (warnings * 0.05));
    }

    weightedSum += cmdScore * weight;
    totalWeight += weight;
  }

  return weightedSum / totalWeight;
}
```

## 커스텀 검사 추가

프로젝트별 커스텀 검사:

```yaml
- name: no_any_types
  cmd: "grep -r ': any' src/ | wc -l"
  pass_condition: "output == 0"
  custom: true
  weight: 0.1

- name: no_console_log
  cmd: "grep -r 'console.log' src/ --include='*.ts' --include='*.tsx' | grep -v '__tests__' | wc -l"
  pass_condition: "output == 0"
  custom: true
  weight: 0.05
```

## 보안 분석 (bandit 스타일)

```yaml
- name: security_scan
  cmd: "npm audit --json"
  pass_condition: "high == 0 && critical == 0"
  output_format: json
  extract_path: "metadata.vulnerabilities"
  severity_map:
    critical: 1.0
    high: 0.5
    moderate: 0.1
    low: 0.02
```

## LiveMetro 프로젝트 기본 설정

```yaml
# .claude/evals/graders/config/livemetro-static.yaml
commands:
  - name: typescript
    cmd: "npm run type-check"
    weight: 0.35

  - name: eslint
    cmd: "npm run lint"
    weight: 0.25

  - name: test
    cmd: "npm test -- --passWithNoTests"
    weight: 0.25

  - name: no_any
    cmd: "grep -r ': any' src/ --include='*.ts' --include='*.tsx' | grep -v 'node_modules' | wc -l"
    pass_condition: "output <= 5"
    weight: 0.15
```

## 참고

- Anthropic 블로그: "Combine deterministic tests with LLM rubrics"
- 정적 분석은 빠르고, 저렴하고, 객관적
