/**
 * Delay Report Models
 * 실시간 지연 제보 데이터 모델
 */

/**
 * Report type categories
 */
export enum ReportType {
  DELAY = 'delay',
  ACCIDENT = 'accident',
  CROWDED = 'crowded',
  DOOR_ISSUE = 'door_issue',
  SIGNAL_ISSUE = 'signal_issue',
  STOPPED = 'stopped',
  OTHER = 'other',
}

/**
 * Report type display names
 */
export const ReportTypeLabels: Record<ReportType, string> = {
  [ReportType.DELAY]: '지연',
  [ReportType.ACCIDENT]: '사고',
  [ReportType.CROWDED]: '혼잡',
  [ReportType.DOOR_ISSUE]: '출입문 고장',
  [ReportType.SIGNAL_ISSUE]: '신호 장애',
  [ReportType.STOPPED]: '운행 중단',
  [ReportType.OTHER]: '기타',
};

/**
 * Report type icons (lucide-react-native icon names)
 */
export const ReportTypeIcons: Record<ReportType, string> = {
  [ReportType.DELAY]: 'Clock',
  [ReportType.ACCIDENT]: 'AlertTriangle',
  [ReportType.CROWDED]: 'Users',
  [ReportType.DOOR_ISSUE]: 'DoorClosed',
  [ReportType.SIGNAL_ISSUE]: 'Radio',
  [ReportType.STOPPED]: 'OctagonX',
  [ReportType.OTHER]: 'HelpCircle',
};

/**
 * Report severity levels
 */
export enum ReportSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Reaction kinds — 시안 #5 제보 피드백의 4-bucket bar.
 *  - helped:    "도움됨"      (제보가 도움이 됐다)
 *  - same:      "저도 그래요" (같은 상황을 겪었다)
 *  - recovered: "복구 확인"   (운행이 정상화됐다)
 *  - differ:    "사실과 달라요" (제보 내용이 부정확하다)
 */
export type ReactionKind = 'helped' | 'same' | 'recovered' | 'differ';

export const REACTION_KINDS: ReactionKind[] = ['helped', 'same', 'recovered', 'differ'];

export const ReactionLabels: Record<ReactionKind, string> = {
  helped: '도움됨',
  same: '저도 그래요',
  recovered: '복구 확인',
  differ: '사실과 달라요',
};

export interface ReactionCounts {
  helped: number;
  same: number;
  recovered: number;
  differ: number;
}

export const emptyReactionCounts = (): ReactionCounts => ({
  helped: 0,
  same: 0,
  recovered: 0,
  differ: 0,
});

/**
 * Sum total reactions — used for bar chart normalization.
 */
export const totalReactions = (counts: ReactionCounts): number =>
  counts.helped + counts.same + counts.recovered + counts.differ;

/**
 * Delay report interface
 */
export interface DelayReport {
  /** Unique report ID */
  id: string;
  /** User ID who submitted the report */
  userId: string;
  /** User display name (for anonymized display) */
  userDisplayName?: string;
  /** Subway line ID */
  lineId: string;
  /** Station ID where report was made */
  stationId: string;
  /** Station name */
  stationName: string;
  /** Type of report */
  reportType: ReportType;
  /** Severity level */
  severity: ReportSeverity;
  /** Description/notes */
  description?: string;
  /** Estimated delay in minutes (if applicable) */
  estimatedDelayMinutes?: number;
  /** Report timestamp */
  timestamp: Date;
  /** Number of upvotes from other users */
  upvotes: number;
  /** User IDs who upvoted */
  upvotedBy: string[];
  /** Whether report has been verified */
  verified: boolean;
  /** Whether report is still active (not resolved) */
  active: boolean;
  /** Resolution timestamp (if resolved) */
  resolvedAt?: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /**
   * Per-kind reaction counts (denormalized for fast read on detail/feedback
   * screens). Phase C/D adds this; older docs missing the field should be
   * treated as `emptyReactionCounts()` by callers.
   */
  reactions?: ReactionCounts;
  /**
   * Per-user reaction map. Each user can hold at most one reaction kind;
   * switching kinds is a single transaction in the service layer.
   */
  reactedBy?: Record<string, ReactionKind>;
  /** Cumulative comment count — incremented when comments are added. */
  commentCount?: number;
}

/**
 * Report summary for display
 */
export interface ReportSummary {
  lineId: string;
  reportCount: number;
  totalUpvotes: number;
  mostRecentReport: DelayReport | null;
  dominantType: ReportType | null;
  averageSeverity: ReportSeverity;
}

/**
 * Create new report input
 */
export interface CreateReportInput {
  userId: string;
  userDisplayName?: string;
  lineId: string;
  stationId: string;
  stationName: string;
  reportType: ReportType;
  severity?: ReportSeverity;
  description?: string;
  estimatedDelayMinutes?: number;
}

/**
 * Calculate report credibility score (0-100)
 */
export const calculateCredibilityScore = (report: DelayReport): number => {
  let score = 50; // Base score

  // Upvotes boost
  score += Math.min(report.upvotes * 5, 30);

  // Verified boost
  if (report.verified) {
    score += 20;
  }

  // Recent reports are more credible
  const hoursSinceReport =
    (Date.now() - new Date(report.timestamp).getTime()) / (1000 * 60 * 60);
  if (hoursSinceReport < 0.5) {
    score += 10;
  } else if (hoursSinceReport < 1) {
    score += 5;
  } else if (hoursSinceReport > 2) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
};

/**
 * Determine if report should be highlighted
 */
export const shouldHighlightReport = (report: DelayReport): boolean => {
  return (
    report.upvotes >= 3 ||
    report.verified ||
    report.severity === ReportSeverity.CRITICAL ||
    report.severity === ReportSeverity.HIGH
  );
};

/**
 * Get severity color
 */
export const getSeverityColor = (severity: ReportSeverity): string => {
  switch (severity) {
    case ReportSeverity.CRITICAL:
      return '#DC2626'; // Red
    case ReportSeverity.HIGH:
      return '#EA580C'; // Orange
    case ReportSeverity.MEDIUM:
      return '#CA8A04'; // Yellow
    case ReportSeverity.LOW:
    default:
      return '#65A30D'; // Green
  }
};

/**
 * Get report type emoji
 */
export const getReportTypeEmoji = (type: ReportType): string => {
  switch (type) {
    case ReportType.DELAY:
      return '⏰';
    case ReportType.ACCIDENT:
      return '🚨';
    case ReportType.CROWDED:
      return '👥';
    case ReportType.DOOR_ISSUE:
      return '🚪';
    case ReportType.SIGNAL_ISSUE:
      return '📡';
    case ReportType.STOPPED:
      return '🛑';
    case ReportType.OTHER:
    default:
      return '❓';
  }
};
