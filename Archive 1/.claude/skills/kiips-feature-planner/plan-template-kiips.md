# Feature Plan: [기능명]

**Status**: 🔄 진행 중 | ✅ 완료 | ⏸️ 보류
**Started**: YYYY-MM-DD
**Last Updated**: YYYY-MM-DD
**Estimated Completion**: YYYY-MM-DD
**Service**: KiiPS-[ServiceName]
**Developer**: [담당자명]

---

## ⚠️ 진행 규칙

**각 Phase 완료 후 반드시**:
1. ✅ Task 체크박스 완료 표시
2. 🔧 Quality Gate 검증 (빌드 + 시작 + 테스트)
3. 📅 "Last Updated" 날짜 업데이트
4. 📝 이슈 발생 시 Notes 섹션 기록
5. 💾 SVN 커밋 (`svn commit -m "Phase X complete"`)
6. ➡️ 모든 검증 통과 후 다음 Phase 진행

⛔ **Quality Gate 실패 시 다음 Phase 진행 금지**

---

## 📋 Feature 개요

### 기능 설명
[이 기능이 무엇을 하는지, 왜 필요한지 설명]

**예시**:
- 신규 펀드 검색 필터 추가 (펀드명, 운용사, 설정일 기준)
- 투자심사 승인 워크플로우 개선
- LP 포털 데이터 연동 API 구축

### 완료 기준 (Success Criteria)
- [ ] 기준 1: [명확하고 측정 가능한 기준]
- [ ] 기준 2: [예: API 응답시간 < 500ms]
- [ ] 기준 3: [예: UI에서 정상 동작 확인]

### 사용자 영향 (User Impact)
[이 기능으로 사용자가 얻는 이점]

---

## 🏗️ 기술 환경

### 영향받는 서비스
- **Primary Service**: KiiPS-[ServiceName] (Port: 8xxx)
- **Dependencies**:
  - [ ] KiiPS-COMMON (공통 서비스)
  - [ ] KiiPS-UTILS (DAO)
  - [ ] KiiPS-Login (인증 필요 시)
  - [ ] API Gateway (라우팅 변경 필요 시)
  - [ ] KiiPS-UI (UI 연동 필요 시)

### 개발 환경 체크리스트
- [ ] Java 8 확인: `java -version`
- [ ] Maven 설정: `mvn -v`
- [ ] SVN 최신 상태: `svn up`
- [ ] IDE 설정 완료 (IntelliJ/Eclipse)
- [ ] 로컬 DB 접속 확인 (필요 시)

### 환경별 설정 파일
- **Local**: `app-local.properties`
- **Staging**: `app-stg.properties`
- **Production**: `app-kiips.properties`

---

## 🚀 구현 Phase

### Phase 1: [Phase 명] - 핵심 비즈니스 로직
**Goal**: [이 Phase가 제공하는 구체적인 기능]
**Estimated Time**: 1-3 hours
**Status**: ⏳ 대기 | 🔄 진행 중 | ✅ 완료

#### Tasks
- [ ] **Task 1.1**: Service layer 구현
  - File: `src/main/java/com/kiips/{domain}/service/[Name]Service.java`
  - Details: [구현할 비즈니스 로직 설명]

- [ ] **Task 1.2**: DAO 구현 또는 KiiPS-UTILS DAO 활용
  - File: `src/main/java/com/kiips/{domain}/dao/[Name]Dao.java`
  - Details: [데이터베이스 쿼리 로직]

- [ ] **Task 1.3**: DTO/Entity 클래스 작성
  - File: `src/main/java/com/kiips/{domain}/dto/` 또는 `domain/`
  - Details: [필요한 데이터 구조]

#### Quality Gate ✋

**⚠️ STOP: 다음 항목 모두 통과 필요**

**Build Verification**:
```bash
cd KiiPS-HUB/
mvn clean package -pl :KiiPS-ServiceName -am
```
- [ ] 빌드 성공 (compilation errors 없음)
- [ ] target/ 디렉토리에 JAR/WAR 생성 확인
- [ ] 의존성 해결 완료

