# Agent Skills 예시 모음
#claude-code #skills #examples #2026-03-update

> 최신 업데이트: 2026-03-06 | Claude Code v2.1.x | Claude 4.6 모델 패밀리
>
> Skills/Commands 통합 (v2.1.3): `user-invocable` 필드로 슬래시 명령어 호출 가능
> Agent frontmatter 확장: `memory`, `hooks`, `skills` 필드 추가

## 개요
Claude Code Agent Skills의 실제 예시들입니다. 각 Skill은 특정 작업에 특화되어 있으며, 필요에 따라 자동으로 로드됩니다.

LiveMetro(React Native/Expo) 프로젝트 기준으로 TypeScript 예시를 중심으로 구성했습니다.

---

## 🔍 Code Reviewer Skill

### 파일 위치
`.claude/skills/code-reviewer/SKILL.md`

### 전체 코드
```markdown
---
name: code-reviewer
description: Comprehensive code review for quality, security, and maintainability. Use when reviewing pull requests, code changes, or when code quality checks are needed.
---

# Code Review Skill

## Purpose
Perform thorough code reviews focusing on:
- Code quality and readability
- Security vulnerabilities
- Performance optimization
- Test coverage
- Documentation completeness

## Review Checklist

### 1. Code Quality
- [ ] Clear and descriptive variable names
- [ ] Functions are single-purpose and small
- [ ] No code duplication (DRY principle)
- [ ] Consistent coding style
- [ ] Proper abstraction levels

### 2. Security
- [ ] Input validation present
- [ ] No SQL injection vulnerabilities
- [ ] Proper authentication/authorization
- [ ] Sensitive data encrypted
- [ ] No hardcoded secrets

### 3. Performance
- [ ] Efficient algorithms (O(n) complexity analysis)
- [ ] Database queries optimized
- [ ] Caching implemented where appropriate
- [ ] No memory leaks
- [ ] Async operations handled properly

### 4. Testing
- [ ] Unit tests present (>80% coverage)
- [ ] Edge cases covered
- [ ] Integration tests for APIs
- [ ] Error scenarios tested
- [ ] Mocks/stubs used appropriately

### 5. Documentation
- [ ] JSDoc/docstrings for public methods
- [ ] README updated if needed
- [ ] Complex logic explained
- [ ] API changes documented
- [ ] Changelog updated

## Review Process

\`\`\`typescript
interface ReviewIssues {
  critical: string[];
  warning: string[];
  suggestion: string[];
}

function performCodeReview(changes: string[]): ReviewIssues {
  const issues: ReviewIssues = {
    critical: [],
    warning: [],
    suggestion: [],
  };

  // Step 1: Analyze changes
  for (const file of changes) {
    checkSecurity(file, issues);
    checkPerformance(file, issues);
    checkStyle(file, issues);
    checkTests(file, issues);
  }

  return issues;
}
\`\`\`

## Output Format

### Review Summary
- **Status**: ✅ Approved / ⚠️ Needs Changes / ❌ Rejected
- **Risk Level**: Low / Medium / High
- **Test Coverage**: XX%

### Detailed Feedback
\`\`\`
🟢 **Good Practices**:
- Well-structured component architecture
- Comprehensive error handling
- Good test coverage

🟡 **Suggestions**:
- Consider extracting magic numbers to constants
- Add retry logic for network requests
- Improve variable naming in calculateTotal()

🔴 **Required Changes**:
- Fix SQL injection vulnerability in line 45
- Add input validation for user data
- Handle null pointer exception in getData()
\`\`\`

## Integration with Git

\`\`\`bash
# Pre-commit hook
#!/bin/bash
claude -p "Review staged changes using code-reviewer skill"
\`\`\`

## Best Practices
1. Run before every PR
2. Address all critical issues
3. Consider suggestions for improvement
4. Document decisions for ignored warnings
```

---

## Subway Data Processor Skill (LiveMetro)

### 파일 위치
`.claude/skills/subway-data-processor/SKILL.md`

