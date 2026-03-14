/**
 * API Key Manager - Hybrid Strategy
 * Round-Robin + Failover + Usage Tracking
 *
 * 여러 API 키를 효율적으로 관리하여 rate limit 및 장애 상황에 대응
 */

interface ApiKeyState {
  key: string;
  usageCount: number;
  errorCount: number;
  lastUsed: number;
  lastError: number | null;
  isDisabled: boolean;
  disabledUntil: number | null;
}

interface ApiKeyManagerOptions {
  /** 에러 발생 시 키를 비활성화할 시간 (ms) */
  disableDurationMs?: number;
  /** 연속 에러 횟수 임계값 (이 횟수 초과 시 키 비활성화) */
  errorThreshold?: number;
  /** 사용량 카운터 리셋 주기 (ms) */
  usageResetIntervalMs?: number;
}

const DEFAULT_OPTIONS: Required<ApiKeyManagerOptions> = {
  disableDurationMs: 60000, // 1분
  errorThreshold: 3,
  usageResetIntervalMs: 3600000, // 1시간
};

/**
 * 다중 API 키를 관리하는 매니저 클래스
 *
 * 전략:
 * 1. Round-Robin: 요청마다 다른 키를 순환 사용
 * 2. Failover: 에러 발생 시 다른 키로 자동 전환
 * 3. Usage Tracking: 키별 사용량 추적 및 균형 조정
 */
export class ApiKeyManager {
  private keys: Map<string, ApiKeyState> = new Map();
  private keyOrder: string[] = [];
  private currentIndex = 0;
  private options: Required<ApiKeyManagerOptions>;
  private usageResetTimer: ReturnType<typeof setInterval> | null = null;

  constructor(apiKeys: string[], options: ApiKeyManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // 유효한 키만 등록
    const validKeys = apiKeys.filter((key) => key && key.trim() !== '');

    if (validKeys.length === 0) {
      console.warn('ApiKeyManager: No valid API keys provided');
    }

    validKeys.forEach((key) => {
      this.keys.set(key, {
        key,
        usageCount: 0,
        errorCount: 0,
        lastUsed: 0,
        lastError: null,
        isDisabled: false,
        disabledUntil: null,
      });
      this.keyOrder.push(key);
    });

    // 주기적으로 사용량 카운터 리셋
    this.startUsageResetTimer();
  }

  /**
   * 다음 사용 가능한 API 키 반환 (Round-Robin)
   * 모든 키가 비활성화된 경우 가장 먼저 복구될 키 반환
   */
  getNextKey(): string | null {
    this.checkAndReenableKeys();

    const availableKeys = this.getAvailableKeys();

    if (availableKeys.length === 0) {
      // 모든 키가 비활성화된 경우, 가장 먼저 복구될 키 반환
      return this.getNextRecoveringKey();
    }

    // Round-Robin으로 키 선택
    const key = this.selectKeyRoundRobin(availableKeys);

    if (key) {
      const state = this.keys.get(key);
      if (state) {
        state.usageCount++;
        state.lastUsed = Date.now();
      }
    }

    return key;
  }

  /**
   * API 호출 성공 시 호출
   */
  reportSuccess(key: string): void {
    const state = this.keys.get(key);
    if (state) {
      state.errorCount = 0; // 성공 시 에러 카운트 리셋
    }
  }

  /**
   * API 호출 실패 시 호출
   * @returns 대체 키가 있으면 반환, 없으면 null
   */
  reportError(key: string): string | null {
    const state = this.keys.get(key);
    if (state) {
      state.errorCount++;
      state.lastError = Date.now();

      // 임계값 초과 시 키 비활성화
      if (state.errorCount >= this.options.errorThreshold) {
        this.disableKey(key);
      }
    }

    // Failover: 다른 사용 가능한 키 반환
    return this.getNextKey();
  }

  /**
   * Rate limit 에러 발생 시 호출 (즉시 키 비활성화)
   */
  reportRateLimit(key: string): string | null {
    this.disableKey(key);
    return this.getNextKey();
  }

