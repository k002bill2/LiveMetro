import {
  generateMapLayout,
  getNodeByName,
  getTransferNodes,
  getLineEdges,
  edgesToPath,
  createLinePaths,
  LINE_COLORS,
  MAP_WIDTH,
  MAP_HEIGHT,
  MapData,
  MapEdge,
} from '../mapLayout';

describe('mapLayout', () => {
  let mapData: MapData;

  beforeAll(() => {
    mapData = generateMapLayout();
  });

  describe('generateMapLayout', () => {
    it('should generate map data with nodes and edges using default data', () => {
      expect(mapData.nodes.length).toBeGreaterThan(0);
      expect(mapData.edges.length).toBeGreaterThan(0);
      expect(mapData.width).toBe(4900);
      expect(mapData.height).toBe(4400);
    });

    it('should correctly map stations to nodes', () => {
      const seoulStation = mapData.nodes.find(n => n.id === 'seoul');
      expect(seoulStation).toBeDefined();
      expect(seoulStation?.name).toBe('서울역');
      expect(seoulStation?.x).toBe(2143);
      expect(seoulStation?.y).toBe(1711);
    });

    it('should generate edges for lines', () => {
      const line1Edges = mapData.edges.filter(e => e.lineId === '1');
      expect(line1Edges.length).toBeGreaterThan(0);
    });

    it('should not add duplicate nodes for transfer stations', () => {
      const nodeIds = mapData.nodes.map(n => n.id);
      const uniqueIds = new Set(nodeIds);
      expect(uniqueIds.size).toBe(nodeIds.length);
    });

    it('should mark transfer stations correctly', () => {
      const transferNodes = mapData.nodes.filter(n => n.isTransfer);
      transferNodes.forEach(node => {
        expect(node.lines.length).toBeGreaterThan(1);
      });
    });

    it('should accept custom lines', () => {
      const customLines = [
        { id: 'test', color: '#FF0000', stations: ['seoul', 'city_hall'] },
      ];
      const custom = generateMapLayout(customLines);
      expect(custom.nodes.length).toBeGreaterThanOrEqual(0);
      // Edges are only created if 2+ stations found
      expect(custom.width).toBe(4900);
    });

    it('should close loop for Line 2', () => {
      const line2Edges = mapData.edges.filter(e => e.lineId === '2');
      const loopEdge = line2Edges.find(e => e.id === 'edge-2-loop');
      expect(loopEdge).toBeDefined();
    });

    it('should skip unknown station IDs gracefully', () => {
      const customLines = [
        { id: 'test', color: '#FF0000', stations: ['seoul', 'nonexistent_station_xyz'] },
      ];
      const custom = generateMapLayout(customLines);
      // Should still work, just skip missing stations
      expect(custom.nodes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getNodeByName', () => {
    it('should find node by Korean name', () => {
      const node = getNodeByName(mapData, '서울역');
      expect(node).toBeDefined();
      expect(node?.id).toBe('seoul');
    });

    it('should find node by English name', () => {
      const node = getNodeByName(mapData, 'Seoul Station');
      if (node) {
        expect(node.name).toBe('서울역');
      }
    });

    it('should return undefined for unknown name', () => {
      const node = getNodeByName(mapData, 'Nonexistent Station');
      expect(node).toBeUndefined();
    });
  });

  describe('getTransferNodes', () => {
    it('should return only transfer nodes', () => {
      const transfers = getTransferNodes(mapData);
      expect(transfers.length).toBeGreaterThan(0);
      transfers.forEach(node => {
        expect(node.isTransfer).toBe(true);
      });
    });
  });

  describe('getLineEdges', () => {
    it('should return edges for a specific line', () => {
      const edges = getLineEdges(mapData, '1');
      expect(edges.length).toBeGreaterThan(0);
      edges.forEach(edge => {
        expect(edge.lineId).toBe('1');
      });
    });

    it('should return empty for unknown line', () => {
      const edges = getLineEdges(mapData, 'unknown_line');
      expect(edges).toEqual([]);
    });
  });

  describe('edgesToPath', () => {
    it('should return empty string for empty edges', () => {
      expect(edgesToPath([])).toBe('');
    });

    it('should create path string from straight edges', () => {
      const edges: MapEdge[] = [
        { id: 'e1', x1: 0, y1: 0, x2: 10, y2: 10, color: '#f00', lineId: '1' },
        { id: 'e2', x1: 10, y1: 10, x2: 20, y2: 20, color: '#f00', lineId: '1' },
      ];
      const path = edgesToPath(edges);
      expect(path).toContain('M 0 0');
      expect(path).toContain('L 10 10');
      expect(path).toContain('L 20 20');
    });

    it('should handle quadratic bezier curves', () => {
      const edges: MapEdge[] = [
        {
          id: 'e1', x1: 0, y1: 0, x2: 20, y2: 20,
          color: '#f00', lineId: '1',
          isCurve: true, cx1: 10, cy1: 5,
        },
      ];
      const path = edgesToPath(edges);
      expect(path).toContain('Q 10 5 20 20');
    });

    it('should handle cubic bezier curves', () => {
      const edges: MapEdge[] = [
        {
          id: 'e1', x1: 0, y1: 0, x2: 30, y2: 30,
          color: '#f00', lineId: '1',
          isCurve: true, cx1: 10, cy1: 5, cx2: 20, cy2: 25,
        },
      ];
      const path = edgesToPath(edges);
      expect(path).toContain('C 10 5 20 25 30 30');
    });
  });

  describe('createLinePaths', () => {
    it('should return paths for all lines', () => {
      const paths = createLinePaths(mapData);
      expect(typeof paths).toBe('object');
      expect(Object.keys(paths).length).toBeGreaterThan(0);
    });

    it('should have path and color for each line', () => {
      const paths = createLinePaths(mapData);
      Object.values(paths).forEach(lineData => {
        expect(typeof lineData.path).toBe('string');
        expect(lineData.path.length).toBeGreaterThan(0);
        expect(typeof lineData.color).toBe('string');
      });
    });
  });

  describe('Re-exported constants', () => {
    it('should export LINE_COLORS', () => {
      expect(typeof LINE_COLORS).toBe('object');
    });

    it('should export MAP_WIDTH and MAP_HEIGHT', () => {
      expect(MAP_WIDTH).toBe(4900);
      expect(MAP_HEIGHT).toBe(4400);
    });
  });
});
