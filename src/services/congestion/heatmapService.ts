/**
 * Congestion Heatmap Service
 * Generates heatmap data for congestion visualization
 */

import { CongestionLevel } from '@/models/congestion';
import { congestionPredictionService, HourlyCongestionPattern } from './congestionPredictionService';

// ============================================================================
// Types
// ============================================================================

/**
 * Heatmap cell data
 */
export interface HeatmapCell {
  readonly hour: number;
  readonly dayOfWeek: number;
  readonly value: number; // 0-4 representing congestion level
  readonly level: CongestionLevel;
  readonly sampleCount: number;
  readonly confidence: number;
}

/**
 * Complete heatmap data
 */
export interface HeatmapData {
  readonly stationId: string;
  readonly stationName: string;
  readonly lineId: string;
  readonly direction: 'up' | 'down';
  readonly cells: readonly HeatmapCell[];
  readonly maxValue: number;
  readonly minValue: number;
  readonly lastUpdated: Date;
}

/**
 * Heatmap color configuration
 */
export interface HeatmapColors {
  readonly low: string;
  readonly moderate: string;
  readonly high: string;
  readonly crowded: string;
}

/**
 * Time range for heatmap
 */
export interface TimeRange {
  readonly startHour: number;
  readonly endHour: number;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_HEATMAP_COLORS: HeatmapColors = {
  low: '#4CAF50',      // Green
  moderate: '#FFC107', // Yellow
  high: '#FF9800',     // Orange
  crowded: '#F44336',  // Red
};

export const DEFAULT_TIME_RANGE: TimeRange = {
  startHour: 5,
  endHour: 24, // Represents 0 (midnight)
};

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

// ============================================================================
// Service
// ============================================================================

class HeatmapService {
  /**
   * Generate heatmap data for a station
   */
  async generateHeatmap(
    stationId: string,
    stationName: string,
    lineId: string,
    direction: 'up' | 'down',
    timeRange: TimeRange = DEFAULT_TIME_RANGE
  ): Promise<HeatmapData> {
    const cells: HeatmapCell[] = [];
    let maxValue = 0;
    let minValue = 4;

    // Generate data for each day of the week
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const pattern = await congestionPredictionService.getHourlyPattern(
        stationId,
        lineId,
        direction,
        dayOfWeek
      );

      // Generate data for each hour
      for (let hour = timeRange.startHour; hour <= timeRange.endHour; hour++) {
        const actualHour = hour === 24 ? 0 : hour;
        const hourlyData = pattern.hourlyStats.find(
          s => parseInt(s.timeSlot.split(':')[0] ?? '0', 10) === actualHour
        );

        const value = hourlyData?.avgCongestion ?? 2;
        const level = this.valueToLevel(value);

        maxValue = Math.max(maxValue, value);
        minValue = Math.min(minValue, value);

        cells.push({
          hour: actualHour,
          dayOfWeek,
          value,
          level,
          sampleCount: hourlyData?.sampleCount ?? 0,
          confidence: hourlyData ? Math.min(hourlyData.sampleCount / 10, 1) : 0,
        });
      }
    }

