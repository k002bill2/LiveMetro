# Coverage Thresholds

테스트 커버리지 최소 기준:

| 지표 | 최소 | 목표 |
|------|------|------|
| Statements | 75% | 85% |
| Functions | 70% | 80% |
| Branches | 60% | 70% |

- 새 파일 추가 시 테스트 파일도 함께 생성
- 커버리지 미달 시 PR 차단
- `npm test -- --coverage` 로 확인
