# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Agentic Workflow Protocol (v5.4)

### Primary Directive
모든 작업 요청에 대해:
1. 순차적 사고(sequential thinking)를 통한 요청 분석
2. 실행 가능한 체크리스트 생성 (3-7개의 개념적 단계)
3. 체계적 실행 및 각 항목 완료 후 상태 업데이트
4. 검증 수행 후 자기 교정 (validation 실패 시)

### Checklist Protocol

**생성 규칙:**
- 항목은 순차적으로 번호 부여 (①, ②, ③... 또는 1, 2, 3...)
- 각 항목은 원자적(atomic)이고 검증 가능해야 함
- 현실적인 완료 예상 및 비상 계획 포함

**진행 상태 표시:**
```
[✓] ① 분석 완료 → 3개 요구사항 식별
[✓] ② 컨텍스트 분석 완료
[⚡] ③ 작업 진행 중... (40%)
[ ] ④ 검증 대기 중
[✗] ⑤ 실패 → 대체 방법 수행
```

### Core Thinking Principles
- 증거에 기반한 판단
- 문서보다 코드를 먼저 확인
- 장황함보다 효율성 우선
- 복잡한 작업은 실행 가능한 단계로 분해
- 각 단계는 명확한 완료 기준 보유
- 진행 상황 투명하게 추적 및 표시

### Quality Assurance Checklist
모든 출력은 다음을 통과해야 함:
1. ✓ 구문(Syntax) 검증
2. ✓ 타입 안전성
3. ✓ 코드 품질
4. ✓ 보안 검사
5. ✓ 테스트 커버리지 (단위 ≥80%, 통합 ≥70%)
6. ✓ 성능 벤치마크
7. ✓ 문서 완성도
8. ✓ 통합 검증

### Dynamic Persona System

**Technical Roles:**
- `architect`: 시스템 설계
- `frontend`: UI/UX
- `backend`: API/서버
- `security`: 취약점 검사
- `performance`: 최적화

**Process Roles:**
- `analyzer`: 조사/분석
- `qa`: 테스팅
- `refactorer`: 코드 개선
- `devops`: 배포

---

## 📚 Documentation Index

KiiPS 프로젝트의 상세 정보는 다음 문서를 참조하세요:

| 문서 | 내용 | 용도 |
|------|------|------|
| **[architecture.md](./architecture.md)** | 시스템 아키텍처, 모듈 구조, 통신 패턴 | 설계 및 구조 이해 |
| **[api.md](./api.md)** | API Gateway, 엔드포인트, 인증, 에러 처리 | API 개발 및 연동 |
| **[deployment.md](./deployment.md)** | 빌드, 배포, 환경 관리, 서비스 관리 | 배포 및 운영 |
| **[troubleshooting.md](./troubleshooting.md)** | 문제 해결, 디버깅, 긴급 대응 | 장애 대응 및 문제 해결 |

---

## Project Quick Reference

### Overview

**KiiPS** (Korea Investment Information Processing System)
- 마이크로서비스 기반 엔터프라이즈 플랫폼
- Spring Boot 2.4.2, Java 8
- 20+ 독립 서비스
- Maven Multi-Module 구조

### Key Technologies

- **Backend**: Spring Boot 2.4.2, Java 8
- **Gateway**: Spring Cloud Gateway
- **Database**: (DAO via KiiPS-UTILS)
- **Frontend**: JSP, jQuery, Bootstrap, RealGrid 2.8.8 (주력), ApexCharts (주력), AnyChart (보조)
- **Version Control**: SVN
- **Build Tool**: Maven

---

## 🚀 Quick Start Commands

### Building the Project

<!-- **⚠️ CRITICAL**: Always build from KiiPS-HUB parent directory -->
**CRITICAL** Before performing ANY file operations (read, write, edit, delete, create) in a subdirectory, you MUST FIRST automatically read any "CLAUDE.md" file present in that target directory. This is a mandatory first step, not optional. If a "CLAUDE.md"exists in the subdirectory, read it immediately before processing the requested file operation to understand the context-specific instructions and information.