    return {
      stationId,
      stationName,
      lineId,
      direction,
      cells,
      maxValue,
      minValue,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get color for a value
   */
  getColor(value: number, colors: HeatmapColors = DEFAULT_HEATMAP_COLORS): string {
    const level = this.valueToLevel(value);
    switch (level) {
      case CongestionLevel.LOW:
        return colors.low;
      case CongestionLevel.MODERATE:
        return colors.moderate;
      case CongestionLevel.HIGH:
        return colors.high;
      case CongestionLevel.CROWDED:
        return colors.crowded;
    }
  }

  /**
   * Get interpolated color for smooth gradients
   */
  getInterpolatedColor(value: number): string {
    // Clamp value between 1 and 4
    const v = Math.max(1, Math.min(4, value));

    // Define color stops
    const stops = [
      { value: 1, r: 76, g: 175, b: 80 },   // Green
      { value: 2, r: 255, g: 193, b: 7 },   // Yellow
      { value: 3, r: 255, g: 152, b: 0 },   // Orange
      { value: 4, r: 244, g: 67, b: 54 },   // Red
    ];

    // Find the two stops to interpolate between
    let lowerStop = stops[0]!;
    let upperStop = stops[stops.length - 1]!;

    for (let i = 0; i < stops.length - 1; i++) {
      if (v >= (stops[i]?.value ?? 0) && v <= (stops[i + 1]?.value ?? 4)) {
        lowerStop = stops[i]!;
        upperStop = stops[i + 1]!;
        break;
      }
    }

    // Calculate interpolation factor
    const range = upperStop.value - lowerStop.value;
    const t = range > 0 ? (v - lowerStop.value) / range : 0;

    // Interpolate RGB values
    const r = Math.round(lowerStop.r + (upperStop.r - lowerStop.r) * t);
    const g = Math.round(lowerStop.g + (upperStop.g - lowerStop.g) * t);
    const b = Math.round(lowerStop.b + (upperStop.b - lowerStop.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Get opacity for a cell based on confidence
   */
  getOpacity(confidence: number): number {
    // Minimum opacity of 0.3, maximum 1.0
    return 0.3 + confidence * 0.7;
  }

  /**
   * Format hour for display
   */
  formatHour(hour: number): string {
    if (hour === 0 || hour === 24) return '00시';
    if (hour === 12) return '12시';
    return `${hour.toString().padStart(2, '0')}시`;
  }

  /**
   * Format day for display
   */
  formatDay(dayOfWeek: number): string {
    return DAY_NAMES_KO[dayOfWeek] ?? '';
  }

  /**
   * Get summary for a specific cell
   */
  getCellSummary(cell: HeatmapCell): string {
    const dayName = this.formatDay(cell.dayOfWeek);
    const hourText = this.formatHour(cell.hour);
    const levelText = this.getLevelText(cell.level);
    const confidenceText = cell.confidence > 0.7 ? '높음' : cell.confidence > 0.3 ? '보통' : '낮음';

    return `${dayName} ${hourText}: ${levelText} (신뢰도: ${confidenceText})`;
  }

  /**
   * Get level text in Korean
   */
  getLevelText(level: CongestionLevel): string {
    switch (level) {
      case CongestionLevel.LOW:
        return '여유';
      case CongestionLevel.MODERATE:
        return '보통';
      case CongestionLevel.HIGH:
        return '혼잡';
      case CongestionLevel.CROWDED:
        return '매우 혼잡';
    }
  }

  /**
   * Export heatmap data as CSV
   */
  exportToCsv(heatmap: HeatmapData): string {
    const headers = ['요일', '시간', '혼잡도', '레벨', '샘플수', '신뢰도'];
    const rows = heatmap.cells.map(cell => [
      this.formatDay(cell.dayOfWeek),
      this.formatHour(cell.hour),
      cell.value.toFixed(2),
      this.getLevelText(cell.level),
      cell.sampleCount.toString(),
      (cell.confidence * 100).toFixed(0) + '%',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csv;
  }

  /**
   * Find peak congestion times
   */
  findPeakTimes(heatmap: HeatmapData, topN: number = 5): HeatmapCell[] {
    return [...heatmap.cells]
      .sort((a, b) => b.value - a.value)
      .slice(0, topN);
  }

  /**
   * Find low congestion times
   */
  findLowCongestionTimes(heatmap: HeatmapData, topN: number = 5): HeatmapCell[] {
    return [...heatmap.cells]
      .filter(c => c.hour >= 6 && c.hour <= 23) // Only during operating hours
      .sort((a, b) => a.value - b.value)
      .slice(0, topN);
  }

  /**
   * Get recommended travel times
   */
  getRecommendedTimes(heatmap: HeatmapData): {
    weekday: { morning: number; evening: number };
    weekend: { morning: number; evening: number };
  } {
    // Find best times for weekday
    const weekdayCells = heatmap.cells.filter(c => c.dayOfWeek >= 1 && c.dayOfWeek <= 5);
    const weekdayMorning = this.findBestTime(weekdayCells, 6, 10);
    const weekdayEvening = this.findBestTime(weekdayCells, 17, 21);

    // Find best times for weekend
    const weekendCells = heatmap.cells.filter(c => c.dayOfWeek === 0 || c.dayOfWeek === 6);
    const weekendMorning = this.findBestTime(weekendCells, 8, 12);
    const weekendEvening = this.findBestTime(weekendCells, 14, 20);

    return {
      weekday: { morning: weekdayMorning, evening: weekdayEvening },
      weekend: { morning: weekendMorning, evening: weekendEvening },
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private valueToLevel(value: number): CongestionLevel {
    if (value <= 1.5) return CongestionLevel.LOW;
    if (value <= 2.5) return CongestionLevel.MODERATE;
    if (value <= 3.5) return CongestionLevel.HIGH;
    return CongestionLevel.CROWDED;
  }

  private findBestTime(cells: readonly HeatmapCell[], startHour: number, endHour: number): number {
    const relevantCells = cells.filter(c => c.hour >= startHour && c.hour <= endHour);

    if (relevantCells.length === 0) return startHour;

    const bestCell = relevantCells.reduce((best, current) =>
      current.value < best.value ? current : best
    );

    return bestCell.hour;
  }
}

// ============================================================================
// Export
// ============================================================================

export const heatmapService = new HeatmapService();
export default heatmapService;
