# Claude Code - Context

## Last Updated: 2026-01-08 17:00

## Key Files
- `.claudecode.json` - Claude Code Hooks, 권한, 환경 설정
- `skill-rules.json` - Skills 자동 활성화 규칙 (27개)
- `.claude/skills/` - KiiPS 전문 Skills (23개)
- `.claude/ace-framework/` - ACE Framework 설정
- `.claude/commands/my-workflow.md` - KiiPS 개발 워크플로우

## Important Decisions
- **2026-01-08**: 다크모드 메뉴 폰트 컬러 #FFFFFF, hover 배경 #3d8ef4로 결정
- **2026-01-08**: /save-and-compact와 /update-dev-docs 명령어 통합
- **2026-01-08**: kiips-architect 모델 opus → sonnet 변경 (비용 최적화)
- **2026-01-08**: ACE task_types 중복 항목 통합 (build/deploy)

## Current Issues
- SCSS Deprecation 경고 (향후 마이그레이션 필요: `/` → `math.div()`)

## Next Steps
1. KiiPS-UI Maven 빌드 및 배포 (선택)
2. SCSS Deprecation 마이그레이션 (선택)
3. 새 Feature 개발 시작

## Session History

### 2026-01-08 17:00 (Documentation 완료)
- **세션 유형**: 문서화
- **완료 작업**:
  - Skills 가이드 업데이트: `UPDATE_LOG.md`에 2026-01-08 변경사항 추가
  - ACE Framework 가이드: `skills guide/ACE Framework 가이드.md` 신규 생성
    - 에이전트 계층 구조, Layer 구조, 작업 라우팅, 자원 관리 등 문서화
- **블로커**: 없음
- **다음 우선 조치**: 모든 계획된 작업 완료! 새 Feature 개발 대기

### 2026-01-08 16:00 (SCSS 빌드 완료)
- **세션 유형**: UI/UX 개선
- **완료 작업**:
  - SCSS 빌드: `theme.scss` → `theme.css`, `theme.min.css`
  - 빌드 결과 `static/css/theme.css`로 복사
- **경고 사항**:
  - Dart Sass 2.0 deprecation: `/` 연산자 → `math.div()` 마이그레이션 필요
  - 위치: `config/_helpers.scss`, `gui/_notifications.scss`, `gui/_progress-bars.scss`
- **블로커**: 없음
- **다음 우선 조치**:
  - KiiPS-UI Maven 빌드 후 배포 (선택)
  - Skills 가이드 및 ACE Framework 문서화

### 2026-01-08 15:30 (ACE Framework 최적화 + 워크플로우 구성)
- **세션 유형**: 설정 관리, 코드 리뷰
- **완료 작업**:
  - `/my-workflow` 커스텀 워크플로우 생성 (KiiPS 개발 사이클: Feature→빌드→배포→리뷰)
  - `kiips-architect` 모델 최적화: opus → sonnet (비용 ~80% 절감)
  - ACE Framework task_types 중복 제거:
    - `service_build`, `multi_service_build`, `maven_build` → `service_build` 통합
    - `service_deploy`, `multi_service_deploy`, `service_deployment` → `service_deploy` 통합
  - `ace-config.json`, `layer3-agent-model.json`, `kiips-architect.md` 모델 일관성 수정
  - 코드 리뷰 수행 및 Warning 항목 수정:
    - my-workflow.md load_context 경로 수정 (dev/active/{project}/)
    - ace-config.json primary-coordinator 모델 opus → opus-4.5 통일
- **블로커**: 없음
- **다음 우선 조치**:
  - SCSS 빌드하여 theme.css 재생성
  - Skills 가이드 및 ACE Framework 문서화

### 2026-01-08 10:10 (테마 시스템 개선 + Claude 설정 정리)
- **세션 유형**: UI/UX 개선, 설정 관리
- **완료 작업**:
  - `IL0501.jsp`: 테마 모드 적용 코드 추가 (sidemenu.jsp 미포함 페이지용)
  - `_header.scss`: 다크모드 메뉴 폰트 컬러(#FFFFFF) 및 hover 효과(#3d8ef4) 수정
  - FuturesLap 전용 다크모드 드롭다운 스타일 추가
  - Claude 설정 백업 실행
  - `/save-and-compact`와 `/update-dev-docs` 명령어 통합 (중복 제거)
  - Dev Docs 프로젝트명 변경: `payment-gateway` → `claude-code`
- **블로커**: 없음
- **다음 우선 조치**:
  - SCSS 빌드하여 theme.css 재생성 필요

### 2026-01-07 17:30 (Theme Mode / Dark Mode 작업)
- **세션 유형**: UI/UX 개선 - 테마 모드 기능 작업
- **완료 작업**:
  - `sidemenu_menutop_line_futureslap.jsp`: localStorage 기반 테마 탭 동기화 스크립트 추가
  - `_company-detail.scss`: IL0501 페이지용 다크모드 CSS 변수 및 오버라이드 추가
  - SCSS 컴파일하여 theme.css 업데이트
- **원복 작업**:
  - `header.jsp`: 화면 깜빡임(FOUC) 문제로 테마 초기화 스크립트 및 storage 이벤트 리스너 원복
- **블로커**: header.jsp에 테마 스크립트 추가 시 화면 깜빡임 발생
- **다음 우선 조치**:
  - 다크모드 탭 간 동기화 다른 방식으로 재검토 필요
  - 또는 기존 세션 기반 테마 유지 방식 활용

### 2026-01-07 (Context Compaction)
- **세션 유형**: 컨텍스트 압축 후 Dev Docs 업데이트
- **완료 작업**: 없음 (새 세션 시작)
- **블로커**: 없음
- **다음 우선 조치**: Phase 1 작업 시작 필요
