---
name: audio-accessibility
description: "음성 합성(TTS), 알림음, 진동, 접근성 서비스 통합. Expo Speech, 사운드 재생, 화면 읽기, 움직임 감소 설정. Use when: (1) TTS 음성 안내, (2) 알림음/진동 구현, (3) 접근성 기능 개발, (4) VoiceOver/TalkBack 지원. 트리거: TTS, 음성, voice, 사운드, sound, 진동, vibration, 접근성, accessibility, 화면읽기, screen reader."
---

# Audio & Accessibility Skill

## Resources

- `scripts/tts-test-runner.py` - TTS 안내 문구 생성/검증
- `assets/accessibility-config.json` - 접근성 설정 (TTS, 진동, 화면 읽기)

## Overview

LiveMetro의 음성 안내(TTS), 알림음/진동 재생, 접근성(VoiceOver/TalkBack) 기능을 다루는 스킬. 세 서비스(`ttsService`, `soundService`, `accessibilityService`)가 싱글톤 패턴으로 동작하며, 각각 AsyncStorage에 설정을 영속화한다.

## 서비스 아키텍처

```
User Preferences (models/user.ts)
  └── SoundPreferences { soundId, vibrationPattern, volume }

Services (싱글톤, AsyncStorage 영속화):
  ├── ttsService     ─ expo-speech 래핑, 큐 기반 음성 안내
  ├── soundService   ─ 알림음 재생(제한적) + Vibration API
  └── accessibilityService ─ AccessibilityInfo 래핑, 시스템 설정 감지

Screens:
  ├── VoiceSettingsScreen ─ TTS on/off, 음성 선택, pitch/rate/volume
  └── SoundSettingsScreen ─ 알림음/진동 패턴 선택, 볼륨
```

## 1. TTS 서비스 (`ttsService`)

### 핵심 패턴

- `expo-speech`를 lazy load (Expo Go에서 안전)
- 우선순위 큐: `high` > `normal` > `low`
- `high` + `interruptible: false`이면 현재 음성을 중단하고 즉시 재생

### 사용법

```typescript
import { ttsService } from '@/services/speech/ttsService';

// 초기화 (자동 호출되지만 명시적으로 가능)
await ttsService.initialize();

// 설정 변경
await ttsService.updateSettings({ pitch: 1.2, rate: 0.9 });

// 직접 발화
await ttsService.speak('안내 메시지');

// 템플릿 기반 안내 (6종)
await ttsService.announceArrival({
  lineName: '2호선', stationName: '강남',
  direction: '외선순환', minutes: 3,
});
await ttsService.announceDelay({
  lineName: '3호선', delayMinutes: 5, reason: '신호 장애',
});
await ttsService.announceDepartureReminder({
  stationName: '역삼', minutes: 10,
});
await ttsService.announceTransfer({
  currentStation: '교대', transferLine: '3호선', walkingMinutes: 2,
});
await ttsService.announceCongestion({
  stationName: '강남', level: '매우 혼잡',
});
await ttsService.announceServiceAlert({
  lineName: '1호선', message: '운행 중단',
});

// 정지 & 큐 비우기
ttsService.stop();
```

### TTSSettings 구조

```typescript
interface TTSSettings {
  enabled: boolean;
  language: string;   // 기본 'ko-KR'
  pitch: number;      // 0.5 ~ 2.0
  rate: number;       // 0.1 ~ 2.0
  volume: number;     // 0 ~ 1.0
  voiceId?: string;
}
```

### AnnouncementType (6종)

| 타입 | 우선순위 | 중단가능 | 용도 |
|------|---------|---------|------|
| `arrival` | normal | O | 열차 도착 |
| `delay` | high | X | 지연 알림 |
| `departure_reminder` | normal | O | 출발 시간 |
| `transfer` | normal | O | 환승 안내 |
| `congestion` | normal | O | 혼잡 경고 |
| `service_alert` | high | X | 운행 장애 |

## 2. 사운드 서비스 (`soundService`)

### 핵심 패턴