### 전체 코드
```markdown
---
name: subway-data-processor
description: Process and transform Seoul subway data including station info, real-time arrivals, and timetables. Use when working with Seoul Open Data API responses or subway data normalization.
user-invocable: true
---

# Subway Data Processor Skill

## Capabilities
- Seoul Open Data API 응답 파싱
- 실시간 도착 정보 정규화
- 역 정보 캐싱 (AsyncStorage)
- 노선별 데이터 필터링
- 도착 시간 계산 및 포맷팅

## Core Types
\`\`\`typescript
interface ArrivalInfo {
  stationId: string;
  stationName: string;
  lineNum: string;
  trainLineNm: string;
  destination: string;
  arrivalMessage: string;
  arrivalSec: number;
  updatedAt: Date;
}

interface StationInfo {
  id: string;
  name: string;
  line: string;
  lat: number;
  lng: number;
  transferLines?: string[];
}
\`\`\`

## Core Functions

### 1. API 응답 파싱
\`\`\`typescript
function parseArrivalResponse(raw: unknown): ArrivalInfo[] {
  if (!raw || typeof raw !== 'object') return [];

  const data = raw as Record<string, unknown>;
  const realtimeList = data.realtimeArrivalList;
  if (!Array.isArray(realtimeList)) return [];

  return realtimeList.map((item): ArrivalInfo => ({
    stationId: String(item.statnId ?? ''),
    stationName: String(item.statnNm ?? ''),
    lineNum: String(item.subwayId ?? ''),
    trainLineNm: String(item.trainLineNm ?? ''),
    destination: String(item.bstatnNm ?? ''),
    arrivalMessage: String(item.arvlMsg2 ?? ''),
    arrivalSec: Number(item.barvlDt ?? 0),
    updatedAt: new Date(),
  }));
}
\`\`\`

### 2. 도착 시간 포맷팅
\`\`\`typescript
function formatArrivalTime(seconds: number): string {
  if (seconds <= 0) return '곧 도착';
  if (seconds < 60) return seconds + '초';
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  return remainSec > 0
    ? minutes + '분 ' + remainSec + '초'
    : minutes + '분';
}
\`\`\`

### 3. AsyncStorage 캐싱
\`\`\`typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@livemetro/arrivals';
const CACHE_TTL = 30 * 1000; // 30초

async function getCachedArrivals(
  stationId: string
): Promise<ArrivalInfo[] | null> {
  const cached = await AsyncStorage.getItem(CACHE_KEY + '/' + stationId);
  if (!cached) return null;

  const parsed = JSON.parse(cached);
  if (Date.now() - parsed.timestamp > CACHE_TTL) return null;

  return parsed.data as ArrivalInfo[];
}

async function setCachedArrivals(
  stationId: string,
  data: ArrivalInfo[]
): Promise<void> {
  await AsyncStorage.setItem(
    CACHE_KEY + '/' + stationId,
    JSON.stringify({ data, timestamp: Date.now() })
  );
}
\`\`\`

## Usage Examples

### Example 1: 실시간 도착 정보 조회
\`\`\`typescript
async function fetchArrivals(stationName: string): Promise<ArrivalInfo[]> {
  const cached = await getCachedArrivals(stationName);
  if (cached) return cached;

  const response = await fetch(
    'http://swopenAPI.seoul.go.kr/api/subway/' +
    API_KEY + '/json/realtimeStationArrival/0/10/' +
    encodeURIComponent(stationName)
  );
  const raw = await response.json();
  const arrivals = parseArrivalResponse(raw);

  await setCachedArrivals(stationName, arrivals);
  return arrivals;
}
\`\`\`

### Example 2: 노선별 필터링
\`\`\`typescript
function filterByLine(arrivals: ArrivalInfo[], lineNum: string): ArrivalInfo[] {
  return arrivals.filter((a) => a.lineNum === lineNum);
}
\`\`\`
```

---

## 🧪 Test Runner Skill

