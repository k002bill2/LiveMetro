/**
 * Transfer badge label formatting per Wanted Design hand-off v5 PNG ground truth.
 *
 * Numeric line IDs ('1'~'9') render as-is.
 * Korean line IDs (공항철도 / 수인분당선 / etc.) collapse to short labels so
 * that the small badge style (paddingHorizontal: 8) matches the visual density
 * shown in docs/design/livemetro/project/uploads/pasted-1777743918147-0.png.
 */

export const LINE_NAMES: Record<string, string> = {
  '1': '1호선', '2': '2호선', '3': '3호선',
  '4': '4호선', '5': '5호선', '6': '6호선',
  '7': '7호선', '8': '8호선', '9': '9호선',
  '공항철도': '공항',
  '경의선': '경의중앙',
  '경춘선': '경춘',
  '수인분당선': '수인분당',
  '신분당선': '신분당',
  '경강선': '경강',
  '서해선': '서해',
  '인천선': '인천1',
  '인천2': '인천2',
  '용인경전철': '에버라인',
  '의정부경전철': '의정부',
  '우이신설경전철': '우이신설',
  '김포도시철도': '김포골드',
  '신림선': '신림',
  'GTX-A': 'GTX-A',
};

export const formatTransferBadgeLabel = (lineId: string): string => {
  const label = LINE_NAMES[lineId] ?? lineId;
  return label.replace(/호선$/, '');
};
