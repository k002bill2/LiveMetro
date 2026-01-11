# State Check Grader

상태 기반 검증 그레이더. 태스크 완료 후 백엔드/파일시스템/DB 상태를 검증합니다.

## 개요

Anthropic 블로그 권장사항에 따라, 에이전트의 출력뿐만 아니라 **결과 상태**를 검증합니다.
- 파일이 실제로 생성되었는지
- Firebase/Firestore 문서가 올바른 상태인지
- 로그에 예상 이벤트가 기록되었는지

## 사용 시점

| 에이전트 유형 | 검증 대상 |
|--------------|----------|
| 코딩 에이전트 | 파일 존재, 내용 패턴 |
| 백엔드 통합 | Firestore 문서 상태 |
| 컴퓨터 사용 | URL 상태, DOM 상태 |

## 그레이더 정의 (YAML)

```yaml
graders:
  - type: state_check
    weight: 0.3
    expect:
      files:
        "src/components/station/StationCard.tsx":
          exists: true
          contains: ["React.memo", "accessibilityLabel"]
          not_contains: [": any", "console.log"]
        "src/components/station/__tests__/StationCard.test.tsx":
          exists: true
          min_lines: 50
      firebase:
        "stations/{stationId}":
          status: "active"
          updated_at: "recent"  # 최근 5분 이내
      logs:
        app_logs:
          contains: ["StationCard rendered"]
          not_contains: ["ERROR", "WARN"]
```

## 검증 로직

### 1. 파일 상태 검증

```bash
# 파일 존재 확인
test -f "$FILE_PATH" && echo "EXISTS" || echo "MISSING"

# 내용 패턴 확인
grep -c "React.memo" "$FILE_PATH"

# 금지 패턴 확인 (없어야 함)
grep -c ": any" "$FILE_PATH"  # 0이어야 PASS

# 최소 라인 수
wc -l < "$FILE_PATH"
```

### 2. Firebase 상태 검증

```typescript
// Firebase Admin SDK를 통한 검증
const doc = await db.collection('stations').doc(stationId).get();

const checks = {
  exists: doc.exists,
  status: doc.data()?.status === 'active',
  updated_at: isRecent(doc.data()?.updated_at, 5 * 60 * 1000) // 5분
};
```

### 3. 로그 상태 검증

```bash
# 최근 로그에서 패턴 검색
tail -100 .temp/logs/app.log | grep -c "StationCard rendered"

# 에러 없음 확인
tail -100 .temp/logs/app.log | grep -c "ERROR"  # 0이어야 PASS
```

## 출력 형식

```json
{
  "grader": "state_check",
  "checks": [
    {
      "target": "files.src/components/station/StationCard.tsx",
      "condition": "exists",
      "expected": true,
      "actual": true,
      "passed": true
    },
    {
      "target": "files.src/components/station/StationCard.tsx",
      "condition": "contains",
      "expected": ["React.memo", "accessibilityLabel"],
      "actual": ["React.memo", "accessibilityLabel"],
      "passed": true
    },
    {
      "target": "files.src/components/station/StationCard.tsx",
      "condition": "not_contains",
      "expected": [": any"],
      "actual": [],
      "passed": true,
      "note": "No forbidden patterns found"
    },
    {
      "target": "firebase.stations/{stationId}",
      "condition": "status",
      "expected": "active",
      "actual": "active",
      "passed": true
    }
  ],
  "score": 1.0,
  "summary": "All 4 state checks passed"
}
```

## 점수 계산

```
score = passed_checks / total_checks

예시: 4개 중 3개 통과 → 0.75
```

## 조건부 검사

특정 조건에서만 실행되는 검사:

```yaml
expect:
  files:
    "src/services/api/cache.ts":
      exists: true
      # 캐시 파일이 존재하면 추가 검사
      if_exists:
        contains: ["TTL", "invalidate"]
        max_lines: 200
```

## 에러 처리

| 상황 | 처리 |
|------|------|
| 파일 없음 (exists: true 기대) | FAIL |
| Firebase 연결 실패 | SKIP (경고) |
| 로그 파일 없음 | SKIP (경고) |
| 타임아웃 | FAIL |

## 통합 예시

```yaml
# 전체 태스크 정의에서 사용
id: task_ui_001
graders:
  - type: code
    weight: 0.4
    checks: [...]

  - type: state_check
    weight: 0.2
    expect:
      files:
        "src/components/station/StationCard.tsx":
          exists: true
          contains: ["memo"]

  - type: llm
    weight: 0.4
    rubric: code-quality
```

## 참고

- Anthropic 블로그: "Check backend state, not just responses"
- 결과 검증이 경로 검증보다 중요
