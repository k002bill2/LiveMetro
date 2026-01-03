/**
 * Test data and fixtures for E2E testing
 * Contains mock data for consistent test scenarios
 */

/**
 * Test user credentials
 */
export const testUsers = {
  validUser: {
    email: 'test@livemetro.app',
    password: 'TestPassword123!',
    displayName: 'Test User',
  },
  invalidUser: {
    email: 'invalid@test.com',
    password: 'wrongpassword',
  },
  newUser: {
    email: `test-${Date.now()}@livemetro.app`,
    password: 'NewPassword123!',
    displayName: 'New Test User',
  },
};

/**
 * Korean UI text constants (for element finding)
 */
export const koreanText = {
  // Authentication
  getStarted: '시작하기',
  tryAnonymous: '체험해보기',
  login: '로그인',
  signUp: '계정 만들기',
  forgotPassword: '비밀번호를 잊으셨나요?',
  anonymousLogin: '익명으로 계속하기',
  noAccount: '계정이 없으신가요? 가입하기',
  hasAccount: '이미 계정이 있으신가요? 로그인',

  // Navigation tabs
  home: '홈',
  favorites: '즐겨찾기',
  alerts: '알림',
  settings: '설정',

  // Home screen
  nearbyStations: '주변 역',
  realtimeInfo: '실시간 지하철 정보를 확인하세요',
  viewDetails: '상세보기',
  refresh: '새로고침',

  // Favorites screen
  noFavorites: '즐겨찾기가 없습니다',
  findStations: '역 찾아보기',
  search: '검색',
  edit: '편집',
  delete: '삭제',
  save: '저장',

  // Alerts screen
  noAlerts: '알림이 없습니다',
  markAllRead: '모두 읽음',
  clearAll: '모두 삭제',

  // Station detail
  departure: '출발',
  arrival: '도착',
  timetable: '시간표',
  addToFavorites: '즐겨찾기 추가',

  // Settings
  signOut: '로그아웃',
  notifications: '알림',
  theme: '테마',
  language: '언어',
  help: '도움말',
  privacyPolicy: '개인정보처리방침',

  // Common
  cancel: '취소',
  confirm: '확인',
  ok: '확인',
  yes: '예',
  no: '아니오',
  back: '뒤로',
  close: '닫기',
  loading: '로딩 중...',
  error: '오류',
  retry: '다시 시도',
};

/**
 * Mock station data
 */
export const mockStations = {
  gangnam: {
    id: 'gangnam',
    name: '강남',
    nameEn: 'Gangnam',
    lineId: '2',
    lineName: '2호선',
    lineColor: '#00A651',
  },
  hongdae: {
    id: 'hongdae',
    name: '홍대입구',
    nameEn: 'Hongik Univ.',
    lineId: '2',
    lineName: '2호선',
    lineColor: '#00A651',
  },
  jamsil: {
    id: 'jamsil',
    name: '잠실',
    nameEn: 'Jamsil',
    lineId: '2',
    lineName: '2호선',
    lineColor: '#00A651',
  },
  seoul: {
    id: 'seoul',
    name: '서울역',
    nameEn: 'Seoul Station',
    lineId: '1',
    lineName: '1호선',
    lineColor: '#263C96',
  },
  myeongdong: {
    id: 'myeongdong',
    name: '명동',
    nameEn: 'Myeong-dong',
    lineId: '4',
    lineName: '4호선',
    lineColor: '#00A2E8',
  },
};

/**
 * Mock train arrival data
 */
export const mockArrivals = {
  arriving: {
    message: '곧 도착',
    minutes: 0,
    destination: '신도림',
    direction: '상행',
  },
  twoMinutes: {
    message: '2분 후 도착',
    minutes: 2,
    destination: '잠실',
    direction: '하행',
  },
  fiveMinutes: {
    message: '5분 후 도착',
    minutes: 5,
    destination: '강남',
    direction: '상행',
  },
};

/**
 * Test IDs used in the app
 */
export const testIds = {
  // Welcome screen
  welcomeLogo: 'welcome-logo',
  getStartedButton: 'get-started-button',
  tryAnonymousButton: 'try-anonymous-button',

  // Auth screen
  emailInput: 'email-input',
  passwordInput: 'password-input',
  displayNameInput: 'displayname-input',
  submitButton: 'submit-button',
  anonymousLoginButton: 'anonymous-login-button',

  // Home screen
  appContainer: 'app-container',
  refreshButton: 'refresh-button',
  stationList: 'station-list',
  stationCard: 'station-card',
  trainArrivalCard: 'train-arrival-card',

  // Navigation
  homeTab: 'home-tab',
  favoritesTab: 'favorites-tab',
  alertsTab: 'alerts-tab',
  settingsTab: 'settings-tab',

  // Favorites screen
  favoritesHeader: 'favorites-header',
  searchInput: 'search-input',
  favoriteItem: 'favorite-item',
  emptyState: 'empty-state',

  // Station detail
  stationName: 'station-name',
  lineIndicator: 'line-indicator',
  prevStationButton: 'prev-station-button',
  nextStationButton: 'next-station-button',
  arrivalList: 'arrival-list',
  departureTab: 'departure-tab',
  arrivalTab: 'arrival-tab',
  timetableTab: 'timetable-tab',
  favoriteTab: 'favorite-tab',

  // Settings
  settingsHeader: 'settings-header',
  signOutButton: 'sign-out-button',
  notificationSettings: 'notification-settings',
  themeSettings: 'theme-settings',
  languageSettings: 'language-settings',

  // Common
  loadingIndicator: 'loading-indicator',
  errorMessage: 'error-message',
  toastMessage: 'toast-message',
};

/**
 * Generate unique test email
 */
export function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}@livemetro.app`;
}

/**
 * Generate unique test name
 */
export function generateTestName(): string {
  return `TestUser_${Math.random().toString(36).substr(2, 6)}`;
}
