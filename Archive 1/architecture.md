# KiiPS Architecture

> 이 문서는 KiiPS 시스템의 아키텍처 상세 정보를 포함합니다.
> 메인 컨텍스트: [CLAUDE.md](./CLAUDE.md)

---

## System Overview

KiiPS (Korea Investment Information Processing System)는 벤처캐피탈 및 투자 운영 관리를 위한 마이크로서비스 기반 엔터프라이즈 플랫폼입니다.

- **아키텍처**: Multi-module Maven 마이크로서비스
- **프레임워크**: Spring Boot 2.4.2
- **Java 버전**: Java 8
- **서비스 수**: 20+ 독립 서비스
- **통신 방식**: REST API via API Gateway

---

## Multi-Module Maven Structure

### Parent POM: KiiPS-HUB

프로젝트는 **KiiPS-HUB**를 부모 POM으로 사용하여 모든 모듈을 관리합니다.
이는 의존성 해결 및 버전 관리에 필수적입니다.

### Core Modules

| 모듈 | 역할 | 패키징 |
|------|------|--------|
| **KiiPS-HUB** | Parent POM (Spring Boot 2.4.2, Java 8) | POM |
| **KIIPS-APIGateway** | Spring Cloud Gateway - 모든 서비스 요청 라우팅, CORS 설정 | JAR |
| **KiiPS-COMMON** | 공유 서비스 (ErrorNotificationService, GlobalExceptionHandler, API clients) | JAR |
| **KiiPS-UTILS** | 공유 DAO 및 데이터 액세스 레이어 | JAR |
| **KiiPS-UI** | JSP 기반 웹 인터페이스 레이어 | WAR |
| **KiiPS-Login** | 인증 및 JWT 토큰 관리 | JAR |

### Business Domain Modules

| 도메인 | 모듈 | 설명 |
|--------|------|------|
| **Fund** | KiiPS-FD | 펀드 관리 서비스 |
| **Investment** | KiiPS-IL | 투자 서비스 |
| **Program** | KiiPS-PG | 프로그램 관리 |
| **Accounting** | KiiPS-AC | 회계 서비스 |
| **System** | KiiPS-SY | 시스템 관리 |
| **LP** | KiiPS-LP | LP (Limited Partner) 관리 |
| **E-Document** | KiiPS-EL | 전자문서 서비스 |
| **Reporting** | KiiPS-RT | 리포팅 서비스 |
| **Transfer** | KIIPS-TRANSFER | 데이터 전송 서비스 |
| **Batch** | KIIPS-BATCH | 배치 처리 작업 |
| **SecureURL** | KIIPS-SECURL | 보안 URL 관리 |
| **Mobile** | KIIPS-MOBILE | 모바일 서비스 |
| **KSD** | KIIPS-KSD | KSD 연동 서비스 |
| **Help** | KIIPS-HELP | 도움말 및 문서 |
| **Lab** | KIIPS-LAB | 실험적 기능 |
| **E-Gov** | KIIPS-EGOVDOCUMENT | 전자정부 문서 연동 |
| **AI** | KIIPS-AI | AI 챗봇 서비스 |
| **Infra** | KIIPS-Infra-Admin | 인프라 관리 |

---

## Key Architectural Patterns

### 1. Microservices Communication
- 서비스 간 REST API를 통한 통신
- API Gateway를 통한 모든 외부 요청 라우팅
- Service-to-Service 호출 시 커스텀 헤더 사용

### 2. Shared Dependencies
모든 서비스는 공통 기능을 위해 KiiPS-COMMON과 KiiPS-UTILS에 의존:
- **KiiPS-COMMON**: 예외 처리, 알림, API 클라이언트
- **KiiPS-UTILS**: DAO 및 데이터베이스 액세스

### 3. Multi-environment Support
각 서비스는 환경별 프로퍼티 파일 지원:
- `app-local.properties`: 로컬 개발
- `app-stg.properties`: 스테이징 환경
- `app-kiips.properties`: 프로덕션 환경
- `app-shinhanvc.properties`: 신한VC 전용 (일부 서비스)

### 4. Global Exception Handling
KiiPS-COMMON의 GlobalExceptionHandler 제공:
- Slack 알림 통합
- 예외 심각도 레벨 (P0: Critical, P1: High, P2: Medium)
- 자동 에러 추적

### 5. Parent POM Pattern
모든 모듈은 `../KiiPS-HUB/pom.xml`을 parent로 참조 (`relativePath` 사용)

---

## Project Structure

### Standard Service Structure

각 마이크로서비스는 다음 패턴을 따릅니다:

```
KiiPS-{ServiceName}/
├── pom.xml                           # Maven 설정
├── app-local.properties              # 로컬 환경 설정
├── app-stg.properties                # 스테이징 환경 설정
├── app-kiips.properties              # 프로덕션 환경 설정
├── start.sh                          # 서비스 시작 스크립트
├── stop.sh                           # 서비스 중지 스크립트
├── build_{ServiceName}.sh            # 빌드 및 배포 스크립트
├── src/
│   ├── main/
│   │   ├── java/com/kiips/{domain}/
│   │   │   ├── {ServiceName}Application.java   # Spring Boot 메인 클래스
│   │   │   ├── config/               # 설정 클래스
│   │   │   ├── controll/             # REST 컨트롤러 (오타: controller)
│   │   │   ├── service/              # 비즈니스 로직
│   │   │   ├── dao/                  # Data Access Objects
│   │   │   ├── model/                # 도메인 모델
│   │   │   └── util/                 # 유틸리티 클래스
│   │   └── resources/
│   │       ├── application.properties
│   │       ├── logback-spring.xml    # 로깅 설정
│   │       └── static/               # 정적 리소스 (UI 서비스)
│   └── test/java/                    # 테스트 클래스
└── target/                           # 빌드 출력
```

