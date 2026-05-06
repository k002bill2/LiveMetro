// LiveMetro — Mock data (real Seoul stations & lines)
// Globals: window.LM_DATA

const LINES = {
  '1':  { id: '1',  name: '1호선',   color: '#0052A4', label: '1' },
  '2':  { id: '2',  name: '2호선',   color: '#00A84D', label: '2' },
  '3':  { id: '3',  name: '3호선',   color: '#EF7C1C', label: '3' },
  '4':  { id: '4',  name: '4호선',   color: '#00A5DE', label: '4' },
  '5':  { id: '5',  name: '5호선',   color: '#996CAC', label: '5' },
  '6':  { id: '6',  name: '6호선',   color: '#CD7C2F', label: '6' },
  '7':  { id: '7',  name: '7호선',   color: '#747F00', label: '7' },
  '8':  { id: '8',  name: '8호선',   color: '#E6186C', label: '8' },
  '9':  { id: '9',  name: '9호선',   color: '#BDB092', label: '9' },
  'sb': { id: 'sb', name: '신분당선', color: '#D4003B', label: '신분당' },
  'bd': { id: 'bd', name: '분당선',   color: '#FABE00', label: '분당' },
  'gj': { id: 'gj', name: '경의중앙', color: '#77C4A3', label: '경의' },
  'gx': { id: 'gx', name: '공항철도', color: '#0090D2', label: '공항' },
};

const STATIONS = [
  { id: 'gangnam',     name: '강남',     lines: ['2', 'sb'],     code: '222' },
  { id: 'hongik',      name: '홍대입구', lines: ['2', 'gj', 'gx'], code: '239' },
  { id: 'sinchon',     name: '신촌',     lines: ['2'],            code: '240' },
  { id: 'jamsil',      name: '잠실',     lines: ['2', '8'],       code: '216' },
  { id: 'seoul',       name: '서울역',   lines: ['1', '4', 'gx'], code: '133' },
  { id: 'sadang',      name: '사당',     lines: ['2', '4'],       code: '226' },
  { id: 'samsung',     name: '삼성',     lines: ['2'],            code: '219' },
  { id: 'yeoksam',     name: '역삼',     lines: ['2'],            code: '221' },
  { id: 'seonleung',   name: '선릉',     lines: ['2', 'bd'],      code: '220' },
  { id: 'wangsimni',   name: '왕십리',   lines: ['2', '5', 'bd', 'gj'], code: '210' },
  { id: 'sindorim',    name: '신도림',   lines: ['1', '2'],       code: '234' },
  { id: 'yeouido',     name: '여의도',   lines: ['5', '9'],       code: '527' },
];

// Realtime arrivals for "강남" station
const ARRIVALS_GANGNAM = [
  { line: '2', dest: '잠실 방면',     direction: 'down', minutes: 1, seconds: 47, status: 'approaching', cars: 10, congestion: [78, 65, 92, 88, 70, 55, 48, 60, 72, 80] },
  { line: '2', dest: '신도림 방면',   direction: 'up',   minutes: 3, seconds: 12, status: 'enroute',     cars: 10, congestion: [55, 48, 65, 70, 60, 52, 45, 50, 58, 62] },
  { line: '2', dest: '잠실 방면',     direction: 'down', minutes: 6, seconds: 30, status: 'enroute',     cars: 10, congestion: null },
  { line: 'sb', dest: '광교 방면',    direction: 'down', minutes: 4, seconds: 5,  status: 'enroute',     cars: 6,  congestion: [40, 38, 45, 50, 42, 36] },
  { line: 'sb', dest: '신사 방면',    direction: 'up',   minutes: 8, seconds: 50, status: 'scheduled',   cars: 6,  congestion: null },
];

const FAVORITES = [
  { stationId: 'gangnam',   nickname: '회사',   lines: ['2', 'sb'],     nextMin: 1, dest: '잠실', cong: 'high' },
  { stationId: 'hongik',    nickname: '집',     lines: ['2', 'gj'],     nextMin: 4, dest: '시청', cong: 'mid' },
  { stationId: 'jamsil',    nickname: null,     lines: ['2', '8'],      nextMin: 7, dest: '모란', cong: 'low' },
  { stationId: 'seoul',     nickname: 'KTX',    lines: ['1', '4'],      nextMin: 2, dest: '인천', cong: 'mid' },
  { stationId: 'wangsimni', nickname: '학원',   lines: ['2', '5'],      nextMin: 11, dest: '방화', cong: 'low' },
];

