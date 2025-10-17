/**
 * Train domain models and types
 * Represents real-time subway train information for Seoul metropolitan area
 */

export interface Station {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly lineId: string;
  readonly coordinates: {
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly transfers: readonly string[];
}

export interface SubwayLine {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly stations: readonly Station[];
}

export interface Train {
  readonly id: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly currentStationId: string;
  readonly nextStationId: string | null;
  readonly status: TrainStatus;
  readonly arrivalTime: Date | null;
  readonly delayMinutes: number;
  readonly lastUpdated: Date;
}

export enum TrainStatus {
  NORMAL = 'normal',
  DELAYED = 'delayed',
  SUSPENDED = 'suspended',
  MAINTENANCE = 'maintenance',
  EMERGENCY = 'emergency'
}

export interface TrainDelay {
  readonly trainId: string;
  readonly lineId: string;
  readonly delayMinutes: number;
  readonly reason: string;
  readonly affectedStations: readonly string[];
  readonly estimatedResolutionTime: Date | null;
  readonly severity: DelaySeverity;
  readonly reportedAt: Date;
}

export interface ServiceDisruption {
  readonly id: string;
  readonly lineId: string;
  readonly lineName: string;
  readonly stationName: string;
  readonly status: TrainStatus;
  readonly message: string;
  readonly severity: DelaySeverity;
  readonly reportedAt: Date;
  readonly affectedDirections: readonly ('up' | 'down')[];
}

export enum DelaySeverity {
  MINOR = 'minor',        // 1-5 minutes
  MODERATE = 'moderate',  // 6-15 minutes
  MAJOR = 'major',        // 16-30 minutes
  SEVERE = 'severe'       // 30+ minutes or suspension
}

export interface CongestionData {
  readonly trainId: string;
  readonly carNumber: number;
  readonly congestionLevel: CongestionLevel;
  readonly passengerCount: number | null;
  readonly maxCapacity: number;
  readonly lastUpdated: Date;
}

export enum CongestionLevel {
  LOW = 'low',           // < 30%
  MODERATE = 'moderate', // 30-70%
  HIGH = 'high',         // 70-90%
  CROWDED = 'crowded'    // > 90%
}

export interface TrainSchedule {
  readonly lineId: string;
  readonly stationId: string;
  readonly direction: 'up' | 'down';
  readonly scheduledTimes: readonly Date[];
  readonly isWeekend: boolean;
  readonly isPeakHour: boolean;
}
