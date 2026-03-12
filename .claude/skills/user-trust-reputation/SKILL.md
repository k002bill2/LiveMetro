---
name: user-trust-reputation
description: "사용자 신뢰도 및 평판 시스템. 신뢰도 점수 관리, 뱃지 시스템, 사기 탐지, 리포트 검증. Use when: (1) 신뢰도 점수 계산/업데이트, (2) 뱃지 획득 조건, (3) 부정행위 탐지, (4) 사용자 평판 표시. 트리거: 신뢰도, trust, 평판, reputation, 뱃지, badge, 사기탐지, fraud, 검증, verification."
---

# User Trust & Reputation System

## Overview

사용자의 지연 제보 정확도를 기반으로 신뢰도 점수(0-100)를 관리하고, 뱃지를 수여하며, 부정행위를 탐지하는 시스템. 클라이언트(AsyncStorage) + 서버(Firestore) 이중 저장 구조.

## Architecture

```
DelayReportForm → userTrustService.recordReportSubmission()
                → fraudDetectionService.analyzeReport()
                     ↓
              Firestore: delay_reports (status: pending)
                     ↓
              reportVerification (Cloud Function)
                ├── autoVerifyReports (5분 스케줄)
                ├── onDelayReportCreated (커뮤니티 교차검증)
                └── verifyDelayReport (관리자 수동)
                     ↓
              userTrustService.processVerification()
                ├── 점수 갱신 → TrustLevel 재계산
                ├── 뱃지 확인 → 신규 뱃지 수여
                └── notificationTriggers.onBadgeEarned()
```

## TrustLevel 구조

| Level | 점수 범위 | 한국어 | 색상 | maxPending | 쿨다운 |
|-------|----------|--------|------|------------|--------|
| `new` | 0-19 | 신규 사용자 | `#9E9E9E` | 2 | 5분 |
| `basic` | 20-39 | 일반 사용자 | `#2196F3` | 3 | 2분 |
| `trusted` | 40-59 | 신뢰할 수 있는 사용자 | `#4CAF50` | 5 | 없음 |
| `verified` | 60-79 | 검증된 사용자 | `#FF9800` | 10 | 없음 |
| `expert` | 80-100 | 전문가 | `#9C27B0` | 20 | 없음 |
| `suspended` | < 0 | 이용 정지 | `#F44336` | 0 | 차단 |

```typescript
// src/services/user/userTrustService.ts
export type TrustLevel =
  | 'new' | 'basic' | 'trusted' | 'verified' | 'expert' | 'suspended';
```

신규 사용자 초기 점수는 **10점** (`new` 레벨).

## 점수 변동 규칙

| 이벤트 | 점수 변화 | 비고 |
|--------|----------|------|
| 제보 검증됨 | +5 | `REPORT_VERIFIED` |
| 제보 거부됨 | -10 | `REPORT_REJECTED` |
| 첫 제보 | +2 | `FIRST_REPORT` |
| 연속 3회+ 검증 | +3 (보너스) | `CONSECUTIVE_VERIFIED` |
| 도움됨 투표 | +1 | `HELPFUL_VOTE` |
| 스팸 감지 | -20 | `SPAM_DETECTED` |
| 허위 제보 감지 | -30 | `FRAUD_DETECTED` |
| 계정 나이 보너스 | +0.5/월 (max 10) | `ACCOUNT_AGE_BONUS` |

점수 범위: `-100 ~ 100` (Math.max/min 클램핑)

### 점수 업데이트 코드 패턴

```typescript
import { userTrustService } from '@/services/user';

// 제보 제출 시
await userTrustService.recordReportSubmission(userId);

// 검증 결과 처리
const change = await userTrustService.processVerification({
  reportId: 'report-id',
  userId: 'user-id',
  verified: true,
  verifiedBy: 'system', // 'system' | 'admin' | 'community'
  confidence: 0.9,
  reason: 'Matches official data',
  timestamp: new Date(),
});
// change: { previousScore, newScore, change, reason }

// 페널티 적용
const penalty = await userTrustService.applyPenalty(
  userId,
  'fraud', // 'spam' | 'fraud'
  '허위 지연 제보'
);
```

## 뱃지 시스템

| ID | 이름 | 획득 조건 | 아이콘 |
|----|------|----------|--------|
| `first_report` | 첫 제보자 | 첫 번째 제보 제출 | 🎉 |
| `verified_10` | 신뢰할 수 있는 제보자 | 검증된 제보 10건 | ✅ |
| `verified_50` | 베테랑 제보자 | 검증된 제보 50건 | 🏆 |
| `early_reporter` | 신속 제보자 | 공식 발표 전 제보 | ⚡ |
| `consistent` | 꾸준한 제보자 | 30일 연속 정확한 제보 | 📊 |
| `expert` | 전문가 | 신뢰도 80점 달성 | 👑 |

```typescript
// TrustBadge 인터페이스
interface TrustBadge {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly earnedAt: Date;
  readonly icon: string;
}
```

뱃지 수여는 `processVerification()` 내부에서 `checkAndAwardBadges()`를 통해 자동 처리됨. `recordReportSubmission()`에서는 `first_report` 뱃지만 처리.

## 사기 탐지 (FraudDetectionService)

### 탐지 규칙

