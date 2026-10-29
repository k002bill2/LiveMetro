/**
 * Server-side lineId → display name table for push copy.
 *
 * Push title/body must never echo client-written strings (security finding
 * F-01), so the line name is resolved here from a fixed allowlist.
 *
 * Key domain = the client lineIds written to `delayReports.lineId` and
 * `pushTokens.lines`: `convertLineNumToLineId(line_num)` over
 * `src/data/seoulStations.json` in the RN app (src/services/data/
 * stationsDataService.ts) — "01호선" → "1", "인천2호선" → "인천2", other
 * names unchanged. Values are the dataset's own `line_num` display names.
 * Keep in sync if the station dataset gains a line.
 */
export const LINE_DISPLAY_NAMES: ReadonlyMap<string, string> = new Map<string, string>([
  ['1', '1호선'],
  ['2', '2호선'],
  ['3', '3호선'],
  ['4', '4호선'],
  ['5', '5호선'],
  ['6', '6호선'],
  ['7', '7호선'],
  ['8', '8호선'],
  ['9', '9호선'],
  ['GTX-A', 'GTX-A'],
  ['경강선', '경강선'],
  ['경의선', '경의선'],
  ['경춘선', '경춘선'],
  ['공항철도', '공항철도'],
  ['김포도시철도', '김포도시철도'],
  ['서해선', '서해선'],
  ['수인분당선', '수인분당선'],
  ['신림선', '신림선'],
  ['신분당선', '신분당선'],
  ['용인경전철', '용인경전철'],
  ['우이신설경전철', '우이신설경전철'],
  ['의정부경전철', '의정부경전철'],
  ['인천2', '인천2호선'],
  ['인천선', '인천선'],
]);

/**
 * Resolve a lineId to its display name. Returns null for anything not in the
 * table, including non-strings and Object.prototype keys (`constructor`,
 * `__proto__`) — a `Map` has no prototype-key fallthrough.
 */
export function getLineDisplayName(lineId: unknown): string | null {
  if (typeof lineId !== 'string') return null;
  return LINE_DISPLAY_NAMES.get(lineId) ?? null;
}
