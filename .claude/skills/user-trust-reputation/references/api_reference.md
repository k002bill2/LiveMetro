# User Trust & Reputation API Reference

## UserTrustService

싱글톤: `userTrustService` (`src/services/user/userTrustService.ts`)

### Public Methods

#### `getProfile(userId: string): Promise<UserTrustProfile>`
사용자 프로필 조회. 미존재 시 초기 프로필 생성 (trustScore: 10, level: 'new').

#### `processVerification(result: ReportVerificationResult): Promise<TrustScoreChange>`
제보 검증 결과를 반영하여 점수/레벨/뱃지를 갱신.
- 검증됨: +5점 (연속 3회+ 시 추가 +3)
- 거부됨: -10점
- 반환: `{ previousScore, newScore, change, reason }`

#### `recordReportSubmission(userId: string): Promise<void>`
제보 제출 기록. pendingReports +1. 첫 제보 시 `first_report` 뱃지 수여.

#### `applyPenalty(userId, type, reason): Promise<TrustScoreChange>`
- `type: 'spam'` → -20점
- `type: 'fraud'` → -30점
- 점수 < 0 → 자동 `suspended`

#### `canSubmitReport(userId: string): Promise<{ allowed, reason?, cooldownMinutes? }>`
제보 가능 여부. 차단 조건: suspended / maxPending 초과 / 쿨다운 미경과.

#### `getTrustLevelLabel(level: TrustLevel): string`
한국어 레이블 반환. 예: `'verified'` → `'검증된 사용자'`

#### `getTrustLevelColor(level: TrustLevel): string`
색상 코드 반환. 예: `'expert'` → `'#9C27B0'`

#### `getScoreHistory(userId, limit?): Promise<readonly TrustScoreChange[]>`
점수 변동 히스토리 (기본 20건, 최근 순).

#### `getLeaderboard(limit?): Promise<readonly UserTrustProfile[]>`
점수 내림차순 리더보드 (suspended 제외, 기본 10명).

---

## FraudDetectionService

싱글톤: `fraudDetectionService` (`src/services/delay/fraudDetectionService.ts`)

### Public Methods

#### `analyzeReport(report, otherReports): Promise<FraudDetectionResult>`
제보를 5가지 규칙으로 분석. 반환:
```typescript
{
  isSuspicious: boolean;    // fraudScore >= 25
  fraudScore: number;       // 0-100
  flags: FraudFlag[];       // 탐지된 플래그 목록
  recommendation: 'accept' | 'review' | 'reject';
}
```

#### `getUserProfile(userId): Promise<UserFraudProfile>`
사기 탐지용 사용자 프로필. 미존재 시 기본값 반환 (trustScore: 100).

#### `updateUserProfile(userId, wasFraudulent): Promise<void>`
리뷰 결과 반영. 허위 시 flaggedReports +1, trustScore 재계산.

#### `isUserTrusted(userId): Promise<boolean>`
trustScore >= 20 여부.

#### `getTrustLevelLabel(trustScore: number): string`
숫자 기반 레이블: 90+: '매우 높음', 70+: '높음', 50+: '보통', 30+: '낮음', 그 외: '매우 낮음'

---

## Type Definitions

### UserTrustProfile
```typescript
interface UserTrustProfile {
  readonly userId: string;
  readonly trustScore: number;       // -100 ~ 100
  readonly trustLevel: TrustLevel;
  readonly totalReports: number;
  readonly verifiedReports: number;
  readonly rejectedReports: number;
  readonly pendingReports: number;
  readonly lastReportAt?: Date;
  readonly lastVerifiedAt?: Date;
  readonly badges: readonly TrustBadge[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

### TrustLevel
```typescript
type TrustLevel = 'new' | 'basic' | 'trusted' | 'verified' | 'expert' | 'suspended';
```

### TrustBadge
```typescript
interface TrustBadge {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly earnedAt: Date;
  readonly icon: string;
}
```

### ReportVerificationResult
```typescript
interface ReportVerificationResult {
  readonly reportId: string;
  readonly userId: string;
  readonly verified: boolean;
  readonly verifiedBy: 'system' | 'admin' | 'community';
  readonly confidence: number;
  readonly reason: string;
  readonly timestamp: Date;
}
```

### TrustScoreChange
```typescript
interface TrustScoreChange {
  readonly userId: string;
  readonly previousScore: number;
  readonly newScore: number;
  readonly change: number;
  readonly reason: string;
  readonly timestamp: Date;
}
```

### FraudDetectionResult
```typescript
interface FraudDetectionResult {
  readonly isSuspicious: boolean;
  readonly fraudScore: number;
  readonly flags: readonly FraudFlag[];
  readonly recommendation: 'accept' | 'review' | 'reject';
}
```

### FraudFlag
```typescript
interface FraudFlag {
  readonly type: FraudFlagType;
  readonly severity: 'low' | 'medium' | 'high';
  readonly description: string;
  readonly evidence?: string;
}
```

### FraudFlagType
```typescript
type FraudFlagType =
  | 'rapid_reporting'
  | 'inconsistent_delay'
  | 'unusual_location'
  | 'pattern_anomaly'
  | 'no_official_delay'
  | 'extreme_delay'
  | 'repeat_offender'
  | 'time_anomaly';