**Deployment Check**:
```bash
cd ../KiiPS-ServiceName/
./start.sh
tail -f logs/log.$(date "+%Y-%m-%d")-0.log
```
- [ ] 서비스 정상 시작 (Spring context loaded)
- [ ] 로그에 Exception/Error 없음
- [ ] Health check 통과: `curl http://localhost:PORT/actuator/health`

**Manual Test**:
- [ ] 기능 동작 확인 (Postman/curl 또는 직접 테스트)
- [ ] Edge case 테스트 (예: null 값, 빈 리스트)
- [ ] 기존 기능 정상 동작 (regression check)

**Code Quality**:
- [ ] 코드 리뷰 가능한 수준
- [ ] 주석 추가 (복잡한 로직)
- [ ] 변수명/메서드명 명확
- [ ] SQL Injection/XSS 취약점 없음

**SVN Commit**:
```bash
svn status
svn diff | less  # 변경사항 검토
svn commit -m "Phase 1: [설명] - 핵심 비즈니스 로직 구현"
```
- [ ] SVN 커밋 완료

---

### Phase 2: [Phase 명] - API 엔드포인트
**Goal**: [이 Phase가 제공하는 구체적인 기능]
**Estimated Time**: 1-2 hours
**Status**: ⏳ 대기 | 🔄 진행 중 | ✅ 완료

#### Tasks
- [ ] **Task 2.1**: Controller 구현
  - File: `src/main/java/com/kiips/{domain}/controll/[Name]Controller.java`
  - Details: REST endpoint 생성 (GET/POST/PUT/DELETE)

- [ ] **Task 2.2**: Request/Response DTO 작성
  - File: `src/main/java/com/kiips/{domain}/dto/`
  - Details: API 입출력 데이터 구조

- [ ] **Task 2.3**: Exception Handling 추가
  - Details: GlobalExceptionHandler 활용 또는 커스텀 예외

#### Quality Gate ✋

**Build & Deploy**:
```bash
cd KiiPS-HUB/
mvn clean package -pl :KiiPS-ServiceName -am
cd ../KiiPS-ServiceName/
./stop.sh && sleep 2 && ./start.sh
```
- [ ] 빌드 및 재시작 성공

**API Test (Postman/curl)**:
```bash
# Example
curl -X POST http://localhost:8xxx/api/endpoint \
  -H "Content-Type: application/json" \
  -H "X-AUTH-TOKEN: test-token" \
  -d '{"key": "value"}'
```
- [ ] API 응답 정상 (200 OK)
- [ ] Response 형식 올바름
- [ ] 에러 처리 동작 확인 (400, 500 등)

**SVN Commit**:
```bash
svn commit -m "Phase 2: [설명] - API 엔드포인트 추가"
```
- [ ] SVN 커밋 완료

---

### Phase 3: [Phase 명] - API Gateway 연동
**Goal**: [이 Phase가 제공하는 구체적인 기능]
**Estimated Time**: 1 hour
**Status**: ⏳ 대기 | 🔄 진행 중 | ✅ 완료

#### Tasks
- [ ] **Task 3.1**: API Gateway 라우팅 설정
  - File: `KIIPS-APIGateway/src/main/resources/application.yml`
  - Details: 새로운 route 추가

- [ ] **Task 3.2**: JWT 인증 설정 (필요 시)
  - Details: 보호된 endpoint 설정

- [ ] **Task 3.3**: CORS 설정 확인 (UI 연동 시)

#### Quality Gate ✋

**Gateway Routing Test**:
```bash
# Through API Gateway (port 8000)
curl -X POST http://localhost:8000/api/endpoint \
  -H "Content-Type: application/json" \
  -H "X-AUTH-TOKEN: your-jwt-token" \
  -d '{"key": "value"}'
```
- [ ] Gateway를 통한 호출 성공
- [ ] 인증/인가 정상 동작
- [ ] 에러 응답 정상 (GlobalExceptionHandler)

