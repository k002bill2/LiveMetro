# Skills Guide - Claude Code 완벽 가이드 (LiveMetro 프로젝트)

> **최신 업데이트**: 2026-03-06
> **환경**: macOS with VS Code / Cursor
> **대상**: Claude Code 초보자 ~ 중급자
> **프로젝트**: LiveMetro - Seoul Metro 실시간 도착정보 (React Native Expo)
> **자동 업데이트**: 30일마다 자동 실행

---

## 가이드 구성

이 폴더는 Claude Code를 LiveMetro React Native Expo 프로젝트에서 효과적으로 활용하기 위한 완벽한 가이드 모음입니다.

### 핵심 가이드

| 파일명 | 설명 | 난이도 |
|--------|------|--------|
| **Claude Code 완벽 가이드북 2026.md** | 가장 포괄적인 통합 가이드 | 초급~중급 |
| **Quick Reference.md** | 빠른 참조용 치트시트 | 모든 레벨 |
| **실전 예제.md** | LiveMetro 실무 적용 예제 모음 | 중급 |

### 시스템 구축 가이드

| 파일명 | 설명 |
|--------|------|
| **Skills 자동 활성화 시스템.md** | Skills/Commands 통합 활성화 시스템 구축 |
| **Dev Docs 시스템.md** | 대규모 작업용 3-파일 문서 시스템 |

### 템플릿

| 파일명 | 설명 |
|--------|------|
| **CLAUDE.md 템플릿.md** | 프로젝트별 컨텍스트 파일 템플릿 |
| **프로젝트별 템플릿.md** | React Native/Firebase 등 프로젝트 타입별 설정 |
| **Agent Skills 예시 모음.md** | 재사용 가능한 Skills 및 Commands 코드 모음 |

---

## 빠른 시작

### 1단계: 기본 이해

```
읽기 순서:
1. Claude Code 완벽 가이드북 2026.md  -- 전체 개요
2. Quick Reference.md                  -- 명령어 익히기
3. CLAUDE.md 템플릿.md                 -- 첫 프로젝트 설정
```

### 2단계: 시스템 구축

```
필요에 따라 선택:
- Skills 자동 활성화 시스템.md   -- Skills/Commands 통합 활용
- Dev Docs 시스템.md            -- 대규모 작업 관리
```

### 3단계: 실전 적용

```
실무 예제로 학습:
- 실전 예제.md                  -- LiveMetro 실제 워크플로우
- 프로젝트별 템플릿.md          -- React Native Expo 설정
- Agent Skills 예시 모음.md     -- 재사용 가능한 코드
```

---

## 핵심 개념 요약

### Claude Code란?

- Anthropic의 AI 기반 CLI 개발 도구
- 2026년 3월 기준 최신 버전: v2.1.x (2.1.63+)
- Skills, Commands, Sub-agents, Hooks, 자동 메모리 등 강력한 기능 제공
- VS Code / Cursor 에디터와 통합 사용

### Claude 4.6 모델 패밀리

| 모델 | 용도 | LiveMetro 활용 예시 |
|------|------|---------------------|
| **Opus 4.6** | 복잡한 설계, 아키텍처, 오케스트레이션 | 새 기능 설계, 대규모 리팩토링, 멀티에이전트 조율 |
| **Sonnet 4.6** | UI/서비스 구현, 일반 개발 | 컴포넌트 구현, Firebase 서비스, 화면 작성 |
| **Haiku 4.5** | 빠른 검증, 단순 작업 | 테스트 작성, 린트 수정, 버그 수정 |

### LiveMetro 프로젝트

- Seoul Metro 실시간 도착정보 React Native Expo 앱
- 기술 스택: React Native 0.72.10, Expo SDK ~49, TypeScript ^5.1.3+, Firebase (Auth/Firestore)
- 네비게이션: React Navigation 6.x (BottomTabs)
- 상태 관리: AuthContext + Custom Hooks (Redux 미사용)
- 데이터 흐름: Seoul API -> Firebase -> AsyncStorage (Cache)

### 필수 시스템

1. **Skills/Commands 통합**: `.claude/skills/` 및 `.claude/commands/` 디렉토리 기반 자동화
2. **Dev Docs 3-파일**: plan.md, context.md, tasks.md
3. **자동 메모리**: `.claude/` 하위에 프로젝트별 메모리 자동 관리
4. **설정 파일**: `.claude/settings.json`으로 프로젝트 설정 통합 관리

---

## 학습 로드맵

### Week 1: 기초 다지기

- [ ] Claude Code CLI v2.1.x 설치 및 설정
- [ ] VS Code 또는 Cursor에서 Claude Code 연동
- [ ] 기본 명령어 익히기 (Quick Reference)
- [ ] LiveMetro CLAUDE.md 구조 파악

### Week 2: Skills/Commands 마스터

- [ ] Skills와 Commands의 차이 이해
- [ ] `.claude/skills/` 디렉토리 구조 파악
- [ ] `.claude/commands/` 커스텀 슬래시 커맨드 작성
- [ ] Skills 자동 활성화 시스템 구축

### Week 3: Advanced 기능

- [ ] Sub-agents 활용 (멀티에이전트 오케스트레이션)
- [ ] Hooks 설정 (PostToolUse 등)
- [ ] 자동 메모리 기능 활용
- [ ] Dev Docs 시스템 도입

