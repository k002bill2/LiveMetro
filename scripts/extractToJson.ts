/**
 * Script to extract STATIONS and LINE data from subwayMapData.ts to JSON files
 * Run: npx ts-node scripts/extractToJson.ts
 */

import { STATIONS, LINE_STATIONS, LINE_COLORS } from '../src/utils/subwayMapData';
import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.join(__dirname, '..', 'src', 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Export stations.json
const stationsPath = path.join(dataDir, 'stations.json');
fs.writeFileSync(stationsPath, JSON.stringify(STATIONS, null, 2));
console.log(`✅ Created ${stationsPath}`);
console.log(`   Total stations: ${Object.keys(STATIONS).length}`);

// Export lines.json
const linesData = {
  colors: LINE_COLORS,
  stations: LINE_STATIONS,
};
const linesPath = path.join(dataDir, 'lines.json');
fs.writeFileSync(linesPath, JSON.stringify(linesData, null, 2));
console.log(`✅ Created ${linesPath}`);
console.log(`   Total lines: ${Object.keys(LINE_STATIONS).length}`);
console.log(`   Total colors: ${Object.keys(LINE_COLORS).length}`);

console.log('\n🎉 JSON extraction complete!');
