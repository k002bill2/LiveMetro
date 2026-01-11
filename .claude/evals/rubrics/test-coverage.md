# Test Coverage Rubric

테스트 품질과 커버리지 평가를 위한 상세 루브릭입니다.

## 평가 영역

### 1. Coverage Metrics (커버리지 지표) - 1~5점

정량적 테스트 커버리지를 평가합니다.

| 점수 | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| **5** | ≥90% | ≥85% | ≥90% | ≥90% |
| **4** | ≥80% | ≥75% | ≥80% | ≥80% |
| **3** | ≥75% | ≥60% | ≥70% | ≥75% |
| **2** | ≥60% | ≥50% | ≥60% | ≥60% |
| **1** | <60% | <50% | <60% | <60% |

**프로젝트 기준 (CLAUDE.md)**:
- Statements: ≥75%
- Functions: ≥70%
- Branches: ≥60%

---

### 2. Test Quality (테스트 품질) - 1~5점

테스트의 의미와 효과성을 평가합니다.

| 점수 | 기준 |
|------|------|
| **5** | 탁월함 - 모든 시나리오 커버, 엣지케이스 포함, 의미있는 assertion |
| **4** | 우수함 - 주요 시나리오 커버, 일부 엣지케이스, 명확한 assertion |
| **3** | 보통 - 기본 시나리오 커버, 엣지케이스 부족, 기본 assertion |
| **2** | 미흡 - 일부 시나리오만 커버, assertion 빈약 |
| **1** | 부적합 - 테스트 없음 또는 의미없는 테스트 |

**체크리스트**:
- [ ] Happy path가 테스트되는가?
- [ ] Error/exception 케이스가 테스트되는가?
- [ ] 경계값(boundary)이 테스트되는가?
- [ ] null/undefined 케이스가 테스트되는가?
- [ ] 비동기 동작이 올바르게 테스트되는가?

---

### 3. Test Structure (테스트 구조) - 1~5점

테스트 코드의 구조와 조직을 평가합니다.

| 점수 | 기준 |
|------|------|
| **5** | 탁월함 - 완벽한 AAA 패턴, 명확한 describe/it 구조, 재사용 가능 |
| **4** | 우수함 - AAA 패턴 준수, 논리적 그룹화, 적절한 헬퍼 |
| **3** | 보통 - 대체로 구조화됨, 일부 혼란 |
| **2** | 미흡 - 구조 없음, 중복 코드 다수 |
| **1** | 부적합 - 읽기 어려움, 유지보수 불가 |

**AAA 패턴**:
```typescript
it('should return filtered stations', () => {
  // Arrange
  const stations = [mockStation1, mockStation2];
  const filter = 'line1';

  // Act
  const result = filterStations(stations, filter);

  // Assert
  expect(result).toHaveLength(1);
  expect(result[0].line).toBe('line1');
});
```

**체크리스트**:
- [ ] describe 블록이 논리적으로 그룹화되었는가?
- [ ] it/test 설명이 명확한가?
- [ ] AAA (Arrange-Act-Assert) 패턴을 따르는가?
- [ ] 테스트 간 독립성이 보장되는가?
- [ ] 공통 setup이 beforeEach에 있는가?

---

### 4. Mock Quality (모킹 품질) - 1~5점

외부 의존성 모킹의 적절성을 평가합니다.

| 점수 | 기준 |
|------|------|
| **5** | 탁월함 - 최소 모킹, 실제 동작 시뮬레이션, 타입 안전 |
| **4** | 우수함 - 적절한 모킹, 대부분 실제 동작 반영 |
| **3** | 보통 - 필요한 모킹 존재, 일부 과도한 모킹 |
| **2** | 미흡 - 과도한 모킹, 실제 동작과 괴리 |
| **1** | 부적합 - 모킹 없음 또는 완전 하드코딩 |

**체크리스트**:
- [ ] 외부 API 호출이 모킹되었는가?
- [ ] 모킹된 데이터가 실제 형태와 유사한가?
- [ ] 타이머/인터벌이 jest.useFakeTimers로 처리되었는가?
- [ ] AsyncStorage/Firebase가 적절히 모킹되었는가?
- [ ] Navigation이 모킹되었는가?

---

### 5. React Native Specific (RN 특화) - 1~5점

React Native 테스트 모범 사례 준수를 평가합니다.

