# Research Agent Rubric

연구/조사 에이전트 전용 평가 루브릭. 정보 수집, 분석, 문서화 태스크용.

## 개요

Anthropic 블로그 권장: 연구 에이전트는 **근거성(Groundedness)** + **범위 검사** + **출처 품질** 조합

## 평가 영역 (가중치)

| 영역 | 가중치 | 설명 |
|------|--------|------|
| 근거성 | 30% | 주장이 출처로 뒷받침되는가 |
| 완전성 | 25% | 요청한 범위를 모두 다루었는가 |
| 정확성 | 20% | 정보가 정확하고 최신인가 |
| 출처 품질 | 15% | 신뢰할 수 있는 출처인가 |
| 구조화 | 10% | 정보가 체계적으로 정리되었는가 |

---

## 1. 근거성 (Groundedness) - 30%

모든 주장이 출처로 뒷받침되는가?

| 점수 | 기준 |
|------|------|
| **5** | 모든 주장에 정확한 출처, 인용 명확 |
| **4** | 대부분 주장에 출처, 일부 일반적 진술 |
| **3** | 핵심 주장에만 출처, 일부 미검증 |
| **2** | 출처 부족, 많은 주장이 미검증 |
| **1** | 출처 없음, 주장만 나열 |

**체크리스트**:
- [ ] 모든 사실적 주장에 출처가 있는가?
- [ ] 인용이 정확한가? (잘못된 인용 없음)
- [ ] 출처와 주장이 직접적으로 연결되는가?
- [ ] 불확실한 정보는 명시적으로 표시되었는가?

**근거성 검사 방법**:
```yaml
graders:
  - type: llm
    rubric: research-agent
    groundedness_check:
      require_citations: true
      min_citations: 3
      verify_quotes: true  # 인용이 출처와 일치하는지
```

---

## 2. 완전성 (Completeness) - 25%

요청한 범위를 모두 다루었는가?

| 점수 | 기준 |
|------|------|
| **5** | 모든 요청 항목 + 관련 추가 정보 |
| **4** | 모든 요청 항목 충족 |
| **3** | 대부분 항목 충족, 일부 누락 |
| **2** | 핵심 항목만 부분 충족 |
| **1** | 범위 크게 미달 |

**체크리스트**:
- [ ] 요청한 모든 질문에 답변했는가?
- [ ] 필수 섹션이 모두 포함되었는가?
- [ ] 예시/사례가 충분히 제공되었는가?
- [ ] 관련 맥락 정보가 포함되었는가?

---

## 3. 정확성 (Accuracy) - 20%

정보가 정확하고 최신인가?

| 점수 | 기준 |
|------|------|
| **5** | 모든 정보 정확, 최신 데이터, 오류 없음 |
| **4** | 대부분 정확, 사소한 오류 1-2개 |
| **3** | 핵심 정보 정확, 세부 오류 존재 |
| **2** | 다수 오류, 오래된 정보 포함 |
| **1** | 정보 신뢰 불가, 심각한 오류 |

**체크리스트**:
- [ ] 날짜/수치가 정확한가?
- [ ] 기술 정보가 최신인가? (버전, API 등)
- [ ] 명백한 사실 오류가 없는가?
- [ ] 논쟁적 주제에 대해 균형 잡힌 시각인가?

---

## 4. 출처 품질 (Source Quality) - 15%

신뢰할 수 있는 출처를 사용했는가?

| 점수 | 기준 |
|------|------|
| **5** | 공식 문서, 학술 자료, 1차 출처만 사용 |
| **4** | 대부분 신뢰할 수 있는 출처 |
| **3** | 혼합 출처, 일부 비신뢰 |
| **2** | 대부분 2차/3차 출처, 블로그 위주 |
| **1** | 출처 불명확, 신뢰 불가 |

**출처 신뢰도 계층**:
```
Tier 1 (높음): 공식 문서, API 레퍼런스, 학술 논문
Tier 2 (중간): 공식 블로그, 신뢰할 수 있는 기술 사이트
Tier 3 (낮음): 개인 블로그, Stack Overflow 답변
Tier 4 (주의): 포럼, 댓글, 날짜 불명 콘텐츠
```

