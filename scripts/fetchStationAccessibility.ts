/**
 * fetchStationAccessibility — one-off generator for src/data/stationAccessibility.json
 *
 * data.go.kr 교통약자이용정보 API(B553766/wksn)를 역명별로 조회해 엘리베이터
 * 유무를 기록한다. 엘리베이터 유무는 거의 안 변하므로 가끔만 재실행한다.
 *
 * 실행:
 *   EXPO_PUBLIC_DATA_PORTAL_API_KEY=<key> npx ts-node scripts/fetchStationAccessibility.ts
 *
 * 네트워크: apis.data.go.kr 는 sandbox allowlist 에 없다 — sandbox 해제 또는
 * 일반 터미널에서 실행할 것.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { STATIONS } from '../src/utils/subwayMapData';

const API_KEY = process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY ?? '';
const ENDPOINT = 'https://apis.data.go.kr/B553766/wksn/stnInfoList';
const RATE_LIMIT_MS = 1100; // data.go.kr 1초 제한 + 여유

interface RawItem {
  readonly stinNm: string;
  readonly elvtrSttus?: string; // 엘리베이터 개수 (문자열)
}
interface RawResponse {
  readonly response: { readonly body: { readonly items: readonly RawItem[] } };
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** 한 역명의 엘리베이터 개수 조회. 실패 시 null. */
async function fetchElevatorCount(stationName: string): Promise<number | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.append('serviceKey', decodeURIComponent(API_KEY));
  url.searchParams.append('numOfRows', '10');
  url.searchParams.append('pageNo', '1');
  url.searchParams.append('stinNm', stationName);
  url.searchParams.append('type', 'json');
  try {
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as RawResponse;
    const item = json.response?.body?.items?.[0];
    if (!item) return null;
    const count = Number.parseInt(item.elvtrSttus ?? '0', 10);
    return Number.isNaN(count) ? 0 : count;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error('EXPO_PUBLIC_DATA_PORTAL_API_KEY 미설정');
    process.exit(1);
  }

  // 역명 → 그 역명을 쓰는 stationId 목록 (환승역은 노선별 다른 id 가 같은 역명 공유)
  const nameToIds = new Map<string, string[]>();
  for (const station of Object.values(STATIONS)) {
    const list = nameToIds.get(station.name) ?? [];
    list.push(station.id);
    nameToIds.set(station.name, list);
  }

  const stations: Record<string, { hasElevator: boolean; elevatorCount: number }> = {};
  const failed: string[] = [];
  const names = [...nameToIds.keys()];

  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    const count = await fetchElevatorCount(name);
    if (count === null) {
      failed.push(name);
    } else {
      for (const id of nameToIds.get(name)!) {
        stations[id] = { hasElevator: count > 0, elevatorCount: count };
      }
    }
    console.log(`[${i + 1}/${names.length}] ${name}: ${count ?? 'FAILED'}`);
    if (i < names.length - 1) await sleep(RATE_LIMIT_MS);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'data.go.kr/B553766/wksn/stnInfoList',
    stations,
  };
  const outPath = join(__dirname, '../src/data/stationAccessibility.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  console.log(`\n작성: ${outPath} (${Object.keys(stations).length} stations)`);
  if (failed.length > 0) {
    console.warn(`실패 ${failed.length}역 (런타임 neutral 처리됨): ${failed.join(', ')}`);
  }
}

void main();
