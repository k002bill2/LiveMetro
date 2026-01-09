# KiiPS API Specification

> 이 문서는 KiiPS 시스템의 API Gateway 설정, 엔드포인트, 인증 방식을 포함합니다.
> 메인 컨텍스트: [CLAUDE.md](./CLAUDE.md) | 아키텍처: [architecture.md](./architecture.md)

---

## API Gateway Configuration

### CORS Configuration

API Gateway (`cors.yml`)는 크로스 오리진 요청을 허용하도록 설정되어 있습니다:

```yaml
allowedOrigins: "*"
allowedHeaders:
  - x-requested-with
  - authorization
  - content-type
  - X-AUTH-TOKEN
  - logostoken
  - LIB
  - x-api-key
allowedMethods:
  - POST
  - GET
  - PUT
  - OPTIONS
```

### Custom Headers

KiiPS 전체에서 사용되는 커스텀 헤더:

| 헤더명 | 용도 | 예시 |
|--------|------|------|
| `X-AUTH-TOKEN` | JWT 인증 토큰 | `Bearer eyJhbGciOiJIUzI1NiIs...` |
| `logostoken` | 커스텀 인증 토큰 | 서비스별 토큰 값 |
| `LIB` | 라이브러리 버전 표시자 | `v1.0.0` |
| `x-api-key` | 서비스 간 API 키 | Service-to-Service 호출용 |

---

## Service Endpoints

### Port Allocation

각 서비스는 표준 포트 할당 패턴을 따릅니다 (`app-*.properties`에 설정):

| 서비스 | 포트 | 설명 | 환경별 설정 |
|--------|------|------|------------|
| **API Gateway** | 8000 | 모든 요청의 진입점 | app-local.properties |
| **Login** | 8801 | 인증 및 JWT 토큰 관리 | app-local.properties |
| **Common** | 8701 | 공통 서비스 (알림, API 클라이언트) | app-local.properties |
| **UI** | 8100 | JSP 웹 인터페이스 | app-local.properties |
| **FD** | 8601 | 펀드 관리 | app-local.properties |
| **IL** | 8401 | 투자 서비스 | app-local.properties |
| **PG** | 8201 | 프로그램 관리 | app-local.properties |
| **AC** | 8xxx | 회계 서비스 | app-local.properties |
| **SY** | 8xxx | 시스템 관리 | app-local.properties |
| **LP** | 8xxx | LP 관리 | app-local.properties |
| **EL** | 8xxx | 전자문서 | app-local.properties |
| **RT** | 8xxx | 리포팅 | app-local.properties |

> **참고**: 8xxx 패턴을 따르며, 충돌을 피하기 위해 각 서비스별로 고유 포트 할당

### Environment-Specific URLs

각 서비스는 환경별 프로퍼티 파일을 통해 URL을 설정합니다:

**로컬 개발 (app-local.properties):**
```properties
server.port=8601
api.gateway.url=http://localhost:8000
login.service.url=http://localhost:8801
```

**스테이징 (app-stg.properties):**
```properties
server.port=8601
api.gateway.url=http://stg-api.kiips.co.kr:8000
login.service.url=http://stg-login.kiips.co.kr:8801
```

**프로덕션 (app-kiips.properties):**
```properties
server.port=8601
api.gateway.url=https://api.kiips.co.kr
login.service.url=https://login.kiips.co.kr
```

---

## Authentication

### Authentication Flow

```
┌─────────┐         ┌──────────────┐         ┌─────────────┐
│ Client  │         │ API Gateway  │         │ Login Svc   │
└────┬────┘         └──────┬───────┘         └──────┬──────┘
     │                     │                        │
     │  1. POST /login     │                        │
     ├────────────────────>│                        │
     │                     │  2. Forward to Login   │
     │                     ├───────────────────────>│
     │                     │                        │
     │                     │  3. JWT Token          │
     │                     │<───────────────────────┤
     │  4. Return Token    │                        │
     │<────────────────────┤                        │
     │                     │                        │
     │  5. API Call with   │                        │
     │     X-AUTH-TOKEN    │                        │
     ├────────────────────>│                        │
     │                     │  6. Validate Token     │
     │                     ├───────────────────────>│
     │                     │                        │
     │                     │  7. Token Valid        │
     │                     │<───────────────────────┤
     │                     │                        │
     │                     │  8. Route to Service   │
     │                     ├─────────────────>      │
```

