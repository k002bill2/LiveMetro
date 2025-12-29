# Development Environment Setup Guide

LiveMetro 프로젝트 개발 환경 설정 가이드입니다.

## 📋 목차

- [필수 도구](#필수-도구)
- [VS Code 설정](#vs-code-설정)
- [LSP 및 확장 프로그램](#lsp-및-확장-프로그램)
- [MCP 서버 설정](#mcp-서버-설정)
- [개발 워크플로우](#개발-워크플로우)

---

## 필수 도구

### 1. Node.js & npm

**버전**: Node.js 18+ 권장

```bash
# Node.js 버전 확인
node --version  # v18.0.0 이상

# npm 버전 확인
npm --version   # v9.0.0 이상
```

**설치**:
- [Node.js 공식 사이트](https://nodejs.org/)
- 또는 [nvm](https://github.com/nvm-sh/nvm) 사용 권장

### 2. TypeScript

프로젝트에 포함되어 있으므로 별도 설치 불필요:

```bash
# 프로젝트 TypeScript 버전 확인
npx tsc --version
```

### 3. Expo CLI

```bash
# 전역 설치 (선택사항)
npm install -g expo-cli

# 또는 npx 사용
npx expo --version
```

### 4. Git

```bash
git --version  # v2.30.0 이상 권장
```

---

## VS Code 설정

### 자동 설치 (권장)

VS Code를 열면 자동으로 권장 확장 프로그램 설치를 제안합니다:

1. VS Code로 프로젝트 열기
2. 우측 하단 알림에서 "Install Recommended Extensions" 클릭
3. 모든 확장 프로그램 자동 설치

### 수동 설치

`.vscode/extensions.json`에 정의된 확장 프로그램:

#### 필수 확장 프로그램

1. **ESLint** (`dbaeumer.vscode-eslint`)
   - JavaScript/TypeScript 린팅
   - 저장 시 자동 수정

2. **Prettier** (`esbenp.prettier-vscode`)
   - 코드 포맷터
   - 저장 시 자동 포맷팅

3. **React Native Tools** (`msjsdiag.vscode-react-native`)
   - React Native 디버깅
   - Metro bundler 통합
   - 디바이스/시뮬레이터 연결

4. **TypeScript** (`ms-vscode.vscode-typescript-next`)
   - TypeScript 언어 지원
   - IntelliSense 향상

#### 추천 확장 프로그램

5. **ES7+ React/Redux/React-Native snippets** (`dsznajder.es7-react-js-snippets`)
   - React/React Native 코드 스니펫

6. **Jest** (`orta.vscode-jest`)
   - 테스트 자동 실행
   - 커버리지 표시

7. **GitLens** (`eamodio.gitlens`)
   - Git 히스토리 및 blame 정보

8. **Path Intellisense** (`christian-kohler.path-intellisense`)
   - 경로 자동완성
   - 모듈 임포트 지원

9. **Import Cost** (`wix.vscode-import-cost`)
   - 임포트 크기 표시
   - 번들 사이즈 최적화

10. **TODO Highlight** (`wayou.vscode-todo-highlight`)
    - TODO, FIXME 하이라이트

11. **Claude Code** (`anthropic.claude-code`)
    - AI 코드 어시스턴트

---

## LSP 및 확장 프로그램

### LSP (Language Server Protocol) 설정

프로젝트는 다음 LSP를 자동으로 사용합니다:

#### 1. TypeScript LSP

**제공 기능**:
- 타입 체킹
- 자동 완성
- 리팩토링
- 타입 정의로 이동
- 참조 찾기

**설정** (`.vscode/settings.json`):
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

#### 2. ESLint LSP

**제공 기능**:
- 실시간 린팅
- 코드 품질 검사
- 자동 수정 제안

**설정**:
```json
{
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

#### 3. JSON LSP

**제공 기능**:
- package.json, tsconfig.json 스키마 검증
- 자동 완성

**자동 활성화**: VS Code 내장

---

## MCP 서버 설정

### 활성화된 MCP 서버

프로젝트는 다음 MCP(Model Context Protocol) 서버를 사용합니다:

#### 1. **codex-cli** ✅ 활성화
- 코드 스니펫 및 개발 도구
- API 키 불필요

#### 2. **context7** ✅ 활성화
- 시맨틱 코드 검색
- 코드베이스 이해 향상
- API 키 불필요

#### 3. **magic** ✅ 활성화
- 21st.dev UI 컴포넌트 라이브러리
- **API 키 필요**: `TWENTYFIRST_API_KEY`

#### 4. **tavily** ✅ 활성화
- 웹 검색 및 리서치
- **API 키 필요**: `TAVILY_API_KEY`

#### 5. **playwright** ✅ 활성화
- 브라우저 자동화 및 테스팅
- API 키 불필요

#### 6. **serena** ✅ 활성화
- IDE 어시스턴트
- **요구사항**: Python with `uvx`

#### 7. **typescript-lsp** ✅ 활성화
- TypeScript 언어 서버 통합
- 코드 분석 및 제안

#### 8. **github** ⏸️ 비활성화 (선택사항)
- GitHub 저장소 통합
- **API 키 필요**: `GITHUB_PERSONAL_ACCESS_TOKEN`

### MCP 서버 API 키 설정

프로젝트 루트에 `.env` 파일 생성:

```bash
# .env 파일
TWENTYFIRST_API_KEY=your_21st_dev_api_key
TAVILY_API_KEY=your_tavily_api_key
GITHUB_PERSONAL_ACCESS_TOKEN=your_github_token  # 선택사항
```

**API 키 발급**:
- 21st.dev: https://21st.dev
- Tavily: https://tavily.com
- GitHub: https://github.com/settings/tokens

---

## 개발 워크플로우

### 1. 프로젝트 초기 설정

```bash
# 저장소 클론
git clone <repository-url>
cd liveMetro

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집 (API 키 입력)

# TypeScript 타입 체크
npm run type-check

# 린트 체크
npm run lint

# 테스트 실행
npm test
```

### 2. 개발 서버 실행

```bash
# Expo 개발 서버 시작
npm start

# Android
npm run android

# iOS
npm run ios

# Web
npm run web
```

### 3. 코드 작성 워크플로우

#### VS Code에서 자동화된 작업

**저장 시 자동 실행**:
1. ✅ Prettier 포맷팅
2. ✅ ESLint 자동 수정
3. ✅ Import 정리

**실시간 피드백**:
- TypeScript 타입 에러 표시
- ESLint 경고/에러 표시
- Import cost 표시

#### 개발 사이클

```bash
# 1. 브랜치 생성
git checkout -b feature/new-feature

# 2. 코드 작성 (VS Code에서)
# - 자동 완성 활용
# - TypeScript 타입 체크
# - ESLint 규칙 준수

# 3. 테스트 작성
npm test -- --watch

# 4. 타입 체크
npm run type-check

# 5. 린트
npm run lint

# 6. 커밋 (pre-commit hook 자동 실행)
git add .
git commit -m "feat: add new feature"

# 7. 푸시
git push origin feature/new-feature
```

### 4. 디버깅

#### React Native Debugger

**VS Code 디버그 설정** (`.vscode/launch.json` 자동 생성):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Android",
      "type": "reactnative",
      "request": "launch",
      "platform": "android"
    },
    {
      "name": "Debug iOS",
      "type": "reactnative",
      "request": "launch",
      "platform": "ios"
    }
  ]
}
```

**사용법**:
1. VS Code에서 F5 누르기
2. 디버그 구성 선택 (Android/iOS)
3. 중단점 설정 및 디버깅

#### Jest 테스트 디버깅

```bash
# 특정 테스트 디버그 모드
node --inspect-brk node_modules/.bin/jest --runInBand
```

VS Code에서 "Attach to Process" 사용

---

## 키보드 단축키

### VS Code 기본

- **파일 검색**: `Cmd+P` (Mac) / `Ctrl+P` (Windows)
- **심볼 검색**: `Cmd+Shift+O`
- **전역 검색**: `Cmd+Shift+F`
- **정의로 이동**: `F12`
- **참조 찾기**: `Shift+F12`
- **이름 변경**: `F2`

### React Native 전용

- **시뮬레이터 열기**: `Shift+Cmd+P` → "React Native: Run iOS"
- **Reload**: 시뮬레이터에서 `Cmd+R`
- **Dev Menu**: 시뮬레이터에서 `Cmd+D`

### Git

- **Source Control**: `Ctrl+Shift+G`
- **변경사항 보기**: `Cmd+K Cmd+D`

---

## Path Aliases 설정

프로젝트는 다음 경로 별칭을 사용합니다:

```typescript
// tsconfig.json & babel.config.js
{
  "@": "src/",
  "@components": "src/components",
  "@screens": "src/screens",
  "@services": "src/services",
  "@models": "src/models",
  "@utils": "src/utils",
  "@hooks": "src/hooks"
}
```

**사용 예시**:
```typescript
// ❌ 상대 경로 (피하기)
import { Button } from '../../../components/common/Button';

// ✅ 절대 경로 (권장)
import { Button } from '@components/common/Button';
```

**VS Code 자동 완성 지원**:
- Path Intellisense 확장 프로그램 설치 시 자동 완성 제공

---

## 코드 품질 도구

### 1. ESLint

**설정 파일**: `.eslintrc.js`

**규칙**:
- TypeScript strict 모드
- React/React Native best practices
- Import order

**실행**:
```bash
npm run lint        # 린트 체크 및 자동 수정
npm run lint:check  # 체크만 (수정 없음)
```

### 2. TypeScript

**설정 파일**: `tsconfig.json`

**Strict 모드 옵션**:
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noImplicitReturns: true`

**실행**:
```bash
npm run type-check  # 타입 에러 체크
```

### 3. Prettier

**설정 파일**: `.prettierrc` (또는 package.json)

**규칙**:
- Single quotes
- 2 spaces
- Trailing commas (ES5)
- Arrow function parens: avoid

**실행**:
```bash
# VS Code 저장 시 자동 실행
# 또는 수동 실행
npx prettier --write "src/**/*.{ts,tsx,js,jsx}"
```

### 4. Jest

**설정 파일**: `jest.config.js`

**커버리지 목표**:
- Statements: 75%
- Branches: 60%
- Functions: 70%
- Lines: 75%

**실행**:
```bash
npm test              # 테스트 실행
npm run test:watch    # Watch 모드
npm run test:coverage # 커버리지 리포트
```

---

## 성능 최적화

### 1. VS Code 성능

**큰 프로젝트를 위한 설정**:

```json
{
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.expo/**": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/coverage": true
  }
}
```

### 2. TypeScript 빌드 속도

**증분 빌드 활성화**:
```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  }
}
```

### 3. Metro Bundler 캐시

```bash
# 캐시 문제 시 클리어
npx expo start --clear

# 또는
rm -rf .expo
rm -rf node_modules/.cache
```

---

## 문제 해결

### 1. TypeScript 에러가 사라지지 않음

```bash
# VS Code TypeScript 서버 재시작
Cmd+Shift+P → "TypeScript: Restart TS Server"

# 또는
rm -rf node_modules
npm install
```

### 2. ESLint가 작동하지 않음

```bash
# ESLint 서버 재시작
Cmd+Shift+P → "ESLint: Restart ESLint Server"

# 또는 VS Code 재시작
```

### 3. Import path가 인식되지 않음

```bash
# tsconfig.json과 babel.config.js의 paths 확인
# VS Code 재시작
```

### 4. MCP 서버 연결 안 됨

```bash
# .env 파일 확인
cat .env

# Claude Code 재시작
# 또는 MCP 서버 로그 확인
```

---

## 추가 리소스

- [VS Code 공식 문서](https://code.visualstudio.com/docs)
- [React Native 문서](https://reactnative.dev/)
- [Expo 문서](https://docs.expo.dev/)
- [TypeScript 문서](https://www.typescriptlang.org/docs/)
- [Claude Code 문서](https://claude.ai/code)

---

**Last Updated**: 2025-12-29
**Version**: 1.0.0