### KiiPS-COMMON Structure

모든 서비스에서 공유되는 구조:

```
KiiPS-COMMON/src/main/java/com/kiips/common/
├── KiiPSApplication.java             # 기본 애플리케이션 클래스
├── config/                           # 공유 설정
├── controll/                         # 공유 컨트롤러
├── dao/                              # 공유 데이터 액세스
├── exception/
│   └── GlobalExceptionHandler.java   # 전역 예외 처리
├── service/
│   ├── ErrorNotificationService.java # Slack 에러 알림
│   ├── Common_API_Service.java       # 공통 API 클라이언트
│   ├── Login_API_Service.java        # 로그인 API 클라이언트
│   ├── MAIL_API_Service.java         # 이메일 서비스
│   ├── SMS_API_Service.java          # SMS 서비스
│   ├── PUSH_API_Service.java         # 푸시 알림 서비스
│   └── Bank_API_Service.java         # 은행 연동
├── model/                            # 공유 모델
└── util/                             # 공유 유틸리티
```

### KiiPS-UTILS Structure

모든 서비스에서 사용되는 테이블별 DAO 제공:

```
KiiPS-UTILS/src/main/java/kr/co/kiips/dao/
├── TB_SY*.java    # 시스템 테이블
├── TB_PG*.java    # 프로그램 테이블
├── TB_IL*.java    # 투자 테이블
├── TB_FD*.java    # 펀드 테이블
└── ...            # 기타 도메인 테이블
```

---

## Service Communication

### 통신 방식

1. **REST APIs**: 서비스 간 HTTP/JSON 통신
2. **API Gateway**: 모든 외부 요청은 KIIPS-APIGateway를 통해 라우팅
3. **Shared DAOs**: KiiPS-UTILS 의존성을 통한 데이터 액세스
4. **Common Services**: KiiPS-COMMON 의존성 (예외 처리, 알림, API 클라이언트)

### 서비스 포트 (기본 할당)

| 서비스 | 포트 |
|--------|------|
| API Gateway | 8000 |
| Login | 8801 |
| Common | 8701 |
| UI | 8100 |
| FD | 8601 |
| IL | 8401 |
| PG | 8201 |
| 기타 | 8xxx 패턴 |

---

## Integration Points

### External Systems

서비스 연동 대상:
- **은행**: KiiPS-COMMON의 Bank_API_Service 사용
- **이메일**: MAIL_API_Service
- **SMS**: SMS_API_Service
- **푸시 알림**: PUSH_API_Service
- **KSD**: KIIPS-KSD 모듈
- **전자정부**: KIIPS-EGOVDOCUMENT 모듈

### Authentication Flow

1. 사용자가 KiiPS-Login 서비스를 통해 인증
2. JWT 토큰 생성 및 반환
3. 이후 요청에 `X-AUTH-TOKEN` 또는 `logostoken` 헤더로 토큰 포함
4. API Gateway가 서비스 라우팅 전 토큰 검증

---

## Special Considerations

### Building Dependencies

1. **항상 KiiPS-HUB에서 빌드**: 올바른 의존성 해결 보장
2. **빌드 순서 중요**: 서비스 빌드 시 의존성 (COMMON, UTILS)이 먼저 빌드되어야 함
3. **`-am` 플래그 사용**: Maven의 "also make" 플래그로 의존성 자동 빌드

### UI Module (KiiPS-UI)

- **패키징**: WAR 파일 (서비스는 JAR)
- **뷰 기술**: JSP (`mappedfile=false`로 65KB 이상 JSP 파일 처리)
- **보안**: 모든 요청에 Lucy XSS 필터 활성화
- **정적 리소스**: `src/main/resources/static/`
- **프론트엔드 라이브러리**: jQuery, Bootstrap, DataTables, AmCharts, RealGrid

### Version Control

- 프로젝트는 **SVN** 사용 (Git 아님)
- 빌드 스크립트에 `svn up` 명령 포함

### Java Version

- **Java 8** 필수
- Maven compiler plugin: source/target 1.8 설정

### Testing

- 대부분 모듈에서 테스트 비활성화 (`<skipTests>true</skipTests>`)
- 테스트 활성화: `pom.xml` 설정 수정 필요

---

## Error Notification System

### Slack Integration

KiiPS-COMMON의 ErrorNotificationService가 Slack 알림 제공:

**알림 트리거:**
- Critical 에러 (NullPointerException)
- Runtime 예외
- 일반 예외
- 커스텀 비즈니스 로직 에러

**알림 내용:**
- 서비스명 및 환경
- 예외 타입 및 메시지
- 전체 스택 트레이스
- 요청 컨텍스트 (가능한 경우)

**심각도 레벨:**
1. **NullPointerException** → Critical (P0) - 즉시 Slack 알림
2. **RuntimeException** → High (P1) - 높은 우선순위 알림
3. **Exception** → Medium (P2) - 표준 알림