### Week 4: 실전 프로젝트

- [ ] LiveMetro 실전 예제로 연습
- [ ] 검증 루프 (`/verify-app`, `/check-health`) 활용
- [ ] 배포 워크플로우 (`/commit-push-pr`, `/deploy-with-tests`) 적용
- [ ] Boris Cherny 워크플로우 체득

---

## 자동 업데이트 시스템

### 개요

이 Skills Guide는 **30일마다 자동으로 업데이트**되어 항상 최신 기술 스택과 버전 정보를 유지합니다.

### 주요 기능

- **기술 스택 버전 검증** - package.json의 모든 패키지를 최신 버전과 비교
- **낙후 기술 감지** - 6개월 이상 업데이트 없는 패키지 자동 감지
- **문서 자동 갱신** - 마크다운 파일의 버전 정보 자동 업데이트
- **경고 추가** - 낙후된 기술에 대한 경고 및 대안 제시
- **보고서 생성** - 모든 변경 사항을 담은 상세 보고서 생성

### 수동 실행

```bash
# 일반 업데이트 (30일 경과 시에만 실행)
npm run skills:update

# 강제 업데이트 (30일 대기 무시)
npm run skills:update:force

# 검사만 실행 (변경 없이 상태만 확인)
npm run skills:check
```

### GitHub Actions

- **스케줄**: 매월 1일과 15일 오전 9시 (KST 18시)
- **워크플로우**: `.github/workflows/skills-guide-update.yml`
- **수동 실행**: GitHub Actions 탭에서 "Run workflow" 버튼

### 설정 파일

- `.update-config.json` - 업데이트 설정 및 규칙
- `.last-update.json` - 마지막 업데이트 타임스탬프 (자동 생성)

---

## FAQ (LiveMetro 관련)

### Q: 처음 시작하는데 어디서부터?

**A**: `Claude Code 완벽 가이드북 2026.md` -> `Quick Reference.md` 순서로 읽은 뒤, LiveMetro의 `CLAUDE.md`를 참고하여 프로젝트 구조를 파악하세요.

### Q: Skills를 만들었는데 Claude가 안 써요

**A**: `Skills 자동 활성화 시스템.md`를 참고하세요. `.claude/skills/` 디렉토리에 SKILL.md 파일이 올바르게 배치되어 있는지, `CLAUDE.md`의 Skill Routing 테이블에 등록되어 있는지 확인하세요.

### Q: 대규모 작업시 Claude가 길을 잃어요

**A**: `Dev Docs 시스템.md`의 3-파일 시스템을 도입하세요. 또한 자동 메모리 기능(`.claude/` 하위 MEMORY.md)을 활용하면 세션 간 컨텍스트가 유지됩니다.

### Q: LiveMetro 테스트가 자주 실패해요

**A**: `CLAUDE.md`의 "잘못된 행동 기록" 섹션에 기록된 패턴을 확인하세요. `useAuth` mock 구조 불일치, `testID` 누락, `isAutoLoggingIn` 상태 등이 주요 원인입니다. `/verify-app` 커맨드로 사전 검증하세요.

### Q: Firebase 연동 작업을 할 때 주의할 점은?

**A**: `CLAUDE.md`의 Skill Routing에 따라 `firebase-integration` 스킬을 먼저 호출하세요. Auth, Firestore 관련 작업 시 구독 정리(cleanup)를 반드시 useEffect return에서 처리해야 합니다.

### Q: PM2가 필요한가요?

**A**: LiveMetro는 React Native Expo 모바일 프로젝트이므로 PM2는 필수가 아닙니다. 별도의 백엔드 서비스를 로컬에서 관리할 필요가 있을 때만 보조적으로 활용하세요.

---

## 환경 요구사항

### 필수

| 항목 | 버전/조건 |
|------|-----------|
| macOS | Intel 또는 Apple Silicon |
| Node.js | v18 이상 |
| Git | 최신 버전 |
| VS Code 또는 Cursor | 최신 버전 |
| Claude Code CLI | v2.1.x (2.1.63+) |
| Expo CLI | Expo SDK ~49 호환 |

### 권장

| 항목 | 버전/조건 |
|------|-----------|
| TypeScript | 5.1+ (strict mode) |
| React Native | 0.72 |
| Firebase | Auth + Firestore |
| Watchman | React Native 개발용 |

---

## 유용한 링크

### 공식 문서

- [Claude Code 공식 문서](https://code.claude.com/docs)
- [Claude Code Skills 가이드](https://code.claude.com/docs/skills)
- [Claude Code Sub-agents 문서](https://code.claude.com/docs/sub-agents)

### 커뮤니티

- [Claude Developers Discord](https://discord.gg/anthropic)
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code)

---

## 기여 및 피드백

이 가이드는 LiveMetro 프로젝트 실전 경험을 바탕으로 지속적으로 업데이트됩니다.

- 오류 발견시: Issues 등록
- 개선 제안: Pull Request 환영
- 추가 예제: 공유 환영

---

*마지막 수동 업데이트: 2026-03-06*
*자동 업데이트 시스템: 활성화*
*다음 예정 업데이트: 2026-04-05 (30일 후)*
*환경: macOS + VS Code / Cursor*

#claude-code #livemetro #react-native #expo #ai-coding #guide #macos #auto-update
