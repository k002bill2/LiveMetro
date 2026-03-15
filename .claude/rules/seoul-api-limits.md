# Seoul API 제한

- 폴링 간격: **최소 30초** (더 짧으면 차단 위험)
- API 키: 환경변수(`EXPO_PUBLIC_SEOUL_API_KEY`)로 관리
- 타임아웃: 10초 설정 필수
- 에러 시: 캐시된 데이터 반환 (빈 화면 금지)
- Rate limit: 일 1,000회 이내 유지