**Error Notification Test**:
- [ ] Slack 알림 동작 확인 (ErrorNotificationService)

**SVN Commit**:
```bash
cd KIIPS-APIGateway/
svn commit -m "Phase 3: [설명] - API Gateway 라우팅 설정"
```
- [ ] SVN 커밋 완료

---

### Phase 4: [Phase 명] - UI 연동 (Optional)
**Goal**: [이 Phase가 제공하는 구체적인 기능]
**Estimated Time**: 2-3 hours
**Status**: ⏳ 대기 | 🔄 진행 중 | ✅ 완료

#### Tasks
- [ ] **Task 4.1**: JSP 페이지 작성
  - File: `KiiPS-UI/src/main/resources/templates/{path}/{name}.jsp`
  - Details: 화면 레이아웃

- [ ] **Task 4.2**: JavaScript/jQuery AJAX 구현
  - File: `KiiPS-UI/src/main/resources/static/js/` 또는 inline
  - Details: API 호출 로직

- [ ] **Task 4.3**: RealGrid/ApexCharts/AnyChart 적용 (필요 시)
  - Details: 그리드는 RealGrid 2.8.8 (라이선스 필요), 차트는 ApexCharts 또는 AnyChart 사용

#### Quality Gate ✋

**UI Test**:
- [ ] 페이지 정상 렌더링
- [ ] AJAX 호출 성공 (Network tab 확인)
- [ ] 데이터 정상 표시
- [ ] 브라우저 콘솔 에러 없음

**Lucy XSS Filter Check**:
- [ ] 입력값 XSS 필터링 동작 확인

**SVN Commit**:
```bash
cd KiiPS-UI/
svn commit -m "Phase 4: [설명] - UI 연동 완료"
```
- [ ] SVN 커밋 완료

---

### Phase 5: [Phase 명] - 에러 처리 & 성능 개선 (Optional)
**Goal**: [이 Phase가 제공하는 구체적인 기능]
**Estimated Time**: 1-2 hours
**Status**: ⏳ 대기 | 🔄 진행 중 | ✅ 완료

#### Tasks
- [ ] **Task 5.1**: 예외 처리 보강
  - Details: 모든 edge case 처리

- [ ] **Task 5.2**: 로깅 추가
  - Details: 디버깅을 위한 적절한 로그 레벨

- [ ] **Task 5.3**: 성능 최적화
  - Details: 쿼리 최적화, 캐싱 등

- [ ] **Task 5.4**: 코드 리팩토링
  - Details: 중복 제거, 가독성 향상

#### Quality Gate ✋

**Performance Check**:
- [ ] API 응답 시간 < 500ms (또는 목표 시간)
- [ ] 대용량 데이터 처리 확인 (해당 시)
- [ ] 메모리 사용량 정상

**Final Verification**:
- [ ] 전체 기능 end-to-end 테스트
- [ ] 에러 시나리오 테스트
- [ ] 로그 레벨 적절 (DEBUG → INFO)

**SVN Commit**:
```bash
svn commit -m "Phase 5: [설명] - 에러 처리 및 성능 개선"
```
- [ ] SVN 커밋 완료

---

## 🔄 Rollback Strategy

### Phase 1 실패 시
```bash
cd KiiPS-ServiceName/
svn revert -R .
svn up
```
- 변경사항: Service, DAO, DTO 파일 제거

### Phase 2 실패 시
```bash
svn update -r <Phase-1-revision>
```
- 변경사항: Controller, Request/Response DTO 제거

### Phase 3 실패 시
```bash
cd KIIPS-APIGateway/
svn revert application.yml
```
- 변경사항: Gateway 설정 원복

### Phase 4 실패 시
```bash
cd KiiPS-UI/
svn revert -R .
```
- 변경사항: JSP, JavaScript 파일 제거

---

## 📊 진행 상황 추적

