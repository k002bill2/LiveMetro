/**
 * Fare Calculation Service
 * Calculates Seoul Metro fare based on distance
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Fare calculation result
 */
export interface FareResult {
  readonly baseFare: number;
  readonly additionalFare: number;
  readonly totalFare: number;
  readonly distance: number; // km
  readonly fareType: FareType;
  readonly breakdown: FareBreakdown;
}

/**
 * Fare types
 */
export type FareType = 'regular' | 'youth' | 'child' | 'senior';

/**
 * Fare breakdown
 */
export interface FareBreakdown {
  readonly baseDistance: number; // km covered by base fare
  readonly additionalDistance: number; // km beyond base
  readonly additionalUnits: number; // number of additional fare units
}

/**
 * Route fare info
 */
export interface RouteFareInfo {
  readonly stationCount: number;
  readonly estimatedDistance: number; // km
  readonly fare: FareResult;
  readonly transferDiscount: number;
}

// ============================================================================
// Constants
// ============================================================================

// Base fares (in KRW)
const BASE_FARES: Record<FareType, number> = {
  regular: 1400,
  youth: 720,
  child: 450,
  senior: 0, // Free for 65+
};

// Base distance covered by base fare (km)
const BASE_DISTANCE = 10;

// Additional fare per distance unit
const ADDITIONAL_FARE_REGULAR = 100;
const ADDITIONAL_FARE_YOUTH = 80;
const ADDITIONAL_FARE_CHILD = 50;

// Distance unit for additional fare (km)
const ADDITIONAL_FARE_DISTANCE_10_50 = 5; // 10-50km
const ADDITIONAL_FARE_DISTANCE_50_PLUS = 8; // 50km+

// Average distance between stations (km)
const AVG_STATION_DISTANCE = 1.2;

// Transfer discount
const TRANSFER_DISCOUNT = 0; // Transfers are free within time limit

// ============================================================================
// Service
// ============================================================================

class FareService {
  /**
   * Calculate fare for a route
   */
  calculateFare(stationCount: number, fareType: FareType = 'regular'): FareResult {
    const distance = this.estimateDistance(stationCount);
    return this.calculateFareByDistance(distance, fareType);
  }

  /**
   * Calculate fare by distance
   */
  calculateFareByDistance(distanceKm: number, fareType: FareType = 'regular'): FareResult {
    const baseFare = BASE_FARES[fareType];

    // Senior (65+) rides free
    if (fareType === 'senior') {
      return {
        baseFare: 0,
        additionalFare: 0,
        totalFare: 0,
        distance: distanceKm,
        fareType,
        breakdown: {
          baseDistance: distanceKm,
          additionalDistance: 0,
          additionalUnits: 0,
        },
      };
    }

    // Within base distance
    if (distanceKm <= BASE_DISTANCE) {
      return {
        baseFare,
        additionalFare: 0,
        totalFare: baseFare,
        distance: distanceKm,
        fareType,
        breakdown: {
          baseDistance: distanceKm,
          additionalDistance: 0,
          additionalUnits: 0,
        },
      };
    }

    // Calculate additional fare
    const additionalDistance = distanceKm - BASE_DISTANCE;
    let additionalFare = 0;
    let additionalUnits = 0;

    // 10-50km zone
    const zone1Distance = Math.min(additionalDistance, 40); // Max 40km in this zone
    const zone1Units = Math.ceil(zone1Distance / ADDITIONAL_FARE_DISTANCE_10_50);
    additionalUnits += zone1Units;

    // 50km+ zone
    if (distanceKm > 50) {
      const zone2Distance = distanceKm - 50;
      const zone2Units = Math.ceil(zone2Distance / ADDITIONAL_FARE_DISTANCE_50_PLUS);
      additionalUnits += zone2Units;
    }

    // Calculate additional fare based on type
    const additionalFarePerUnit = this.getAdditionalFarePerUnit(fareType);
    additionalFare = additionalUnits * additionalFarePerUnit;

    return {
      baseFare,
      additionalFare,
      totalFare: baseFare + additionalFare,
      distance: distanceKm,
      fareType,
      breakdown: {
        baseDistance: BASE_DISTANCE,
        additionalDistance,
        additionalUnits,
      },
    };
  }

  /**
   * Get route fare info
   */
  getRouteFareInfo(
    stationCount: number,
    hasTransfer: boolean = false,
    fareType: FareType = 'regular'
  ): RouteFareInfo {
    const estimatedDistance = this.estimateDistance(stationCount);
    const fare = this.calculateFareByDistance(estimatedDistance, fareType);

    return {
      stationCount,
      estimatedDistance,
      fare,
      transferDiscount: hasTransfer ? TRANSFER_DISCOUNT : 0,
    };
  }

  /**
   * Compare fares between routes
   */
  compareFares(
    route1Stations: number,
    route2Stations: number,
    fareType: FareType = 'regular'
  ): {
    route1Fare: FareResult;
    route2Fare: FareResult;
    difference: number;
    cheaperRoute: 1 | 2 | 'equal';
  } {
    const route1Fare = this.calculateFare(route1Stations, fareType);
    const route2Fare = this.calculateFare(route2Stations, fareType);
    const difference = Math.abs(route1Fare.totalFare - route2Fare.totalFare);

    let cheaperRoute: 1 | 2 | 'equal';
    if (route1Fare.totalFare < route2Fare.totalFare) {
      cheaperRoute = 1;
    } else if (route2Fare.totalFare < route1Fare.totalFare) {
      cheaperRoute = 2;
    } else {
      cheaperRoute = 'equal';
    }

    return {
      route1Fare,
      route2Fare,
      difference,
      cheaperRoute,
    };
  }

  /**
   * Format fare for display
   */
  formatFare(amount: number): string {
    return `${amount.toLocaleString('ko-KR')}원`;
  }

  /**
   * Get fare type label
   */
  getFareTypeLabel(fareType: FareType): string {
    const labels: Record<FareType, string> = {
      regular: '일반',
      youth: '청소년',
      child: '어린이',
      senior: '경로',
    };
    return labels[fareType];
  }

  /**
   * Estimate distance from station count
   */
  estimateDistance(stationCount: number): number {
    return Math.max(0, (stationCount - 1) * AVG_STATION_DISTANCE);
  }

  /**
   * Calculate actual distance using station data (if available)
   */
  calculateActualDistance(stationDistances: readonly number[]): number {
    return stationDistances.reduce((sum, d) => sum + d, 0);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getAdditionalFarePerUnit(fareType: FareType): number {
    switch (fareType) {
      case 'regular':
        return ADDITIONAL_FARE_REGULAR;
      case 'youth':
        return ADDITIONAL_FARE_YOUTH;
      case 'child':
        return ADDITIONAL_FARE_CHILD;
      case 'senior':
        return 0;
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const fareService = new FareService();
export default fareService;
