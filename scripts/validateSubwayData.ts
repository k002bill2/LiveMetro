/**
 * Subway Data Validation Script
 *
 * 역 데이터와 노선 데이터의 정합성을 검증합니다.
 */

import { STATIONS, LINE_STATIONS, LINE_COLORS } from '../src/utils/subwayMapData';

interface ValidationResult {
  lineId: string;
  totalStations: number;
  matchedStations: number;
  missingStations: string[];
  duplicateStations: string[];
  invalidCoordinates: string[];
}

interface ValidationSummary {
  totalLines: number;
  totalStationsInLines: number;
  totalUniqueStations: number;
  matchRate: number;
  results: ValidationResult[];
  criticalIssues: string[];
  warnings: string[];
}

/**
 * LINE_STATIONS의 역 ID가 STATIONS에 존재하는지 검증
 */
export function validateStationMapping(): ValidationSummary {
  const results: ValidationResult[] = [];
  const allStationIds = new Set<string>();
  const criticalIssues: string[] = [];
  const warnings: string[] = [];

  let totalStationsInLines = 0;
  let totalMatched = 0;

  console.log('🔍 서울 지하철 데이터 검증 시작...\n');

  // 각 노선별로 검증. LINE_STATIONS는 string[][] (operational segments).
  // 검증 목적은 ID 멤버십/중복/좌표 점검이므로 인접성 불필요 → flat 처리.
  Object.entries(LINE_STATIONS).forEach(([lineId, segments]) => {
    const stationIds = segments.flat();
    const missingStations: string[] = [];
    const duplicateStations: string[] = [];
    const invalidCoordinates: string[] = [];
    let matchedCount = 0;

    // 중복 체크를 위한 Set
    const seenIds = new Set<string>();

    stationIds.forEach(stationId => {
      allStationIds.add(stationId);

      // 중복 체크
      if (seenIds.has(stationId)) {
        duplicateStations.push(stationId);
        warnings.push(`노선 ${lineId}: 중복 역 ID '${stationId}'`);
      }
      seenIds.add(stationId);

      // 매칭 체크
      const station = STATIONS[stationId];
      if (!station) {
        missingStations.push(stationId);
      } else {
        matchedCount++;

        // 좌표 유효성 체크 (0이거나 범위 밖)
        if (
          station.x === 0 ||
          station.y === 0 ||
          station.x < 0 ||
          station.y < 0 ||
          station.x > 5000 ||
          station.y > 5000
        ) {
          invalidCoordinates.push(stationId);
          warnings.push(`노선 ${lineId}: 역 '${stationId}' (${station.name})의 좌표가 비정상: (${station.x}, ${station.y})`);
        }
      }
    });

    totalStationsInLines += stationIds.length;
    totalMatched += matchedCount;

    results.push({
      lineId,
      totalStations: stationIds.length,
      matchedStations: matchedCount,
      missingStations,
      duplicateStations,
      invalidCoordinates,
    });

    // Critical issue 체크
    if (missingStations.length > stationIds.length * 0.3) {
      criticalIssues.push(
        `노선 ${lineId}: ${missingStations.length}/${stationIds.length}개 역 매칭 실패 (임계치 30% 초과)`
      );
    }
  });

  const matchRate = (totalMatched / totalStationsInLines) * 100;

  // 전체 매칭률이 80% 미만이면 Critical
  if (matchRate < 80) {
    criticalIssues.push(`전체 매칭률이 ${matchRate.toFixed(1)}%로 80% 미만입니다.`);
  }

  return {
    totalLines: Object.keys(LINE_STATIONS).length,
    totalStationsInLines,
    totalUniqueStations: allStationIds.size,
    matchRate,
    results,
    criticalIssues,
    warnings,
  };
}

/**
 * 검증 결과를 콘솔에 출력
 */
