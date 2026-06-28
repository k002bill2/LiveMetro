/**
 * Format Utility Functions
 * String formatting and display utilities
 */

/**
 * Format station name for display
 */
export const formatStationName = (stationName: string): string => {
  // Remove "역" suffix if present
  return stationName.replace(/역$/, '');
};

/**
 * Format line name for display  
 */
export const formatLineName = (lineId: string): string => {
  const lineNumber = lineId.replace(/[^0-9]/g, '');
  if (lineNumber) {
    return `${lineNumber}호선`;
  }
  
  // Handle special lines
  const specialLines: Record<string, string> = {
    'gyeongui': '경의중앙선',
    'jungang': '경의중앙선', 
    'bundang': '분당선',
    'sinbundang': '신분당선',
    'gyeongchun': '경춘선',
    'suin': '수인분당선',
    'uijeongbu': '의정부선',
    'ever': '에버라인',
    'seohae': '서해선',
    'gimpo': '김포골드라인',
    'wooyisinseol': '우이신설선',
    'airport': '공항철도',
    'gyeonggang': '경강선'
  };
  
  const normalized = lineId.toLowerCase();
  return specialLines[normalized] || lineId;
};

const SEOUL_REALTIME_SUBWAY_ID_TO_LINE_ID: Record<string, string> = {
  '1001': '1',
  '1002': '2',
  '1003': '3',
  '1004': '4',
  '1005': '5',
  '1006': '6',
  '1007': '7',
  '1008': '8',
  '1009': '9',
  '1061': '경의선',
  '1063': '경의선',
  '1065': '공항철도',
  '1067': '경춘선',
  '1071': '수인분당선',
  '1075': '수인분당선',
  '1077': '신분당선',
  '1081': '경강선',
  '1092': '우이신설경전철',
  '1093': '서해선',
  '1094': '신림선',
  '1032': 'GTX-A',
};

const APP_LINE_ID_ALIASES: Record<string, string> = {
  gyeongui: '경의선',
  jungang: '경의선',
  '경의중앙선': '경의선',
  '경의중앙': '경의선',
  bundang: '수인분당선',
  suin: '수인분당선',
  '분당선': '수인분당선',
  '수인선': '수인분당선',
  '수인분당': '수인분당선',
  sinbundang: '신분당선',
  shinbundang: '신분당선',
  '신분당': '신분당선',
  airport: '공항철도',
  gyeongchun: '경춘선',
  gyeonggang: '경강선',
  seohaeline: '서해선',
  seohae: '서해선',
  sillim: '신림선',
  wooyisinseol: '우이신설경전철',
  '우이신설': '우이신설경전철',
  '우이신설선': '우이신설경전철',
  gimpo: '김포도시철도',
  '김포골드': '김포도시철도',
  '김포골드라인': '김포도시철도',
  yongin: '용인경전철',
  ever: '용인경전철',
  everline: '용인경전철',
  '에버라인': '용인경전철',
  uijeongbu: '의정부경전철',
  incheon1: '인천선',
  '인천1호선': '인천선',
  '인천1': '인천선',
  incheon2: '인천2',
  '인천2호선': '인천2',
  gtx_a: 'GTX-A',
  'gtx-a': 'GTX-A',
  gtxa: 'GTX-A',
};

/**
 * Normalize Seoul realtime `subwayId`, app line slugs, and display names to
 * the app's canonical line id.
 *
 * Do not extract digits from mixed-name lines like `인천2`; those are distinct
 * app line ids and must not be mistaken for Seoul Line 2.
 */
export const normalizeSeoulLineId = (rawLineId: string): string => {
  const trimmed = rawLineId.trim();
  const subwayId = SEOUL_REALTIME_SUBWAY_ID_TO_LINE_ID[trimmed];
  if (subwayId) return subwayId;

  const direct = trimmed.match(/^0?([1-9])(?:호선)?$/);
  if (direct?.[1]) return direct[1];

  const legacy = trimmed.match(/^line-([1-9])$/i);
  if (legacy?.[1]) return legacy[1];

  const alias = APP_LINE_ID_ALIASES[trimmed] ?? APP_LINE_ID_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  return trimmed;
};

/**
 * App lineId → Seoul `realtimePosition` API official line name.
 *
 * The app's Korean lineId universe (Station.lineId, e.g. '경의선', '인천2')
 * does not match the API's official names — verified by probing every line
 * with the sample key (2026-06-12). `null` means the Seoul API does not
 * provide that line at all, so the call must be skipped (calling anyway
 * returns INFO-200, and '인천2' would even leak digits into '2호선').
 */
const SEOUL_API_POSITION_LINE_NAMES: Record<string, string | null> = {
  '1': '1호선',
  '2': '2호선',
  '3': '3호선',
  '4': '4호선',
  '5': '5호선',
  '6': '6호선',
  '7': '7호선',
  '8': '8호선',
  '9': '9호선',
  '공항철도': '공항철도',
  '경의선': '경의중앙선',
  '경춘선': '경춘선',
  '수인분당선': '수인분당선',
  '신분당선': '신분당선',
  '경강선': '경강선',
  '서해선': '서해선',
  '신림선': '신림선',
  'GTX-A': 'GTX-A',
  '우이신설경전철': '우이신설선',
  '김포도시철도': null,
  '용인경전철': null,
  '의정부경전철': null,
  '인천선': null,
  '인천2': null,
};

/**
 * Resolve the Seoul realtimePosition API line name for an app lineId.
 * Returns `null` when the API does not cover the line (skip the call).
 */
export const toSeoulApiLineName = (lineId: string): string | null => {
  const trimmed = lineId.trim();
  if (trimmed in SEOUL_API_POSITION_LINE_NAMES) {
    return SEOUL_API_POSITION_LINE_NAMES[trimmed] ?? null;
  }
  // Legacy english slugs ('gyeongui') and unknown ids keep the historical
  // formatLineName behavior — unknown names fail safe as INFO-200 no-data.
  return formatLineName(trimmed);
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  
  return phoneNumber;
};

/**
 * Format number with commas
 */
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('ko-KR').format(num);
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Capitalize first letter
 */
export const capitalize = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = parseFloat((bytes / Math.pow(1024, i)).toFixed(2));
  
  return `${size} ${sizes[i]}`;
};