  /**
   * 현재 키 상태 조회
   */
  getKeyStats(): {
    key: string;
    usageCount: number;
    errorCount: number;
    isDisabled: boolean;
    disabledUntil: number | null;
  }[] {
    return Array.from(this.keys.values()).map((state) => ({
      key: this.maskKey(state.key),
      usageCount: state.usageCount,
      errorCount: state.errorCount,
      isDisabled: state.isDisabled,
      disabledUntil: state.disabledUntil,
    }));
  }

  /**
   * 등록된 키 개수
   */
  get keyCount(): number {
    return this.keys.size;
  }

  /**
   * 사용 가능한 키 개수
   */
  get availableKeyCount(): number {
    return this.getAvailableKeys().length;
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    if (this.usageResetTimer) {
      clearInterval(this.usageResetTimer);
      this.usageResetTimer = null;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getAvailableKeys(): string[] {
    return this.keyOrder.filter((key) => {
      const state = this.keys.get(key);
      return state && !state.isDisabled;
    });
  }

  private selectKeyRoundRobin(availableKeys: string[]): string | null {
    if (availableKeys.length === 0) return null;

    // 현재 인덱스가 범위를 벗어나면 리셋
    if (this.currentIndex >= availableKeys.length) {
      this.currentIndex = 0;
    }

    const key = availableKeys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % availableKeys.length;

    return key ?? null;
  }

  private disableKey(key: string): void {
    const state = this.keys.get(key);
    if (state) {
      state.isDisabled = true;
      state.disabledUntil = Date.now() + this.options.disableDurationMs;
      console.warn(
        `ApiKeyManager: Key ${this.maskKey(key)} disabled until ${new Date(state.disabledUntil).toISOString()}`
      );
    }
  }

  private checkAndReenableKeys(): void {
    const now = Date.now();

    this.keys.forEach((state) => {
      if (state.isDisabled && state.disabledUntil && now >= state.disabledUntil) {
        state.isDisabled = false;
        state.disabledUntil = null;
        state.errorCount = 0;
        console.info(`ApiKeyManager: Key ${this.maskKey(state.key)} re-enabled`);
      }
    });
  }

  private getNextRecoveringKey(): string | null {
    let earliestKey: string | null = null;
    let earliestTime = Infinity;

    this.keys.forEach((state) => {
      if (state.disabledUntil && state.disabledUntil < earliestTime) {
        earliestTime = state.disabledUntil;
        earliestKey = state.key;
      }
    });

    return earliestKey ?? (this.keyOrder[0] ?? null);
  }

  private startUsageResetTimer(): void {
    this.usageResetTimer = setInterval(() => {
      this.keys.forEach((state) => {
        state.usageCount = 0;
      });
    }, this.options.usageResetIntervalMs);
  }

  private maskKey(key: string): string {
    if (key.length <= 8) return '****';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * 환경 변수에서 API 키를 로드하여 ApiKeyManager 생성
 *
 * 환경 변수:
 * - EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY: 메인 키
 * - EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY_2: 백업 키
 * - EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY_3: 추가 키 (선택)
 */
export function createSeoulApiKeyManager(
  options?: ApiKeyManagerOptions
): ApiKeyManager {
  const keys = [
    process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY,
    process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY_2,
    process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY_3,
  ].filter((key): key is string => !!key);

  return new ApiKeyManager(keys, options);
}

/**
 * 공공데이터포털 API 키 매니저 생성
 */
export function createPublicDataApiKeyManager(
  options?: ApiKeyManagerOptions
): ApiKeyManager {
  const keys = [
    process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY,
    process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY_2,
    // Fallback: Seoul subway API keys work with openapi.seoul.go.kr too
    ...(!process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY ? [
      process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY,
      process.env.EXPO_PUBLIC_SEOUL_SUBWAY_API_KEY_2,
    ] : []),
  ].filter((key): key is string => !!key);

  return new ApiKeyManager(keys, options);
}

export default ApiKeyManager;
