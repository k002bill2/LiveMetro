/**
 * Delay Certificate Models
 * 지연증명서 데이터 모델
 */

/**
 * Delay reason categories
 */
export enum DelayReason {
  MECHANICAL_FAILURE = 'mechanical_failure',
  SIGNAL_FAILURE = 'signal_failure',
  PASSENGER_INCIDENT = 'passenger_incident',
  DOOR_FAILURE = 'door_failure',
  MEDICAL_EMERGENCY = 'medical_emergency',
  SECURITY_INCIDENT = 'security_incident',
  WEATHER = 'weather',
  CONGESTION = 'congestion',
  MAINTENANCE = 'maintenance',
  OTHER = 'other',
}

/**
 * Delay reason display names
 */
export const DelayReasonLabels: Record<DelayReason, string> = {
  [DelayReason.MECHANICAL_FAILURE]: '차량 고장',
  [DelayReason.SIGNAL_FAILURE]: '신호 장애',
  [DelayReason.PASSENGER_INCIDENT]: '승객 사고',
  [DelayReason.DOOR_FAILURE]: '승강장 문 고장',
  [DelayReason.MEDICAL_EMERGENCY]: '응급 환자 발생',
  [DelayReason.SECURITY_INCIDENT]: '안전 사고',
  [DelayReason.WEATHER]: '기상 악화',
  [DelayReason.CONGESTION]: '혼잡 지연',
  [DelayReason.MAINTENANCE]: '시설 점검',
  [DelayReason.OTHER]: '기타',
};

/**
 * Delay certificate interface
 */
export interface DelayCertificate {
  /** Unique certificate ID */
  id: string;
  /** Certificate number (for official reference) */
  certificateNumber: string;
  /** User ID who experienced the delay */
  userId: string;
  /** Date of the delay */
  date: Date;
  /** Subway line ID */
  lineId: string;
  /** Station where delay was experienced */
  stationId: string;
  /** Station name */
  stationName: string;
  /** Scheduled arrival/departure time */
  scheduledTime: string;
  /** Actual arrival/departure time */
  actualTime: string;
  /** Delay duration in minutes */
  delayMinutes: number;
  /** Reason for the delay */
  reason: DelayReason;
  /** Additional notes */
  notes?: string;
  /** Whether certificate has been verified */
  verified: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Delay history entry (simpler version for logging)
 */
export interface DelayHistoryEntry {
  /** Unique entry ID */
  id: string;
  /** User ID */
  userId: string;
  /** Subway line ID */
  lineId: string;
  /** Station ID */
  stationId: string;
  /** Station name */
  stationName: string;
  /** Delay duration in minutes */
  delayMinutes: number;
  /** Timestamp when delay was detected */
  timestamp: Date;
  /** Reason if known */
  reason?: DelayReason;
  /** Raw message from API */
  rawMessage?: string;
  /** Whether a certificate was generated */
  certificateGenerated: boolean;
  /** Associated certificate ID if generated */
  certificateId?: string;
}

/**
 * Generate a unique certificate number
 */
export const generateCertificateNumber = (): string => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LM-${dateStr}-${randomPart}`;
};

/**
 * Create a new delay certificate from history entry
 */
export const createCertificateFromHistory = (
  history: DelayHistoryEntry,
  scheduledTime: string,
  actualTime: string
): Omit<DelayCertificate, 'id' | 'createdAt' | 'updatedAt'> => {
  return {
    certificateNumber: generateCertificateNumber(),
    userId: history.userId,
    date: history.timestamp,
    lineId: history.lineId,
    stationId: history.stationId,
    stationName: history.stationName,
    scheduledTime,
    actualTime,
    delayMinutes: history.delayMinutes,
    reason: history.reason || DelayReason.OTHER,
    verified: false,
  };
};
