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

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Types
interface SeoulStationData {
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

interface FirestoreStation {
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
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
}

// Convert line_num to lineId
const convertLineNumToLineId = (lineNum: string): string => {
  const match = lineNum.match(/^0?(\d+)호선$/);
  if (match && match[1]) {
    return match[1];
  }
  return lineNum.replace('호선', '');
};

// Initialize Firebase Admin
const initializeFirebase = (): void => {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    || path.join(__dirname, '..', 'serviceAccountKey.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized with service account');
  } else {
    // Use application default credentials
    admin.initializeApp({
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    });
    console.log('✅ Firebase Admin initialized with default credentials');
  }
};

// Upload stations to Firestore
const uploadStations = async (): Promise<void> => {
  const db = admin.firestore();
  const stationsCollection = db.collection('stations');

  // Read local JSON data
  const jsonPath = path.join(__dirname, '..', 'src', 'data', 'seoulStations.json');
  const jsonData: SeoulStationsJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log(`📊 Found ${jsonData.DATA.length} stations to upload`);

  // Batch processing
  let batch = db.batch();
  let batchCount = 0;
  let totalUploaded = 0;
  const BATCH_SIZE = 450; // Firestore batch limit is 500, use 450 for safety

  for (const station of jsonData.DATA) {
    const stationDoc: FirestoreStation = {
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Use station code as document ID
    const docRef = stationsCollection.doc(station.station_cd);
    batch.set(docRef, stationDoc, { merge: true });
    batchCount++;

    // Commit batch when reaching limit
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      totalUploaded += batchCount;
      console.log(`✅ Committed batch of ${batchCount} stations (total: ${totalUploaded})`);
      batch = db.batch(); // Create new batch
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    totalUploaded += batchCount;
    console.log(`✅ Committed final batch of ${batchCount} stations`);
  }

  console.log(`\n🎉 Successfully uploaded ${jsonData.DATA.length} stations to Firestore!`);
};

// Create line index
const createLineIndex = async (): Promise<void> => {
  const db = admin.firestore();
  const linesCollection = db.collection('subwayLines');

  const jsonPath = path.join(__dirname, '..', 'src', 'data', 'seoulStations.json');
  const jsonData: SeoulStationsJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // Group stations by line
  const lineMap = new Map<string, string[]>();

  jsonData.DATA.forEach((station) => {
    const lineId = convertLineNumToLineId(station.line_num);
    if (!lineMap.has(lineId)) {
      lineMap.set(lineId, []);
    }
    lineMap.get(lineId)!.push(station.station_cd);
  });

  // Line colors
  const lineColors: Record<string, string> = {
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

  const batch = db.batch();

  for (const [lineId, stationIds] of lineMap) {
    const lineDoc = {
      name: `${lineId}호선`,
      color: lineColors[lineId] || '#888888',
      stationCount: stationIds.length,
      stationIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = linesCollection.doc(lineId);
    batch.set(docRef, lineDoc, { merge: true });
  }

  await batch.commit();
  console.log(`✅ Created ${lineMap.size} line indexes`);
};

// Main
const main = async (): Promise<void> => {
  try {
    console.log('🚇 Seoul Metro Station Data Uploader\n');

    initializeFirebase();

    console.log('\n📤 Uploading stations...');
    await uploadStations();

    console.log('\n📋 Creating line indexes...');
    await createLineIndex();

    console.log('\n✨ All done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();