### JWT Token Management

**토큰 생성 (KiiPS-Login):**
1. 사용자 자격 증명 검증
2. JWT 토큰 생성 (사용자 정보, 권한, 만료 시간 포함)
3. 클라이언트에 토큰 반환

**토큰 사용:**
```http
GET /api/funds/list HTTP/1.1
Host: api.kiips.co.kr
X-AUTH-TOKEN: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

또는

```http
GET /api/funds/list HTTP/1.1
Host: api.kiips.co.kr
logostoken: custom-token-value
Content-Type: application/json
```

**토큰 검증:**
- API Gateway가 모든 요청의 토큰을 검증
- 유효하지 않거나 만료된 토큰 → 401 Unauthorized
- 검증 성공 → 해당 서비스로 라우팅

---

## Error Handling

### Global Exception Handler

KiiPS-COMMON의 `GlobalExceptionHandler`가 모든 서비스에 예외 처리 제공:

**예외 심각도 레벨:**

| 레벨 | 예외 타입 | 우선순위 | Slack 알림 |
|------|-----------|----------|------------|
| **P0 (Critical)** | `NullPointerException` | 즉시 대응 필요 | ✅ 즉시 |
| **P1 (High)** | `RuntimeException` | 높은 우선순위 | ✅ 높음 |
| **P2 (Medium)** | `Exception` | 표준 우선순위 | ✅ 표준 |

**에러 응답 형식:**

```json
{
  "success": false,
  "errorCode": "KIIPS_ERR_500",
  "message": "서버 내부 오류가 발생했습니다.",
  "timestamp": "2025-12-26T10:30:00.000Z",
  "path": "/api/funds/list",
  "details": {
    "service": "KiiPS-FD",
    "environment": "production"
  }
}
```

### Slack Notification System

**알림 트리거:**
- Critical 에러 (NullPointerException)
- Runtime 예외
- 일반 예외
- 커스텀 비즈니스 로직 에러

**알림 내용:**
```
🚨 [P0 CRITICAL] KiiPS-FD Error
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment: Production
Service: KiiPS-FD
Exception: NullPointerException
Message: Cannot invoke method on null object

Stack Trace:
  at com.kiips.fd.service.FundService.getFundList(FundService.java:123)
  at com.kiips.fd.controller.FundController.list(FundController.java:45)
  ...

Request Context:
  Path: /api/funds/list
  Method: GET
  User: user@kiips.co.kr
  Timestamp: 2025-12-26 10:30:00
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## API Gateway Routing

### Routing Rules

API Gateway는 경로 기반 라우팅을 사용합니다:

| 경로 패턴 | 대상 서비스 | 포트 | 설명 |
|-----------|-------------|------|------|
| `/api/login/**` | KiiPS-Login | 8801 | 인증 관련 |
| `/api/funds/**` | KiiPS-FD | 8601 | 펀드 관리 |
| `/api/investments/**` | KiiPS-IL | 8401 | 투자 관리 |
| `/api/programs/**` | KiiPS-PG | 8201 | 프로그램 관리 |
| `/api/accounting/**` | KiiPS-AC | 8xxx | 회계 |
| `/api/lp/**` | KiiPS-LP | 8xxx | LP 관리 |
| `/api/documents/**` | KiiPS-EL | 8xxx | 전자문서 |
| `/api/reports/**` | KiiPS-RT | 8xxx | 리포팅 |

### Load Balancing

