---
name: session-wrap
description: 세션 종료 시 4개 병렬 에이전트로 문서/패턴/학습/후속작업을 자동 정리하는 스킬
tags: [session, wrap, cleanup, documentation, learning]
---

# Session Wrap Skill

세션 종료 전에 작업 결과를 체계적으로 정리하고 다음 세션에서 원활하게 이어갈 수 있도록 합니다.

## 트리거 조건

- 사용자가 `/session-wrap` 또는 "세션 정리" 요청 시
- 장시간 작업 후 컨텍스트 압축 전
- 작업 완료 후 다음 세션 준비가 필요할 때

## 실행 프로세스

### Phase 1: 컨텍스트 수집 (순차)

현재 세션에서 수행한 작업을 요약합니다:
1. `git diff --stat` 로 변경된 파일 목록 확인
2. `git log --oneline -10` 으로 최근 커밋 확인
3. 현재 진행 중인 작업 상태 파악

### Phase 2: 4 병렬 에이전트 실행

다음 4개 에이전트를 **동시에** 실행합니다:

#### Agent 1: Documentation Updater
- 변경된 파일에 대한 문서 업데이트 필요 여부 확인
- CLAUDE.md, dev docs, README 등 관련 문서 식별
- 업데이트가 필요한 문서 목록 + 구체적 변경 내용 제안

#### Agent 2: Pattern Extractor
- 세션 중 반복된 코딩 패턴 식별
- 새로 발견된 프로젝트 관례(convention) 기록
- `MEMORY.md`에 추가할 패턴 제안

#### Agent 3: Learning Recorder
- 성공/실패 경험을 Agent Memory에 기록
- 디버깅 인사이트, 우회 방법 등 학습 사항 추출
- `agent-memory/` JSONL 파일에 기록

#### Agent 4: Next Steps Planner
- 미완료 작업 식별 및 우선순위 정리
- 다음 세션에서 이어갈 TODO 목록 생성
- 잠재적 이슈/리스크 식별

### Phase 3: 통합 요약 (순차)

4개 에이전트 결과를 통합하여:
1. **세션 요약 리포트** 생성 (`.claude/dev/active/session-summary.md`)
2. **MEMORY.md** 업데이트 (새 패턴/인사이트)
3. **Agent Memory** 기록 확인
4. 사용자에게 최종 요약 표시

## 출력 형식

```markdown
# Session Wrap Report

## 이번 세션 요약
- [변경된 파일 수]개 파일 수정
- [커밋 수]개 커밋 생성
- 주요 작업: [작업 설명]

## 문서 업데이트 필요
- [ ] [파일명]: [변경 내용]

## 새로운 패턴/인사이트
- [패턴 설명]

## 학습 기록
- [성공/실패 경험]

## 다음 세션 TODO
1. [우선순위 높은 작업]
2. [후속 작업]

## 리스크/주의사항
- [잠재 이슈]
```

## 주의사항

- 커밋되지 않은 변경사항이 있으면 먼저 커밋 여부를 확인합니다
- Agent Memory 기록 시 confidence 0.7 이상만 기록합니다
- MEMORY.md는 200줄 제한을 준수합니다 (오래된 항목 제거 후 추가)
