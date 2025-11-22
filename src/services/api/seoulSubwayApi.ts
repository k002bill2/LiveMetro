/**
 * Seoul Subway API Integration Service
 * Real-time subway data from Seoul Open API
 */

interface SeoulApiResponse<T> {
  errorMessage?: {
    status: number;
    code: string;
    message: string;
    link?: string;
    developerMessage?: string;
    total?: number;
  };
  realtimeArrivalList?: T[];
  SearchInfoBySubwayNameService?: {
    list_total_count: number;
    RESULT: {
      CODE: string;
      MESSAGE: string;
    };
    row?: T[];
  };
}

interface SeoulRealtimeArrival {
  rowNum: string;
  selectedCount: string;
  totalCount: string;
  subwayId: string;
  updnLine: string;
  trainLineNm: string;
  subwayHeading: string;
  statnFid: string;
  statnTid: string;
  statnId: string;
  statnNm: string;
  trainCo: string;
  ordkey: string;
  subwayList: string;
  statnList: string;
  btrainSttus: string;
  barvlDt: string;
  btrainNo: string;
  bstatnId: string;
  bstatnNm: string;
  recptnDt: string;
  arvlMsg2: string;
  arvlMsg3: string;
  arvlCd: string;
}

interface SeoulStationInfo {
  STATION_CD: string;
  STATION_NM: string;
  LINE_NUM: string;
  FR_CODE: string;
  XPOS: string;
  YPOS: string;
}

interface SeoulTimetableRow {
  STATION_CD: string;
  STATION_NM: string;
  TRAIN_NO: string;
  ARRIVETIME: string;
  LEFTTIME: string;
  ORIGIN_STATION_NM: string;
  DEST_STATION_NM: string;
  SUBWAYSNAME: string;
  WEEK_TAG: string;
  INOUT_TAG: string;
  FLAG: string;
  STATION_NM_ENG?: string;
  TYPE?: string; // 급행 여부 등
}

interface SeoulTimetableResponse {
  SearchSTNTimeTableByIDService?: {
    list_total_count: number;
    RESULT: {
      CODE: string;
      MESSAGE: string;
    };
    row: SeoulTimetableRow[];
  };
}