- 현재 단일 인스턴스 배포
- 향후 다중 인스턴스 시 API Gateway가 라운드 로빈 방식으로 로드 밸런싱

---

## Service-to-Service Communication

### API Clients (KiiPS-COMMON)

서비스 간 통신을 위한 공통 API 클라이언트:

**Common_API_Service:**
- 범용 REST API 호출
- 자동 헤더 추가 (`x-api-key`)
- 재시도 로직 내장

**Login_API_Service:**
- 토큰 검증
- 사용자 정보 조회

**MAIL_API_Service:**
- 이메일 발송
- 템플릿 렌더링

**SMS_API_Service:**
- SMS 발송
- 대량 발송 지원

**PUSH_API_Service:**
- 푸시 알림 발송
- FCM 연동

**Bank_API_Service:**
- 은행 API 연동
- 계좌 조회, 이체 등

### Example: Service-to-Service Call

```java
@Service
public class FundService {

    @Autowired
    private Common_API_Service commonApiService;

    public InvestmentInfo getInvestmentInfo(String fundId) {
        // KiiPS-IL 서비스 호출
        String url = "http://localhost:8401/api/investments/by-fund/" + fundId;
        Map<String, String> headers = new HashMap<>();
        headers.put("x-api-key", "service-to-service-key");

        return commonApiService.get(url, InvestmentInfo.class, headers);
    }
}
```

---

## External API Integration

### Bank API
- **모듈**: Bank_API_Service (KiiPS-COMMON)
- **기능**: 계좌 조회, 거래 내역, 이체
- **인증**: API Key + 인증서

### Email Service
- **모듈**: MAIL_API_Service (KiiPS-COMMON)
- **프로토콜**: SMTP
- **템플릿 엔진**: Thymeleaf

### SMS Service
- **모듈**: SMS_API_Service (KiiPS-COMMON)
- **제공업체**: (설정 파일 참조)
- **기능**: 단일/대량 발송

### Push Notification
- **모듈**: PUSH_API_Service (KiiPS-COMMON)
- **프로토콜**: FCM (Firebase Cloud Messaging)
- **플랫폼**: Android, iOS

### KSD Integration
- **모듈**: KIIPS-KSD
- **기능**: 증권 예탁원 연동
- **데이터**: 주식 정보, 거래 정보

### E-Government
- **모듈**: KIIPS-EGOVDOCUMENT
- **기능**: 전자정부 문서 연동
- **표준**: 행정전자서명

---

## API Best Practices

### Request/Response Format

**요청 예시:**
```http
POST /api/funds/create HTTP/1.1
Host: api.kiips.co.kr
X-AUTH-TOKEN: eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "fundName": "코오롱 벤처펀드 1호",
  "fundType": "VC",
  "totalAmount": 10000000000,
  "managerId": "MGR001"
}
```

**성공 응답:**
```json
{
  "success": true,
  "data": {
    "fundId": "FD20250001",
    "fundName": "코오롱 벤처펀드 1호",
    "fundType": "VC",
    "totalAmount": 10000000000,
    "managerId": "MGR001",
    "createdAt": "2025-12-26T10:30:00.000Z"
  },
  "message": "펀드가 성공적으로 생성되었습니다."
}
```

**에러 응답:**
```json
{
  "success": false,
  "errorCode": "FUND_DUPLICATE",
  "message": "이미 존재하는 펀드명입니다.",
  "timestamp": "2025-12-26T10:30:00.000Z",
  "path": "/api/funds/create"
}
```

### Pagination

```http
GET /api/funds/list?page=1&size=20&sort=createdAt,desc HTTP/1.1
```

**응답:**
```json
{
  "success": true,
  "data": {
    "content": [...],
    "page": 1,
    "size": 20,
    "totalElements": 157,
    "totalPages": 8
  }
}
```

### Rate Limiting

- 현재 구현되지 않음
- 향후 API Gateway 레벨에서 구현 예정
- 계획: 분당 1000 요청 제한
