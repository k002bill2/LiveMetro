/**
 * staticExitLandmarks — 역명별 출구 주요장소 정적 lookup.
 *
 * `src/data/exitLandmarks.json` (scripts/fetchExitLandmarks.ts 산출)을 읽어
 * 역명(stationName)으로 조회한다. `stationAccessibility.ts` 와 동일한
 * 정적-JSON-테이블 패턴 (memory: [Empty-data foundation 패턴]).
 *
 * 왜 정적인가: odcloud 국가철도공단 출구별주요장소 API(15073460)는 data.go.kr
 * 활용신청(서비스 등록)이 필요하고 web 에선 CORS 로 막힌다. 라이브 호출이 빈
 * 결과/에러를 줄 때(또는 web) 이 테이블을 fallback SoT 로 사용해, "출구 안내
 * 정보가 없습니다" 빈 화면이 모든 역에 뜨는 것을 막는다 (Issue #173).
 *
 * Invariants:
 *  - 같은 입력 → 같은 출력 (deterministic)
 *  - 데이터셋에 없는 역 → 빈 배열 (unknown). 에러로 취급하지 않는다.
 *  - JSON 의 stations 키 부재 시 빈 테이블 → 모든 역 빈 배열 (기능 inert, graceful)
 *  - 반환값은 방어적 복사본 — 호출부 mutation 이 테이블을 오염시키지 않는다.
 */
import type { ExitLandmark } from '@/models/publicData';
import exitLandmarksJson from '@/data/exitLandmarks.json';

interface ExitLandmarksFile {
  readonly generatedAt: string;
  readonly source: string;
  readonly stations?: Readonly<Record<string, readonly ExitLandmark[]>>;
}

const FILE = exitLandmarksJson as ExitLandmarksFile;
const TABLE: Readonly<Record<string, readonly ExitLandmark[]>> = FILE.stations ?? {};

/**
 * 역명의 정적 출구 주요장소 목록.
 * @param stationName 역명 (예: "서울역"). 데이터셋의 키와 정확히 일치해야 한다.
 * @returns 출구 장소 배열 (방어적 복사본). 미수록 역은 빈 배열.
 */
export function getStaticExitLandmarks(stationName: string): ExitLandmark[] {
  const entry = TABLE[stationName];
  return entry ? [...entry] : [];
}
