
import { generateMapLayout } from '../mapLayout';
import { STATIONS, LINE_STATIONS } from '../subwayMapData';

describe('generateMapLayout', () => {
  it('should generate map data with nodes and edges using default data', () => {
    const mapData = generateMapLayout();

    console.log('Total Nodes:', mapData.nodes.length);
    console.log('Total Edges:', mapData.edges.length);

    // Check if we have nodes
    expect(mapData.nodes.length).toBeGreaterThan(0);

    // Check if we have edges
    expect(mapData.edges.length).toBeGreaterThan(0);

    // Verify dimensions (updated to match actual MAP_WIDTH/HEIGHT)
    expect(mapData.width).toBe(4900);
    expect(mapData.height).toBe(4400);
  });

  it('should correctly map stations to nodes', () => {
    const mapData = generateMapLayout();

    // Check for a known station (e.g., Seoul Station)
    const seoulStation = mapData.nodes.find(n => n.id === 'seoul');
    expect(seoulStation).toBeDefined();
    expect(seoulStation?.name).toBe('서울역');
    // Updated coordinates to match actual STATIONS data
    expect(seoulStation?.x).toBe(2143);
    expect(seoulStation?.y).toBe(1711);
  });

  it('should generate edges for lines', () => {
    const mapData = generateMapLayout();
    
    // Check edges for Line 1
    const line1Edges = mapData.edges.filter(e => e.lineId === '1');
    expect(line1Edges.length).toBeGreaterThan(0);
  });
});