- `expo-av` 미사용 (Expo Go 제약). 사운드 미리듣기는 Alert로 대체
- 진동은 `react-native`의 `Vibration` API 직접 사용
- iOS는 패턴 진동 미지원 -> 단순 진동으로 폴백

### 알림음 ID (`NotificationSoundId`)

| ID | 라벨 |
|----|------|
| `default` | 기본음 |
| `train_arrival` | 열차 도착 |
| `subway_chime` | 지하철 차임 |
| `gentle_bell` | 부드러운 벨 |
| `urgent_alert` | 긴급 알림 |
| `silent` | 무음 |

### 진동 패턴 ID (`VibrationPatternId`)

| ID | 패턴 (ms) | 설명 |
|----|----------|------|
| `default` | `[0, 250, 250, 250]` | 표준 |
| `short` | `[0, 100]` | 짧게 |
| `long` | `[0, 500]` | 길게 |
| `double` | `[0, 200, 100, 200]` | 두 번 |
| `triple` | `[0, 150, 100, 150, 100, 150]` | 세 번 |
| `none` | `[]` | 없음 |

패턴 배열: `[대기, 진동, 대기, 진동, ...]` (밀리초 단위)

### 사용법

```typescript
import { soundService, NOTIFICATION_SOUNDS, VIBRATION_PATTERNS,
         getVibrationPattern } from '@/services/sound/soundService';

// 초기화 + cleanup (useEffect 패턴)
useEffect(() => {
  soundService.initialize();
  return () => { soundService.cleanup(); };
}, []);

// 알림음 미리듣기 (Expo Go에서는 Alert 표시)
await soundService.previewSound('train_arrival', 80);

// 진동 실행
soundService.triggerVibration('double');

// 패턴 배열 직접 조회
const pattern = getVibrationPattern('triple'); // [0, 150, 100, 150, 100, 150]
```

### 사용자 설정 연동 (SoundPreferences)

```typescript
// models/user.ts
interface SoundPreferences {
  readonly soundEnabled: boolean;
  readonly soundId: NotificationSoundId;
  readonly volume: number;          // 0-100
  readonly vibrationEnabled: boolean;
  readonly vibrationPattern: VibrationPatternId;
}

// SoundSettingsScreen에서 updateUserProfile로 저장
await updateUserProfile({
  preferences: {
    ...user.preferences,
    notificationSettings: {
      ...user.preferences.notificationSettings,
      soundSettings: { ...soundSettings, soundId: 'subway_chime' },
    },
  },
});
```

## 3. 접근성 서비스 (`accessibilityService`)

### 핵심 패턴

- `AccessibilityInfo` API로 시스템 설정 감지 (screenReader, reduceMotion)
- 이벤트 리스너로 실시간 변경 추적
- 옵저버 패턴 (`subscribe`)으로 컴포넌트에 변경 전파

### AccessibilitySettings 구조

```typescript
interface AccessibilitySettings {
  screenReaderEnabled: boolean;     // VoiceOver/TalkBack 활성화
  reduceMotionEnabled: boolean;     // 움직임 줄이기
  highContrastEnabled: boolean;     // 고대비
  boldTextEnabled: boolean;         // 굵은 텍스트
  largeTextScale: number;           // 텍스트 크기 배율
  announceNotifications: boolean;   // 알림 음성 읽기
  hapticFeedbackEnabled: boolean;   // 햅틱 피드백
  voiceOverHints: boolean;          // 힌트 텍스트
}
```

### 사용법

