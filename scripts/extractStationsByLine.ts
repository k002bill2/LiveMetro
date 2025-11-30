/**
 * Extract and organize STATIONS data by line
 */

import { STATIONS, LINE_COLORS } from '../src/utils/subwayMapData';

interface StationInfo {
  id: string;
  name: string;
  nameEn?: string;
  x: number;
  y: number;
  lines: string[];
}

const stationsByLine: Record<string, StationInfo[]> = {};

// 노선별로 역 그룹화
Object.entries(STATIONS).forEach(([id, data]) => {
  data.lines.forEach(lineId => {
    if (!stationsByLine[lineId]) {
      stationsByLine[lineId] = [];
    }
    stationsByLine[lineId].push({
      id,
      name: data.name,
      nameEn: data.nameEn,
      x: data.x,
      y: data.y,
      lines: data.lines,
    });
  });
});

// 1호선: 남북으로 긴 노선 - y좌표 기준 정렬
if (stationsByLine['1']) {
  stationsByLine['1'].sort((a, b) => a.y - b.y);
}

// 2호선: 순환 노선 - 시계방향 정렬 (각도 기반)
if (stationsByLine['2']) {
  const centerX = 2500; // 대략적인 중심
  const centerY = 1800;

  stationsByLine['2'].sort((a, b) => {
    const angleA = Math.atan2(a.y - centerY, a.x - centerX);
    const angleB = Math.atan2(b.y - centerY, b.x - centerX);
    return angleA - angleB;
  });
}

// 3-9호선: x좌표 기준 정렬 (대부분 동서로 흐름)
['3', '4', '5', '6', '7', '8', '9'].forEach(lineId => {
  if (stationsByLine[lineId]) {
    stationsByLine[lineId].sort((a, b) => {
      // 3호선, 4호선은 남북이 주요 방향
      if (lineId === '3' || lineId === '4') {
        return a.y - b.y;
      }
      return a.x - b.x;
    });
  }
});

// TypeScript 코드 형식으로 출력
console.log('/**');
console.log(' * Seoul Subway LINE_STATIONS - Auto-generated');
console.log(' * Generated from STATIONS data with proper key matching');
console.log(' */\n');

console.log('export const LINE_STATIONS: Record<string, string[]> = {');

// 메인 노선 (1-9호선)
['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((lineId, idx) => {
  const stations = stationsByLine[lineId] || [];
  const color = LINE_COLORS[lineId] || '#888';

  console.log(`  // ${lineId}호선 (${color}) - ${stations.length}개 역`);
  console.log(`  '${lineId}': [`);

  stations.forEach((s, sIdx) => {
    const transfer = s.lines.length > 1 ? ' // [환승]' : '';
    const comma = sIdx < stations.length - 1 ? ',' : '';
    console.log(`    '${s.id}'${comma}${transfer} ${s.name} (${s.nameEn || 'N/A'})`);
  });

  const comma = idx < 8 ? ',' : '';
  console.log(`  ]${comma}\n`);
});

console.log('};\n');

// 통계 출력
console.log('// === 통계 ===');
['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(lineId => {
  const stations = stationsByLine[lineId] || [];
  const transfers = stations.filter(s => s.lines.length > 1).length;
  console.log(`// ${lineId}호선: ${stations.length}개 역 (환승 ${transfers}개)`);
});
