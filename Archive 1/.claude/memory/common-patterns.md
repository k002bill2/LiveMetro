# KiiPS 공통 패턴

## REST Controller 패턴

```java
@RestController
@RequestMapping("/api/v1/funds")
public class FundController {

    @Autowired
    private FundService fundService;

    @PostMapping("/create")
    public ResponseEntity<?> createFund(@RequestBody FundDTO fund) {
        try {
            return ResponseEntity.ok(fundService.createFund(fund));
        } catch (Exception e) {
            // GlobalExceptionHandler가 자동으로 처리
            throw e;
        }
    }
}
```

## Service Layer 패턴

```java
@Service
public class FundService {

    @Autowired
    private TB_FD_FUND_DAO fundDAO;

    @Autowired
    private ErrorNotificationService notificationService;

    public FundDTO createFund(FundDTO fund) {
        try {
            // Business logic
            fundDAO.insert(fund);
            return fund;
        } catch (Exception e) {
            notificationService.sendSlackNotification(
                "펀드 생성 실패", e, "P1"
            );
            throw e;
        }
    }
}
```

## DAO 사용 패턴

```java
// KiiPS-UTILS의 DAO 활용
@Autowired
private TB_FD_FUND_DAO fundDAO;

// CRUD 작업
fundDAO.insert(fund);
fundDAO.update(fund);
fundDAO.delete(fundId);
List<Fund> funds = fundDAO.selectList(searchDTO);
```

## 예외 처리 패턴

```java
// GlobalExceptionHandler가 자동으로 처리
// - Slack 알림
// - 로그 기록
// - 사용자 친화적 에러 메시지 반환

throw new NullPointerException("Critical error"); // P0
throw new RuntimeException("High priority error"); // P1
throw new Exception("Medium priority error"); // P2
```

## 환경별 설정 패턴

```properties
# app-local.properties
server.port=8601
api.gateway.url=http://localhost:8000
database.url=jdbc:mysql://localhost:3306/kiips_local

# app-stg.properties
server.port=8601
api.gateway.url=http://stg-gateway:8000
database.url=jdbc:mysql://stg-db:3306/kiips_stg
```

## API 게이트웨이 라우팅

```yaml
# API Gateway에서 요청 라우팅
# Pattern: /api/v1/{service}/** → http://{service}:port/**

/api/v1/funds/** → KiiPS-FD:8601
/api/v1/investments/** → KiiPS-IL:8401
/api/v1/programs/** → KiiPS-PG:8201
```

## 공통 헤더 사용

```javascript
// JWT 인증
headers: {
    'X-AUTH-TOKEN': token,
    'logostoken': customToken,
    'Content-Type': 'application/json'
}
```

## 로깅 패턴

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

private static final Logger logger = LoggerFactory.getLogger(ClassName.class);

logger.debug("Debug message");
logger.info("Info message");
logger.warn("Warning message");
logger.error("Error message", exception);
```

## UI JSP 패턴

```jsp
<%@ page language="java" contentType="text/html; charset=UTF-8" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>

<script>
$(document).ready(function() {
    // jQuery 초기화
    loadFundData();
});

function loadFundData() {
    $.ajax({
        url: '/api/v1/funds/list',
        method: 'GET',
        headers: {
            'X-AUTH-TOKEN': getToken()
        },
        success: function(data) {
            renderFundTable(data);
        },
        error: function(xhr, status, error) {
            showErrorMessage('데이터 로드 실패');
        }
    });
}
</script>
```

## 보안 패턴

```java
// Lucy XSS Filter 사용 (KiiPS-UI)
// 자동으로 모든 요청에 적용됨

// SQL Injection 방지 (MyBatis 사용)
// Prepared Statement 자동 사용

// 인증/인가
// JWT 토큰 검증 (KiiPS-Login)
// API Gateway에서 토큰 검증
```
