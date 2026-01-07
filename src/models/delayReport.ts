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
