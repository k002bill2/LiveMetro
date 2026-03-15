# Subscription Cleanup

모든 구독/비동기 작업에 cleanup 필수:

- `useEffect` → return 함수에서 구독 해제
- Firebase `onSnapshot` → `unsubscribe()` 호출
- `setInterval`/`setTimeout` → `clearInterval`/`clearTimeout`
- EventListener → `removeEventListener`
- AbortController → `abort()` on unmount

cleanup 누락 = 메모리 누수 → PR 차단 사유
