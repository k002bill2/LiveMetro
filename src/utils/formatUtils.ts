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