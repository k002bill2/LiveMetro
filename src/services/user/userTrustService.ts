/**
 * User Trust Service
 * Manages user trust scores based on reporting behavior
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

/**
 * User trust profile
 */
export interface UserTrustProfile {
  readonly userId: string;
  readonly trustScore: number; // 0-100
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

/**
 * Trust levels
 */
export type TrustLevel =
  | 'new'         // 0-20 score, < 5 reports
  | 'basic'       // 20-40 score
  | 'trusted'     // 40-60 score
  | 'verified'    // 60-80 score
  | 'expert'      // 80-100 score
  | 'suspended';  // Trust violations

/**
 * Trust badges
 */
export interface TrustBadge {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly earnedAt: Date;
  readonly icon: string;
}

/**
 * Report verification result
 */
export interface ReportVerificationResult {
  readonly reportId: string;
  readonly userId: string;
  readonly verified: boolean;
  readonly verifiedBy: 'system' | 'admin' | 'community';
  readonly confidence: number;
  readonly reason: string;
  readonly timestamp: Date;
}

/**
 * Trust score change event
 */
export interface TrustScoreChange {
  readonly userId: string;
  readonly previousScore: number;
  readonly newScore: number;
  readonly change: number;
  readonly reason: string;
  readonly timestamp: Date;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = '@livemetro:user_trust_profiles';
const HISTORY_KEY = '@livemetro:trust_score_history';

// Score changes
const SCORE_CHANGES = {
  REPORT_VERIFIED: 5,
  REPORT_REJECTED: -10,
  REPORT_PENDING: 0,
  FIRST_REPORT: 2,
  CONSECUTIVE_VERIFIED: 3, // Bonus for 3+ verified in a row
  HELPFUL_VOTE: 1,
  SPAM_DETECTED: -20,
  FRAUD_DETECTED: -30,
  ACCOUNT_AGE_BONUS: 0.5, // Per month, max 10
} as const;

// Trust level thresholds - exported for external configuration
export const TRUST_THRESHOLDS: Record<TrustLevel, { min: number; max: number }> = {
  new: { min: 0, max: 20 },
  basic: { min: 20, max: 40 },
  trusted: { min: 40, max: 60 },
  verified: { min: 60, max: 80 },
  expert: { min: 80, max: 100 },
  suspended: { min: -100, max: 0 },
};

// Badge definitions
const BADGE_DEFINITIONS: Record<string, Omit<TrustBadge, 'id' | 'earnedAt'>> = {
  first_report: {
    name: '첫 제보자',
    description: '첫 번째 지연 제보를 완료했습니다',
    icon: '🎉',
  },
  verified_10: {
    name: '신뢰할 수 있는 제보자',
    description: '10건의 제보가 검증되었습니다',
    icon: '✅',
  },
  verified_50: {
    name: '베테랑 제보자',
    description: '50건의 제보가 검증되었습니다',
    icon: '🏆',
  },
  early_reporter: {
    name: '신속 제보자',
    description: '공식 발표 전에 지연을 제보했습니다',
    icon: '⚡',
  },
  consistent: {
    name: '꾸준한 제보자',
    description: '30일 연속 정확한 제보를 유지했습니다',
    icon: '📊',
  },
  expert: {
    name: '전문가',
    description: '신뢰도 점수 80점 이상을 달성했습니다',
    icon: '👑',
  },
};

// ============================================================================
// Service
// ============================================================================

class UserTrustService {
  private profiles: Map<string, UserTrustProfile> = new Map();
  private scoreHistory: Map<string, TrustScoreChange[]> = new Map();
  private initialized = false;

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const profileData = await AsyncStorage.getItem(STORAGE_KEY);
      if (profileData) {
        const parsed = JSON.parse(profileData);
        for (const [key, value] of Object.entries(parsed)) {
          const profile = value as UserTrustProfile;
          this.profiles.set(key, {
            ...profile,
            lastReportAt: profile.lastReportAt ? new Date(profile.lastReportAt) : undefined,
            lastVerifiedAt: profile.lastVerifiedAt ? new Date(profile.lastVerifiedAt) : undefined,
            createdAt: new Date(profile.createdAt),
            updatedAt: new Date(profile.updatedAt),
          });
        }
      }

      const historyData = await AsyncStorage.getItem(HISTORY_KEY);
      if (historyData) {
        const parsed = JSON.parse(historyData);
        for (const [key, value] of Object.entries(parsed)) {
          this.scoreHistory.set(key, value as TrustScoreChange[]);
        }
      }
    } catch {
      // Ignore storage errors
    }

    this.initialized = true;
  }

