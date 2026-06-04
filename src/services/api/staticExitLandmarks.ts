/**
 * staticExitLandmarks — 역명별 출구 주요장소 정적 lookup.
 *
 * `src/data/exitLandmarks.json` (scripts/fetchExitLandmarks.ts 산출)을 읽어
 * 역명(stationName)으로 조회한다. `stationAccessibility.ts` 와 동일한
 * 정적-JSON-테이블 패턴 (memory: [Empty-data foundation 패턴]).
 *
 * 왜 정적인가: 라이브 odcloud REST 출구 API 는 실제로 존재하지 않았다(Issue
 * #173 — 원 코드의 15073460 은 죽은 전제였다). 실데이터는 data.go.kr
 * "국가철도공단_서울교통공사 출구별 주요 장소" 파일데이터(CSV)로만 제공되므로,
 * 이를 빌드타임에 정적 JSON 으로 베이크해 SoT 로 쓴다. 미수록 역은 빈 배열을
 * 반환해 "출구 안내 정보가 없습니다" 를 표시한다.
 *
 * Invariants:
 *  - 같은 입력 → 같은 출력 (deterministic)
 *  - 데이터셋에 없는 역 → 빈 배열 (unknown). 에러로 취급하지 않는다.
 *  - JSON 의 stations 키 부재 시 빈 테이블 → 모든 역 빈 배열 (기능 inert, graceful)
 *  - 반환값은 방어적 복사본 — 호출부 mutation 이 테이블을 오염시키지 않는다.
 */
import type { ExitLandmark } from '@/models/publicData';
import exitLandmarksJson from '@/data/exitLandmarks.json';

/** 역명 → 출구번호 → 시설명[] (컴팩트 저장 구조). */
type CompactExits = Readonly<Record<string, readonly string[]>>;

interface ExitLandmarksFile {
  readonly generatedAt: string;
  readonly source: string;
  readonly stations?: Readonly<Record<string, CompactExits>>;
}

const FILE = exitLandmarksJson as ExitLandmarksFile;
const TABLE: Readonly<Record<string, CompactExits>> = FILE.stations ?? {};

/**
 * stationName 을 출구 테이블 키로 해석.
 *  1) trim 후 정확 일치 우선
 *  2) 역 suffix 없는 변형은 "역" 을 붙여 재시도 ("서울" → "서울역")
 *
 * 좌표가 동일한 GTX-A "서울" 노드(stations.json s_9005, seoulStations cd 9005)를
 * 탭하면 stationName 이 "서울"(역 suffix 없음)로 들어온다. 실시간 API 는 부분매칭으로
 * 살지만 출구 lookup 은 exact 키 "서울역"과 어긋나 빈다 — 그 비대칭을 보정한다.
 */
function resolveStationKey(stationName: string): string | null {
  const name = stationName.trim();
  if (Object.prototype.hasOwnProperty.call(TABLE, name)) return name;
  if (!name.endsWith('역')) {
    const withSuffix = `${name}역`;
    if (Object.prototype.hasOwnProperty.call(TABLE, withSuffix)) return withSuffix;
  }
  return null;
}

/**
 * 역명의 정적 출구 주요장소 목록.
 *
 * 컴팩트 저장소(출구번호→시설명[])에서 정규화된 역명·exitNumber 를 채워 ExitLandmark
 * 로 복원한다. 매 호출마다 새 객체를 생성하므로 호출부 mutation 이 테이블을
 * 오염시키지 않는다.
 *
 * @param stationName 역명 (예: "서울역" 또는 "서울"). trim·역-suffix fallback 적용.
 * @returns 출구 장소 배열 (stationName 은 매칭된 정식 키). 미수록 역은 빈 배열.
 */
export function getStaticExitLandmarks(stationName: string): ExitLandmark[] {
  const key = resolveStationKey(stationName);
  if (!key) return [];
  const byExit = TABLE[key]!;
  const out: ExitLandmark[] = [];
  for (const exitNumber of Object.keys(byExit)) {
    for (const landmarkName of byExit[exitNumber]!) {
      out.push({ stationName: key, exitNumber, landmarkName });
    }
  }
  return out;
}