```

### ReportForAnalysis
```typescript
interface ReportForAnalysis {
  readonly id: string;
  readonly userId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly delayMinutes: number;
  readonly timestamp: Date;
  readonly reason?: string;
}
```

### UserFraudProfile
```typescript
interface UserFraudProfile {
  readonly userId: string;
  readonly totalReports: number;
  readonly flaggedReports: number;
  readonly trustScore: number;
  readonly lastFlaggedAt?: Date;
  readonly flags: readonly string[];   // ISO 날짜 문자열 배열
}
```

---

## Cloud Functions (asia-northeast3)

### verifyDelayReport (HTTPS Callable)
```typescript
// Request
{ reportId: string; action: 'verify' | 'reject'; reason?: string }
// Response
{ success: boolean; message: string }
```
관리자 전용. `context.auth.uid`로 admin 역할 확인.

### autoVerifyReports (PubSub Schedule: every 5 minutes)
pending 제보 최대 50건 처리. 자동 검증 조건:
- trustScore >= 60 + 유사 제보 2건+
- trustScore >= 80 (expert) → 무조건 검증

### onDelayReportCreated (Firestore onCreate: delay_reports)
동일 노선 10분 내 pending 제보 2건+ → 지연 차이 10분 이내 시 일괄 community 검증.

### onBadgeEarned (Firestore onUpdate: user_trust_profiles)
before/after 뱃지 비교 → 새 뱃지 발견 시 FCM 푸시 알림.

---

## Constants

### Score Changes
```typescript
const SCORE_CHANGES = {
  REPORT_VERIFIED: 5,
  REPORT_REJECTED: -10,
  REPORT_PENDING: 0,
  FIRST_REPORT: 2,
  CONSECUTIVE_VERIFIED: 3,
  HELPFUL_VOTE: 1,
  SPAM_DETECTED: -20,
  FRAUD_DETECTED: -30,
  ACCOUNT_AGE_BONUS: 0.5,  // 월당, 최대 10
};
```

### Trust Thresholds
```typescript
const TRUST_THRESHOLDS: Record<TrustLevel, { min: number; max: number }> = {
  new: { min: 0, max: 20 },
  basic: { min: 20, max: 40 },
  trusted: { min: 40, max: 60 },
  verified: { min: 60, max: 80 },
  expert: { min: 80, max: 100 },
  suspended: { min: -100, max: 0 },
};
```

### Fraud Thresholds
```typescript
const RAPID_REPORT_THRESHOLD = 3;       // 10분 내 최대 제보 수
const RAPID_REPORT_WINDOW_MS = 600000;   // 10분
const EXTREME_DELAY_THRESHOLD = 60;      // 60분 초과 = extreme
const MIN_TRUST_SCORE = 20;              // isUserTrusted 기준
```

### Max Pending Reports (by TrustLevel)
```typescript
{ new: 2, basic: 3, trusted: 5, verified: 10, expert: 20, suspended: 0 }
```

### Cooldown (by TrustLevel)
```typescript
{ new: 300000 /* 5분 */, basic: 120000 /* 2분 */ }
// trusted, verified, expert: 쿨다운 없음
```

### AsyncStorage Keys
```typescript
'@livemetro:user_trust_profiles'   // Map<userId, UserTrustProfile>
'@livemetro:trust_score_history'   // Map<userId, TrustScoreChange[]>
'@livemetro:fraud_profiles'        // Map<userId, UserFraudProfile>
```

### Firestore Collections
```typescript
'user_trust_profiles'  // 문서 ID: userId
'delay_reports'        // auto ID
'verification_log'     // auto ID
'users'                // 문서 ID: userId (role/isAdmin 필드)
```
