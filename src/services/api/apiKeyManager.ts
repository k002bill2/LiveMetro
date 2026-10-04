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
  /**
   * 'auth' = 키 자체가 무효 — 복구 후보에서 제외하고 장기 TTL 적용.
   * 'quota' = 일일 호출 한도 소진(ERROR-337) — 다음 KST 자정까지 비활성, 복구 후보 제외.
   */
  disabledReason: DisableReason | null;
}

type DisableReason = 'error' | 'auth' | 'quota';

/** KST = UTC+9, no DST. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Next 00:00 in Korea (KST) as an epoch ms, computed from epoch arithmetic so
 * it is correct regardless of the device's local time zone. Assumption: the
 * Seoul Open API daily quota (1,000 calls/key) resets at KST midnight.
 */
export const nextKstMidnight = (nowMs: number): number =>
  Math.floor((nowMs + KST_OFFSET_MS) / DAY_MS) * DAY_MS + DAY_MS - KST_OFFSET_MS;

interface ApiKeyManagerOptions {
  /** 에러 발생 시 키를 비활성화할 시간 (ms) */
  disableDurationMs?: number;
  /** 연속 에러 횟수 임계값 (이 횟수 초과 시 키 비활성화) */
  errorThreshold?: number;
  /** 사용량 카운터 리셋 주기 (ms) */
  usageResetIntervalMs?: number;
  /**
   * 인증 오류(INFO-100 등)로 비활성화된 키의 비활성 시간 (ms).
   * 무효 키를 짧은 쿨다운 후 라운드로빈에 재투입하면 주기적 실패 버스트가 생긴다.
   * 세션 영구가 아닌 장기 TTL인 이유: 신규 발급 키는 활성화 지연 동안 INFO-100을 낸다.
   */
  authDisableDurationMs?: number;
}

const DEFAULT_OPTIONS: Required<ApiKeyManagerOptions> = {
  disableDurationMs: 60000, // 1분
  errorThreshold: 3,
  usageResetIntervalMs: 3600000, // 1시간
  authDisableDurationMs: 3600000, // 1시간 — 무효 키 재시도 ≤ 24회/일/키
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
      this.keys.set(key, ApiKeyManager.freshState(key));
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
   * 인증 오류(키 무효) 발생 시 호출 — 즉시 장기 비활성화 (임계값 누적 없음)
   */
  reportAuthError(key: string): void {
    this.disableKey(key, 'auth');
  }

  /**
   * 일일 호출 한도 소진(ERROR-337) 시 호출 — 다음 KST 자정까지 비활성화.
   * 60초 쿨다운으로 재투입하면 자정 전까지 매분 실패 호출이 반복된다.
   */
  reportDailyQuotaExceeded(key: string): void {
    this.disableKey(key, 'quota');
  }

  /**
   * 오늘 더 이상 호출할 수 있는 키가 없는지 — 모든 키가 한도 소진/무효이고
   * 그중 하나 이상이 한도 소진일 때 true. (전부 무효 키뿐이면 한도 문제가 아니다)
   */
  isDailyQuotaExhausted(): boolean {
    this.checkAndReenableKeys();
    const states = Array.from(this.keys.values());
    return (
      states.length > 0 &&
      states.every((s) => s.isDisabled && (s.disabledReason === 'quota' || s.disabledReason === 'auth')) &&
      states.some((s) => s.disabledReason === 'quota')
    );
  }

  /**
   * 키가 지금 라운드로빈에 들어 있는지 (비활성 아님)
   */
  isKeyAvailable(key: string): boolean {
    const state = this.keys.get(key);
    return !!state && !state.isDisabled;
  }

  /**
   * 모든 키 상태 초기화 (테스트용)
   */
  resetKeyStates(): void {
    this.keyOrder.forEach((key) => this.keys.set(key, ApiKeyManager.freshState(key)));
    this.currentIndex = 0;
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

  private static freshState(key: string): ApiKeyState {
    return {
      key,
      usageCount: 0,
      errorCount: 0,
      lastUsed: 0,
      lastError: null,
      isDisabled: false,
      disabledUntil: null,
      disabledReason: null,
    };
  }

  private disableKey(key: string, reason: DisableReason = 'error'): void {
    const state = this.keys.get(key);
    if (state) {
      // 이미 auth/quota로 장기 비활성인 키를 짧은 쿨다운으로 덮어쓰지 않는다
      if (
        state.isDisabled &&
        (state.disabledReason === 'auth' || state.disabledReason === 'quota') &&
        reason === 'error'
      ) {
        return;
      }
      const now = Date.now();
      state.isDisabled = true;
      state.disabledReason = reason;
      state.disabledUntil =
        reason === 'quota'
          ? nextKstMidnight(now)
          : now + (reason === 'auth' ? this.options.authDisableDurationMs : this.options.disableDurationMs);
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
        state.disabledReason = null;
        state.errorCount = 0;
      }
    });
  }

  private getNextRecoveringKey(): string | null {
    let earliestKey: string | null = null;
    let earliestTime = Infinity;

    this.keys.forEach((state) => {
      // 무효(auth)·한도 소진(quota) 키는 복구 후보가 아니다 — 내주면 실패가 확정된 호출이 낭비된다
      if (state.disabledReason === 'auth' || state.disabledReason === 'quota') return;
      if (state.disabledUntil && state.disabledUntil < earliestTime) {
        earliestTime = state.disabledUntil;
        earliestKey = state.key;
      }
    });

    return (
      earliestKey ??
      this.keyOrder.find((key) => {
        const reason = this.keys.get(key)?.disabledReason;
        return reason !== 'auth' && reason !== 'quota';
      }) ??
      null
    );
  }

  private startUsageResetTimer(): void {
    this.usageResetTimer = setInterval(() => {
      this.keys.forEach((state) => {
        state.usageCount = 0;
      });
    }, this.options.usageResetIntervalMs);

    // 이 싱글톤 매니저의 사용량-리셋 타이머가 Node/Jest 프로세스 종료를 막지
    // 않도록 unref. (모듈 import만으로 생성돼 테스트에서 open handle 누수 →
    // "worker failed to exit gracefully" 유발) RN의 setInterval은 number를
    // 반환해 unref가 없으므로 가드로 프로덕션 동작은 변하지 않는다.
    (this.usageResetTimer as { unref?: () => void }).unref?.();
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
 * 공공데이터포털 API 키 매니저 생성.
 *
 * 주의: 실시간(swopenapi.seoul.go.kr)과 시간표(openapi.seoul.go.kr:8088)는
 * 인증 도메인이 다릅니다. SEOUL_SUBWAY 키를 cross-fallback으로 주입하면
 * 시간표 호출이 silent 401을 받습니다 — graceful degradation을 위해
 * 빈 manager는 반환하되 console.error로 명시적으로 알립니다.
 */
export function createPublicDataApiKeyManager(
  options?: ApiKeyManagerOptions
): ApiKeyManager {
  const keys = [
    process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY,
    process.env.EXPO_PUBLIC_DATA_PORTAL_API_KEY_2,
  ].filter((key): key is string => !!key);

  if (keys.length === 0) {
    console.error(
      'EXPO_PUBLIC_DATA_PORTAL_API_KEY is missing. ' +
        'Timetable/public-data API calls will fail with 401. ' +
        'The realtime SEOUL_SUBWAY key uses a different auth domain and is NOT used as a fallback.'
    );
  }

  return new ApiKeyManager(keys, options);
}

export default ApiKeyManager;