  /**
   * Get or create user trust profile
   */
  async getProfile(userId: string): Promise<UserTrustProfile> {
    await this.initialize();

    const existing = this.profiles.get(userId);
    if (existing) return existing;

    // Create new profile
    const newProfile: UserTrustProfile = {
      userId,
      trustScore: 10, // Starting score
      trustLevel: 'new',
      totalReports: 0,
      verifiedReports: 0,
      rejectedReports: 0,
      pendingReports: 0,
      badges: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.profiles.set(userId, newProfile);
    await this.saveProfiles();

    return newProfile;
  }

  /**
   * Process report verification
   */
  async processVerification(result: ReportVerificationResult): Promise<TrustScoreChange> {
    await this.initialize();

    const profile = await this.getProfile(result.userId);
    let scoreChange = 0;
    let reason = '';

    if (result.verified) {
      scoreChange = SCORE_CHANGES.REPORT_VERIFIED;
      reason = '제보가 검증되었습니다';

      // Consecutive verified bonus
      const history = this.scoreHistory.get(result.userId) ?? [];
      const recentVerified = history
        .slice(-3)
        .filter(h => h.reason.includes('검증'));
      if (recentVerified.length >= 2) {
        scoreChange += SCORE_CHANGES.CONSECUTIVE_VERIFIED;
        reason += ' (연속 검증 보너스)';
      }
    } else {
      scoreChange = SCORE_CHANGES.REPORT_REJECTED;
      reason = `제보가 거부되었습니다: ${result.reason}`;
    }

    // Apply score change
    const newScore = Math.max(-100, Math.min(100, profile.trustScore + scoreChange));
    const newLevel = this.calculateTrustLevel(newScore);

    const updatedProfile: UserTrustProfile = {
      ...profile,
      trustScore: newScore,
      trustLevel: newLevel,
      totalReports: profile.totalReports + 1,
      verifiedReports: result.verified ? profile.verifiedReports + 1 : profile.verifiedReports,
      rejectedReports: result.verified ? profile.rejectedReports : profile.rejectedReports + 1,
      pendingReports: Math.max(0, profile.pendingReports - 1),
      lastReportAt: new Date(),
      lastVerifiedAt: result.verified ? new Date() : profile.lastVerifiedAt,
      badges: this.checkAndAwardBadges(profile, result.verified),
      updatedAt: new Date(),
    };

    this.profiles.set(result.userId, updatedProfile);

    // Record history
    const change: TrustScoreChange = {
      userId: result.userId,
      previousScore: profile.trustScore,
      newScore,
      change: scoreChange,
      reason,
      timestamp: new Date(),
    };

    const history = this.scoreHistory.get(result.userId) ?? [];
    history.push(change);
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    this.scoreHistory.set(result.userId, history);

    await this.saveProfiles();
    await this.saveHistory();

    return change;
  }

  /**
   * Record new report submission
   */
  async recordReportSubmission(userId: string): Promise<void> {
    await this.initialize();

    const profile = await this.getProfile(userId);
    const isFirstReport = profile.totalReports === 0;

    const updatedProfile: UserTrustProfile = {
      ...profile,
      pendingReports: profile.pendingReports + 1,
      lastReportAt: new Date(),
      badges: isFirstReport
        ? this.awardBadge(profile.badges, 'first_report')
        : profile.badges,
      updatedAt: new Date(),
    };

    if (isFirstReport) {
      updatedProfile.trustScore + SCORE_CHANGES.FIRST_REPORT;
    }

    this.profiles.set(userId, updatedProfile);
    await this.saveProfiles();
  }

  /**
   * Apply penalty for fraud/spam
   */
  async applyPenalty(
    userId: string,
    type: 'spam' | 'fraud',
    reason: string
  ): Promise<TrustScoreChange> {
    await this.initialize();

    const profile = await this.getProfile(userId);
    const scoreChange = type === 'fraud'
      ? SCORE_CHANGES.FRAUD_DETECTED
      : SCORE_CHANGES.SPAM_DETECTED;

    const newScore = Math.max(-100, profile.trustScore + scoreChange);
    const newLevel = newScore < 0 ? 'suspended' : this.calculateTrustLevel(newScore);

    const updatedProfile: UserTrustProfile = {
      ...profile,
      trustScore: newScore,
      trustLevel: newLevel,
      updatedAt: new Date(),
    };

    this.profiles.set(userId, updatedProfile);

    const change: TrustScoreChange = {
      userId,
      previousScore: profile.trustScore,
      newScore,
      change: scoreChange,
      reason: `${type === 'fraud' ? '허위 제보' : '스팸'} 감지: ${reason}`,
      timestamp: new Date(),
    };

    const history = this.scoreHistory.get(userId) ?? [];
    history.push(change);
    this.scoreHistory.set(userId, history);

    await this.saveProfiles();
    await this.saveHistory();

    return change;
  }

  /**
   * Check if user can submit reports
   */
  async canSubmitReport(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    cooldownMinutes?: number;
  }> {
    const profile = await this.getProfile(userId);

    // Suspended users cannot submit
    if (profile.trustLevel === 'suspended') {
      return {
        allowed: false,
        reason: '계정이 일시 정지되었습니다. 고객센터에 문의하세요.',
      };
    }

    // Rate limiting based on trust level
    const maxPending: Record<TrustLevel, number> = {
      new: 2,
      basic: 3,
      trusted: 5,
      verified: 10,
      expert: 20,
      suspended: 0,
    };

    if (profile.pendingReports >= maxPending[profile.trustLevel]) {
      return {
        allowed: false,
        reason: '이전 제보가 검증될 때까지 기다려주세요.',
      };
    }

    // Cooldown for new/basic users
    if (profile.lastReportAt && ['new', 'basic'].includes(profile.trustLevel)) {
      const cooldownMs = profile.trustLevel === 'new' ? 5 * 60 * 1000 : 2 * 60 * 1000;
      const elapsed = Date.now() - profile.lastReportAt.getTime();

      if (elapsed < cooldownMs) {
        return {
          allowed: false,
          reason: '너무 빠르게 제보하고 있습니다. 잠시 후 다시 시도하세요.',
          cooldownMinutes: Math.ceil((cooldownMs - elapsed) / 60000),
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Get trust level label
   */
  getTrustLevelLabel(level: TrustLevel): string {
    const labels: Record<TrustLevel, string> = {
      new: '신규 사용자',
      basic: '일반 사용자',
      trusted: '신뢰할 수 있는 사용자',
      verified: '검증된 사용자',
      expert: '전문가',
      suspended: '이용 정지',
    };
    return labels[level];
  }

  /**
   * Get trust level color
   */
  getTrustLevelColor(level: TrustLevel): string {
    const colors: Record<TrustLevel, string> = {
      new: '#9E9E9E',
      basic: '#2196F3',
      trusted: '#4CAF50',
      verified: '#FF9800',
      expert: '#9C27B0',
      suspended: '#F44336',
    };
    return colors[level];
  }

  /**
   * Get score history
   */
  async getScoreHistory(userId: string, limit = 20): Promise<readonly TrustScoreChange[]> {
    await this.initialize();
    const history = this.scoreHistory.get(userId) ?? [];
    return history.slice(-limit);
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit = 10): Promise<readonly UserTrustProfile[]> {
    await this.initialize();

    return Array.from(this.profiles.values())
      .filter(p => p.trustLevel !== 'suspended')
      .sort((a, b) => b.trustScore - a.trustScore)
      .slice(0, limit);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate trust level from score
   */
  private calculateTrustLevel(score: number): TrustLevel {
    if (score < 0) return 'suspended';
    if (score < 20) return 'new';
    if (score < 40) return 'basic';
    if (score < 60) return 'trusted';
    if (score < 80) return 'verified';
    return 'expert';
  }

  /**
   * Check and award badges
   */
  private checkAndAwardBadges(
    profile: UserTrustProfile,
    wasVerified: boolean
  ): readonly TrustBadge[] {
    let badges = [...profile.badges];

    if (wasVerified) {
      const newVerifiedCount = profile.verifiedReports + 1;

      // 10 verified reports badge
      if (newVerifiedCount === 10 && !badges.find(b => b.id === 'verified_10')) {
        badges = this.awardBadge(badges, 'verified_10');
      }

      // 50 verified reports badge
      if (newVerifiedCount === 50 && !badges.find(b => b.id === 'verified_50')) {
        badges = this.awardBadge(badges, 'verified_50');
      }
    }

    // Expert badge
    const newScore = profile.trustScore + (wasVerified ? SCORE_CHANGES.REPORT_VERIFIED : SCORE_CHANGES.REPORT_REJECTED);
    if (newScore >= 80 && !badges.find(b => b.id === 'expert')) {
      badges = this.awardBadge(badges, 'expert');
    }

    return badges;
  }

  /**
   * Award a badge
   */
  private awardBadge(
    badges: readonly TrustBadge[],
    badgeId: string
  ): TrustBadge[] {
    const definition = BADGE_DEFINITIONS[badgeId];
    if (!definition) return [...badges];

    const newBadge: TrustBadge = {
      id: badgeId,
      ...definition,
      earnedAt: new Date(),
    };

    return [...badges, newBadge];
  }

  /**
   * Save profiles to storage
   */
  private async saveProfiles(): Promise<void> {
    try {
      const data = Object.fromEntries(this.profiles);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Save history to storage
   */
  private async saveHistory(): Promise<void> {
    try {
      const data = Object.fromEntries(this.scoreHistory);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const userTrustService = new UserTrustService();
export default userTrustService;