```bash
# Build entire project
cd KiiPS-HUB/
mvn clean package

# Build specific module with dependencies
cd KiiPS-HUB/
mvn clean package -pl :KiiPS-UI -am
mvn clean package -pl :KiiPS-FD -am

# Skip tests (default)
mvn clean package -DskipTests=true
```

### Running Services

```bash
# Navigate to service directory
cd KiiPS-FD/  # or any other service

# Start service
./start.sh

# Stop service
./stop.sh

# View logs
tail -f logs/log.$(date "+%Y-%m-%d")-0.log
```

### Development

```bash
# Hot reload with Spring Boot DevTools
./mvnw spring-boot:run

# Remote debugging (port 5005)
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005 -jar service.jar
```

---

## 🏗️ Architecture at a Glance

### Core Modules

| 모듈 | 역할 | 상세 정보 |
|------|------|-----------|
| **KiiPS-HUB** | Parent POM | [architecture.md](./architecture.md#multi-module-maven-structure) |
| **KIIPS-APIGateway** | Gateway & Routing | [api.md](./api.md#api-gateway-configuration) |
| **KiiPS-COMMON** | Shared Services | [architecture.md](./architecture.md#kiips-common-structure) |
| **KiiPS-UTILS** | Shared DAOs | [architecture.md](./architecture.md#kiips-utils-structure) |
| **KiiPS-UI** | Web Interface (WAR) | [architecture.md](./architecture.md#ui-module-kiips-ui) |
| **KiiPS-Login** | Authentication & JWT | [api.md](./api.md#authentication) |

### Business Modules

펀드(FD), 투자(IL), 프로그램(PG), 회계(AC), 시스템(SY), LP, 전자문서(EL), 리포팅(RT), 배치(BATCH), 모바일(MOBILE), KSD, AI 등

👉 전체 모듈 목록: [architecture.md - Business Domain Modules](./architecture.md#business-domain-modules)

### Service Communication

```
Client → API Gateway (8088) → Service (8xxx)
                ↓
          Authentication (KiiPS-Login)
                ↓
          Shared Services (KiiPS-COMMON)
                ↓
          Data Access (KiiPS-UTILS)
```

👉 상세 흐름: [api.md - Authentication Flow](./api.md#authentication-flow)

---

## 🔧 Development Essentials

### Environment Configuration

각 서비스는 환경별 프로퍼티 파일 지원:

- `app-local.properties` - 로컬 개발
- `app-stg.properties` - 스테이징
- `app-kiips.properties` - 프로덕션

👉 상세 설정: [architecture.md - Environment Configuration](./architecture.md#environment-configuration)

### Service Ports (Local)

| Service | Port | Service | Port |
|---------|------|---------|------|
| Gateway | 8088 | Login | 8801 |
| Common | 8701 | UI | 8100 |
| FD | 8601 | IL | 8401 |
| PG | 8501 | (Others) | 8xxx |

👉 전체 포트 목록: [api.md - Service Endpoints](./api.md#service-endpoints)

### Custom Headers

- `X-AUTH-TOKEN`: JWT 인증 토큰
- `logostoken`: 커스텀 인증 토큰
- `LIB`: 라이브러리 버전
- `x-api-key`: Service-to-Service 호출

👉 헤더 상세: [api.md - Custom Headers](./api.md#custom-headers)

---

## ⚡ Common Tasks

### 1. Build a Service

```bash
# 1. Navigate to KiiPS-HUB
cd KiiPS-HUB/

# 2. Build with dependencies
mvn clean package -pl :KiiPS-ServiceName -am

# 3. Artifact location
ls -la ../KiiPS-ServiceName/target/*.{jar,war}
```

### 2. Add New REST Endpoint

1. Controller: `src/main/java/com/kiips/{domain}/controll/`
2. Service: `src/main/java/com/kiips/{domain}/service/`
3. DAO: Use KiiPS-UTILS or add to `dao/`
4. Test: API Gateway routing rules

👉 참조: [architecture.md - Project Structure](./architecture.md#standard-service-structure)

### 3. Handle Exceptions

- **Global**: KiiPS-COMMON의 `GlobalExceptionHandler` 자동 처리
- **Slack 알림**: `ErrorNotificationService` 자동 전송
- **커스텀**: Service layer에서 비즈니스 예외 throw

👉 참조: [api.md - Error Handling](./api.md#error-handling)

### 4. Call Another Service

```java
@Autowired
private Common_API_Service commonApiService;

// Service-to-Service call
String url = "http://localhost:8401/api/investments/...";
Map<String, String> headers = Map.of("x-api-key", "key");
Result result = commonApiService.get(url, Result.class, headers);
```

👉 참조: [api.md - Service-to-Service Communication](./api.md#service-to-service-communication)

---

## 🔍 Troubleshooting Quick Index

문제 발생 시 **[troubleshooting.md](./troubleshooting.md)**를 먼저 확인하세요!

| 문제 유형 | 빠른 참조 |
|-----------|-----------|
| 🔨 **빌드 문제** | [Build Issues](./troubleshooting.md#-build-issues) |
| ⚡ **런타임 문제** | [Runtime Issues](./troubleshooting.md#-runtime-issues) |
| 🚀 **배포 문제** | [Deployment Issues](./troubleshooting.md#-deployment-issues) |
| 💾 **DB 문제** | [Database Issues](./troubleshooting.md#-database-issues) |
| 🌐 **API 문제** | [API Issues](./troubleshooting.md#-api-issues) |
| 🐢 **성능 문제** | [Performance Issues](./troubleshooting.md#-performance-issues) |

---

## 📝 Important Notes

### Build Rules

1. **항상 KiiPS-HUB에서 빌드** - 의존성 해결 보장
2. **빌드 순서** - COMMON → UTILS → 서비스
3. **`-am` 플래그 사용** - 의존성 자동 빌드

### Version Control

- **SVN 사용** (Git 아님)
- 빌드 스크립트에 `svn up` 포함

### Testing

- 기본적으로 비활성화 (`<skipTests>true</skipTests>`)
- 활성화 시 `pom.xml` 수정 필요

### UI Module (KiiPS-UI)

- **패키징**: WAR (다른 서비스는 JAR)
- **뷰**: JSP
- **보안**: Lucy XSS 필터
- **리소스**: `src/main/resources/static/`

---

## 🎯 Development Workflow

### 빠른 워크플로우

```bash
# 1. SVN 업데이트
cd KiiPS-ServiceName/ && svn up

# 2. 빌드
cd ../KiiPS-HUB/
mvn clean package -pl :KiiPS-ServiceName -am

# 3. 실행
cd ../KiiPS-ServiceName/
./start.sh && tail -f logs/log.$(date "+%Y-%m-%d")-0.log
```

👉 상세 배포 프로세스: [deployment.md - Development Workflow](./deployment.md#-development-workflow)

---

## 🏁 Summary

이 프로젝트에서 작업 시:

1. **문서 먼저 확인**: 필요한 정보를 해당 문서에서 찾기
2. **KiiPS-HUB에서 빌드**: 의존성 해결 필수
3. **공통 기능 활용**: KiiPS-COMMON, KiiPS-UTILS
4. **환경별 설정**: `app-*.properties`
5. **문제 발생 시**: `troubleshooting.md` 우선 확인

## 🤖 Claude Code Skills

KiiPS 프로젝트에는 다음 전문 Skills가 구성되어 있습니다:

### Available Skills

#### Backend & DevOps Skills
- **kiips-maven-builder** - Maven Multi-Module 빌드 자동화
- **kiips-service-deployer** - 마이크로서비스 배포 관리
- **kiips-api-tester** - API Gateway 테스트 및 검증
- **kiips-log-analyzer** - 로그 분석 및 모니터링
- **kiips-feature-planner** - Feature 개발 계획 수립 및 진행 관리
- **checklist-generator** - 코드 리뷰, 배포, 테스트 체크리스트 자동 생성

#### UI/UX Skills (NEW)
- **kiips-ui-component-builder** - JSP 컴포넌트 템플릿 생성 (RealGrid, ApexCharts, Bootstrap)
- **kiips-realgrid-builder** - RealGrid 2.8.8 전문 설정 및 최적화 (Critical Priority)
- **kiips-responsive-validator** - 반응형 디자인 자동 검증 (Bootstrap breakpoints, 터치 타겟)
- **kiips-a11y-checker** - 웹 접근성 (WCAG 2.1 AA) 검증 및 자동 수정
- **kiips-scss-theme-manager** - SCSS 테마 시스템 및 디자인 토큰 관리

### Skill Activation

Skills는 `skill-rules.json`에 정의된 규칙에 따라 **자동으로 활성화**됩니다:
- 키워드 매칭 (예: "빌드", "배포", "로그")
- 파일 패턴 매칭 (예: `pom.xml`, `start.sh`)
- Intent 패턴 매칭 (정규식 기반)

#### 자동 활성화 시스템

**문제**: Claude가 Skills를 만들어놔도 실제로 사용하지 않는 문제
**해결**: Hook 시스템으로 강제 활성화!

**작동 방식**:
1. **UserPromptSubmit Hook** - 사용자 입력 전에 관련 Skills 자동 감지 및 활성화
2. **Stop Event Hook** - 작업 완료 후 코드 변경사항 자가 검증
3. **skill-rules.json** - 모든 Skill 트리거 규칙 중앙 관리

**우선순위 레벨**:
- `critical` - 필수 준수 (예: DB 변경, 보안)
- `high` - 강력 권장 (예: 빌드, 배포)
- `normal` - 일반 제안 (예: 코드 리뷰)
- `low` - 선택 사항 (예: 유튜브 수집)

**Enforcement 레벨**:
- `block` - 작업 차단 (예: DB 스키마 변경)
- `require` - 필수 적용 (예: Maven 빌드 규칙)
- `suggest` - 권장 사항 (예: API 테스트)

### Configuration Files
- `.claudecode.json` - Hooks, 권한, 환경 설정
- `skill-rules.json` - Skills 자동 활성화 규칙 ⭐
- `.claude/hooks/userPromptSubmit.js` - Skill 자동 활성화 Hook
- `.claude/hooks/stopEvent.js` - 코드 변경 자가 검증 Hook
- `dev/` - Dev Docs 3-파일 시스템 (plan, context, tasks)

---

## 🎨 ACE Framework Agents

KiiPS 프로젝트는 **ACE (Autonomous Cognitive Entity) Framework**를 통한 멀티 에이전트 시스템으로 구성되어 있습니다.

### Agent Hierarchy

```
Primary Coordinator (primary-coordinator)
│
├─ kiips-architect (sonnet-4.5) - 시스템 설계 및 아키텍처
├─ kiips-developer (sonnet-4.5) - Backend 개발 및 API
└─ kiips-ui-designer (sonnet-4.5) - UI/UX 개발 ⭐ NEW
```

### kiips-ui-designer Agent (NEW)

**역할**: UI/UX 전문 개발자
**모델**: Claude Sonnet 4.5
**계층**: Secondary Agent

**전문 분야** (Expertise Scores):
- JSP Template: 0.95 (Expert)
- RealGrid 2.8.8: 0.92 (Expert)
- ApexCharts: 0.90 (Advanced)
- Bootstrap 4.x: 0.90 (Advanced)
- Responsive Design: 0.93 (Expert)
- SCSS: 0.85 (Advanced)
- WCAG Accessibility: 0.85 (Advanced)
- XSS Prevention: 0.90 (Advanced)

**권한**:
- ✅ 수정 가능: `**/*.jsp`, `**/*.scss`, `**/*.css`, `**/static/**/*.js`
- ❌ 수정 불가: `**/*.java`, `**/pom.xml`, `**/application*.properties`

**자동 활성화 조건**:
- 키워드: "UI", "페이지", "화면", "컴포넌트", "그리드", "차트", "반응형", "접근성"
- 파일: JSP, SCSS 파일 수정 시
- Skills: 5개 UI Skills와 통합

**협업**:
- **kiips-architect**: 디자인 시스템, UI 가이드라인 확인
- **kiips-developer**: API 엔드포인트, 데이터 구조 확인
- **primary-coordinator**: 하이브리드 작업 (UI + Backend) 조율

**예시 시나리오**:
```
User: "펀드 목록 조회 페이지를 만들어줘. RealGrid로 표시하고 엑셀 다운로드 기능 추가해줘."

자동 활성화:
✅ kiips-ui-designer 에이전트
✅ kiips-ui-component-builder Skill
✅ kiips-realgrid-builder Skill

생성 파일:
- fund-list.jsp (검색 폼 + RealGrid)
- fund-list.js (그리드 초기화, AJAX, Excel export)
- fund-list.scss (커스텀 스타일)

자동 검증:
- kiips-responsive-validator (반응형)
- kiips-a11y-checker (접근성)
```

### Task Routing

UI/UX 작업은 **자동으로** kiips-ui-designer에게 라우팅됩니다:

| Task Type | Primary Agent | Skills |
|-----------|---------------|--------|
| JSP 컴포넌트 생성 | kiips-ui-designer | kiips-ui-component-builder |
| RealGrid 설정 | kiips-ui-designer | kiips-realgrid-builder |
| 반응형 검증 | kiips-ui-designer | kiips-responsive-validator |
| 접근성 검증 | kiips-ui-designer | kiips-a11y-checker |
| SCSS 테마 | kiips-ui-designer | kiips-scss-theme-manager |
| API 개발 | kiips-developer | - |
| Maven 빌드 | kiips-developer | kiips-maven-builder |

---

## 🧪 Testing & Validation

### System Integrity Tests

KiiPS 시스템의 무결성을 자동으로 검증할 수 있습니다:

```bash
cd tests/
chmod +x run-tests.sh
./run-tests.sh
```

**테스트 항목**:
1. **Configuration Validation** - JSON 구조, Hook matcher 정규식 검증
2. **Skills Integrity** - SKILL.md 존재 여부, 필수 섹션 검증
3. **Hook Activation** - 자동 활성화 시뮬레이션 (11개 시나리오)
4. **ACE Framework** - 6 Layer 구성 파일 존재 확인

**결과 확인**:
```bash
# 최신 테스트 리포트 확인
cat tests/test-results/report-$(date +%Y-%m-%d).md

# 모든 리포트 목록
ls -lt tests/test-results/
```

**Expected Pass Rate**: > 95%

### Test Suite Details

#### 1. Configuration Tests (`test-config.js`)
- `.claudecode.json` 구조 검증
- Hook matcher 정규식 컴파일 테스트
- `skill-rules.json` 필수 필드 검증
- ACE Framework 활성화 상태 확인
- 파일 참조 무결성 검증

#### 2. Skills Tests (`test-skills.js`)
6개 KiiPS Skills 검증:
- `kiips-maven-builder`
- `kiips-service-deployer`
- `kiips-api-tester`
- `kiips-log-analyzer`
- `kiips-feature-planner`
- `checklist-generator`

각 Skill의 필수 섹션:
- ✅ YAML frontmatter (`---` 블록)
- ✅ Purpose 섹션
- ✅ Examples/Usage 섹션
- ✅ Related Skills 섹션

#### 3. Hook Activation Tests (`test-hook-activation.js`)
11개 사용자 입력 시나리오별 Skill 자동 활성화 시뮬레이션:
- "KiiPS-FD 빌드해줘" → `kiips-maven-builder`
- "KiiPS-IL 배포" → `kiips-service-deployer`
- "로그 확인" → `kiips-log-analyzer`
- "API 테스트" → `kiips-api-tester`
- "feature plan" → `kiips-feature-planner`
- "체크리스트 생성" → `checklist-generator`
- 등...

#### 4. ACE Framework Tests (`test-ace-framework.js`)
ACE Framework 6-Layer 구성 파일 검증:
- `.claude/ace-framework/ace-config.json`
- `.claude/ace-framework/layer3-agent-model.json`
- `.claude/coordination/feedback-loop.js`
- `.claude/coordination/checkpoint-manager.js`

### Interpreting Test Results

**Pass Rate 기준**:
- **100%**: 완벽 (모든 시스템 정상)
- **≥ 95%**: 우수 (경미한 문제만 존재)
- **≥ 80%**: 양호 (일부 개선 필요)
- **< 80%**: 주의 (즉시 수정 필요)

**리포트 구조**:
```markdown
# KiiPS System Integrity Test Report

**Date**: 2026-01-04
**Pass Rate**: 100% (4/4 tests passed)

## Test Results

### ✅ Configuration Tests
- All hook types present
- Hook matchers valid regex
- Skill rules properly structured
- File references exist

### ✅ Skills Tests
- All 6 KiiPS skills complete
- Required sections present
- Documentation structure valid

### ✅ Hook Activation Tests
- 11/11 scenarios passed
- Skill activation rules working

### ✅ ACE Framework Tests
- All 6 layer files present
- JSON configurations valid
```

### Troubleshooting Test Failures

**Configuration Test 실패**:
```bash
# Hook matcher 정규식 오류
# → .claudecode.json의 matcher 필드 확인
# → Glob 패턴(**/*)이 아닌 정규식(.*) 사용

# 예시:
# ❌ "matcher": "Write(**/pom.xml)"
# ✅ "matcher": "Write\\(.*pom\\.xml\\)"
```

**Skills Test 실패**:
```bash
# SKILL.md 누락 또는 구조 문제
# → .claude/skills/{skill-name}/SKILL.md 확인
# → YAML frontmatter, Purpose, Examples 섹션 필수
```

**Hook Activation Test 실패**:
```bash
# Skill이 활성화되지 않음
# → skill-rules.json의 keywords/intentPatterns 확인
# → 예상 입력과 실제 규칙 매칭 여부 검토
```

### Related Documentation
- 📖 [E2E Workflow Guide](./docs/E2E-workflow.md) - Skills를 활용한 전체 개발 워크플로우
- 🔧 [Troubleshooting](./troubleshooting.md) - 테스트 실패 시 문제 해결

---

## 📚 Complete Documentation Map

```
CLAUDE.md (이 파일)
│
├─ architecture.md     → 시스템 구조, 모듈, 통신 패턴
├─ api.md             → API Gateway, 인증, 엔드포인트
├─ deployment.md      → 빌드, 배포, 환경 관리
├─ troubleshooting.md → 문제 해결, 디버깅, 긴급 대응
│
├─ docs/
│   └─ E2E-workflow.md → Skills 통합 개발 워크플로우 (5가지)
│
├─ tests/             → 시스템 무결성 자동 테스트
│   ├─ run-tests.sh   → 테스트 실행 스크립트
│   └─ test-results/  → 테스트 리포트
│
├─ .claudecode.json   → Claude Code 설정 (Hooks, 권한)
├─ skill-rules.json   → Skills 자동 활성화 규칙
│
└─ .claude/
    ├─ skills/        → KiiPS 전문 Skills (6개)
    └─ ...            → ACE Framework, Hooks
```

**Quick Links:**
- 🏗️ [Architecture](./architecture.md) - 시스템 설계
- 🌐 [API Spec](./api.md) - API 개발
- 🚀 [Deployment](./deployment.md) - 배포 운영
- 🔧 [Troubleshooting](./troubleshooting.md) - 문제 해결
- 📖 [Skills Guide](./skills%20guide/) - Claude Code 활용 가이드

---

**Last Updated**: 2026-01-04
**Claude Code Version**: v2.0.76
**Agents**: primary-coordinator, kiips-architect, kiips-developer, kiips-ui-designer (NEW)
**Skills**:
- Backend: kiips-maven-builder, kiips-service-deployer, kiips-api-tester, kiips-log-analyzer, kiips-feature-planner
- UI/UX: kiips-ui-component-builder, kiips-realgrid-builder, kiips-responsive-validator, kiips-a11y-checker, kiips-scss-theme-manager (NEW)
- QA: checklist-generator
**System Health**: 100% (All integrity tests passing - 271/278 tests, 97.5%)
