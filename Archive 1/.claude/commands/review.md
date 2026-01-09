---
description: Perform comprehensive code review with security, performance, and quality checks
---

# 코드 리뷰

철저한 코드 리뷰를 수행합니다 (품질, 보안, 유지보수성 중심).

## Review Checklist

### 1. Code Quality
- [ ] **Naming**: 명확하고 설명적인 변수/함수명?
- [ ] **SRP**: 함수가 단일 목적이고 작은가?
- [ ] **DRY**: 코드 중복 없는가?
- [ ] **Style**: 일관된 코딩 스타일?
- [ ] **Abstraction**: 적절한 추상화 수준?

### 2. Security (보안)
- [ ] **Validation**: 입력 검증 존재?
- [ ] **Injection**: SQL/NoSQL 인젝션 취약점 없는가?
- [ ] **Auth**: 적절한 인증/인가 체크?
- [ ] **Secrets**: 하드코딩된 비밀 키 없는가?
- [ ] **Data**: 민감 데이터 암호화 또는 마스킹?
- [ ] **XSS**: Lucy XSS 필터 적용? (KiiPS-UI)

### 3. Performance (성능)
- [ ] **Complexity**: 효율적인 알고리즘 (핫 패스에서 O(n²) 회피)?
- [ ] **Database**: 쿼리 최적화됨 (인덱스 사용)?
- [ ] **Caching**: 적절한 곳에 캐싱 구현?
- [ ] **Memory**: 명백한 메모리 누수 없는가?

### 4. KiiPS 특정 사항
- [ ] **COMMON**: GlobalExceptionHandler 활용?
- [ ] **UTILS**: DAO 재사용?
- [ ] **Build**: KiiPS-HUB에서 빌드 가능?
- [ ] **Logging**: 적절한 로깅 추가?

### 5. Documentation (문서화)
- [ ] **Javadoc**: 공개 메서드 문서화?
- [ ] **Comments**: 복잡한 로직 설명 (why, not just what)?

## Execution

1. **코드 확인**: 변경된 파일 분석
2. **체크리스트 검토**: 위 항목 점검
3. **리포트 작성**: Critical, Warning, Suggestion으로 분류
4. **수정 적용**: Critical 및 Warning 항목 수정

## Output Format

```markdown
## Code Review Report

### 🔴 Critical (즉시 수정 필요)
- [파일:라인] 설명

### 🟡 Warning (수정 권장)
- [파일:라인] 설명

### 💡 Suggestion (개선 제안)
- [파일:라인] 설명

### ✅ Good Practices (잘된 점)
- 설명
```
