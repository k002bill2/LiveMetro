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