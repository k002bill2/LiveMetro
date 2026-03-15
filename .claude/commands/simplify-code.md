---
name: simplify-code
description: 코드 복잡도 분석 및 단순화 제안 (Boris Cherny code-simplifier 스타일)
allowed-tools: Read, Grep, Glob, Edit
---

# 코드 단순화 워크플로우

이 커맨드는 코드 복잡도를 분석하고 단순화 방안을 제안합니다.

## 분석 대상

- 파일 지정: `/simplify-code src/hooks/useNotifications.ts`
- 디렉토리 지정: `/simplify-code src/services/`
- 최근 변경: `/simplify-code --recent`

## 분석 항목

### 1. 함수 복잡도
- **긴 함수**: 50줄 이상 함수 식별
- **깊은 중첩**: 3단계 이상 들여쓰기
- **많은 매개변수**: 4개 이상 파라미터

### 2. 중복 코드
- 유사한 코드 블록 탐지
- 추출 가능한 공통 로직 식별
- 중복 타입 정의 확인

### 3. 복잡한 조건문
- 복잡한 조건 표현식
- 중첩된 삼항 연산자
- 긴 switch/case 문

### 4. React 특화 분석
- 불필요한 리렌더링 패턴
- useMemo/useCallback 최적화 기회
- 컴포넌트 분리 필요성

## 리포트 형식

```markdown
## 코드 복잡도 분석 결과

### 요약
| 지표 | 값 | 상태 |
|------|-----|------|
| 평균 함수 길이 | X줄 | OK/Warning |
| 최대 중첩 깊이 | X단계 | OK/Warning |
| 중복 코드 | X개 블록 | OK/Warning |

### 높은 우선순위 (즉시 개선 필요)
1. `functionName` (파일:라인) - 문제 설명
   - 제안: 구체적인 리팩토링 방안

### 중간 우선순위 (개선 권장)
1. ...

### 낮은 우선순위 (시간 있을 때)
1. ...
```

## 단순화 전략

- **긴 함수 분리**: 관심사별 작은 함수로 분리
- **조건문 단순화**: 의미 있는 변수명으로 추출
- **중복 제거**: 공통 유틸리티 함수 추출

## 자동 적용 옵션

분석 결과에 동의하면 자동 적용을 요청할 수 있습니다:
```
/simplify-code src/hooks/ --apply
```

**주의**: 자동 적용 후 반드시 `/verify-app`을 실행하세요.
