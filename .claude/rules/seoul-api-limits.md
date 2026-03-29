# Seoul API 제한

- 폴링 간격: **최소 30초** (더 짧으면 차단 위험)
- API 키: 환경변수(`EXPO_PUBLIC_SEOUL_API_KEY`)로 관리
- 타임아웃: 10초 설정 필수
- 에러 시: 캐시된 데이터 반환 (빈 화면 금지)
- Rate limit: 일 1,000회 이내 유지

## BANNED (예외 없음)

| 금지 | 대체 | 이유 |
|------|------|------|
| `arvlMsg2` 텍스트만 파싱 | `barvlDt` (잔여 초) 우선 사용 | 초 단위 정확도 손실 |
| `arrivalTime ? ...` (0은 falsy) | `arrivalTime !== null ? ...` | 0초 도착이 null 처리됨 |
| `updnLine === '상행'` 만 체크 | `'상행' \|\| '내선'` 포함 | 2호선 순환선 방향 누락 |
| stationId를 역명으로 API 전달 | stationName 사용 | "0222" → 검색 결과 없음 |
| 실시간 키로 시간표 API 호출 | `DATA_PORTAL_API_KEY` 분리 | 인증 실패 |
| 에러와 빈 데이터 동일 처리 | 에러=retry, 빈 데이터="운행 종료" | UX 혼동 |
| `fetch()` without timeout | `AbortController` + 10초 | 무한 대기 |
