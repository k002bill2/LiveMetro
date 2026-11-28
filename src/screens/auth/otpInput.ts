/**
 * OTP 칸 입력 복원 (#379).
 *
 * 한 칸(TextInput)의 onChangeText 값에는 "기존 값 중 남은 부분 + 새로 넣은 문자열"이 섞여 온다.
 * 값만으로는 "3 이 선택된 채 38 붙여넣기"와 "3 뒤에 8 타이핑"을 구분할 수 없으므로,
 * 변경 직전 선택 범위(onSelectionChange 로 기록)를 이용해 새로 넣은 문자열만 결정론적으로 떼어낸다.
 */

/** onSelectionChange 로 기록한 선택 범위 + 기록 시점의 칸 값 (이벤트 순서 가드용). */
export interface OtpCellSelection {
  readonly start: number;
  readonly end: number;
  /** 선택을 기록했을 때 그 칸에 표시되던 값. 변경 전 선택인지 판별하는 데 쓴다. */
  readonly value: string;
}

const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max);

/**
 * 변경 전 선택을 신뢰할 수 있는지. 기록 시점 값이 이전 칸 값과 다르거나 범위가 이전 값 길이를
 * 벗어나면(=변경 후 선택이 먼저 기록된 경우) 버리고 안전 기본값(커서 끝)을 쓴다.
 */
const isUsableSelection = (prev: string, sel: OtpCellSelection | null): sel is OtpCellSelection =>
  sel !== null &&
  sel.value === prev &&
  Number.isInteger(sel.start) &&
  Number.isInteger(sel.end) &&
  sel.start >= 0 &&
  sel.start <= sel.end &&
  sel.end <= prev.length;

/**
 * 변경 전 선택이라면 next 는 "prev 앞부분 + 삽입 + prev 뒷부분" 꼴이어야 한다.
 * 변경 후 선택이 먼저 기록된 경우(예: "3" 을 (0,1) 선택해 "5" 입력 → (1,1) 이 먼저 옴)를 걸러낸다.
 */
const isConsistentSelection = (prev: string, next: string, sel: OtpCellSelection): boolean =>
  next.startsWith(prev.slice(0, sel.start)) &&
  next.endsWith(prev.slice(sel.end)) &&
  next.length >= sel.start + (prev.length - sel.end);

/** 쓸 수 있는 선택이 없을 때 내용으로 추정: 앞이 같으면 커서 끝, 뒤가 같으면 커서 앞, 아니면 교체. */
const inferSelection = (prev: string, next: string): { start: number; end: number } => {
  const len = prev.length;
  if (next.startsWith(prev)) return { start: len, end: len };
  if (next.endsWith(prev)) return { start: 0, end: 0 };
  return { start: 0, end: len };
};

/**
 * 이전 칸 값(prev)과 변경 후 값(next, 숫자만)에서 실제로 삽입된 문자열을 복원한다.
 * - 선택 (0,len): next 전체가 새 입력 (교체)
 * - 커서 끝 (len,len): next.slice(len)
 * - 커서 앞 (0,0): next.slice(0, next.length - len)
 * 최근 선택(sel) → 그 직전 선택(earlier) 순으로, 쓸 수 있고 next 와 모순되지 않는 것을 쓴다.
 * 둘 다 안 되면 내용으로 추정한다(inferSelection).
 */
export const extractInsertedDigits = (
  prev: string,
  next: string,
  sel: OtpCellSelection | null,
  earlier: OtpCellSelection | null = null,
): string => {
  const len = prev.length;
  // 같은 값(비어 있지 않음) = 같은 숫자를 다시 씀. 삭제는 next 가 짧아지므로 구분된다.
  // 선택 기록·이벤트 순서와 무관하게 결정론적으로 "prev 를 삽입"으로 본다(칸 유지 + 다음 칸 포커스).
  if (len > 0 && next === prev) return prev;
  const chosen = [sel, earlier].find(
    (c): c is OtpCellSelection => isUsableSelection(prev, c) && isConsistentSelection(prev, next, c),
  );
  const { start, end } = chosen ?? inferSelection(prev, next);
  const keptSuffix = len - end;
  const insertEnd = clamp(next.length - keptSuffix, 0, next.length);
  return next.slice(clamp(start, 0, insertEnd), insertEnd);
};

/**
 * 삽입 문자열을 칸 배열에 분배한 새 배열과 다음 포커스 칸을 돌려준다 (입력 배열은 변경하지 않음).
 * - 삽입이 length 자리 이상(전체 코드·SMS 자동완성): 첫 칸부터 채운다.
 * - 그 외: 현재 칸부터 뒤로 채우고 넘치는 자리는 버린다 (앞 칸 덮어쓰기 금지).
 * - 빈 삽입(삭제): 현재 칸만 비운다.
 */
export const distributeOtpDigits = (
  cells: readonly string[],
  index: number,
  inserted: string,
): { readonly cells: readonly string[]; readonly focusIndex: number | null } => {
  const length = cells.length;
  if (inserted.length === 0) {
    return { cells: cells.map((c, i) => (i === index ? '' : c)), focusIndex: null };
  }
  const start = inserted.length >= length ? 0 : index;
  const chunk = inserted.slice(0, length - start);
  const nextCells = cells.map((c, i) =>
    i >= start && i < start + chunk.length ? chunk.charAt(i - start) : c,
  );
  const after = start + chunk.length;
  const focusIndex = chunk.length === 1 ? (after < length ? after : null) : Math.min(after, length - 1);
  return { cells: nextCells, focusIndex };
};
