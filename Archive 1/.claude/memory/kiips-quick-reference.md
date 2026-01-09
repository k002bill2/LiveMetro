# KiiPS Quick Reference

## 빠른 명령어

### 빌드
```bash
# KiiPS-HUB 디렉토리에서 실행
cd KiiPS-HUB/
mvn clean package -pl :KiiPS-<ServiceName> -am
```

### 서비스 실행
```bash
cd KiiPS-<ServiceName>/
./start.sh
./stop.sh
```

### 로그 확인
```bash
tail -f logs/log.$(date "+%Y-%m-%d")-0.log
```

## 주요 모듈

| 모듈 | 포트 | 역할 |
|------|------|------|
| KiiPS-APIGateway | 8000 | API 게이트웨이 |
| KiiPS-Login | 8801 | 인증/JWT |
| KiiPS-COMMON | 8701 | 공통 서비스 |
| KiiPS-UI | 8100 | 웹 UI |
| KiiPS-FD | 8601 | 펀드 관리 |
| KiiPS-IL | 8401 | 투자 관리 |
| KiiPS-PG | 8201 | 프로그램 관리 |

## 공통 서비스 (KiiPS-COMMON)

### ErrorNotificationService
- Slack 알림 전송
- 에러 레벨별 분류 (P0, P1, P2)

### GlobalExceptionHandler
- NullPointerException → Critical (P0)
- RuntimeException → High (P1)
- Exception → Medium (P2)

### API 클라이언트
- Common_API_Service
- Login_API_Service
- MAIL_API_Service
- SMS_API_Service
- Bank_API_Service

## 환경 설정

### 프로퍼티 파일
- `app-local.properties` - 로컬 개발
- `app-stg.properties` - 스테이징
- `app-kiips.properties` - 운영

### 빌드 시 주의사항
1. 항상 KiiPS-HUB에서 빌드
2. `-am` 플래그 사용 (의존성 자동 빌드)
3. COMMON, UTILS 먼저 빌드 필요

## 자주 사용하는 DAO (KiiPS-UTILS)

- TB_SY* - 시스템 테이블
- TB_PG* - 프로그램 테이블
- TB_IL* - 투자 테이블
- TB_FD* - 펀드 테이블

## 트러블슈팅

### 빌드 실패
- KiiPS-HUB에서 빌드했는지 확인
- `-am` 플래그 사용했는지 확인
- COMMON, UTILS가 먼저 빌드되었는지 확인

### 서비스 시작 실패
- 포트가 사용 중인지 확인: `lsof -i :<port>`
- 로그 파일 확인
- Java 버전 확인 (Java 8 필요)

### 의존성 문제
- parent POM 경로 확인 (`../KiiPS-HUB/pom.xml`)
- 모듈 간 버전 일치 확인

## 새 Claude Code 커맨드 (2025-12-12 추가)

| 커맨드 | 설명 |
|--------|------|
| `/dev-docs` | Dev Docs 3-파일 시스템 생성 |
| `/update-dev-docs` | Dev Docs 업데이트 (세션 종료 전) |
| `/review` | 종합 코드 리뷰 체크리스트 |

## 버전 정보

- **Claude Code CLI**: v2.0.67
- **Agent 모델**: Sonnet 4.5, Opus 4.5
- **마지막 업데이트**: 2025-12-12

