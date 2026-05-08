# 필수 문서 참조 규칙

코드 수정 전 해당 영역의 문서를 Read 도구로 반드시 읽어야 합니다.

| 수정 대상 | 필수 Read 문서 |
|-----------|---------------|
| `src/` (RN 앱) | `CLAUDE.md`, `COMPONENT_SHOWCASE.md` |
| `functions/` (Firebase Functions) | `DEPLOYMENT.md`, `.claude/rules/livemetro-functions.md` |
| Firestore 보안 규칙 변경 | `firestore.rules`, `firestore.indexes.json` 직접 검토 |
| 디자인 시스템 변경 | `DESIGN_SYSTEM_2024_CHANGELOG.md`, `docs/design/` 인덱스 |
| 새 스크린/내비게이션 추가 | `App.tsx`, `src/navigation/` 구조 |
| Seoul Open Data API 호출 | `.claude/rules/seoul-api-limits.md` (rate-limit 정책) |
| Firebase 구독 관련 | `.claude/rules/subscription-cleanup.md` |
| 운영 문서 변경 | `docs/operations/` 인덱스 |

문서를 읽지 않고 수정하면 기존 패턴과 충돌합니다. "이미 알고 있다"는 근거가 아닙니다.

## 문서 관리

- `CLAUDE.md`에 새 기능 설명 추가 금지 → 적절한 `docs/` 또는 `.claude/rules/`에 추가
- 기능 구현 후 관련 문서(`README.md`, `DEPLOYMENT.md`, `docs/design/*`) 업데이트 필수
- ADR 또는 Phase 결과물은 `dev/active/<phase>/`에 보관 → 완료 후 `dev/archive/`로 이동