### 파일 위치
`.claude/skills/test-runner/SKILL.md`

### 전체 코드
```markdown
---
name: test-runner
description: Automated test execution, coverage analysis, and test generation. Use for running tests, fixing failures, and improving coverage.
---

# Test Runner Skill

## Capabilities
- Execute unit tests
- Run integration tests
- Generate test coverage reports
- Create missing tests
- Fix failing tests
- Performance testing

## Supported Frameworks
- JavaScript: Jest, Mocha, Vitest
- Python: pytest, unittest
- Go: testing package
- Java: JUnit, TestNG

## Test Execution

### 1. Run All Tests
\`\`\`bash
# JavaScript/TypeScript
npm test
npm run test:coverage
npm run test:watch

# Python
pytest
pytest --cov=src --cov-report=html
pytest -v --tb=short

# Go
go test ./...
go test -cover -coverprofile=coverage.out
go tool cover -html=coverage.out
\`\`\`

### 2. Run Specific Tests
\`\`\`bash
# Jest - run specific file
npm test UserService.test.ts

# Jest - run tests matching pattern
npm test -- --testNamePattern="should validate email"

# Pytest - run specific file
pytest tests/test_user.py

# Pytest - run specific test
pytest tests/test_user.py::test_email_validation
\`\`\`

## Test Generation

### Unit Test Template
\`\`\`typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { UserService } from '../src/services/UserService';

describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<UserRepository>;
  
  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn()
    };
    service = new UserService(mockRepository);
  });
  
  describe('getUser', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = '123';
      const expectedUser = { id: userId, name: 'John' };
      mockRepository.findById.mockResolvedValue(expectedUser);
      
      // Act
      const result = await service.getUser(userId);
      
      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockRepository.findById).toHaveBeenCalledWith(userId);
    });
    
    it('should throw error when user not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);
      
      // Act & Assert
      await expect(service.getUser('999')).rejects.toThrow('User not found');
    });
  });
});
\`\`\`

### Integration Test Template
\`\`\`python
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test-token"}

class TestUserAPI:
    def test_create_user(self, client):
        # Arrange
        user_data = {
            "email": "test@example.com",
            "name": "Test User"
        }
        
        # Act
        response = client.post("/api/users", json=user_data)
        
        # Assert
        assert response.status_code == 201
        assert response.json()["email"] == user_data["email"]
    
    def test_get_user_unauthorized(self, client):
        response = client.get("/api/users/123")
        assert response.status_code == 401
    
    def test_get_user_authorized(self, client, auth_headers):
        response = client.get("/api/users/123", headers=auth_headers)
        assert response.status_code == 200
\`\`\`

## Coverage Analysis

### Generate Coverage Report
\`\`\`javascript
// package.json scripts
{
  "scripts": {
    "test:coverage": "jest --coverage",
    "test:coverage:html": "jest --coverage --coverageReporters=html",
    "test:coverage:lcov": "jest --coverage --coverageReporters=lcov"
  }
}

// jest.config.js
module.exports = {
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/tests/",
    "/.test.ts$/"
  ]
};
\`\`\`

### Improve Coverage
\`\`\`python
def analyze_coverage_gaps():
    """
    Identify untested code paths
    """
    # Run coverage analysis
    import coverage
    
    cov = coverage.Coverage()
    cov.start()
    
    # Run your tests
    pytest.main(['-q'])
    
    cov.stop()
    cov.save()
    
    # Get missing lines
    for filename in cov.get_data().measured_files():
        missing = cov.analysis(filename)[3]
        if missing:
            print(f"{filename}: Missing lines {missing}")
    
    return cov.report()
\`\`\`

## Test Debugging

### Fix Failing Tests Process
1. Run failing test in isolation
2. Add debug output
3. Check test data setup
4. Verify mocks/stubs
5. Review implementation changes
6. Update test expectations

### Debug Commands
\`\`\`bash
# Jest with debugging
node --inspect-brk node_modules/.bin/jest --runInBand

# Pytest with debugging
pytest --pdb  # Drop into debugger on failure
pytest -vv   # Very verbose output
pytest --tb=long  # Long traceback

# Go test with verbose
go test -v -run TestName
\`\`\`

## Performance Testing

### Load Test Example
\`\`\`javascript
import autocannon from 'autocannon';

const loadTest = autocannon({
  url: 'http://localhost:3000/api/endpoint',
  connections: 100,
  duration: 10,
  pipelining: 1,
  headers: {
    'content-type': 'application/json'
  }
}, (err, result) => {
  console.log('Requests per second:', result.requests.average);
  console.log('Latency (ms):', result.latency.average);
});
\`\`\`

## Best Practices
1. Write tests before fixing bugs (TDD)
2. Keep tests simple and focused
3. Use descriptive test names
4. Maintain test independence
5. Mock external dependencies
6. Regular coverage monitoring
```