class SeoulSubwayApiService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number = 10000;

  constructor() {
    this.baseUrl = process.env.SEOUL_SUBWAY_API_BASE_URL || 'http://swopenapi.seoul.go.kr/api/subway';
    this.apiKey = process.env.SEOUL_SUBWAY_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('Seoul Subway API key not found. Please set SEOUL_SUBWAY_API_KEY environment variable.');
    }
  }

  /**
   * Get real-time arrival information for a station
   */
  async getRealtimeArrival(stationName: string): Promise<SeoulRealtimeArrival[]> {
    try {
      const url = `${this.baseUrl}/${this.apiKey}/json/realtimeStationArrival/0/10/${encodeURIComponent(stationName)}`;
      
      const response = await this.fetchWithTimeout(url);
      const data: SeoulApiResponse<SeoulRealtimeArrival> = await response.json();

      // Check for API errors
      if (data.errorMessage) {
        throw new Error(`Seoul API Error: ${data.errorMessage.message} (Code: ${data.errorMessage.code})`);
      }

      return data.realtimeArrivalList || [];
    } catch (error) {
      console.error('Error fetching realtime arrival:', error);
      throw new Error(`실시간 도착정보를 가져오는데 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * Get station information by subway line
   */
  async getStationsByLine(lineNumber: string): Promise<SeoulStationInfo[]> {
    try {
      const url = `${this.baseUrl}/${this.apiKey}/json/SearchInfoBySubwayNameService/1/1000/${encodeURIComponent(lineNumber)}호선`;
      
      const response = await this.fetchWithTimeout(url);
      const data: SeoulApiResponse<SeoulStationInfo> = await response.json();

      // Check for API errors
      if (data.errorMessage) {
        throw new Error(`Seoul API Error: ${data.errorMessage.message} (Code: ${data.errorMessage.code})`);
      }

      if (data.SearchInfoBySubwayNameService?.RESULT.CODE !== 'INFO-000') {
        throw new Error(`API Error: ${data.SearchInfoBySubwayNameService?.RESULT.MESSAGE}`);
      }

      return data.SearchInfoBySubwayNameService?.row || [];
    } catch (error) {
      console.error('Error fetching stations by line:', error);
      throw new Error(`역 정보를 가져오는데 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * Get all Seoul subway stations with coordinates
   */
  async getAllStations(): Promise<SeoulStationInfo[]> {
    const allStations: SeoulStationInfo[] = [];
    const lines = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    try {
      const stationPromises = lines.map(line => this.getStationsByLine(line));
      const results = await Promise.allSettled(stationPromises);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allStations.push(...result.value);
        } else {
          console.warn(`Failed to fetch stations for line ${lines[index]}:`, result.reason);
        }
      });

      // Remove duplicates (transfer stations appear in multiple lines)
      const uniqueStations = allStations.filter((station, index, self) => 
        index === self.findIndex(s => s.STATION_NM === station.STATION_NM)
      );

      return uniqueStations;
    } catch (error) {
      console.error('Error fetching all stations:', error);
      throw new Error(`전체 역 정보를 가져오는데 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * Check service status and API connectivity
   */
  async checkServiceStatus(): Promise<boolean> {
    try {
      // Test with a common station like '강남역'
      await this.getRealtimeArrival('강남');
      return true;
    } catch (error) {
      console.error('Seoul Subway API service check failed:', error);
      return false;
    }
  }

  /**
   * Get station timetable (schedule)
   * @param stationCode Station code (e.g., '0222' for Gangnam)
   * @param weekTag '1': Weekday, '2': Saturday, '3': Holiday/Sunday
   * @param inoutTag '1': Up/Inner, '2': Down/Outer
   */
  async getStationTimetable(
    stationCode: string, 
    weekTag: '1' | '2' | '3' = '1', 
    inoutTag: '1' | '2' = '1'
  ): Promise<SeoulTimetableRow[]> {
    try {
      // Note: Timetable API uses a different base URL usually (openAPI.seoul.go.kr)
      // But we'll try to use the configured base URL or fallback to the standard openAPI URL
      const generalBaseUrl = process.env.SEOUL_OPEN_API_BASE_URL || 'http://openAPI.seoul.go.kr:8088';
      const url = `${generalBaseUrl}/${this.apiKey}/json/SearchSTNTimeTableByIDService/1/500/${stationCode}/${weekTag}/${inoutTag}/`;
      
      const response = await this.fetchWithTimeout(url);
      const data: SeoulTimetableResponse = await response.json();

      if (data.SearchSTNTimeTableByIDService?.RESULT.CODE !== 'INFO-000') {
        // INFO-200 means no data found, which is valid for empty schedules
        if (data.SearchSTNTimeTableByIDService?.RESULT.CODE === 'INFO-200') {
          return [];
        }
        throw new Error(`API Error: ${data.SearchSTNTimeTableByIDService?.RESULT.MESSAGE}`);
      }

      return data.SearchSTNTimeTableByIDService?.row || [];
    } catch (error) {
      console.error('Error fetching station timetable:', error);
      throw new Error(`시간표 정보를 가져오는데 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LiveMetro/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('API 요청 시간이 초과되었습니다.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convert Seoul API arrival data to app Train model
   */
  convertToAppTrain(seoulData: SeoulRealtimeArrival): {
    lineId: string;
    stationId: string;
    stationName: string;
    direction: string;
    arrivalMessage: string;
    arrivalTime: number | null;
    trainNumber: string;
    destinationStation: string;
    lastUpdated: Date;
  } {
    // Parse arrival time from message
    let arrivalTime: number | null = null;
    const arrivalMsg = seoulData.arvlMsg2 || seoulData.arvlMsg3 || '';
    
    // Extract minutes from messages like "2분후[1번째전]", "곧 도착[0번째전]"
    const minuteMatch = arrivalMsg.match(/(\d+)분후/);
    if (minuteMatch && minuteMatch[1]) {
      arrivalTime = parseInt(minuteMatch[1], 10) * 60; // Convert to seconds
    } else if (arrivalMsg.includes('곧 도착') || arrivalMsg.includes('진입')) {
      arrivalTime = 30; // 30 seconds for "arriving soon"
    }

    return {
      lineId: seoulData.subwayId || seoulData.trainLineNm,
      stationId: seoulData.statnId,
      stationName: seoulData.statnNm,
      direction: seoulData.updnLine === '상행' ? 'up' : 'down',
      arrivalMessage: arrivalMsg,
      arrivalTime,
      trainNumber: seoulData.btrainNo || '',
      destinationStation: seoulData.bstatnNm || seoulData.subwayHeading || '',
      lastUpdated: new Date()
    };
  }
}

// Export singleton instance
export const seoulSubwayApi = new SeoulSubwayApiService();
export type { SeoulRealtimeArrival, SeoulStationInfo, SeoulTimetableRow, SeoulTimetableResponse };