# MCP 기반 로그 분석 자동화 가이드

**작성일**: 2025-12-31
**버전**: 1.0
**대상**: KiiPS 프로젝트 개발자 및 운영자

---

## 📋 목차

1. [시스템 개요](#-시스템-개요)
2. [설치 및 설정](#-설치-및-설정)
3. [사용 방법](#-사용-방법)
4. [아키텍처](#-아키텍처)
5. [트러블슈팅](#-트러블슈팅)
6. [FAQ](#-faq)

---

## 🎯 시스템 개요

KiiPS 로그 분석 자동화 시스템은 **MCP (Model Context Protocol)**와 **Node.js Daemon**을 사용하여 실시간으로 마이크로서비스 로그를 모니터링하고 분석합니다.

### 주요 기능

✅ **실시간 로그 모니터링**
- 모든 KiiPS 서비스의 로그 파일 자동 감시
- 파일 변경 감지 (debounced, 500ms)
- 새 로그 파일 자동 추가

✅ **자동 에러 분석**
- 8가지 에러 패턴 자동 매칭 (NullPointer, SQL, Timeout 등)
- 스택 트레이스 자동 수집
- 심각도별 분류 (Critical, Error, Warning)

✅ **성능 모니터링**
- Slow Query 감지 (threshold: 2000ms)
- API 응답시간 분석
- 서비스별 성능 메트릭

✅ **Dev Docs 자동 업데이트**
- `dev/active/log-analysis-summary.md` 자동 생성
- 에러 현황 요약 및 통계
- Action Items 자동 추출

✅ **MCP 통합**
- Claude Code가 filesystem MCP로 로그 파일 접근
- Dev Docs를 Claude가 자동으로 읽고 분석
- 대화형 로그 분석 지원

---

## 🚀 설치 및 설정

### 사전 요구사항

```bash
# Node.js (v14 이상)
node --version  # v23.11.0

# Python (serena용, 선택)
python3 --version  # Python 3.14.2

# uvx (serena용, 선택)
uvx --version
```

### 1. MCP 서버 설정 확인

`.mcp.json` 파일이 다음과 같이 설정되어 있는지 확인:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/younghwankang/WORK/WORKSPACE/KiiPS"],
      "disabled": false
    },
    "serena": {
      "disabled": false
    }
  }
}
```

**검증:**
```bash
bash .scripts/mcp-health-check.sh
```

### 2. Claude Code CLI 재시작

MCP 서버를 로드하려면 Claude Code CLI를 재시작하세요:

```bash
# CLI 종료 후 재시작
# MCP 서버가 자동으로 시작됩니다
```

### 3. 디렉토리 구조 확인

```
KiiPS/
├── .mcp.json                          # MCP 서버 설정
├── .scripts/
│   ├── mcp-health-check.sh            # MCP 상태 확인
│   └── monitoring/
│       ├── log-watcher-daemon.js      # 메인 daemon
│       ├── log-analyzer.js            # 분석 엔진
│       ├── dev-docs-updater.js        # Dev Docs 업데이트
│       ├── config.json                # 설정
│       ├── patterns.json              # 에러 패턴
│       └── start-monitor.sh           # 시작 스크립트
├── dev/
│   └── active/
│       └── log-analysis-summary.md    # 자동 생성됨
└── KiiPS-*/logs/                      # 서비스 로그
```

---

## 📖 사용 방법

### 기본 사용 (Daemon 시작)

#### 방법 1: Foreground 실행

```bash
cd /Users/younghwankang/WORK/WORKSPACE/KiiPS
bash .scripts/monitoring/start-monitor.sh
```

- 콘솔에 실시간 출력
- `Ctrl+C`로 중지

#### 방법 2: Background 실행 (권장)

```bash
# Daemon 시작
bash .scripts/monitoring/start-monitor.sh --background

# 상태 확인
bash .scripts/monitoring/start-monitor.sh --status

# 로그 확인
tail -f .scripts/monitoring/monitor.log

# Daemon 중지
bash .scripts/monitoring/start-monitor.sh --stop
```

### Dev Docs 확인

```bash
# 최신 분석 결과 보기
cat dev/active/log-analysis-summary.md

# 실시간 업데이트 감시
tail -f dev/active/log-analysis-summary.md
```

### Claude와 함께 사용

**1. Dev Docs 분석 요청**
```
"dev/active/log-analysis-summary.md 파일을 읽고 현재 문제점을 요약해줘"
```

**2. 특정 서비스 로그 분석**
```
"KiiPS-FD 서비스의 오늘 로그 파일을 filesystem MCP로 읽고 에러를 찾아줘"
```

**3. 로그 파일 목록 확인**
```
"filesystem MCP로 KiiPS-FD/logs/ 디렉토리 목록을 보여줘"
```

---

## 🏗️ 아키텍처

### 시스템 흐름

```
┌─────────────────────────────────────────────────┐
│  KiiPS Services                                 │
│  ├── KiiPS-FD/logs/log.2025-12-31-0.log         │
│  ├── KiiPS-IL/logs/log.2025-12-31-0.log         │
│  └── ...                                        │
└────────────────┬────────────────────────────────┘
                 │ (로그 파일 생성/변경)
                 ▼
┌─────────────────────────────────────────────────┐
│  log-watcher-daemon.js                          │
│  • fs.watch()로 파일 변경 감지                   │
│  • Debounce (500ms)                             │
│  • 새 라인만 읽기 (파일 position 추적)          │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  log-analyzer.js                                │
│  • 에러 패턴 매칭 (정규식)                       │
│  • 스택 트레이스 수집                            │
│  • 성능 메트릭 추출                              │
│  • 통계 집계                                     │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  dev-docs-updater.js                            │
│  • Markdown 리포트 생성                          │
│  • Action Items 추출                            │
│  • dev/active/log-analysis-summary.md 쓰기       │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Claude Code (MCP filesystem)                   │
│  • Dev Docs 읽기                                │
│  • 로그 파일 접근                                │
│  • 대화형 분석                                   │
└─────────────────────────────────────────────────┘
```

### 주요 컴포넌트

#### 1. log-watcher-daemon.js
- **역할**: 로그 파일 실시간 감시
- **기술**: Node.js `fs.watch()`
- **특징**:
  - 외부 의존성 없음 (내장 API만 사용)
  - 파일 position 추적으로 새 라인만 읽기
  - Debounce로 중복 이벤트 방지
  - Glob-like 패턴 지원

#### 2. log-analyzer.js
- **역할**: 로그 분석 엔진
- **패턴 매칭**:
  - 8가지 에러 패턴 (NullPointer, SQL, Timeout, etc.)
  - 성능 패턴 (Slow Query, API response time)
  - 스택 트레이스 자동 수집
- **출력**: 구조화된 분석 결과 객체

#### 3. dev-docs-updater.js
- **역할**: Dev Docs 자동 생성
- **기능**:
  - Markdown 형식 리포트
  - Critical 에러 우선 표시
  - 통계 테이블 및 차트
  - Action Items 자동 추출

#### 4. MCP Servers
- **filesystem**: 로그 파일 및 Dev Docs 접근
- **serena**: 코드 분석 (선택)
- **context7**: 문서 검색 (보조)

---

## 🛠️ 설정

### config.json

```json
{
  "watchPaths": [
    "KiiPS-FD/logs/log.*.log",
    "KiiPS-IL/logs/log.*.log",
    "KiiPS-PG/logs/log.*.log",
    "KiiPS-AC/logs/log.*.log",
    "KiiPS-COMMON/logs/log.*.log",
    "KiiPS-Login/logs/log.*.log",
    "KIIPS-APIGateway/logs/log.*.log"
  ],
  "pollInterval": 1000,
  "debounceDelay": 500,
  "alertThresholds": {
    "error": {
      "critical": 100,
      "warning": 50
    },
    "warning": {
      "info": 100
    },
    "slowQuery": 2000,
    "verySlowQuery": 5000
  },
  "devDocs": {
    "enabled": true,
    "path": "dev/active/log-analysis-summary.md",
    "updateInterval": 5000
  },
  "monitoring": {
    "enabled": true,
    "maxBufferSize": 1000,
    "maxFileSize": 104857600,
    "excludePatterns": ["DEBUG", "TRACE"]
  },
  "performance": {
    "maxMemoryMB": 200,
    "cpuThrottlePercent": 5
  }
}
```

### patterns.json

에러 패턴을 추가/수정하려면:

```json
{
  "errorPatterns": {
    "customError": {
      "pattern": "YourCustomError",
      "flags": "i",
      "severity": "error",
      "description": "Custom error description"
    }
  }
}
```

---

## 🐛 트러블슈팅

### 1. Daemon이 시작되지 않음

**증상**: `bash start-monitor.sh`가 에러 없이 종료됨

**해결**:
```bash
# Node.js 버전 확인
node --version  # v14 이상 필요

# 수동 실행으로 에러 확인
node .scripts/monitoring/log-watcher-daemon.js

# 로그 파일 확인
cat .scripts/monitoring/monitor.log
```

### 2. Dev Docs가 업데이트되지 않음

**증상**: 에러가 발생해도 `dev/active/log-analysis-summary.md`가 변경되지 않음

**해결**:
```bash
# config.json 확인
cat .scripts/monitoring/config.json | grep -A 5 "devDocs"

# devDocs.enabled가 true인지 확인

# dev/active 디렉토리 권한 확인
ls -la dev/active/

# 수동으로 디렉토리 생성
mkdir -p dev/active
chmod 755 dev/active
```

### 3. 로그 파일을 찾지 못함

**증상**: "No log files found"

**해결**:
```bash
# 로그 파일 존재 확인
ls -la KiiPS-FD/logs/

# config.json의 watchPaths 확인
cat .scripts/monitoring/config.json | grep -A 10 "watchPaths"

# 패턴이 올바른지 확인 (대소문자, 경로)
```

### 4. MCP 서버 연결 실패

**증상**: Claude가 filesystem MCP를 사용할 수 없음

**해결**:
```bash
# MCP Health Check 실행
bash .scripts/mcp-health-check.sh

# .mcp.json 검증
python3 -c "import json; json.load(open('.mcp.json'))"

# Claude Code CLI 재시작
```

### 5. 메모리 누수

**증상**: Daemon의 메모리 사용량이 계속 증가

**해결**:
```bash
# config.json에서 maxBufferSize 확인/조정
vi .scripts/monitoring/config.json

# maxBufferSize를 500으로 감소
"maxBufferSize": 500

# Daemon 재시작
bash .scripts/monitoring/start-monitor.sh --stop
bash .scripts/monitoring/start-monitor.sh --background
```

---

## ❓ FAQ

### Q1: 어떤 서비스들이 모니터링되나요?

A: `config.json`의 `watchPaths`에 정의된 서비스들입니다:
- KiiPS-FD, IL, PG, AC, COMMON, Login
- KIIPS-APIGateway

추가/제거는 `config.json`을 수정하세요.

### Q2: 실시간이 아닌 과거 로그 분석은 어떻게 하나요?

A: Claude에게 직접 요청하세요:
```
"KiiPS-FD의 어제(2025-12-30) 로그 파일을 filesystem MCP로 읽고 에러를 분석해줘"
```

### Q3: 알림을 이메일/Slack으로 받고 싶어요

A: 현재 버전은 Dev Docs 자동 업데이트만 지원합니다. 알림 기능은 향후 추가 예정입니다.

### Q4: Daemon을 시스템 부팅 시 자동 시작하려면?

A: cron 또는 systemd를 사용하세요:

**cron 예시:**
```bash
# crontab -e
@reboot cd /Users/younghwankang/WORK/WORKSPACE/KiiPS && bash .scripts/monitoring/start-monitor.sh --background
```

### Q5: 특정 에러 타입만 감지하고 싶어요

A: `patterns.json`을 수정하여 불필요한 패턴을 제거하거나, `config.json`의 `excludePatterns`에 추가하세요.

### Q6: Claude가 MCP 명령어를 사용하지 않아요

A: 명시적으로 요청하세요:
```
"filesystem MCP를 사용해서 dev/active/log-analysis-summary.md를 읽어줘"
```

---

## 📚 참고 자료

- [MCP 공식 문서](https://modelcontextprotocol.io/)
- [KiiPS 프로젝트 문서](../CLAUDE.md)
- [Skill Guide](../.claude/skills/kiips-log-analyzer/SKILL.md)

---

## 📝 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-31 | 초기 버전 - MCP 통합 로그 분석 시스템 |

---

**문의**: KiiPS 개발팀
**라이선스**: Internal Use Only