---

## 📝 Documentation Generator Skill

### 파일 위치
`.claude/skills/docs-generator/SKILL.md`

### 전체 코드
```markdown
---
name: docs-generator
description: Generate comprehensive documentation including API docs, README files, and technical guides. Use for documentation tasks.
---

# Documentation Generator Skill

## Capabilities
- API documentation generation
- README file creation
- Code documentation extraction
- Markdown formatting
- Diagram generation (Mermaid)
- Changelog management

## Documentation Types

### 1. API Documentation
\`\`\`markdown
# API Documentation

## Base URL
\`https://api.example.com/v1\`

## Authentication
All API requests require authentication via Bearer token:
\`\`\`
Authorization: Bearer <token>
\`\`\`

## Endpoints

### GET /users
Retrieve a list of users.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| page | integer | No | Page number (default: 1) |
| limit | integer | No | Items per page (default: 20) |
| sort | string | No | Sort field (name, created_at) |

**Response:**
\`\`\`json
{
  "data": [
    {
      "id": "123",
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
\`\`\`

**Status Codes:**
- 200: Success
- 401: Unauthorized
- 429: Rate limit exceeded
\`\`\`

### 2. README Template
\`\`\`markdown
# Project Name

![Build Status](https://img.shields.io/badge/build-passing-green)
![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## 📋 Table of Contents
- [About](#about)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
- [Contributing](#contributing)
- [License](#license)

## 🎯 About
Brief project description and purpose.

## ✨ Features
- ✅ Feature 1
- ✅ Feature 2
- ✅ Feature 3

## 🚀 Installation

### Prerequisites
- Node.js >= 16.0.0
- npm >= 8.0.0

### Steps
\`\`\`bash
# Clone repository
git clone https://github.com/user/project.git

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run migrations
npm run migrate
\`\`\`

## 💻 Usage

### Basic Example
\`\`\`javascript
const lib = require('project-name');

const result = lib.doSomething({
  option1: 'value',
  option2: true
});
\`\`\`

## 📚 API Reference
See [API Documentation](./docs/api.md)

## 🤝 Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md)

## 📄 License
MIT © [Your Name]
\`\`\`

### 3. Code Documentation
\`\`\`javascript
/**
 * UserService - Handles user-related business logic
 * @class
 * @example
 * const userService = new UserService(repository);
 * const user = await userService.createUser(data);
 */
class UserService {
  /**
   * Creates a new user
   * @async
   * @param {Object} userData - User data object
   * @param {string} userData.email - User email address
   * @param {string} userData.name - User full name
   * @param {string} [userData.role='user'] - User role
   * @returns {Promise<User>} Created user object
   * @throws {ValidationError} If email is invalid
   * @throws {DuplicateError} If email already exists
   * @example
   * const user = await userService.createUser({
   *   email: 'john@example.com',
   *   name: 'John Doe'
   * });
   */
  async createUser(userData) {
    // Implementation
  }
}
\`\`\`

## Diagram Generation

### Architecture Diagram (Mermaid)
\`\`\`mermaid
graph TB
    Client[Client App]
    API[API Gateway]
    Auth[Auth Service]
    User[User Service]
    DB[(Database)]
    Cache[(Redis Cache)]
    
    Client --> API
    API --> Auth
    API --> User
    Auth --> DB
    User --> DB
    User --> Cache
    
    style Client fill:#e1f5fe
    style API fill:#fff9c4
    style Auth fill:#f3e5f5
    style User fill:#f3e5f5
    style DB fill:#c8e6c9
    style Cache fill:#ffccbc
\`\`\`

### Sequence Diagram
\`\`\`mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant S as Service
    participant D as Database
    
    C->>A: POST /users
    A->>A: Validate request
    A->>S: createUser(data)
    S->>D: INSERT user
    D-->>S: User created
    S-->>A: User object
    A-->>C: 201 Created
\`\`\`

## Changelog Management

### CHANGELOG.md Template
\`\`\`markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2024-11-03
### Added
- New feature X
- Support for Y

### Changed
- Updated dependency Z
- Improved performance of feature A

### Fixed
- Bug in component B
- Memory leak in service C

### Deprecated
- Method oldFunction() - use newFunction() instead

### Removed
- Support for legacy API v1

### Security
- Updated vulnerable dependency
\`\`\`

## Auto-generation Scripts

### Extract JSDoc to Markdown
\`\`\`javascript
const jsdoc2md = require('jsdoc-to-markdown');

async function generateDocs() {
  const docs = await jsdoc2md.render({
    files: 'src/**/*.js',
    template: '{{>main}}'
  });
  
  fs.writeFileSync('API.md', docs);
}
\`\`\`

### Generate from OpenAPI
\`\`\`bash
# Using swagger-markdown
swagger-markdown -i openapi.yaml -o API.md

# Using widdershins
widdershins openapi.yaml -o API.md --language_tabs javascript python
\`\`\`

## Best Practices
1. Keep documentation close to code
2. Use consistent formatting
3. Include examples for everything
4. Update docs with code changes
5. Version documentation
6. Use diagrams for complex concepts
```

