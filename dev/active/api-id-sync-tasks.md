# API 키 관리 및 역 ID 동기화 - Tasks

## Completed
- [x] ApiKeyManager 클래스 생성 (Round-Robin + Failover)
- [x] seoulSubwayApi에 ApiKeyManager 통합
- [x] .env에 백업 API 키 추가
- [x] 역 순서 정렬 (fr_code 기준)
- [x] useStationNavigation 다중 매칭 전략 적용
- [x] searchStations 로컬 폴백 추가
- [x] 시간표 API 에러 수정 (Optional Chaining, 응답 검증)
- [x] CORS 문제 처리 (웹 플랫폼 체크)
- [x] useTrainSchedule → seoulSubwayApi 사용하도록 변경
- [x] 시간표 "2시간 내" 필터 제거

## In Progress
- [ ] 네이티브 환경에서 시간표 API 실제 테스트
- [ ] 앱 테스트로 ID 동기화 확인

## Pending
- [ ] 기존 즐겨찾기 마이그레이션 스크립트 (필요 시)
- [ ] Firebase 역 데이터 업로드/검증 (필요 시)

## Notes
- 새로 추가한 즐겨찾기부터 정상 작동 예상
- 기존 즐겨찾기는 ID 형식 불일치 가능성 있음
- 웹 환경: 시간표 API (HTTP) 사용 불가 → 빈 결과 반환
- 네이티브 환경: 시간표 API 정상 작동 예상
