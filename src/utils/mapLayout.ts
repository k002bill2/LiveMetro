

export interface MapNode {
  id: string;
  x: number;
  y: number;
  name: string;
  lineId: string;
  color: string;
  isTransfer: boolean;
  stationId: string;
}

export interface MapEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  lineId: string;
}

export interface MapData {
  nodes: MapNode[];
  edges: MapEdge[];
  width: number;
  height: number;
}

// Simplified interface for map generation
export interface SimpleSubwayLine {
  id: string;
  color: string;
  stations: string[];
}

const CANVAS_SIZE = 2000;

// Key station coordinates (Anchors) to create a schematic layout similar to the official map
// Coordinates are roughly based on a 2000x2000 grid
const ANCHORS: Record<string, { x: number; y: number }> = {
  // Line 2 (The Loop - roughly rectangular with rounded corners)
  '시청': { x: 950, y: 700 },
  '을지로3가': { x: 1050, y: 700 },
  '동대문역사문화공원': { x: 1150, y: 700 },
  '신당': { x: 1250, y: 700 },
  '왕십리': { x: 1350, y: 750 },
  '성수': { x: 1400, y: 850 },
  '건대입구': { x: 1400, y: 950 },
  '잠실': { x: 1400, y: 1100 },
  '종합운동장': { x: 1350, y: 1200 },
  '삼성': { x: 1250, y: 1250 },
  '선릉': { x: 1150, y: 1250 },
  '강남': { x: 1050, y: 1250 },
  '교대': { x: 950, y: 1250 },
  '서초': { x: 900, y: 1250 },
  '사당': { x: 850, y: 1300 },
  '신도림': { x: 600, y: 1100 },
  '영등포구청': { x: 600, y: 950 },
  '합정': { x: 620, y: 850 },
  '홍대입구': { x: 650, y: 800 },
  '신촌': { x: 750, y: 750 },
  '충정로': { x: 850, y: 700 },

  // Line 1
  '소요산': { x: 1600, y: 200 },
  '의정부': { x: 1400, y: 400 },
  '청량리': { x: 1250, y: 600 },
  '동대문': { x: 1150, y: 650 },
  '종로3가': { x: 1000, y: 650 },
  '서울역': { x: 900, y: 750 },
  '용산': { x: 850, y: 900 },
  '노량진': { x: 800, y: 1000 },
  '신길': { x: 650, y: 1050 },
  '구로': { x: 500, y: 1200 },
  '온수': { x: 350, y: 1300 },
  '인천': { x: 200, y: 1600 },

  // Line 3
  '대화': { x: 300, y: 300 },
  '연신내': { x: 600, y: 500 },
  '경복궁': { x: 900, y: 600 },
  '충무로': { x: 1100, y: 750 },
  '약수': { x: 1150, y: 850 },
  '옥수': { x: 1100, y: 1000 },
  '압구정': { x: 1050, y: 1100 },
  '신사': { x: 1000, y: 1150 },
  '고속터미널': { x: 950, y: 1200 },
  '양재': { x: 1050, y: 1350 },
  '수서': { x: 1400, y: 1350 },
  '오금': { x: 1500, y: 1300 },

  // Line 4
  '진접': { x: 1400, y: 200 },
  '노원': { x: 1300, y: 400 },
  '혜화': { x: 1100, y: 600 },
  '명동': { x: 1000, y: 750 },
  '삼각지': { x: 850, y: 950 },
  '이촌': { x: 900, y: 1000 },
  '동작': { x: 900, y: 1100 },
  '금정': { x: 700, y: 1600 },
  '오이도': { x: 500, y: 1800 },

  // Line 5
  '방화': { x: 200, y: 800 },
  '김포공항': { x: 300, y: 850 },
  '까치산': { x: 400, y: 1000 },
  '여의도': { x: 700, y: 1000 },
  '공덕': { x: 800, y: 850 },
  '광화문': { x: 900, y: 650 },
  '을지로4가': { x: 1100, y: 700 },
  '군자': { x: 1500, y: 800 },
  '천호': { x: 1600, y: 1000 },
  '하남검단산': { x: 1900, y: 1000 },
  '마천': { x: 1700, y: 1200 },

  // Line 6
  '응암': { x: 600, y: 600 },
  '디지털미디어시티': { x: 500, y: 700 },
  '효창공원앞': { x: 820, y: 920 },
  '이태원': { x: 950, y: 950 },
  '석계': { x: 1350, y: 500 },
  '신내': { x: 1500, y: 500 },

  // Line 7
  '장암': { x: 1350, y: 300 },
  '강남구청': { x: 1200, y: 1150 },
  '논현': { x: 1050, y: 1200 },
  '이수': { x: 850, y: 1350 },
  '대림': { x: 600, y: 1200 },
  '가산디지털단지': { x: 500, y: 1300 },
  '부평구청': { x: 300, y: 1400 },
  '석남': { x: 200, y: 1400 },

  // Line 8
  '암사': { x: 1600, y: 900 },
  '가락시장': { x: 1450, y: 1250 },
  '모란': { x: 1500, y: 1450 },

  // Line 9
  '개화': { x: 250, y: 820 },
  '당산': { x: 620, y: 900 },
  '신논현': { x: 1050, y: 1220 },
  '중앙보훈병원': { x: 1700, y: 1100 },
};

