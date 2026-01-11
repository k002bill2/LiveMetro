/**
 * Public Data Portal API Types
 * 공공데이터포털 API 응답 타입 정의
 */

// ============================================================================
// 공통 타입
// ============================================================================

/** 공공데이터포털 API 공통 응답 형식 */
export interface PublicDataResponse<T> {
  readonly currentCount: number;
  readonly data: readonly T[];
  readonly matchCount: number;
  readonly page: number;
  readonly perPage: number;
  readonly totalCount: number;
}

/** data.go.kr API 공통 응답 형식 */
export interface DataGoKrResponse<T> {
  readonly response: {
    readonly header: {
      readonly resultCode: string;
      readonly resultMsg: string;
    };
    readonly body: {
      readonly items: readonly T[];
      readonly numOfRows: number;
      readonly pageNo: number;
      readonly totalCount: number;
    };
  };
}

// ============================================================================
// 1. 지하철 혼잡도 정보
// ============================================================================

/** 혼잡도 원시 데이터 (API 응답) */
export interface CongestionRawData {
  readonly 호선: string;
  readonly 역명: string;
  readonly 상하구분: string;
  readonly 요일구분: string;
  readonly '5시30분': string;
  readonly '6시00분': string;
  readonly '6시30분': string;
  readonly '7시00분': string;
  readonly '7시30분': string;
  readonly '8시00분': string;
  readonly '8시30분': string;
  readonly '9시00분': string;
  readonly '9시30분': string;
  readonly '10시00분': string;
  readonly '10시30분': string;
  readonly '11시00분': string;
  readonly '11시30분': string;
  readonly '12시00분': string;
  readonly '12시30분': string;
  readonly '13시00분': string;
  readonly '13시30분': string;
  readonly '14시00분': string;
  readonly '14시30분': string;
  readonly '15시00분': string;
  readonly '15시30분': string;
  readonly '16시00분': string;
  readonly '16시30분': string;
  readonly '17시00분': string;
  readonly '17시30분': string;
  readonly '18시00분': string;
  readonly '18시30분': string;
  readonly '19시00분': string;
  readonly '19시30분': string;
  readonly '20시00분': string;
  readonly '20시30분': string;
  readonly '21시00분': string;
  readonly '21시30분': string;
  readonly '22시00분': string;
  readonly '22시30분': string;
  readonly '23시00분': string;
  readonly '23시30분': string;
  readonly '24시00분': string;
}

/** 혼잡도 정보 (앱 사용) */
export interface CongestionInfo {
  readonly lineNum: string;
  readonly stationName: string;
  readonly direction: 'up' | 'down';
  readonly dayType: 'weekday' | 'saturday' | 'holiday';
  readonly timeSlots: ReadonlyMap<string, number>;
}

/** 혼잡도 레벨 */
export type CongestionLevel = 'low' | 'moderate' | 'high' | 'crowded';

/** 현재 시간대 혼잡도 */
export interface CurrentCongestion {
  readonly stationName: string;
  readonly lineNum: string;
  readonly direction: 'up' | 'down';
  readonly level: CongestionLevel;
  readonly percentage: number;
  readonly updatedAt: Date;
}

// ============================================================================
// 2. 교통약자 이용 정보
// ============================================================================

/** 교통약자 시설 원시 데이터 (API 응답) */
export interface AccessibilityRawData {
  readonly stinCd: string;        // 역 코드
  readonly stinNm: string;        // 역명
  readonly routNm: string;        // 노선명
  readonly elvtrSttus: string;    // 엘리베이터 상태
  readonly esltrSttus: string;    // 에스컬레이터 상태
  readonly wlchUseYn: string;     // 휠체어리프트 여부
  readonly tctlPvmtYn: string;    // 점자블록 여부
  readonly bndFreeYn: string;     // 장애인화장실 여부
}

/** 교통약자 편의시설 정보 (앱 사용) */
export interface AccessibilityInfo {
  readonly stationCode: string;
  readonly stationName: string;
  readonly lineName: string;
  readonly elevator: {
    readonly available: boolean;
    readonly count: number;
    readonly status: 'normal' | 'maintenance' | 'broken';
  };
  readonly escalator: {
    readonly available: boolean;
    readonly count: number;
    readonly status: 'normal' | 'maintenance' | 'broken';
  };
  readonly wheelchairLift: boolean;
  readonly tactilePaving: boolean;
  readonly accessibleRestroom: boolean;
}

/** 편의시설 타입 */
export type FacilityType = 'elevator' | 'escalator' | 'wheelchairLift' | 'tactilePaving' | 'accessibleRestroom';

// ============================================================================
// 3. 지하철 알림 정보
// ============================================================================

/** 알림 원시 데이터 (API 응답) */
export interface AlertRawData {
  readonly ntceId: string;        // 알림 ID
  readonly ntceTtl: string;       // 제목
  readonly ntceCn: string;        // 내용
  readonly routNm: string;        // 노선명
  readonly ntceSdt: string;       // 시작일시
  readonly ntceEdt: string;       // 종료일시
  readonly ntceTp: string;        // 알림 타입
}