// ML prediction — 출퇴근 예측
const COMMUTE_PREDICTION = {
  origin: '홍대입구',
  destination: '강남',
  predicted_min: 28,
  range: [26, 32],
  confidence: 0.87,
  baseline_avg_min: 31,
  saved_min: 3,
  // Per-segment breakdown
  segments: [
    { type: 'walk',     label: '도보',       min: 4,  desc: '집 → 홍대입구역 9번출구' },
    { type: 'wait',     label: '대기',       min: 3,  desc: '2호선 잠실 방면', line: '2' },
    { type: 'ride',     label: '승차',       min: 18, desc: '홍대입구 → 강남 (8개역)', line: '2', stations: 8, congestion: 'high' },
    { type: 'walk',     label: '도보',       min: 3,  desc: '강남역 11번출구 → 회사' },
  ],
  // Day-of-week trend
  weekly: [
    { day: '월', min: 32, isToday: false },
    { day: '화', min: 30, isToday: false },
    { day: '수', min: 28, isToday: true },
    { day: '목', min: 31, isToday: false },
    { day: '금', min: 33, isToday: false },
  ],
  // Hourly congestion forecast
  hourly: [
    { time: '08:00', cong: 75, isNow: false },
    { time: '08:15', cong: 88, isNow: false },
    { time: '08:30', cong: 92, isNow: true },
    { time: '08:45', cong: 84, isNow: false },
    { time: '09:00', cong: 70, isNow: false },
    { time: '09:15', cong: 55, isNow: false },
    { time: '09:30', cong: 42, isNow: false },
  ],
  factors: [
    { icon: 'cloud-rain',  label: '비 예보',         impact: '+2분', tone: 'neg' },
    { icon: 'users',       label: '평균 혼잡도',      impact: '평소보다 8% ↑', tone: 'neg' },
    { icon: 'check',       label: '지연 없음',        impact: '정시 운행', tone: 'pos' },
    { icon: 'calendar',    label: '수요일 패턴',      impact: '평소 28분', tone: 'neutral' },
  ],
};

const DELAY_REPORTS = [
  { id: 1, line: '2',  station: '강남',     time: '12분 전', user: '김**', verified: true,  votes: 47, msg: '교대역 사이 신호장애로 5분 정차 중', tag: '신호장애' },
  { id: 2, line: '4',  station: '동대문',   time: '23분 전', user: '이**', verified: true,  votes: 23, msg: '서울역 방면 평소보다 혼잡, 무정차 통과 발생', tag: '혼잡' },
  { id: 3, line: '7',  station: '고속터미널', time: '38분 전', user: '박**', verified: false, votes: 8, msg: '내선순환 약 3분 지연 운행 중', tag: '지연' },
  { id: 4, line: '9',  station: '여의도',   time: '1시간 전', user: '최**', verified: true,  votes: 91, msg: '급행 5분 지연 후 정상 운행 재개', tag: '복구' },
];

// Alternative routes from 홍대입구 → 강남
const ROUTES = [
  {
    id: 'r1', label: '추천', tag: '최단',
    totalMin: 28, transfers: 0, fare: 1500, walkMin: 7,
    cong: 'high',
    legs: [
      { type: 'walk', min: 4, desc: '도보 → 9번출구' },
      { type: 'train', line: '2', from: '홍대입구', to: '강남', stations: 8, min: 18, dir: '잠실 방면' },
      { type: 'walk', min: 3, desc: '11번출구 → 도착' },
    ],
  },
  {
    id: 'r2', label: '환승최소', tag: '빠른길',
    totalMin: 31, transfers: 1, fare: 1500, walkMin: 9,
    cong: 'mid',
    legs: [
      { type: 'walk', min: 4 },
      { type: 'train', line: '2', from: '홍대입구', to: '교대', stations: 7, min: 16, dir: '잠실 방면' },
      { type: 'transfer', line: 'sb', station: '교대', min: 3 },
      { type: 'train', line: 'sb', from: '교대', to: '강남', stations: 1, min: 3, dir: '광교 방면' },
      { type: 'walk', min: 5 },
    ],
  },
  {
    id: 'r3', label: '편안함', tag: '저혼잡',
    totalMin: 36, transfers: 1, fare: 1550, walkMin: 11,
    cong: 'low',
    legs: [
      { type: 'walk', min: 6 },
      { type: 'train', line: 'gj', from: '홍대입구', to: '왕십리', stations: 5, min: 12, dir: '문산 방면' },
      { type: 'transfer', line: '2', station: '왕십리', min: 4 },
      { type: 'train', line: '2', from: '왕십리', to: '강남', stations: 9, min: 19, dir: '잠실 방면' },
      { type: 'walk', min: 4 },
    ],
  },
];

const ALERTS = [
  { id: 1, type: 'arriving', title: '곧 도착', body: '2호선 잠실행 1분 47초 후 강남역 도착', time: '방금', read: false, line: '2' },
  { id: 2, type: 'depart',   title: '출발 시간', body: '평소 출발시간이에요. 지금 나가면 9시 03분 도착', time: '8분 전', read: false, line: null },
  { id: 3, type: 'delay',    title: '지연 발생', body: '4호선 사당~서울역 구간 약 5분 지연', time: '22분 전', read: true, line: '4' },
  { id: 4, type: 'community',title: '제보 확인 요청', body: '7호선 고속터미널역 지연 제보가 있어요', time: '1시간 전', read: true, line: '7' },
  { id: 5, type: 'cert',     title: '지연 증명서 발급', body: '11/3 4호선 지연 증명서가 준비됐어요', time: '어제', read: true, line: '4' },
  { id: 6, type: 'weekly',   title: '주간 리포트', body: '이번 주 정시율 92%, 평균 28분', time: '월요일', read: true, line: null },
];