---

## 🎯 사용 가이드

### Skill 생성 방법

1. **자동 생성 (추천)**
   ```
   "Use the skill-creator skill to help me create a skill for [작업]"
   ```

2. **수동 생성**
   ```bash
   mkdir -p .claude/skills/skill-name
   touch .claude/skills/skill-name/SKILL.md
   ```

3. **테스트**
   ```
   "Test the [skill-name] skill with this sample data"
   ```

### Skill 활용 팁

1. **명확한 설명**: description 필드가 핵심
2. **모듈화**: 하나의 Skill은 하나의 목적
3. **재사용성**: 팀과 공유 가능하게 설계
4. **버전 관리**: Git으로 관리
5. **문서화**: 사용 예시 포함

---

## Notification System Skill (LiveMetro)

### 파일 위치
`.claude/skills/notification-system/SKILL.md`

### 요약
```markdown
---
name: notification-system
description: Push notification system using Expo Notifications for train arrival alerts and service disruption notifications. Use when implementing notification features.
user-invocable: true
hooks:
  PostToolUse:
    - matcher: "Write(src/services/notification*)"
      hooks:
        - type: command
          command: "npx tsc --noEmit src/services/notification*.ts 2>&1 | head -10"
---

# Notification System Skill

## Core Functions
- Expo Push Notifications 설정
- 도착 알림 스케줄링
- 서비스 장애 알림
- 알림 권한 요청 및 관리
- 백그라운드 알림 처리

## Key Types
\`\`\`typescript
interface NotificationConfig {
  stationId: string;
  lineNum: string;
  direction: string;
  minutesBefore: number;
  enabled: boolean;
}
\`\`\`
```

---

*마지막 업데이트: 2026-03-06 | Claude Code v2.1.x | 환경: macOS + VS Code/Cursor*

*태그: #claude-code #skills #examples #automation #livemetro*