/**
 * Date Utility Functions
 * Helper functions for date and time operations
 */

/**
 * Format date for display
 */
export const formatDate = (date: Date, format: 'short' | 'long' | 'time' | 'datetime' = 'short'): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Relative time for recent dates
  if (format === 'short') {
    if (diffMinutes < 1) return '방금 전';
    if (diffMinutes < 60) return `${diffMinutes}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
  }

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Seoul',
  };

  switch (format) {
    case 'time':
      options.hour = '2-digit';
      options.minute = '2-digit';
      break;
    case 'datetime':
      options.year = 'numeric';
      options.month = 'short';
      options.day = 'numeric';
      options.hour = '2-digit';
      options.minute = '2-digit';
      break;
    case 'long':
      options.year = 'numeric';
      options.month = 'long';
      options.day = 'numeric';
      options.weekday = 'long';
      break;
    default:
      options.year = 'numeric';
      options.month = 'short';
      options.day = 'numeric';
  }

  return date.toLocaleDateString('ko-KR', options);
};

/**
 * Format arrival time for trains
 */
export const formatArrivalTime = (arrivalTime: Date | number | null): string => {
  if (!arrivalTime) return '정보없음';

  const now = new Date();
  let targetTime: Date;

  if (typeof arrivalTime === 'number') {
    // If it's seconds until arrival
    targetTime = new Date(now.getTime() + arrivalTime * 1000);
  } else {
    targetTime = arrivalTime;
  }

  const diffSeconds = Math.floor((targetTime.getTime() - now.getTime()) / 1000);

  if (diffSeconds <= 0) return '도착';
  if (diffSeconds < 60) return '곧 도착';
  
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes === 1) return '1분후';
  return `${minutes}분후`;
};

/**
 * Check if time is within business hours
 */
export const isBusinessHours = (date: Date = new Date()): boolean => {
  const hour = date.getHours();
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Seoul subway typically runs 05:30 - 00:30 (next day)
  const isWeekend = day === 0 || day === 6;
  
  if (isWeekend) {
    // Weekend hours: 05:30 - 00:30
    return hour >= 6 || hour <= 0;
  } else {
    // Weekday hours: 05:30 - 00:30
    return hour >= 5 || hour <= 0;
  }
};

/**
 * Get commute time category
 */
export const getCommuteTimeCategory = (date: Date = new Date()): 'morning-rush' | 'evening-rush' | 'normal' => {
  const hour = date.getHours();
  const day = date.getDay();

  // Weekend has no rush hour
  if (day === 0 || day === 6) return 'normal';

  // Morning rush: 7:00 - 9:30
  if (hour >= 7 && hour < 10) {
    if (hour === 9 && date.getMinutes() > 30) return 'normal';
    return 'morning-rush';
  }

  // Evening rush: 18:00 - 20:00
  if (hour >= 18 && hour < 20) {
    return 'evening-rush';
  }

  return 'normal';
};

/**
 * Parse time string (HH:mm) to Date object for today
 */
export const parseTimeString = (timeString: string, baseDate?: Date): Date => {
  const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));
  const date = baseDate ? new Date(baseDate) : new Date();
  
  date.setHours(hours, minutes, 0, 0);
  return date;
};

/**
 * Format time string from Date
 */
export const formatTimeString = (date: Date): string => {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul'
  });
};

/**
 * Check if current time is within quiet hours
 */
export const isWithinQuietHours = (
  startTime: string,
  endTime: string,
  currentDate: Date = new Date()
): boolean => {
  const start = parseTimeString(startTime, currentDate);
  const end = parseTimeString(endTime, currentDate);

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (start.getTime() > end.getTime()) {
    end.setDate(end.getDate() + 1);
    
    // Check if current time is after start time today or before end time tomorrow
    const currentTime = currentDate.getTime();
    const startToday = start.getTime();
    const endTomorrow = end.getTime();
    
    return currentTime >= startToday || currentTime <= endTomorrow;
  }

  // Normal hours (e.g., 01:00 - 05:00)
  const currentTime = currentDate.getTime();
  return currentTime >= start.getTime() && currentTime <= end.getTime();
};

/**
 * Get next occurrence of a time
 */
export const getNextOccurrence = (timeString: string, baseDate: Date = new Date()): Date => {
  const targetTime = parseTimeString(timeString, baseDate);
  
  // If the time has already passed today, set it for tomorrow
  if (targetTime.getTime() <= baseDate.getTime()) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  return targetTime;
};

/**
 * Calculate time difference in human readable format
 */
export const getTimeDifference = (
  startTime: Date,
  endTime: Date,
  format: 'short' | 'long' = 'short'
): string => {
  const diffMs = Math.abs(endTime.getTime() - startTime.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (format === 'short') {
    if (diffMinutes < 60) return `${diffMinutes}분`;
    if (diffHours < 24) return `${diffHours}시간 ${diffMinutes % 60}분`;
    return `${diffDays}일 ${diffHours % 24}시간`;
  } else {
    if (diffMinutes < 60) return `${diffMinutes}분`;
    if (diffHours < 24) {
      const remainingMinutes = diffMinutes % 60;
      return remainingMinutes > 0 ? `${diffHours}시간 ${remainingMinutes}분` : `${diffHours}시간`;
    }
    const remainingHours = diffHours % 24;
    const remainingMinutes = diffMinutes % 60;
    let result = `${diffDays}일`;
    if (remainingHours > 0) result += ` ${remainingHours}시간`;
    if (remainingMinutes > 0) result += ` ${remainingMinutes}분`;
    return result;
  }
};

/**
 * Check if date is today
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

/**
 * Check if date is yesterday
 */
export const isYesterday = (date: Date): boolean => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
};

/**
 * Get Korean day of week
 */
export const getKoreanDayOfWeek = (date: Date = new Date()): string => {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[date.getDay()];
};

/**
 * Format countdown timer
 */
export const formatCountdown = (seconds: number): string => {
  if (seconds <= 0) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};