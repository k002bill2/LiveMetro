# KiiPS Troubleshooting Guide

> 이 문서는 KiiPS 개발 및 운영 중 발생할 수 있는 문제들의 해결 방법을 포함합니다.
> 메인 컨텍스트: [CLAUDE.md](./CLAUDE.md) | 아키텍처: [architecture.md](./architecture.md) | 배포: [deployment.md](./deployment.md)

---

## 🚨 Quick Problem Finder

문제 유형별로 빠르게 찾기:
- [빌드 문제](#-build-issues) - Maven, 의존성, 컴파일 에러
- [런타임 문제](#-runtime-issues) - 서비스 시작, 포트, 연결 실패
- [배포 문제](#-deployment-issues) - 배포 스크립트, SVN, 권한
- [데이터베이스 문제](#-database-issues) - 연결, 쿼리, 트랜잭션
- [API 문제](#-api-issues) - Gateway, 인증, CORS
- [성능 문제](#-performance-issues) - 메모리, CPU, 응답 지연
- [로그 & 디버깅](#-logging--debugging) - 로그 확인, 디버깅 방법

---

## 🔨 Build Issues

### 문제: Module not found 또는 Dependency resolution failed

**증상:**
```
[ERROR] Failed to execute goal on project KiiPS-FD:
Could not resolve dependencies for project com.kiips:KiiPS-FD:jar:0.0.1-SNAPSHOT
```

**원인:**
- KiiPS-HUB가 아닌 다른 디렉토리에서 빌드 시도
- COMMON 또는 UTILS 모듈이 빌드되지 않음

**해결 방법:**

```bash
# ✅ 올바른 빌드 (KiiPS-HUB에서)
cd /path/to/KiiPS-HUB/
mvn clean package -pl :KiiPS-FD -am

# ❌ 잘못된 빌드 (서비스 디렉토리에서)
cd /path/to/KiiPS-FD/
mvn clean package  # 의존성 해결 실패
```

**상세 해결 단계:**

1. KiiPS-HUB로 이동
2. 의존성 모듈 먼저 빌드
3. 타겟 모듈 빌드

```bash
cd KiiPS-HUB/

# 1. COMMON 빌드
mvn clean install -pl :KiiPS-COMMON -am

# 2. UTILS 빌드
mvn clean install -pl :KiiPS-UTILS -am

# 3. 타겟 서비스 빌드
mvn clean package -pl :KiiPS-FD -am
```

---

### 문제: Tests are failing

**증상:**
```
[ERROR] Tests run: 15, Failures: 3, Errors: 2, Skipped: 0
```

**원인:**
- 테스트 환경 설정 누락
- 테스트 데이터베이스 미실행

**해결 방법:**

**옵션 1: 테스트 스킵 (기본 설정)**

```bash
mvn clean package -DskipTests=true
```

또는 `pom.xml`에서:

```xml
<properties>
    <skipTests>true</skipTests>
</properties>
```

**옵션 2: 테스트 환경 설정**

```properties
# src/test/resources/application-test.properties
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driver-class-name=org.h2.Driver
spring.jpa.hibernate.ddl-auto=create-drop
```

```bash
mvn clean test -Dspring.profiles.active=test
```

---

### 문제: Compilation error - cannot find symbol

**증상:**
```
[ERROR] /path/to/Controller.java:[45,8] cannot find symbol
  symbol:   class SomeService
  location: class com.kiips.fd.controller.FundController
```

**원인:**
- Import 문 누락
- 의존성 모듈(COMMON/UTILS)의 클래스 변경

**해결 방법:**

1. Import 추가 확인
2. 의존성 모듈 재빌드

```bash
# COMMON 재빌드
cd KiiPS-HUB/
mvn clean install -pl :KiiPS-COMMON -am

# IDE에서 Maven 프로젝트 Reload (IntelliJ/Eclipse)
# IntelliJ: Right-click pom.xml → Maven → Reload Project
```

---

### 문제: OutOfMemoryError during build

**증상:**
```
[ERROR] Java heap space
```

**해결 방법:**

```bash
# Maven 힙 메모리 증가
export MAVEN_OPTS="-Xmx2048m -XX:MaxPermSize=512m"
mvn clean package
```

또는 `.mvn/jvm.config` 파일 생성:

```
-Xmx2048m
-XX:MaxPermSize=512m
```

---

## ⚡ Runtime Issues

### 문제: Port already in use

**증상:**
```
***************************
APPLICATION FAILED TO START
***************************

Description:
Web server failed to start. Port 8601 was already in use.
```

**해결 방법:**

**옵션 1: 기존 프로세스 종료**

```bash
# 포트 사용 프로세스 찾기
lsof -i :8601

# 출력 예시:
# COMMAND   PID  USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
# java    12345  user   45u  IPv6  xxxxx      0t0  TCP *:8601 (LISTEN)

# 프로세스 종료
kill 12345

# 또는 강제 종료
kill -9 12345
```

**옵션 2: 포트 변경**

```properties
# app-local.properties
server.port=8602
```

**옵션 3: 서비스 정상 종료**

```bash
cd /deployment/service/
./stop.sh
```

---

### 문제: Service won't start - No main manifest attribute

**증상:**
```
no main manifest attribute, in KiiPS-FD.jar
```

**원인:**
- JAR 파일이 실행 가능한 형태로 패키징되지 않음
- Spring Boot Maven Plugin 설정 누락

**해결 방법:**

`pom.xml` 확인:

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
        </plugin>
    </plugins>
</build>
```

재빌드:

```bash
cd KiiPS-HUB/
mvn clean package -pl :KiiPS-FD -am
```

---

### 문제: ClassNotFoundException for shared classes

**증상:**
```
java.lang.ClassNotFoundException: com.kiips.common.service.Common_API_Service
```

**원인:**
- COMMON 또는 UTILS 모듈이 최신 버전이 아님
- 의존성이 JAR에 포함되지 않음

**해결 방법:**

```bash
# 1. COMMON 재빌드 (install로 로컬 저장소에 배포)
cd KiiPS-HUB/
mvn clean install -pl :KiiPS-COMMON -am

# 2. UTILS 재빌드
mvn clean install -pl :KiiPS-UTILS -am

# 3. 타겟 서비스 재빌드
mvn clean package -pl :KiiPS-FD -am

# 4. 의존성 확인
mvn dependency:tree -pl :KiiPS-FD | grep COMMON
```

---

### 문제: Service can't connect to other services

**증상:**
```
org.springframework.web.client.ResourceAccessException:
I/O error on GET request for "http://localhost:8801/api/login/validate"
```

**원인:**
- API Gateway 미실행
- 타겟 서비스 미실행
- URL 설정 오류

**해결 방법:**

**1. API Gateway 실행 확인**

```bash
# Gateway 프로세스 확인
ps aux | grep APIGateway

# Gateway 포트 확인
lsof -i :8000

# Gateway 시작
cd /deployment/apigateway/
./start.sh
```

**2. 타겟 서비스 실행 확인**

```bash
# Login 서비스 확인
lsof -i :8801

# Login 서비스 시작
cd /deployment/login/
./start.sh
```

**3. URL 설정 확인**

```properties
# app-local.properties
login.service.url=http://localhost:8801

# app-kiips.properties
login.service.url=https://login.kiips.co.kr
```

---

## 🚀 Deployment Issues

### 문제: Build script fails

**증상:**
```
./build_FD.sh: line 15: mvn: command not found
```

**원인:**
- Maven이 PATH에 없음
- 스크립트 실행 권한 없음

**해결 방법:**

**Maven PATH 확인:**

```bash
# Maven 설치 확인
which mvn

# PATH에 추가 (필요시)
export PATH=$PATH:/path/to/maven/bin

# 또는 ~/.bashrc 또는 ~/.zshrc에 추가
echo 'export PATH=$PATH:/usr/local/maven/bin' >> ~/.bashrc
source ~/.bashrc
```

**실행 권한 확인:**

```bash
# 권한 확인
ls -l build_FD.sh

# 실행 권한 부여
chmod +x build_FD.sh
```

---

### 문제: SVN update fails

**증상:**
```
svn: E155004: Working copy '/path/to/KiiPS-FD' locked
```

**해결 방법:**

```bash
# SVN cleanup
svn cleanup

# 여전히 실패 시 강제 업데이트
svn cleanup --remove-unversioned
svn update --force
```

---

### 문제: Service won't start after deployment

**증상:**
서비스 시작 후 즉시 종료됨

**해결 방법:**

**1. 로그 확인**

```bash
# 최근 로그 확인
tail -100 logs/log.$(date "+%Y-%m-%d")-0.log

# 에러 로그만 확인
grep -i error logs/log.$(date "+%Y-%m-%d")-0.log
```

**2. Java 버전 확인**

```bash
# Java 버전 (Java 8 필수)
java -version

# 잘못된 버전 사용 시 JAVA_HOME 설정
export JAVA_HOME=/usr/lib/jvm/java-8-openjdk
export PATH=$JAVA_HOME/bin:$PATH
```

**3. 포트 가용성 확인**

```bash
# 포트 사용 확인
lsof -i :8601

# 사용 중이면 프로세스 종료
```

**4. 설정 파일 확인**

```bash
# 프로퍼티 파일 존재 확인
ls -l app-*.properties

# 문법 오류 확인 (trailing spaces, invalid characters 등)
cat -A app-kiips.properties
```

---

## 💾 Database Issues

### 문제: Could not open connection to database

**증상:**
```
org.springframework.jdbc.CannotGetJdbcConnectionException:
Failed to obtain JDBC Connection
```

**원인:**
- 데이터베이스 서버 미실행
- 연결 정보 오류
- 방화벽 차단

**해결 방법:**

**1. 데이터베이스 연결 테스트**

```bash
# Oracle 연결 테스트 (sqlplus 사용)
sqlplus kiips_user/password@//db-host:1521/KIIPSDB

# 또는 tnsping
tnsping KIIPSDB
```

**2. 연결 정보 확인**

```properties
# app-local.properties
spring.datasource.url=jdbc:oracle:thin:@localhost:1521:KIIPSDB
spring.datasource.username=kiips_user
spring.datasource.password=correct_password
spring.datasource.driver-class-name=oracle.jdbc.OracleDriver
```

**3. 방화벽 확인**

```bash
# 포트 접근 테스트
telnet db-host 1521

# 또는 nc (netcat)
nc -zv db-host 1521
```

---

### 문제: ORA-01017: invalid username/password

**해결 방법:**

```bash
# 환경 변수에서 비밀번호 로드 확인
echo $DB_PASSWORD

# .env 파일 확인
cat .env | grep DB_PASSWORD

# 하드코딩된 비밀번호 확인 (보안상 비권장)
grep -r "datasource.password" app-*.properties
```

---

### 문제: Too many connections

**증상:**
```
ORA-12516: TNS:listener could not find available handler
```

**해결 방법:**

**커넥션 풀 설정 조정:**

```properties
# app-kiips.properties
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
```

**기존 연결 확인:**

```sql
-- Oracle에서 현재 세션 확인
SELECT username, count(*)
FROM v$session
WHERE username IS NOT NULL
GROUP BY username;

-- 세션 종료 (DBA 권한 필요)
ALTER SYSTEM KILL SESSION 'sid,serial#';
```

---

## 🌐 API Issues

### 문제: 401 Unauthorized

**증상:**
```
{
  "timestamp": "2025-12-26T10:30:00.000Z",
  "status": 401,
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

**원인:**
- JWT 토큰 만료
- 토큰 헤더 누락
- 토큰 형식 오류

**해결 방법:**

**1. 토큰 재발급**

```bash
# 로그인 API 호출
curl -X POST http://localhost:8801/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@kiips.co.kr","password":"password"}'

# 응답에서 토큰 추출
# { "token": "eyJhbGciOiJIUzI1NiIs..." }
```

**2. 토큰 포함하여 요청**

```bash
# X-AUTH-TOKEN 헤더 사용
curl -X GET http://localhost:8000/api/funds/list \
  -H "X-AUTH-TOKEN: eyJhbGciOiJIUzI1NiIs..."

# 또는 logostoken 헤더
curl -X GET http://localhost:8000/api/funds/list \
  -H "logostoken: your-token-here"
```

**3. 토큰 디코딩 (디버깅용)**

```bash
# JWT 토큰 디코딩 (jwt.io 또는 jq 사용)
echo "eyJhbGciOiJIUzI1NiIs..." | cut -d. -f2 | base64 -d | jq .
```

---

### 문제: CORS error

**증상:**
```
Access to XMLHttpRequest at 'http://localhost:8000/api/funds/list'
from origin 'http://localhost:3000' has been blocked by CORS policy
```

**해결 방법:**

**API Gateway CORS 설정 확인:**

```yaml
# cors.yml (API Gateway)
spring:
  cloud:
    gateway:
      globalcors:
        corsConfigurations:
          '[/**]':
            allowedOrigins: "*"
            allowedMethods:
              - GET
              - POST
              - PUT
              - DELETE
              - OPTIONS
            allowedHeaders:
              - "*"
            allowCredentials: false
```

**프리플라이트 요청 확인:**

```bash
# OPTIONS 요청 테스트
curl -X OPTIONS http://localhost:8000/api/funds/list \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

---

### 문제: 404 Not Found for existing endpoint

**원인:**
- API Gateway 라우팅 규칙 미설정
- Context path 불일치

**해결 방법:**

**1. Gateway 라우팅 확인**

```yaml
# application.yml (API Gateway)
spring:
  cloud:
    gateway:
      routes:
        - id: kiips-fd
          uri: http://localhost:8601
          predicates:
            - Path=/api/funds/**
```

**2. Context path 확인**

```properties
# KiiPS-FD의 app-local.properties
server.servlet.context-path=/fd

# 올바른 URL
http://localhost:8601/fd/api/funds/list (직접 호출)
http://localhost:8000/api/funds/list (Gateway 경유)
```

---

## 🐢 Performance Issues

### 문제: OutOfMemoryError in production

**증상:**
```
java.lang.OutOfMemoryError: Java heap space
```

**해결 방법:**

**1. 힙 덤프 분석**

```bash
# 힙 덤프 생성 (서비스 재시작 전)
jmap -dump:format=b,file=heapdump.hprof <PID>

# 힙 덤프 분석 (MAT 또는 VisualVM 사용)
# Eclipse Memory Analyzer (MAT)
# https://www.eclipse.org/mat/
```

**2. JVM 옵션 조정**

```bash
# start.sh에서 힙 메모리 증가
JVM_OPTS="-Xms2g -Xmx4g -XX:+UseG1GC"
```

**3. 메모리 누수 확인**

```bash
# GC 로그 활성화
JVM_OPTS="$JVM_OPTS -Xloggc:gc.log -XX:+PrintGCDetails -XX:+PrintGCDateStamps"

# GC 로그 분석
tail -f gc.log
```

---

### 문제: Slow API response

**증상:**
API 응답 시간이 5초 이상 소요

**해결 방법:**

**1. 데이터베이스 쿼리 최적화**

```sql
-- 느린 쿼리 찾기 (Oracle)
SELECT sql_text, elapsed_time, executions
FROM v$sql
WHERE elapsed_time > 1000000
ORDER BY elapsed_time DESC;

-- 실행 계획 확인
EXPLAIN PLAN FOR
SELECT * FROM TB_FD_FUND WHERE fund_id = 'FD001';

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```

**2. 인덱스 추가**

```sql
-- 누락된 인덱스 추가
CREATE INDEX idx_fund_id ON TB_FD_FUND(fund_id);
```

**3. 커넥션 풀 튜닝**

```properties
# 커넥션 풀 크기 증가
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=10
```

**4. 애플리케이션 프로파일링**

```bash
# Java Flight Recorder 활성화
java -XX:+UnlockCommercialFeatures \
     -XX:+FlightRecorder \
     -XX:StartFlightRecording=duration=60s,filename=recording.jfr \
     -jar service.jar
```

---

## 📋 Logging & Debugging

### 로그 레벨 동적 변경

```bash
# Actuator를 통한 로그 레벨 변경 (운영 중)
curl -X POST http://localhost:8601/actuator/loggers/com.kiips.fd \
  -H "Content-Type: application/json" \
  -d '{"configuredLevel": "DEBUG"}'
```

### 원격 디버깅 설정

```bash
# 디버그 모드로 서비스 시작
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005 \
  -jar KiiPS-FD.jar
```

**IntelliJ 원격 디버깅 설정:**
1. Run → Edit Configurations
2. + → Remote JVM Debug
3. Host: localhost, Port: 5005
4. Start debugging

### 유용한 로그 검색 패턴

```bash
# 특정 사용자의 액션 추적
grep "user@kiips.co.kr" logs/log.$(date "+%Y-%m-%d")-0.log

# SQL 쿼리만 추출
grep "Hibernate:" logs/log.$(date "+%Y-%m-%d")-0.log

# 에러와 직전 10줄 컨텍스트
grep -B 10 "ERROR" logs/log.$(date "+%Y-%m-%d")-0.log

# 특정 시간대 로그
grep "2025-12-26 14:" logs/log.2025-12-26-0.log
```

---

## 🆘 Emergency Procedures

### 서비스 전체 재시작

```bash
#!/bin/bash
# restart_all.sh

SERVICES=("apigateway" "login" "common" "fd" "il" "pg" "ui")

for svc in "${SERVICES[@]}"; do
  echo "Restarting $svc..."
  cd /deployment/$svc/
  ./stop.sh
  sleep 2
  ./start.sh
  sleep 5
done

echo "All services restarted."
```

### 긴급 롤백

```bash
# 백업에서 모든 서비스 복원
cd /deployment/backup/$(date -d "yesterday" +%Y%m%d)/
./restore_all.sh
```

### 데이터베이스 연결 긴급 복구

```sql
-- 모든 유휴 세션 종료
BEGIN
  FOR rec IN (SELECT sid, serial# FROM v$session WHERE status = 'INACTIVE' AND username = 'KIIPS_USER') LOOP
    EXECUTE IMMEDIATE 'ALTER SYSTEM KILL SESSION ''' || rec.sid || ',' || rec.serial# || ''' IMMEDIATE';
  END LOOP;
END;
/
```

---

## 📞 Support Contacts

| 담당 영역 | 담당자 | 연락처 |
|-----------|--------|--------|
| 인프라 | Infra Team | #kiips-infra |
| 데이터베이스 | DBA Team | #kiips-db |
| API Gateway | Backend Team | #kiips-backend |
| 프론트엔드 | UI Team | #kiips-frontend |
| 긴급 장애 | On-call | #kiips-emergency |

---

## 📚 Additional Resources

- [Architecture Guide](./architecture.md)
- [API Specification](./api.md)
- [Deployment Guide](./deployment.md)
- [Spring Boot Docs](https://docs.spring.io/spring-boot/docs/2.4.2/reference/html/)
- [Oracle Documentation](https://docs.oracle.com/en/database/)

---

**문제가 해결되지 않았나요?**
Slack #kiips-dev 채널에 다음 정보와 함께 문의하세요:
- 에러 메시지 전문
- 로그 스니펫 (최근 50줄)
- 재현 단계
- 환경 정보 (local/stg/prod)