| 플래그 | 심각도 | 점수 | 조건 |
|--------|--------|------|------|
| `rapid_reporting` | medium | +20 | 10분 내 3건 이상 제보 |
| `inconsistent_delay` | high | +25 | 다른 제보 대비 15분+ 차이 |
| `extreme_delay` | medium | +15 | 60분 초과 지연 제보 |
| `repeat_offender` | high | +20 | 3건+ 플래그 & trustScore < 50 |
| `time_anomaly` | low | +10 | 새벽 1-5시 제보 |

### 판정 기준 (fraudScore 합산)

| fraudScore | recommendation | isSuspicious |
|------------|---------------|-------------|
| 0-24 | `accept` | false |
| 25-49 | `review` | true |
| 50+ | `reject` | true |

```typescript
import { fraudDetectionService } from '@/services/delay/fraudDetectionService';

const result = await fraudDetectionService.analyzeReport(report, otherReports);
// result: { isSuspicious, fraudScore, flags, recommendation }

if (result.recommendation === 'reject') {
  await userTrustService.applyPenalty(userId, 'fraud', 'Auto-detected');
}
```

## 제보 제출 권한 (Rate Limiting)

```typescript
const { allowed, reason, cooldownMinutes } = await userTrustService.canSubmitReport(userId);

if (!allowed) {
  Alert.alert('제보 불가', reason);
  return;
}
```

**차단 조건:**
1. `suspended` 레벨 → 완전 차단
2. pending 제보 수 >= maxPending (레벨별 상이) → 대기 필요
3. `new`/`basic` 레벨 쿨다운 미경과 → 시간 대기

## Firebase 저장 구조

### 클라이언트 (AsyncStorage)

| 키 | 내용 |
|----|------|
| `@livemetro:user_trust_profiles` | `Map<userId, UserTrustProfile>` JSON |
| `@livemetro:trust_score_history` | `Map<userId, TrustScoreChange[]>` JSON (최대 100건/user) |
| `@livemetro:fraud_profiles` | `Map<userId, UserFraudProfile>` JSON |

### 서버 (Firestore)

| 컬렉션 | 문서 ID | 주요 필드 |
|--------|---------|----------|
| `user_trust_profiles` | `{userId}` | trustScore, trustLevel, totalReports, verifiedReports, rejectedReports, badges[] |
| `delay_reports` | auto | userId, lineId, stationId, delayMinutes, status, verifiedBy, verifiedAt |
| `verification_log` | auto | reportId, adminId, action, reason, timestamp |

### Cloud Functions (asia-northeast3)

| 함수 | 트리거 | 역할 |
|------|--------|------|
| `verifyDelayReport` | HTTPS callable | 관리자 수동 검증/거부 |
| `autoVerifyReports` | 5분 스케줄 | 신뢰 사용자(60+) 자동 검증 |
| `onDelayReportCreated` | Firestore onCreate | 2+ 유사 제보 시 커뮤니티 교차 검증 |
| `onBadgeEarned` | Firestore onUpdate | 새 뱃지 → 푸시 알림 |

### 자동 검증 조건 (autoVerifyReports)

```typescript
const DEFAULT_AUTO_CONFIG = {
  minTrustScore: 60,        // verified 이상
  maxDelayMinutes: 30,      // 30분 이내 지연만
  requireLocationMatch: false,
  minSimilarReports: 2,     // 동일 노선 10분 내 2건+
};
```

- trustScore >= 80 (expert) → 유사 제보 없이도 자동 검증
- trustScore >= 60 + 유사 제보 2건+ → 자동 검증

## 테스트 패턴

```typescript
// jest.mock 패턴
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

// 사용자 정지 테스트
for (let i = 0; i < 5; i++) {
  await userTrustService.applyPenalty(userId, 'fraud', 'violation');
}
const result = await userTrustService.canSubmitReport(userId);
expect(result.allowed).toBe(false);
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/services/user/userTrustService.ts` | 신뢰도 점수/뱃지 관리 핵심 서비스 |
| `src/services/user/index.ts` | 타입/서비스 재Export |
| `src/services/delay/fraudDetectionService.ts` | 부정행위 탐지 엔진 |
| `src/models/user.ts` | User, UserPreferences 모델 (trust 타입은 서비스에 정의) |
| `functions/src/admin/reportVerification.ts` | 서버 검증 Cloud Functions |
| `functions/src/triggers/notificationTriggers.ts` | 뱃지 알림 트리거 |
| `src/services/user/__tests__/userTrustService.test.ts` | Trust 서비스 테스트 |
| `src/services/delay/__tests__/fraudDetectionService.test.ts` | Fraud 서비스 테스트 |

## 주의사항

1. **타입 위치**: `UserTrustProfile`, `TrustLevel`, `TrustBadge`는 `src/models/user.ts`가 아닌 `src/services/user/userTrustService.ts`에 정의됨
2. **이중 저장**: 클라이언트(AsyncStorage)와 서버(Firestore)가 독립적으로 저장 — 동기화 로직은 미구현
3. **싱글톤**: `userTrustService`, `fraudDetectionService` 모두 클래스 인스턴스 싱글톤 Export
4. **초기화**: 첫 호출 시 `initialize()`가 lazy하게 실행 (AsyncStorage 로드)
5. **Immutability**: 모든 인터페이스 필드에 `readonly` 적용, 업데이트 시 spread로 새 객체 생성
6. **히스토리 제한**: 사용자당 최대 100건, 초과 시 오래된 것부터 삭제
