# Error Handling

- 서비스 함수: 에러 시 빈 배열(`[]`) 또는 `null` 반환 (throw 금지)
- 컴포넌트: `ErrorBoundary`로 UI 크래시 방지
- 비동기: `try/catch`로 모든 async 작업 감싸기
- 사용자 메시지: 기술 에러 노출 금지, 친화적 메시지 표시
- 로깅: 에러 상세는 console.error로 개발 중만 허용
