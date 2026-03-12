# Audio & Accessibility API Reference

## TTSService API

### 클래스: `TTSService` (싱글톤: `ttsService`)

| 메서드 | 시그니처 | 반환 | 설명 |
|--------|---------|------|------|
| `initialize` | `() => Promise<void>` | - | AsyncStorage에서 설정 로드 + 음성 목록 |
| `loadAvailableVoices` | `() => Promise<readonly VoiceOption[]>` | 한국어 우선 음성 목록 | ko > en/ja/zh 순 |
| `getAvailableVoices` | `() => readonly VoiceOption[]` | 캐시된 음성 목록 | 동기 |
| `getSettings` | `() => TTSSettings` | 현재 설정 복사본 | immutable |
| `updateSettings` | `(Partial<TTSSettings>) => Promise<void>` | - | AsyncStorage에 영속화 |
| `enable` | `() => Promise<void>` | - | `enabled: true` |
| `disable` | `() => Promise<void>` | - | `enabled: false` + stop |
| `isEnabled` | `() => boolean` | - | 동기 확인 |
| `speak` | `(text, options?) => Promise<void>` | - | enabled=false이면 no-op |
| `announce` | `(Announcement) => Promise<void>` | - | 큐 삽입, 우선순위 정렬 |
| `announceArrival` | `(data) => Promise<void>` | - | 도착 템플릿 |
| `announceDelay` | `(data) => Promise<void>` | - | 지연 템플릿 (high, non-interruptible) |
| `announceDepartureReminder` | `(data) => Promise<void>` | - | 출발 알림 템플릿 |
| `announceTransfer` | `(data) => Promise<void>` | - | 환승 템플릿 |
| `announceCongestion` | `(data) => Promise<void>` | - | 혼잡 템플릿 |
| `announceServiceAlert` | `(data) => Promise<void>` | - | 운행 장애 템플릿 (high) |
| `stop` | `() => void` | - | 즉시 정지 + 큐 비우기 |
| `isSpeakingAsync` | `() => Promise<boolean>` | - | expo-speech 상태 |
| `test` | `() => Promise<void>` | - | 임시 enable 후 테스트 문장 |

### 타입: `TTSSettings`

```typescript
interface TTSSettings {
  enabled: boolean;     // TTS 활성화
  language: string;     // BCP 47 (기본: 'ko-KR')
  pitch: number;        // 0.5 ~ 2.0 (기본: 1.0)
  rate: number;         // 0.1 ~ 2.0 (기본: 1.0)
  volume: number;       // 0 ~ 1.0 (기본: 1.0)
  voiceId?: string;     // 디바이스 음성 ID
}
```

### 타입: `Announcement`

```typescript
interface Announcement {
  type: AnnouncementType;
  text: string;
  priority: 'low' | 'normal' | 'high';
  interruptible: boolean;
}
```

### 타입: `VoiceOption`

```typescript
interface VoiceOption {
  id: string;
  name: string;
  language: string;
  quality: 'default' | 'enhanced';
}
```

### 안내 템플릿 상세

```
arrival:
  "${lineName} ${direction} 방면 열차가 ${minutes}분 후 ${stationName}역에 도착합니다."

delay:
  "${lineName} 지연 알림. 현재 약 ${delayMinutes}분 지연 운행 중입니다. ${reason}"

departure_reminder:
  "출발 시간 알림. ${minutes}분 후 ${stationName}역에서 출발 예정입니다. 이동을 준비해 주세요."

transfer:
  "${currentStation}역에서 ${transferLine}으로 환승하세요. 환승 시간은 약 ${walkingMinutes}분입니다."

congestion:
  "혼잡 알림. ${stationName}역이 현재 ${level}합니다. 우회 경로를 이용해 주세요."

service_alert:
  "${lineName} 운행 알림. ${message}"
```

### AsyncStorage 키

`@livemetro:tts_settings`

---

## SoundService API

### 클래스: `SoundService` (싱글톤: `soundService`)

| 메서드 | 시그니처 | 반환 | 설명 |
|--------|---------|------|------|
| `initialize` | `() => Promise<void>` | - | 오디오 초기화 (현재 audioAvailable=false) |
| `isAudioAvailable` | `() => boolean` | false (Expo Go) | EAS Build에서만 true |
| `previewSound` | `(soundId, volume) => Promise<void>` | - | Expo Go: Alert 표시 |
| `stopSound` | `() => Promise<void>` | - | 재생 중지 |
| `triggerVibration` | `(patternId) => void` | - | iOS: 단순진동, Android: 패턴 |
| `previewVibration` | `(patternId) => void` | - | triggerVibration 호출 |
| `getIsPlaying` | `() => boolean` | - | 재생 상태 |
| `getSoundUrl` | `(soundId) => string` | URL | 알림 서비스용 |
| `cleanup` | `() => Promise<void>` | - | 리소스 해제 |

### 내보내기 상수/함수