### Phase 완료율
| Phase | 예상 시간 | 실제 시간 | 상태 |
|-------|----------|----------|------|
| Phase 1 | X hours | - | ⏳ |
| Phase 2 | X hours | - | ⏳ |
| Phase 3 | X hours | - | ⏳ |
| Phase 4 | X hours | - | ⏳ |
| Phase 5 | X hours | - | ⏳ |
| **Total** | **X hours** | **- hours** | **-** |

**Overall Progress**: 0% → 20% → 40% → 60% → 80% → 100%

---

## 📝 Notes & Issues

### 구현 중 발견사항
- [날짜] [발견한 이슈 또는 개선사항]
- [날짜] [배운 점 또는 주의사항]

### 해결된 문제
- **문제**: [문제 설명]
  - **원인**: [근본 원인]
  - **해결**: [해결 방법]

### 기술적 결정 사항
- **결정**: [무엇을 결정했는지]
  - **이유**: [왜 이렇게 결정했는지]
  - **Trade-off**: [포기한 대안과 그 이유]

---

## ⚠️ 위험 요소 (Risk Assessment)

| 위험 | 확률 | 영향도 | 대응 방안 |
|------|------|--------|-----------|
| [예: API 응답 시간 지연] | 중 | 높음 | [예: 쿼리 최적화, 인덱스 추가] |
| [예: 의존 서비스 장애] | 낮 | 높음 | [예: Timeout 설정, Circuit Breaker] |
| [예: DB 마이그레이션 실패] | 중 | 중간 | [예: Rollback SQL 준비] |

---

## ✅ 최종 완료 체크리스트

**배포 전 확인사항**:
- [ ] 모든 Phase Quality Gate 통과
- [ ] 전체 빌드 성공: `cd KiiPS-HUB/ && mvn clean package`
- [ ] 모든 의존 서비스 정상 동작 (Login, COMMON, UTILS)
- [ ] API Gateway 라우팅 검증
- [ ] UI 정상 동작 (해당 시)
- [ ] 에러 처리 및 로깅 적절
- [ ] 성능 요구사항 충족
- [ ] SVN 커밋 완료 (모든 Phase)
- [ ] 코드 리뷰 준비 완료
- [ ] 배포 문서 작성 (필요 시)

**환경별 배포 체크**:
- [ ] **Local**: 테스트 완료
- [ ] **Staging**: 배포 및 검증 완료
- [ ] **Production**: 배포 준비 완료 (승인 대기)

---

## 🧪 테스트 전략 (Optional - 미래 개선용)

**현재 상태**: 테스트 스킵 (`<skipTests>true</skipTests>`)

**향후 개선 시 고려사항**:

### Unit Tests (Service Layer)
```java
// Example structure
@Test
void shouldReturnFundList() {
    // Given
    FundSearchCriteria criteria = new FundSearchCriteria();

    // When
    List<Fund> result = fundService.search(criteria);

    // Then
    assertNotNull(result);
}
```

### Integration Tests (Controller)
```java
@SpringBootTest
@AutoConfigureMockMvc
class FundControllerTest {
    @Autowired MockMvc mockMvc;

    @Test
    void shouldReturnFunds() throws Exception {
        mockMvc.perform(get("/api/funds"))
            .andExpect(status().isOk());
    }
}
```

### Coverage Tool (JaCoCo)
```bash
# If enabled in pom.xml
mvn test jacoco:report -pl :KiiPS-ServiceName
open target/site/jacoco/index.html
```

---

## 📚 참고 자료

### 프로젝트 문서
- [Architecture](../../architecture.md) - 시스템 아키텍처
- [API Spec](../../api.md) - API 개발 가이드
- [Deployment](../../deployment.md) - 배포 프로세스
- [Troubleshooting](../../troubleshooting.md) - 문제 해결 가이드

### 관련 이슈/PR
- Issue #X: [설명]
- PR #Y: [설명]

### 외부 참고자료
- [링크] [설명]

---

**Plan Status**: 🔄 진행 중
**Next Action**: [다음에 할 작업]
**Blocked By**: [차단 요소] 또는 None
**Completion Date**: [완료 시 날짜 기록]