export function printValidationReport(summary: ValidationSummary): void {
  console.log('=' .repeat(70));
  console.log('📊 서울 지하철 데이터 검증 리포트');
  console.log('='.repeat(70));
  console.log();

  // 전체 요약
  console.log('📌 전체 요약');
  console.log(`   • 총 노선 수: ${summary.totalLines}개`);
  console.log(`   • LINE_STATIONS 내 총 역 수: ${summary.totalStationsInLines}개`);
  console.log(`   • 고유 역 수: ${summary.totalUniqueStations}개`);
  console.log(`   • 전체 매칭률: ${summary.matchRate.toFixed(2)}%`);
  console.log();

  // 노선별 상세
  console.log('📍 노선별 매칭 결과');
  console.log('-'.repeat(70));

  summary.results.forEach(result => {
    const matchRate = ((result.matchedStations / result.totalStations) * 100).toFixed(1);
    const status = result.missingStations.length === 0 ? '✅' : '❌';
    const color = LINE_COLORS[result.lineId] || '#888';

    console.log(`\n${status} 노선 ${result.lineId} (${color})`);
    console.log(`   전체: ${result.totalStations}개 | 매칭: ${result.matchedStations}개 | 실패: ${result.missingStations.length}개 (${matchRate}%)`);

    if (result.duplicateStations.length > 0) {
      console.log(`   ⚠️  중복 역: ${result.duplicateStations.length}개`);
      console.log(`      ${result.duplicateStations.slice(0, 5).join(', ')}${result.duplicateStations.length > 5 ? '...' : ''}`);
    }

    if (result.invalidCoordinates.length > 0) {
      console.log(`   ⚠️  비정상 좌표: ${result.invalidCoordinates.length}개`);
      console.log(`      ${result.invalidCoordinates.slice(0, 5).join(', ')}${result.invalidCoordinates.length > 5 ? '...' : ''}`);
    }

    if (result.missingStations.length > 0) {
      console.log(`   ❌ 매칭 실패 역:`);
      const sample = result.missingStations.slice(0, 5);
      sample.forEach(id => console.log(`      - ${id}`));
      if (result.missingStations.length > 5) {
        console.log(`      ... 외 ${result.missingStations.length - 5}개`);
      }
    }
  });

  console.log();
  console.log('-'.repeat(70));

  // Critical Issues
  if (summary.criticalIssues.length > 0) {
    console.log();
    console.log('🚨 치명적 문제 (Critical Issues)');
    console.log('-'.repeat(70));
    summary.criticalIssues.forEach((issue, idx) => {
      console.log(`${idx + 1}. ${issue}`);
    });
  }

  // Warnings
  if (summary.warnings.length > 0) {
    console.log();
    console.log('⚠️  경고 (Warnings) - 상위 10개');
    console.log('-'.repeat(70));
    summary.warnings.slice(0, 10).forEach((warning, idx) => {
      console.log(`${idx + 1}. ${warning}`);
    });
    if (summary.warnings.length > 10) {
      console.log(`   ... 외 ${summary.warnings.length - 10}개 경고`);
    }
  }

  console.log();
  console.log('='.repeat(70));

  // 최종 판정
  if (summary.criticalIssues.length === 0 && summary.matchRate >= 95) {
    console.log('✅ 검증 성공: 데이터 정합성이 양호합니다.');
  } else if (summary.matchRate >= 80) {
    console.log('⚠️  검증 경고: 일부 문제가 발견되었습니다. 수정을 권장합니다.');
  } else {
    console.log('❌ 검증 실패: 심각한 데이터 불일치가 발견되었습니다. 즉시 수정이 필요합니다.');
  }

  console.log('='.repeat(70));
}

/**
 * STATIONS에만 있고 LINE_STATIONS에는 없는 역 찾기
 */
export function findOrphanedStations(): string[] {
  const stationsInLines = new Set<string>();

  Object.values(LINE_STATIONS).forEach(segments => {
    segments.flat().forEach(id => stationsInLines.add(id));
  });

  const orphanedStations = Object.keys(STATIONS).filter(
    id => !stationsInLines.has(id)
  );

  return orphanedStations;
}

/**
 * 환승역 통계
 */
export function getTransferStationStats() {
  const transferStations = Object.values(STATIONS).filter(
    s => s.lines.length > 1
  );

  const transferCount = new Map<number, number>();
  transferStations.forEach(s => {
    const count = s.lines.length;
    transferCount.set(count, (transferCount.get(count) || 0) + 1);
  });

  return {
    total: transferStations.length,
    byLineCount: Object.fromEntries(transferCount),
    stations: transferStations,
  };
}

// 메인 실행
if (require.main === module) {
  const summary = validateStationMapping();
  printValidationReport(summary);

  console.log();
  console.log('📊 추가 통계');
  console.log('-'.repeat(70));

  const orphaned = findOrphanedStations();
  console.log(`고아 역 (STATIONS에만 존재): ${orphaned.length}개`);
  if (orphaned.length > 0) {
    console.log(`샘플: ${orphaned.slice(0, 10).join(', ')}${orphaned.length > 10 ? '...' : ''}`);
  }

  const transferStats = getTransferStationStats();
  console.log(`\n환승역 통계:`);
  console.log(`  총 환승역: ${transferStats.total}개`);
  Object.entries(transferStats.byLineCount).forEach(([count, num]) => {
    console.log(`  ${count}개 노선 환승: ${num}개 역`);
  });

  console.log();
  console.log('검증 완료!');

  // 에러 코드 반환
  process.exit(summary.criticalIssues.length > 0 ? 1 : 0);
}