export const generateMapLayout = (lines: SimpleSubwayLine[]): MapData => {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const stationMap = new Map<string, MapNode>();

  // Helper to check if a station is a transfer station (appears in multiple lines)
  const stationCounts = new Map<string, number>();
  lines.forEach(line => {
    line.stations.forEach(station => {
      stationCounts.set(station, (stationCounts.get(station) || 0) + 1);
    });
  });

  lines.forEach(line => {
    const lineNodes: MapNode[] = [];
    
    // 1. Identify anchor points for this line
    const lineAnchors: { index: number; x: number; y: number }[] = [];
    
    line.stations.forEach((station, index) => {
      if (ANCHORS[station]) {
        lineAnchors.push({ index, ...ANCHORS[station] });
      }
    });

    // If no anchors, add start and end with arbitrary positions (fallback)
    if (lineAnchors.length === 0) {
      // This shouldn't happen for major lines if ANCHORS is well populated
      // Fallback to simple linear layout
      lineAnchors.push({ index: 0, x: 200, y: 200 + parseInt(line.id) * 100 });
      lineAnchors.push({ index: line.stations.length - 1, x: 1800, y: 200 + parseInt(line.id) * 100 });
    }

    // Ensure start and end are covered if not anchored
    if (lineAnchors.length > 0 && lineAnchors[0]!.index > 0) {
      // Extrapolate backwards
      const first = lineAnchors[0]!;
      const second = lineAnchors.length > 1 ? lineAnchors[1] : undefined;
      const refPoint = second || { index: first.index + 1, x: first.x + 50, y: first.y };
      
      const dx = (refPoint.x - first.x) / (refPoint.index - first.index);
      const dy = (refPoint.y - first.y) / (refPoint.index - first.index);
      
      lineAnchors.unshift({
        index: 0,
        x: first.x - dx * first.index,
        y: first.y - dy * first.index
      });
    }

    if (lineAnchors.length > 0 && lineAnchors[lineAnchors.length - 1]!.index < line.stations.length - 1) {
      // Extrapolate forwards
      const last = lineAnchors[lineAnchors.length - 1]!;
      const prev = lineAnchors.length > 1 ? lineAnchors[lineAnchors.length - 2] : undefined;
      const refPoint = prev || { index: last.index - 1, x: last.x - 50, y: last.y };

      const dx = (last.x - refPoint.x) / (last.index - refPoint.index);
      const dy = (last.y - refPoint.y) / (last.index - refPoint.index);
      const remaining = line.stations.length - 1 - last.index;

      lineAnchors.push({
        index: line.stations.length - 1,
        x: last.x + dx * remaining,
        y: last.y + dy * remaining
      });
    }

    // 2. Interpolate positions
    let anchorIdx = 0;
    
    line.stations.forEach((stationName, index) => {
      // Find bounding anchors
      while (anchorIdx < lineAnchors.length - 1 && lineAnchors[anchorIdx + 1]!.index < index) {
        anchorIdx++;
      }

      const startAnchor = lineAnchors[anchorIdx];
      const endAnchor = lineAnchors[anchorIdx + 1];

      let x = 0, y = 0;

      if (startAnchor && startAnchor.index === index) {
        x = startAnchor.x;
        y = startAnchor.y;
      } else if (endAnchor && endAnchor.index === index) {
        x = endAnchor.x;
        y = endAnchor.y;
      } else if (startAnchor && endAnchor) {
        // Linear interpolation
        const progress = (index - startAnchor.index) / (endAnchor.index - startAnchor.index);
        x = startAnchor.x + (endAnchor.x - startAnchor.x) * progress;
        y = startAnchor.y + (endAnchor.y - startAnchor.y) * progress;
      } else if (startAnchor) {
        // Fallback if only start anchor exists (should be covered by extrapolation)
        x = startAnchor.x;
        y = startAnchor.y;
      }

      // Check if node exists (Transfer station)
      let node = stationMap.get(stationName);
      const isTransfer = (stationCounts.get(stationName) || 0) > 1;

      if (!node) {
        node = {
          id: `${line.id}-${stationName}`,
          stationId: stationName,
          x,
          y,
          name: stationName,
          lineId: line.id,
          color: line.color,
          isTransfer,
        };
        nodes.push(node);
        stationMap.set(stationName, node);
      }
      
      // We need to track line-specific nodes for edges
      lineNodes.push({
        ...node,
        id: `${line.id}-${stationName}`, // Unique ID for this line's node ref
        x: node.x, // Use the shared node's position
        y: node.y
      });
    });

    // 3. Create edges
    for (let i = 0; i < lineNodes.length - 1; i++) {
      const curr = lineNodes[i];
      const next = lineNodes[i + 1];
      
      if (curr && next) {
        edges.push({
          id: `edge-${line.id}-${i}`,
          x1: curr.x,
          y1: curr.y,
          x2: next.x,
          y2: next.y,
          color: line.color,
          lineId: line.id,
        });
      }
    }
    
    // For Line 2 loop closure
    if (line.id === '2' && lineNodes.length > 1) {
      const first = lineNodes[0];
      const last = lineNodes[lineNodes.length - 1];
      
      if (first && last) {
        edges.push({
          id: `edge-2-loop`,
          x1: last.x,
          y1: last.y,
          x2: first.x,
          y2: first.y,
          color: line.color,
          lineId: '2',
        });
      }
    }
  });

  return {
    nodes,
    edges,
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
  };
};