| 점수 | 기준 |
|------|------|
| **5** | 탁월함 - RNTL 사용, 접근성 쿼리, 사용자 관점 테스트 |
| **4** | 우수함 - RNTL 사용, 대부분 접근성 쿼리 |
| **3** | 보통 - RNTL 사용, 일부 testID 의존 |
| **2** | 미흡 - 과도한 testID 사용, 구현 세부사항 테스트 |
| **1** | 부적합 - 직접 DOM 접근, 스냅샷만 사용 |

**React Native Testing Library 패턴**:
```typescript
// GOOD: 접근성 쿼리 사용
const button = screen.getByRole('button', { name: '검색' });
const input = screen.getByLabelText('역 이름 입력');

// AVOID: testID 과용
const button = screen.getByTestId('search-button');
```

**체크리스트**:
- [ ] @testing-library/react-native 사용하는가?
- [ ] getByRole, getByLabelText 등 접근성 쿼리 사용하는가?
- [ ] userEvent로 사용자 인터랙션 테스트하는가?
- [ ] 스냅샷 테스트가 assertion과 함께 사용되는가?
- [ ] 훅 테스트에 renderHook 사용하는가?

---

## 테스트 유형별 가이드

### 컴포넌트 테스트
```typescript
describe('StationCard', () => {
  const mockStation = {
    id: '1',
    name: '강남역',
    line: '2호선',
  };

  it('renders station name', () => {
    render(<StationCard station={mockStation} />);
    expect(screen.getByText('강남역')).toBeVisible();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<StationCard station={mockStation} onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledWith(mockStation);
  });
});
```

### 훅 테스트
```typescript
describe('useRealtimeTrains', () => {
  it('returns loading state initially', () => {
    const { result } = renderHook(() => useRealtimeTrains('강남'));
    expect(result.current.isLoading).toBe(true);
  });

  it('cleans up subscription on unmount', () => {
    const unsubscribe = jest.fn();
    jest.spyOn(firebase, 'onSnapshot').mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useRealtimeTrains('강남'));
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
```

### 서비스 테스트
```typescript
describe('trainService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('fetches arrivals from API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    });

    const result = await trainService.getArrivals('강남');
    expect(result).toHaveLength(3);
  });

  it('handles API error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await trainService.getArrivals('강남');
    expect(result).toEqual([]);
  });
});
```

---

## 점수 계산

### 가중치
| 영역 | 가중치 |
|------|--------|
| Coverage Metrics | 25% |
| Test Quality | 30% |
| Test Structure | 20% |
| Mock Quality | 15% |
| RN Specific | 10% |

### 최종 점수 예시
```
- Coverage: 4 × 0.25 = 1.00
- Quality: 4 × 0.30 = 1.20
- Structure: 5 × 0.20 = 1.00
- Mocking: 4 × 0.15 = 0.60
- RN Specific: 3 × 0.10 = 0.30

Total = (1.00 + 1.20 + 1.00 + 0.60 + 0.30) / 5 = 0.82
```

---

## 평가 예시

```markdown
## 테스트 커버리지 평가

### Coverage Metrics: 4/5
- Statements: 82% (목표: 75% ✅)
- Branches: 68% (목표: 60% ✅)
- Functions: 78% (목표: 70% ✅)
- Lines: 80%

### Test Quality: 4/5
- ✅ Happy path 테스트 완료
- ✅ 에러 케이스 테스트 존재
- ⚠️ 경계값 테스트 일부 누락
- ✅ 비동기 처리 올바름

### Test Structure: 5/5
- ✅ AAA 패턴 일관 적용
- ✅ describe 블록 논리적 구조
- ✅ 테스트 간 독립성 보장
- ✅ 공통 setup 적절히 분리

### Mock Quality: 4/5
- ✅ API 모킹 완료
- ✅ Firebase 모킹 완료
- ⚠️ 일부 하드코딩된 mock 데이터
- ✅ 타이머 모킹 적절

### RN Specific: 3/5
- ✅ RNTL 사용
- ⚠️ testID 과용 (getByTestId 빈번)
- ⚠️ 접근성 쿼리 사용 부족
- ✅ renderHook 올바르게 사용

**종합 점수**: 0.82 (B)

**개선 제안**:
1. getByRole, getByLabelText 등 접근성 쿼리로 전환
2. 경계값 테스트 케이스 추가
3. mock 데이터를 팩토리 패턴으로 생성
```