**체크리스트**:
- [ ] 공식 문서가 우선 활용되었는가?
- [ ] 출처의 날짜가 최근인가? (1년 이내)
- [ ] 저자/기관의 신뢰성이 확인되었는가?
- [ ] 여러 출처로 교차 검증했는가?

---

## 5. 구조화 (Organization) - 10%

정보가 체계적으로 정리되었는가?

| 점수 | 기준 |
|------|------|
| **5** | 논리적 구조, 명확한 계층, 쉬운 탐색 |
| **4** | 잘 정리됨, 일관된 포맷 |
| **3** | 대체로 정리됨, 일부 혼란 |
| **2** | 구조 불명확, 정보 산재 |
| **1** | 무질서, 읽기 어려움 |

**체크리스트**:
- [ ] 명확한 제목과 소제목이 있는가?
- [ ] 목차/개요가 제공되었는가?
- [ ] 관련 정보가 그룹화되었는가?
- [ ] 요약/결론이 포함되었는가?

---

## 점수 계산

```typescript
interface ResearchAgentScore {
  groundedness: number;     // 1-5
  completeness: number;     // 1-5
  accuracy: number;         // 1-5
  source_quality: number;   // 1-5
  organization: number;     // 1-5
}

function calculateFinalScore(scores: ResearchAgentScore): number {
  const weights = {
    groundedness: 0.30,
    completeness: 0.25,
    accuracy: 0.20,
    source_quality: 0.15,
    organization: 0.10
  };

  const weightedSum =
    scores.groundedness * weights.groundedness +
    scores.completeness * weights.completeness +
    scores.accuracy * weights.accuracy +
    scores.source_quality * weights.source_quality +
    scores.organization * weights.organization;

  return weightedSum / 5;  // 0-1 스케일
}
```

---

## 태스크 정의 예시

```yaml
id: task_res_001
name: "Seoul Metro API 문서 조사"
category: research

input:
  description: |
    서울 지하철 실시간 도착 정보 API를 조사하고 문서화하세요.
  requirements:
    - "API 엔드포인트 목록"
    - "인증 방법 설명"
    - "응답 형식 및 필드 정의"
    - "Rate limit 및 제한사항"
    - "에러 코드 목록"
  scope:
    must_cover:
      - "서울열린데이터광장 API"
      - "인증 키 발급 방법"
    nice_to_have:
      - "다른 도시 API 비교"

success_criteria:
  required:
    has_citations: true
    min_sources: 3
    covers_all_requirements: true
  must_fail:
    unverified_claims: true

graders:
  - type: llm
    weight: 0.7
    rubric: research-agent
  - type: transcript
    weight: 0.3
    max_turns: 15
    required_tools:
      - WebFetch
      - WebSearch
```

---

## 평가 예시

```markdown
## 연구 에이전트 평가: task_res_001

### 1. 근거성: 4/5 (30%)
- ✅ 5개 출처 인용
- ✅ API 문서 직접 인용
- ⚠️ Rate limit 정보 출처 불명확

### 2. 완전성: 5/5 (25%)
- ✅ 모든 필수 항목 포함
- ✅ 에러 코드 전체 목록
- ✅ 추가로 SDK 예제 포함

### 3. 정확성: 4/5 (20%)
- ✅ API 엔드포인트 정확
- ✅ 응답 형식 검증됨
- ⚠️ 일부 deprecated 필드 포함

### 4. 출처 품질: 5/5 (15%)
- ✅ 공식 API 문서 (Tier 1)
- ✅ 서울열린데이터광장 (Tier 1)
- ✅ 최근 업데이트 확인됨

### 5. 구조화: 4/5 (10%)
- ✅ 명확한 섹션 구분
- ✅ 코드 예시 포함
- ⚠️ 목차 누락

---

**최종 점수**: 0.87 (B+)

**개선 제안**:
1. Rate limit 정보에 공식 문서 링크 추가
2. deprecated 필드 표시
3. 문서 상단에 목차 추가
```

---

## 참고

- Anthropic 블로그: "For research agents, check groundedness, scope coverage, and source quality"
- 연구 에이전트는 "환각" 방지가 핵심