```typescript
import { accessibilityService } from '@/services/accessibility/accessibilityService';

// 초기화 (시스템 설정 감지 + 리스너 등록)
await accessibilityService.initialize();

// 시스템 상태 확인
const isScreenReader = await accessibilityService.isScreenReaderActive();
const isReduceMotion = await accessibilityService.isReduceMotionEnabled();

// 스크린리더 안내 방송
accessibilityService.announce('열차가 3분 후 도착합니다');
accessibilityService.announceForAccessibility('지연 알림', { priority: 'high' });

// 접근성 라벨 생성 헬퍼
const stationLabel = accessibilityService.getStationAccessibilityLabel(
  '강남', '2호선', { isFavorite: true, congestionLevel: '혼잡' }
);
// -> "강남역, 2호선, 즐겨찾기, 혼잡도 혼잡"

const arrivalLabel = accessibilityService.getArrivalAccessibilityLabel(
  '외선순환', 3, '곧 도착'
);
// -> "외선순환 방면, 3분 후 도착, 곧 도착"

// 시간 포맷 (스크린리더용)
accessibilityService.formatTimeForScreenReader('14:30'); // "14시 30분"
accessibilityService.formatDurationForScreenReader(95);  // "1시간 35분"

// 혼잡도 설명
accessibilityService.getCongestionDescription(7); // "약간 혼잡"

// 설정 변경 구독 (cleanup 필수!)
useEffect(() => {
  const unsubscribe = accessibilityService.subscribe((settings) => {
    setReduceMotion(settings.reduceMotionEnabled);
  });
  return unsubscribe;
}, []);

// 조건부 동작
if (accessibilityService.shouldReduceMotion()) { /* 애니메이션 생략 */ }
if (accessibilityService.shouldUseHighContrast()) { /* 고대비 색상 */ }
if (accessibilityService.shouldUseHapticFeedback()) { /* 햅틱 실행 */ }
```

## 4. 컴포넌트 접근성 Props 가이드

### 필수 props

```tsx
<TouchableOpacity
  accessible={true}
  accessibilityLabel="강남역, 2호선, 즐겨찾기"
  accessibilityRole="button"
  accessibilityHint="두 번 탭하여 역 상세 정보 보기"
  accessibilityState={{ selected: isSelected, disabled: isDisabled }}
>
```

### accessibilityRole 값 (자주 사용)

| Role | 용도 |
|------|------|
| `button` | 터치 가능한 요소 |
| `header` | 섹션 제목 |
| `link` | 외부 링크 |
| `search` | 검색 입력 |
| `image` | 이미지 |
| `alert` | 경고/알림 |
| `switch` | 토글 스위치 |
| `adjustable` | 슬라이더 |

## 5. 주의사항

1. **expo-speech lazy load**: `loadSpeechModule()`이 null을 반환할 수 있음. 항상 null 체크 필요
2. **iOS 진동 제한**: `Vibration.vibrate(pattern)`은 iOS에서 패턴 무시, 단순 진동만 동작
3. **Expo Go 사운드 제약**: `expo-av` 미사용. EAS Build에서만 실제 사운드 재생 가능
4. **cleanup 필수**: `soundService.cleanup()`, `accessibilityService.subscribe()` 반환값으로 해제
5. **설정 영속화**: 세 서비스 모두 AsyncStorage 키가 다름 (`@livemetro:tts_settings`, `@livemetro:accessibility_settings`)
6. **혼잡도 레벨**: 1-2 여유, 3-4 보통, 5-6 약간 혼잡, 7-8 혼잡, 9-10 매우 혼잡

## 관련 파일

| 경로 | 역할 |
|------|------|
| `src/services/speech/ttsService.ts` | TTS 싱글톤, 큐, 템플릿 |
| `src/services/sound/soundService.ts` | 알림음 메타, 진동 패턴, Vibration API |
| `src/services/accessibility/accessibilityService.ts` | 시스템 접근성 감지, 라벨 헬퍼 |
| `src/models/user.ts` | `NotificationSoundId`, `VibrationPatternId`, `SoundPreferences` |
| `src/screens/settings/VoiceSettingsScreen.tsx` | TTS 설정 UI (음성 선택, pitch/rate/volume) |
| `src/screens/settings/SoundSettingsScreen.tsx` | 알림음/진동 설정 UI |
| `src/components/settings/SoundPicker.tsx` | 알림음 선택 컴포넌트 |
| `src/components/settings/VibrationPicker.tsx` | 진동 패턴 선택 컴포넌트 |

상세 API 레퍼런스: `references/api_reference.md`
