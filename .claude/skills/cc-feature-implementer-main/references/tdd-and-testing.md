# TDD Workflow & Test Specification

Phase 단위로 기능을 분할할 때 각 phase가 따라야 하는 Red-Green-Refactor 절차와 테스트 유형 가이드.

## Test-First Workflow (Red-Green-Blue)

각 기능 컴포넌트마다:

1. **Specify Test Cases** (코드 작성 전)
   - 어떤 입력을 테스트할지
   - 기대 출력은 무엇인지
   - 어떤 엣지 케이스를 다뤄야 하는지
   - 어떤 에러 조건을 테스트할지

2. **Red Phase — 실패하는 테스트 작성**
   - 의도적으로 실패할 테스트 작성
   - 올바른 이유로 실패하는지 확인
   - 실패 확정 후 commit (TDD 컴플라이언스 추적)

3. **Green Phase — 최소 구현**
   - 테스트를 통과시키는 최소 코드만 작성
   - 2-5분마다 테스트 재실행
   - 통과하면 멈춤. 추가 기능 금지.

4. **Refactor (Blue) Phase**
   - 테스트가 녹색일 때만 품질 개선
   - 중복 제거, 네이밍 개선, 구조 정리
   - 단계마다 테스트 재실행
   - 리팩토링 완료 후 commit

## Test Types

| 종류 | 대상 | 의존성 | 속도 | 커버리지 |
|------|------|--------|------|---------|
| Unit | 함수/메서드/클래스 | mock/stub | <100ms | ≥80% 비즈니스 로직 |
| Integration | 모듈 간 상호작용 | 실제 의존성 일부 | <1s | 핵심 통합 지점 |
| E2E | 전체 사용자 워크플로우 | 실제 환경 | 초~분 | 핵심 사용자 여정 |

## Coverage Thresholds

| 영역 | 목표 |
|------|------|
| Business Logic | ≥90% (critical paths) |
| Data Access Layer | ≥80% (repositories, DAOs) |
| API / Controller | ≥70% (endpoints) |
| UI / Presentation | 통합 테스트 우선 (coverage보다) |

## Coverage Commands (생태계별)

```bash
# JavaScript/TypeScript
jest --coverage
nyc report --reporter=html

# Python
pytest --cov=src --cov-report=html
coverage report

# Java
mvn jacoco:report
gradle jacocoTestReport

# Go
go test -cover ./...
go tool cover -html=coverage.out

# .NET
dotnet test /p:CollectCoverage=true /p:CoverageReporter=html
reportgenerator -reports:coverage.xml -targetdir:coverage

# Ruby
bundle exec rspec --coverage
open coverage/index.html

# PHP
phpunit --coverage-html coverage
```

## 자주 쓰는 테스트 패턴

### Arrange-Act-Assert (AAA)
```
test 'description of behavior':
  // Arrange
  input = createTestData()

  // Act
  result = systemUnderTest.method(input)

  // Assert
  assert result == expectedOutput
```

### Given-When-Then (BDD)
```
test 'feature should behave in specific way':
  given userIsLoggedIn()
  when userClicksButton()
  then shouldSeeConfirmation()
```

### Mocking / Stubbing
```
mockService = createMock(ExternalService)
component = new Component(mockService)
when(mockService.method()).thenReturn(expectedData)
component.execute()
verify(mockService.method()).calledOnce()
```

## Per-Phase Test Documentation

각 phase 문서에 다음 6항목 명시:

1. **Test File Location** — 정확한 경로
2. **Test Scenarios** — 케이스 목록
3. **Expected Failures** — 초기 어떤 에러로 실패하는지
4. **Coverage Target** — 이 phase의 목표 %
5. **Dependencies to Mock** — 어떤 의존성을 mock할지
6. **Test Data** — 필요한 fixtures / factories
