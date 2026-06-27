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
  navigation: {
    home: string;
    favorites: string;
    routes: string;
    reports: string;
    me: string;
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
    feedback: string;
    feedbackDesc: string;
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
    greeting: (name: string) => string;
    greetingAnonymous: string;
    loadingNearby: string;
    morningRouteTitle: string;
    eveningRouteTitle: string;
    nearbyStations: string;
    nearbyStationsEstimated: string;
    nearbySubtitle: string;
    nearbySuffix: string;
    lowAccuracyNote: string;
    favoriteStations: string;
    realtimeArrivals: string;
    viewAll: string;
    liveReports: string;
    nearbyLines: string;
    noData: string;
    tryAnotherLocation: string;
    addFrequentStations: string;
    allowLocation: string;
    noNearbyReports: string;
    quickActions: {
      routeSearch: string;
      subwayMap: string;
      myLocation: string;
      report: string;
      certificate: string;
    };
    recentStations: string;
    searchPlaceholder: string;
    noStationsFound: string;
  };
  routes: {
    title: string;
    emptyTitle: string;
    emptyBody: string;
    loading: string;
    retry: string;
    noRoutes: string;
    currentRoute: string;
    suggestedRoutes: string;
    startGuidance: string;
    startGuidanceA11y: string;
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
    /** Empty-state description shown under "noAlerts" */
    emptyDescription: string;
    /** "새 알림 N개" / "N new" — pluralization differs per locale */
    unreadCountText: (count: number) => string;
    /** Header-right text-link to mark all notifications as read */
    markAllRead: string;
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
    navigation: {
      home: '홈',
      favorites: '즐겨찾기',
      routes: '경로',
      reports: '제보',
      me: '나',
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
      feedback: '의견 보내기',
      feedbackDesc: '버그·기능 제안·정보 오류 신고',
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
      greeting: (name: string) => `안녕하세요, ${name}님`,
      greetingAnonymous: '안녕하세요',
      loadingNearby: '주변 역 정보를 가져오고 있습니다...',
      morningRouteTitle: '오늘의 출근 경로',
      eveningRouteTitle: '오늘의 퇴근 경로',
      nearbyStations: '주변 역',
      nearbyStationsEstimated: '주변 역 (추정)',
      nearbySubtitle: 'GPS 기반 · 도보 거리순',
      nearbySuffix: '인근',
      lowAccuracyNote: '위치 정확도가 낮아 추정 결과예요',
      favoriteStations: '즐겨찾는 역',
      realtimeArrivals: '실시간 도착',
      viewAll: '전체 보기 ›',
      liveReports: '실시간 제보',
      nearbyLines: '근처 노선',
      noData: '데이터가 없습니다.',
      tryAnotherLocation: '다른 위치에서 시도해보세요',
      addFrequentStations: '자주 이용하는 역을 즐겨찾기에 추가해보세요',
      allowLocation: '위치 권한 허용하기',
      noNearbyReports: '근처 노선에 제보된 지연이 없습니다',
      quickActions: {
        routeSearch: '경로검색',
        subwayMap: '노선도',
        myLocation: '내 위치',
        report: '제보',
        certificate: '증명서',
      },
      recentStations: '최근 본 역',
      searchPlaceholder: '역 이름 검색',
      noStationsFound: '검색 결과가 없습니다',
    },
    routes: {
      title: '경로 검색',
      emptyTitle: '경로를 검색해 보세요',
      emptyBody: '출발역과 도착역을 선택하면 가장 빠른 경로를 비교해드려요.',
      loading: '경로를 계산 중...',
      retry: '다시 시도',
      noRoutes: '이 시간대에 가능한 경로가 없습니다',
      currentRoute: '현재 이동 경로',
      suggestedRoutes: '제안 노선',
      startGuidance: '이 경로로 길안내 시작',
      startGuidanceA11y: '선택한 경로로 길안내 시작',
    },
    favorites: {
      title: '즐겨찾기',
      empty: '즐겨찾기한 역이 없습니다',
      addFavorite: '즐겨찾기 추가',
    },
    alerts: {
      title: '알림',
      noAlerts: '알림 없음',
      emptyDescription: '새로운 알림이 도착하면 여기에 표시됩니다',
      unreadCountText: (count: number) => `새 알림 ${count}개`,
      markAllRead: '모두 읽음',
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
    navigation: {
      home: 'Home',
      favorites: 'Favorites',
      routes: 'Routes',
      reports: 'Reports',
      me: 'Me',
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
      feedback: 'Send Feedback',
      feedbackDesc: 'Report bugs, request features, or flag info errors',
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
      greeting: (name: string) => `Hello, ${name}`,
      greetingAnonymous: 'Hello',
      loadingNearby: 'Loading nearby stations...',
      morningRouteTitle: "Today's Morning Route",
      eveningRouteTitle: "Today's Evening Route",
      nearbyStations: 'Nearby Stations',
      nearbyStationsEstimated: 'Nearby Stations (Estimated)',
      nearbySubtitle: 'GPS based · walking distance',
      nearbySuffix: 'nearby',
      lowAccuracyNote: 'Location accuracy is low, so these results are estimated.',
      favoriteStations: 'Favorite Stations',
      realtimeArrivals: 'Live arrivals',
      viewAll: 'View all ›',
      liveReports: 'Live Reports',
      nearbyLines: 'Nearby lines',
      noData: 'No data available.',
      tryAnotherLocation: 'Try again from another location',
      addFrequentStations: 'Add frequently used stations to favorites',
      allowLocation: 'Allow location access',
      noNearbyReports: 'No delay reports on nearby lines',
      quickActions: {
        routeSearch: 'Routes',
        subwayMap: 'Map',
        myLocation: 'My Location',
        report: 'Report',
        certificate: 'Certificate',
      },
      recentStations: 'Recent Stations',
      searchPlaceholder: 'Search station',
      noStationsFound: 'No stations found',
    },
    routes: {
      title: 'Route Search',
      emptyTitle: 'Search for a route',
      emptyBody: 'Choose a departure and destination station to compare the fastest routes.',
      loading: 'Calculating route...',
      retry: 'Retry',
      noRoutes: 'No routes are available at this time',
      currentRoute: 'Current Route',
      suggestedRoutes: 'Suggested Routes',
      startGuidance: 'Start Guidance',
      startGuidanceA11y: 'Start guidance with the selected route',
    },
    favorites: {
      title: 'Favorites',
      empty: 'No favorite stations',
      addFavorite: 'Add Favorite',
    },
    alerts: {
      title: 'Alerts',
      noAlerts: 'No alerts',
      emptyDescription: 'New notifications will appear here',
      unreadCountText: (count: number) => `${count} new`,
      markAllRead: 'Mark all read',
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
