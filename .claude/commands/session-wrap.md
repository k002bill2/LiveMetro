---
description: 세션 종료 시 문서/패턴/학습/후속작업 자동 정리
---

session-wrap 스킬을 사용하여 현재 세션을 정리합니다.

1. 현재 세션의 git 변경사항과 작업 상태를 수집합니다
2. 4개 병렬 에이전트를 실행합니다:
   - Documentation Updater: 문서 업데이트 필요 여부 확인
   - Pattern Extractor: 반복 패턴 식별 및 MEMORY.md 업데이트
   - Learning Recorder: Agent Memory에 학습 기록
   - Next Steps Planner: 미완료 작업 및 다음 TODO 정리
3. 결과를 통합하여 세션 요약 리포트를 생성합니다