/** 지하철 알림 정보 (앱 사용) */
export interface SubwayAlert {
  readonly alertId: string;
  readonly title: string;
  readonly content: string;
  readonly lineName: string;
  readonly alertType: AlertType;
  readonly startTime: Date;
  readonly endTime: Date | null;
  readonly isActive: boolean;
  readonly affectedStations: readonly string[];
}

/** 알림 타입 */
export type AlertType = 'delay' | 'accident' | 'maintenance' | 'crowded' | 'weather' | 'other';

/** 알림 심각도 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

// ============================================================================
// 4. 출구별 주요 장소
// ============================================================================

/** 출구 장소 원시 데이터 (API 응답) */
export interface ExitLandmarkRawData {
  readonly 역번호: string;
  readonly 역명: string;
  readonly 호선: string;
  readonly 출구번호: string;
  readonly 주요장소: string;
  readonly 장소분류: string;
}

/** 출구별 주요 장소 정보 (앱 사용) */
export interface ExitLandmark {
  readonly stationCode: string;
  readonly stationName: string;
  readonly lineNum: string;
  readonly exitNumber: string;
  readonly landmarkName: string;
  readonly category: LandmarkCategory;
}

/** 출구 정보 (그룹화) */
export interface ExitInfo {
  readonly exitNumber: string;
  readonly landmarks: readonly ExitLandmark[];
}

/** 장소 분류 */
export type LandmarkCategory =
  | 'hospital'
  | 'school'
  | 'government'
  | 'shopping'
  | 'culture'
  | 'transport'
  | 'food'
  | 'accommodation'
  | 'park'
  | 'other';

// ============================================================================
// 5. 열차시간표 정보
// ============================================================================

/** 열차시간표 원시 데이터 (API 응답) */
export interface TrainScheduleRawData {
  readonly stnCd?: string;         // 역코드
  readonly stnNm?: string;         // 역명
  readonly lineNm?: string;        // 호선명
  readonly trainno?: string;       // 열차번호
  readonly trainArvlTm?: string;   // 도착시간 (HH:MM:SS)
  readonly trainDptreTm?: string;  // 출발시간 (HH:MM:SS)
  readonly arvlStnNm?: string;     // 도착역명 (종착역)
  readonly arvlStnCd?: string;     // 도착역코드
  readonly wkndSe?: string;        // 요일구분 (평일/토요일/공휴일)
  readonly upbdnbSe?: string;      // 상하행 (상행/하행/내선/외선)
  readonly exprsTmtblYn?: string;  // 급행여부 (Y/N)
}

/** 열차시간표 정보 (앱 사용) */
export interface TrainSchedule {
  readonly stationCode: string;         // 역코드 (FR_CODE)
  readonly stationName: string;         // 역명
  readonly lineNumber: string;          // 호선
  readonly trainNumber: string;         // 열차번호
  readonly arrivalTime: string;         // 도착시간 (HH:MM:SS)
  readonly departureTime: string;       // 출발시간 (HH:MM:SS)
  readonly destinationCode: string;     // 종착역코드
  readonly destinationName: string;     // 종착역명
  readonly dayType: 'weekday' | 'saturday' | 'holiday'; // 요일구분
  readonly direction: 'up' | 'down';    // 상하행
}

/** 요일 타입 코드 */
export type DayTypeCode = '1' | '2' | '3';

/** 방향 타입 코드 */
export type DirectionCode = '1' | '2';

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 혼잡도 퍼센트를 레벨로 변환
 */
export function getCongestionLevel(percentage: number): CongestionLevel {
  if (percentage < 30) return 'low';
  if (percentage < 60) return 'moderate';
  if (percentage < 80) return 'high';
  return 'crowded';
}

/**
 * 알림 타입 문자열 변환
 */
export function parseAlertType(typeStr: string): AlertType {
  const typeMap: Record<string, AlertType> = {
    '지연': 'delay',
    '사고': 'accident',
    '공사': 'maintenance',
    '혼잡': 'crowded',
    '기상': 'weather',
  };
  return typeMap[typeStr] || 'other';
}

/**
 * 장소 분류 문자열 변환
 */
export function parseLandmarkCategory(categoryStr: string): LandmarkCategory {
  const categoryMap: Record<string, LandmarkCategory> = {
    '의료': 'hospital',
    '병원': 'hospital',
    '학교': 'school',
    '교육': 'school',
    '관공서': 'government',
    '공공기관': 'government',
    '쇼핑': 'shopping',
    '백화점': 'shopping',
    '마트': 'shopping',
    '문화': 'culture',
    '공연': 'culture',
    '교통': 'transport',
    '음식': 'food',
    '식당': 'food',
    '숙박': 'accommodation',
    '호텔': 'accommodation',
    '공원': 'park',
  };

  for (const [key, value] of Object.entries(categoryMap)) {
    if (categoryStr.includes(key)) {
      return value;
    }
  }
  return 'other';
}