const STATS = {
  weeklyOnTime: 92,
  avgCommute: 28,
  totalRides: 47,
  delayMinTotal: 14,
  byDay: [
    { day: '월', delays: 1, onTime: 4 },
    { day: '화', delays: 0, onTime: 5 },
    { day: '수', delays: 2, onTime: 3 },
    { day: '목', delays: 1, onTime: 4 },
    { day: '금', delays: 0, onTime: 5 },
  ],
  byLine: [
    { line: '2', pct: 58, count: 27 },
    { line: 'sb', pct: 22, count: 10 },
    { line: '4', pct: 12, count: 6 },
    { line: '9', pct: 8, count: 4 },
  ],
  weeklyTrend: [88, 91, 89, 94, 92, 95, 92], // last 7 weeks
};

// ─────────────── LINE STATIONS (vertical timeline) ───────────────
const LINE_STATIONS = {
  '2': {
    name: '2호선',
    color: '#00A84D',
    total: 51,
    stations: [
      { ko: '시청',           en: 'City Hall',                  transfers: ['1'] },
      { ko: '을지로입구',     en: 'Euljiro 1(il)-ga',           transfers: [] },
      { ko: '을지로3가',      en: 'Euljiro 3(sam)-ga',          transfers: ['3'] },
      { ko: '을지로4가',      en: 'Euljiro 4(sa)-ga',           transfers: ['5'] },
      { ko: '동대문역사문화공원', en: 'Dongdaemun History Culture Park', transfers: ['4', '5'] },
      { ko: '신당',           en: 'Sindang',                    transfers: ['6'] },
      { ko: '상왕십리',       en: 'Sangwangsimni',              transfers: [] },
      { ko: '왕십리',         en: 'Wangsimni',                  transfers: ['5', 'gj', 'sb'] },
      { ko: '한양대',         en: 'Hanyang Univ.',              transfers: [] },
      { ko: '뚝섬',           en: 'Ttukseom',                   transfers: [] },
      { ko: '성수',           en: 'Seongsu',                    transfers: [] },
      { ko: '건대입구',       en: 'Konkuk Univ.',               transfers: ['7'] },
      { ko: '구의',           en: 'Guui',                       transfers: [] },
      { ko: '강변',           en: 'Gangbyeon',                  transfers: [] },
      { ko: '잠실나루',       en: 'Jamsillaru',                 transfers: [] },
      { ko: '잠실',           en: 'Jamsil',                     transfers: ['8'] },
      { ko: '잠실새내',       en: 'Jamsilsaenae',               transfers: [] },
      { ko: '종합운동장',     en: 'Sports Complex',             transfers: ['9'] },
      { ko: '삼성',           en: 'Samseong',                   transfers: [] },
      { ko: '선릉',           en: 'Seolleung',                  transfers: ['bd'] },
      { ko: '역삼',           en: 'Yeoksam',                    transfers: [] },
      { ko: '강남',           en: 'Gangnam',                    transfers: ['sb'] },
      { ko: '교대',           en: 'Seoul Edu. Univ.',           transfers: ['3'] },
      { ko: '서초',           en: 'Seocho',                     transfers: [] },
      { ko: '방배',           en: 'Bangbae',                    transfers: [] },
    ],
  },
};

// Nearby stations — GPS 기반 주변 역 (현재 위치: 홍대입구역 인근)
const NEARBY_STATIONS = [
  {
    stationId: 'hongik', name: '홍대입구', lines: ['2', 'gj', 'gx'],
    distance: 180, walkMin: 3, exit: '9번 출구',
    arrivals: [
      { line: '2', dest: '잠실 방면', min: 2, sec: 14, cong: 'mid' },
      { line: '2', dest: '시청 방면', min: 5, sec: 0, cong: 'low' },
    ],
  },
  {
    stationId: 'sinchon', name: '신촌', lines: ['2'],
    distance: 720, walkMin: 9, exit: '4번 출구',
    arrivals: [
      { line: '2', dest: '잠실 방면', min: 4, sec: 30, cong: 'high' },
    ],
  },
  {
    stationId: 'hapjeong', name: '합정', lines: ['2', '6'],
    distance: 880, walkMin: 11, exit: '8번 출구',
    arrivals: [
      { line: '2', dest: '시청 방면', min: 1, sec: 50, cong: 'mid' },
      { line: '6', dest: '봉화산 방면', min: 6, sec: 0, cong: 'low' },
    ],
  },
];

window.LM_DATA = {
  LINES, STATIONS, ARRIVALS_GANGNAM, FAVORITES, COMMUTE_PREDICTION,
  DELAY_REPORTS, ROUTES, ALERTS, STATS,
  LINE_STATIONS, NEARBY_STATIONS,
};
