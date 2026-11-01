/**
 * Upload Seoul Metro Station Data to Firebase Firestore
 *
 * Usage:
 *   npx ts-node scripts/uploadStationsToFirebase.ts
 *
 * Prerequisites:
 *   1. Set GOOGLE_APPLICATION_CREDENTIALS env variable to service account key path
 *      OR place serviceAccountKey.json in project root
 *   2. Ensure Firebase project is configured
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Types
export interface SeoulStationData {
  line_num: string;
  station_nm: string;
  station_nm_eng: string;
  station_nm_chn: string;
  station_nm_jpn: string;
  station_cd: string;
  fr_code: string;
}

interface SeoulStationsJson {
  DESCRIPTION: Record<string, string>;
  DATA: SeoulStationData[];
}

export interface FirestoreStation {
  name: string;
  nameEn: string;
  nameCn: string;
  nameJp: string;
  lineId: string;
  lineName: string;
  stationCode: string;
  externalCode: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  transfers: string[];
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

export interface FirestoreLineIndex {
  name: string;
  color: string;
  stationCount: number;
  stationIds: string[];
  updatedAt: FieldValue;
}

export const STATIONS_COLLECTION = 'stations';
export const LINES_COLLECTION = 'subwayLines';
export const BATCH_SIZE = 450; // Firestore batch limit is 500, use 450 for safety

const LINE_COLORS: Readonly<Record<string, string>> = {
  '1': '#0052A4',
  '2': '#00A84D',
  '3': '#EF7C1C',
  '4': '#00A5DE',
  '5': '#996CAC',
  '6': '#CD7C2F',
  '7': '#747F00',
  '8': '#E6186C',
  '9': '#BDB092',
};
const DEFAULT_LINE_COLOR = '#888888';

// Convert line_num to lineId
export const convertLineNumToLineId = (lineNum: string): string => {
  const match = lineNum.match(/^0?(\d+)호선$/);
  if (match && match[1]) {
    return match[1];
  }
  return lineNum.replace('호선', '');
};

// Build one station document (document ID = station_cd)
export const buildStationDoc = (
  station: SeoulStationData,
  timestamp: FieldValue,
): FirestoreStation => ({
  name: station.station_nm,
  nameEn: station.station_nm_eng,
  nameCn: station.station_nm_chn,
  nameJp: station.station_nm_jpn,
  lineId: convertLineNumToLineId(station.line_num),
  lineName: station.line_num,
  stationCode: station.station_cd,
  externalCode: station.fr_code,
  coordinates: {
    latitude: 37.5665, // Default - can be updated later
    longitude: 126.9780,
  },
  transfers: [],
  createdAt: timestamp,
  updatedAt: timestamp,
});

// Group station codes by lineId (insertion order preserved) and build line docs
export const buildLineIndexDocs = (
  stations: readonly SeoulStationData[],
  timestamp: FieldValue,
): { lineId: string; doc: FirestoreLineIndex }[] => {
  const lineMap = new Map<string, string[]>();
  stations.forEach((station) => {
    const lineId = convertLineNumToLineId(station.line_num);
    lineMap.set(lineId, [...(lineMap.get(lineId) ?? []), station.station_cd]);
  });

  return [...lineMap].map(([lineId, stationIds]) => ({
    lineId,
    doc: {
      name: `${lineId}호선`,
      color: LINE_COLORS[lineId] || DEFAULT_LINE_COLOR,
      stationCount: stationIds.length,
      stationIds,
      updatedAt: timestamp,
    },
  }));
};

// Split items into consecutive chunks of at most `size`
export const chunkIntoBatches = <T>(items: readonly T[], size: number = BATCH_SIZE): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

// Initialize Firebase Admin
const initializeFirebase = (): void => {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || path.join(__dirname, '..', 'serviceAccountKey.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    initializeApp({
      credential: cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized with service account');
  } else {
    // Use application default credentials
    initializeApp({
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    });
    console.log('✅ Firebase Admin initialized with default credentials');
  }
};

// Upload stations to Firestore
export const uploadStations = async (
  db: Firestore,
  stations: readonly SeoulStationData[],
): Promise<void> => {
  const stationsCollection = db.collection(STATIONS_COLLECTION);

  console.log(`📊 Found ${stations.length} stations to upload`);

  let totalUploaded = 0;
  for (const chunk of chunkIntoBatches(stations)) {
    const batch = db.batch();
    for (const station of chunk) {
      // Use station code as document ID
      const docRef = stationsCollection.doc(station.station_cd);
      batch.set(docRef, buildStationDoc(station, FieldValue.serverTimestamp()), { merge: true });
    }
    await batch.commit();
    totalUploaded += chunk.length;
    if (chunk.length >= BATCH_SIZE) {
      console.log(`✅ Committed batch of ${chunk.length} stations (total: ${totalUploaded})`);
    } else {
      console.log(`✅ Committed final batch of ${chunk.length} stations`);
    }
  }

  console.log(`\n🎉 Successfully uploaded ${stations.length} stations to Firestore!`);
};

// Create line index
export const createLineIndex = async (
  db: Firestore,
  stations: readonly SeoulStationData[],
): Promise<void> => {
  const linesCollection = db.collection(LINES_COLLECTION);
  const lineDocs = buildLineIndexDocs(stations, FieldValue.serverTimestamp());

  const batch = db.batch();
  for (const { lineId, doc } of lineDocs) {
    batch.set(linesCollection.doc(lineId), doc, { merge: true });
  }

  await batch.commit();
  console.log(`✅ Created ${lineDocs.length} line indexes`);
};

const readStations = (): SeoulStationData[] => {
  const jsonPath = path.join(__dirname, '..', 'src', 'data', 'seoulStations.json');
  const jsonData: SeoulStationsJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  return jsonData.DATA;
};

// Main
const main = async (): Promise<void> => {
  try {
    console.log('🚇 Seoul Metro Station Data Uploader\n');

    // Load environment variables
    dotenv.config();
    initializeFirebase();
    const db = getFirestore();

    console.log('\n📤 Uploading stations...');
    await uploadStations(db, readStations());

    console.log('\n📋 Creating line indexes...');
    await createLineIndex(db, readStations());

    console.log('\n✨ All done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  void main();
}
