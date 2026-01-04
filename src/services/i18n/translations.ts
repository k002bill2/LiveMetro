/**
 * Translations for LiveMetro app
 * Supports Korean (ko) and English (en)
 */

export type Language = 'ko' | 'en';

export interface Translations {
  // Common
  common: {
    cancel: string;
    confirm: string;
    save: string;
    delete: string;
    edit: string;
    done: string;
    back: string;
    next: string;
    loading: string;
    error: string;
    retry: string;
    ok: string;
  };
  // Settings
  settings: {
    title: string;
    profile: string;
    anonymousUser: string;
    // Notification settings
    notificationSettings: string;
    commuteSettings: string;
    commuteSettingsDesc: string;
    delayAlert: string;
    delayAlertDesc: string;
    notificationTime: string;
    notificationTimeDesc: string;
    soundSettings: string;
    soundSettingsDesc: string;
    // App settings
    appSettings: string;
    language: string;
    languageDesc: string;
    theme: string;
    themeDesc: string;
    themeSystem: string;
    themeLight: string;
    themeDark: string;
    locationPermission: string;
    locationPermissionDesc: string;
    // Security
    security: string;
    biometricLogin: string;
    biometricLoginDesc: string;
    biometricUnavailable: string;
    // Info
    info: string;
    help: string;
    helpDesc: string;
    privacyPolicy: string;
    termsOfService: string;
    appInfo: string;
    version: string;
    // Actions
    signOut: string;
    signOutConfirm: string;
  };
  // Language settings
  languageSettings: {
    title: string;
    korean: string;
    english: string;
    changeConfirm: string;
    changeMessage: string;
  };
  // Theme settings
  themeSettings: {
    title: string;
    system: string;
    systemDesc: string;
    light: string;
    lightDesc: string;
    dark: string;
    darkDesc: string;
  };
  // Home
  home: {
    title: string;
    nearbyStations: string;
    recentStations: string;
    searchPlaceholder: string;
    noStationsFound: string;
  };
  // Favorites
  favorites: {
    title: string;
    empty: string;
    addFavorite: string;
  };
  // Alerts
  alerts: {
    title: string;
    noAlerts: string;
    delay: string;
    suspension: string;
    serviceUpdate: string;
  };
  // Station
  station: {
    arrival: string;
    departure: string;
    transfer: string;
    platform: string;
    minutes: string;
    arriving: string;
    approaching: string;
  };
  // Errors
  errors: {
    networkError: string;
    serverError: string;
    unknownError: string;
    authError: string;
  };
}