| 이름 | 타입 | 설명 |
|------|------|------|
| `NOTIFICATION_SOUNDS` | `readonly SoundOption[]` | 6개 알림음 메타 |
| `VIBRATION_PATTERNS` | `readonly VibrationOption[]` | 6개 진동 패턴 메타 |
| `getVibrationPattern` | `(id) => number[]` | 패턴 배열 반환 |

### 타입: `SoundOption`

```typescript
interface SoundOption {
  readonly id: NotificationSoundId;
  readonly label: string;        // 한국어 라벨
  readonly description: string;  // 설명
}
```

### 타입: `VibrationOption`

```typescript
interface VibrationOption {
  readonly id: VibrationPatternId;
  readonly label: string;
  readonly description: string;
  readonly pattern: number[];    // [대기ms, 진동ms, ...]
}
```

### 사운드 URL 매핑

| ID | URL |
|----|-----|
| `default` | mixkit sfx 2869 |
| `train_arrival` | mixkit sfx 1900 |
| `subway_chime` | mixkit sfx 2571 |
| `gentle_bell` | mixkit sfx 2869 (= default) |
| `urgent_alert` | mixkit sfx 1977 |
| `silent` | (빈 문자열) |

---

## AccessibilityService API

### 클래스: `AccessibilityService` (싱글톤: `accessibilityService`)

| 메서드 | 시그니처 | 반환 | 설명 |
|--------|---------|------|------|
| `initialize` | `() => Promise<void>` | - | 설정 로드 + 시스템 감지 + 리스너 등록 |
| `getSettings` | `() => AccessibilitySettings` | 설정 복사본 | immutable |
| `updateSettings` | `(Partial<AccessibilitySettings>) => Promise<void>` | - | 영속화 + 리스너 알림 |
| `subscribe` | `(callback) => () => void` | unsubscribe 함수 | 옵저버 패턴 |
| `isScreenReaderActive` | `() => Promise<boolean>` | - | 시스템 API |
| `isReduceMotionEnabled` | `() => Promise<boolean>` | - | 시스템 API |
| `announce` | `(string \| AccessibilityAnnouncement) => void` | - | 스크린리더 방송 |
| `announceForAccessibility` | `(message, options?) => void` | - | announceNotifications 확인 후 방송 |
| `setAccessibilityFocus` | `(reactTag) => void` | - | 포커스 이동 |
| `getStationAccessibilityLabel` | `(station, line, extras?) => string` | 조합된 라벨 | 역 정보 |
| `getArrivalAccessibilityLabel` | `(dest, minutes, status?) => string` | 조합된 라벨 | 도착 정보 |
| `getAccessibilityHint` | `(action) => string` | hint 또는 빈 문자열 | voiceOverHints 확인 |
| `formatTimeForScreenReader` | `(timeString) => string` | "HH시 MM분" | HH:mm 변환 |
| `formatDurationForScreenReader` | `(minutes) => string` | "N시간 M분" | 분 -> 시간분 |
| `getCongestionDescription` | `(level) => string` | 한국어 설명 | 1-10 레벨 |
| `shouldUseHighContrast` | `() => boolean` | - | 동기 |
| `getTextScaleFactor` | `() => number` | - | 동기 |
| `shouldReduceMotion` | `() => boolean` | - | 동기 |
| `shouldUseHapticFeedback` | `() => boolean` | - | 동기 |

### 시스템 이벤트 리스너

서비스 내부에서 자동 등록:

| 이벤트 | 업데이트 필드 |
|--------|-------------|
| `screenReaderChanged` | `screenReaderEnabled` |
| `reduceMotionChanged` | `reduceMotionEnabled` |

### AsyncStorage 키

`@livemetro:accessibility_settings`

---

## User Model 관련 타입

### `NotificationSoundId` (union type)

`'default' | 'train_arrival' | 'subway_chime' | 'gentle_bell' | 'urgent_alert' | 'silent'`

### `VibrationPatternId` (union type)

`'default' | 'short' | 'long' | 'double' | 'triple' | 'none'`

### `SoundPreferences` (in `NotificationSettings`)

```typescript
interface SoundPreferences {
  readonly soundEnabled: boolean;
  readonly soundId: NotificationSoundId;
  readonly volume: number;              // 0-100 (soundService와 다름 주의)
  readonly vibrationEnabled: boolean;
  readonly vibrationPattern: VibrationPatternId;
}
```

> 주의: `SoundPreferences.volume`은 0-100, `TTSSettings.volume`은 0-1.0. 단위 변환 필요.

---

## 플랫폼별 차이

| 기능 | iOS | Android |
|------|-----|---------|
| TTS (expo-speech) | 시스템 음성 사용 | 시스템 음성 사용 |
| 진동 패턴 | 단순 진동만 (`Vibration.vibrate()`) | 패턴 지원 (`Vibration.vibrate(pattern)`) |
| 사운드 재생 | Expo Go 미지원 | Expo Go 미지원 |
| 스크린리더 | VoiceOver | TalkBack |
| 움직임 줄이기 | 설정 > 손쉬운 사용 | 설정 > 접근성 |
