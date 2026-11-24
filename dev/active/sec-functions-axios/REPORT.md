# REPORT — functions 의존성 보안 갱신

## 변경 (functions/package-lock.json만)
- axios 1.13.2 → 1.21.1 (≥1.20.0 충족)
- @fastify/busboy 3.2.0 → 3.2.6 (≥3.2.2 충족)
- axios 하위 의존성: follow-redirects 1.15.11→1.16.3, form-data 4.0.5→4.0.6, proxy-from-env 1.1.0→2.1.0, axios 중첩 https-proxy-agent 5.0.1·agent-base 6.0.2 신규
- package.json 변경 없음.

## 절차 메모
- 샌드박스에서 ~/.npm 캐시가 root 소유라 `--cache $TMPDIR/npmc` 사용.
- `npm update` 원본 결과는 무관한 lock 변경(`peer: true` 플래그 다수, @emnapi/core·runtime 제거)이 섞여 있어 폐기. 새 lock에서 위 패키지 항목만 옛 lock에 반영(peer 플래그 제외)하는 방식으로 재작성 (BRIEF 절차 2의 재시도 경로).
- diff stat: 1 file, 50 insertions(+), 21 deletions(-).

## 게이트 (functions/)
- `npm ci` → exit 0 (594 packages; EBADENGINE 경고: 로컬 node 24 vs engines 22)
- `npm run build` → exit 0
- `npm test` → 12 suites / 196 tests passed
- `npm run lint` → exit 0 (0 errors, 1 기존 warning: expoSdkLoader.ts:25 unused eslint-disable)
- `npm ls axios @fastify/busboy` → axios@1.21.1, @fastify/busboy@3.2.6

## 남은 위험
- axios 1.13→1.21 minor 점프: @sendgrid/client 실제 메일 발송은 테스트에서 mock이라 실환경 미검증.
- main 병합 시 firebase-deploy.yml이 운영 배포 시작. push 안 함.
- osv-scanner 재스캔은 미실행.

검증: 위 게이트 4종+npm ls 실행. osv-scanner·실제 SendGrid 호출 미검증.
위험·영향 범위: 이메일 발송(sendgrid), 파일 업로드 파싱(firebase-admin busboy 경유).
되돌리는 법: 이 커밋 revert (git revert <SHA>).