export const translations: Record<Language, Translations> = {
  ko: {
    common: {
      cancel: '취소',
      confirm: '확인',
      save: '저장',
      delete: '삭제',
      edit: '수정',
      done: '완료',
      back: '뒤로',
      next: '다음',
      loading: '로딩 중...',
      error: '오류',
      retry: '다시 시도',
      ok: '확인',
    },
    settings: {
      title: '설정',
      profile: '프로필',
      anonymousUser: '익명 사용자',
      notificationSettings: '알림 설정',
      commuteSettings: '출퇴근 설정',
      commuteSettingsDesc: '출퇴근 경로 및 알림 설정',
      delayAlert: '지연 알림',
      delayAlertDesc: '열차 지연 시 알림 받기',
      notificationTime: '알림 시간대',
      notificationTimeDesc: '출퇴근 시간 설정',
      soundSettings: '소리 설정',
      soundSettingsDesc: '알림음 및 진동 설정',
      appSettings: '앱 설정',
      language: '언어',
      languageDesc: '한국어',
      theme: '테마',
      themeDesc: '시스템 설정 따름',
      themeSystem: '시스템 설정 따름',
      themeLight: '라이트 모드',
      themeDark: '다크 모드',
      locationPermission: '위치 권한',
      locationPermissionDesc: '주변 역 검색을 위해 필요',
      security: '보안',
      biometricLogin: '생체인증 로그인',
      biometricLoginDesc: '생체인증으로 빠르게 로그인',
      biometricUnavailable: '이 기기에서 사용할 수 없음',
      info: '정보',
      help: '도움말',
      helpDesc: '앱 사용법 및 FAQ',
      privacyPolicy: '개인정보처리방침',
      termsOfService: '서비스 이용약관',
      appInfo: '앱 정보',
      version: '버전',
      signOut: '로그아웃',
      signOutConfirm: '정말 로그아웃하시겠습니까?',
    },
    languageSettings: {
      title: '언어 설정',
      korean: '한국어',
      english: 'English',
      changeConfirm: '언어 변경',
      changeMessage: '언어를 변경하시겠습니까?',
    },
    themeSettings: {
      title: '테마 설정',
      system: '시스템 설정 따름',
      systemDesc: '기기 설정에 따라 자동 전환',
      light: '라이트 모드',
      lightDesc: '밝은 배경의 화면',
      dark: '다크 모드',
      darkDesc: '어두운 배경의 화면',
    },
    home: {
      title: '홈',
      nearbyStations: '주변 역',
      recentStations: '최근 본 역',
      searchPlaceholder: '역 이름 검색',
      noStationsFound: '검색 결과가 없습니다',
    },
    favorites: {
      title: '즐겨찾기',
      empty: '즐겨찾기한 역이 없습니다',
      addFavorite: '즐겨찾기 추가',
    },
    alerts: {
      title: '알림',
      noAlerts: '알림이 없습니다',
      delay: '지연',
      suspension: '운행 중단',
      serviceUpdate: '서비스 업데이트',
    },
    station: {
      arrival: '도착',
      departure: '출발',
      transfer: '환승',
      platform: '승강장',
      minutes: '분',
      arriving: '곧 도착',
      approaching: '진입 중',
    },
    errors: {
      networkError: '네트워크 연결을 확인해주세요',
      serverError: '서버 오류가 발생했습니다',
      unknownError: '알 수 없는 오류가 발생했습니다',
      authError: '인증에 실패했습니다',
    },
  },
  en: {
    common: {
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      done: 'Done',
      back: 'Back',
      next: 'Next',
      loading: 'Loading...',
      error: 'Error',
      retry: 'Retry',
      ok: 'OK',
    },
    settings: {
      title: 'Settings',
      profile: 'Profile',
      anonymousUser: 'Anonymous User',
      notificationSettings: 'Notification Settings',
      commuteSettings: 'Commute Settings',
      commuteSettingsDesc: 'Set commute routes and alerts',
      delayAlert: 'Delay Alerts',
      delayAlertDesc: 'Get notified of train delays',
      notificationTime: 'Notification Time',
      notificationTimeDesc: 'Set commute time',
      soundSettings: 'Sound Settings',
      soundSettingsDesc: 'Alert sounds and vibration',
      appSettings: 'App Settings',
      language: 'Language',
      languageDesc: 'English',
      theme: 'Theme',
      themeDesc: 'Follow system',
      themeSystem: 'Follow System',
      themeLight: 'Light Mode',
      themeDark: 'Dark Mode',
      locationPermission: 'Location Permission',
      locationPermissionDesc: 'Required for nearby stations',
      security: 'Security',
      biometricLogin: 'Biometric Login',
      biometricLoginDesc: 'Quick login with biometrics',
      biometricUnavailable: 'Not available on this device',
      info: 'Information',
      help: 'Help',
      helpDesc: 'How to use & FAQ',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      appInfo: 'App Info',
      version: 'Version',
      signOut: 'Sign Out',
      signOutConfirm: 'Are you sure you want to sign out?',
    },
    languageSettings: {
      title: 'Language',
      korean: '한국어',
      english: 'English',
      changeConfirm: 'Change Language',
      changeMessage: 'Do you want to change the language?',
    },
    themeSettings: {
      title: 'Theme',
      system: 'Follow System',
      systemDesc: 'Auto-switch based on device settings',
      light: 'Light Mode',
      lightDesc: 'Light background theme',
      dark: 'Dark Mode',
      darkDesc: 'Dark background theme',
    },
    home: {
      title: 'Home',
      nearbyStations: 'Nearby Stations',
      recentStations: 'Recent Stations',
      searchPlaceholder: 'Search station',
      noStationsFound: 'No stations found',
    },
    favorites: {
      title: 'Favorites',
      empty: 'No favorite stations',
      addFavorite: 'Add Favorite',
    },
    alerts: {
      title: 'Alerts',
      noAlerts: 'No alerts',
      delay: 'Delay',
      suspension: 'Suspension',
      serviceUpdate: 'Service Update',
    },
    station: {
      arrival: 'Arrival',
      departure: 'Departure',
      transfer: 'Transfer',
      platform: 'Platform',
      minutes: 'min',
      arriving: 'Arriving',
      approaching: 'Approaching',
    },
    errors: {
      networkError: 'Please check your network connection',
      serverError: 'Server error occurred',
      unknownError: 'An unknown error occurred',
      authError: 'Authentication failed',
    },
  },
};
