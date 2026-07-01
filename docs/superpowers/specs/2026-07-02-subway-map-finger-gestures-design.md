# 내 위치 노선도 핑거 제스처 (핀치 줌 + 드래그 + 경계 클램핑)

- **날짜**: 2026-07-02
- **대상 화면**: `CurrentLocationMapScreen` ("내 위치 노선도")
- **대상 컴포넌트**: `src/components/map/SubwayMapView.tsx` (유일 소비처 — blast radius 1개 화면)
- **성격**: 재작성이 아니라 **제스처 + 변환 메커니즘만 교체**. SVG 렌더·오버레이 마커·범례·`+/−/초기화` 버튼·`%` 표시기·선택역 센터링은 유지.

## 문제 (현재 상태)

`SubwayMapView.tsx`는:

1. **핀치 줌 제스처가 없다** — 줌은 `+`/`−` 버튼(`handleZoomIn/Out`, `:227-233`)으로만 가능.
2. **줌이 끊긴다** — `scale`을 `width={SVG_MAP_WIDTH * scale}`처럼 SVG 치수 자체에 곱해(`:333-334`) 매 줌마다 SVG를 새 치수로 re-layout/re-rasterize. 부드러운 제스처 불가.
3. **드래그가 경계를 모른다** — `PanResponder`(`:256-281`)가 지도를 화면 밖으로 무한히 날려버릴 수 있다.
4. **자동 센터링이 사용자와 싸운다** — `useEffect`(`:199`)가 viewport/stations 변경마다 재센터링해 사용자가 팬/줌한 위치를 되돌린다.

## 목표

- 핀치로 **줌 인/아웃**, 한 손가락 **드래그(팬)**, 두 제스처 **동시** 동작.
- **부드러움** = SVG를 한 번만 렌더하고 GPU `transform`으로만 확대/이동 (60fps).
- **경계 클램핑**: scale 범위 제한 + 지도를 화면 밖으로 날릴 수 없게 translate 제한.
- 관성 스크롤·더블탭 줌은 **범위 밖** (YAGNI — 사용자가 명시적으로 핵심+클램핑만 선택).

## 접근법

### 스택 (신규 의존성 없음)

- `react-native-gesture-handler ~2.12.0` (설치됨, `GestureHandlerRootView`가 `App.tsx:107`에서 앱 루트 래핑, jest `jestSetup` 로드됨)
- `react-native-reanimated ~3.3.0` (설치됨, babel plugin 등록됨, jest `mock` 로드됨)

### 메커니즘

1. **진실 원천 = shared values 3개**: `translateX`, `translateY`, `scale` (`useSharedValue`).
2. **제스처**: `Gesture.Pinch()` + `Gesture.Pan()`을 `Gesture.Simultaneous()`로 합쳐 `GestureDetector`로 지도 캔버스를 감쌈.
3. **렌더**: base `SvgXml`(1525×1000)와 오버레이 `Svg`를 base 치수로 **한 번만** 렌더. 확대/이동은 래핑한 reanimated `Animated.View`의 `transform:[{translateX},{translateY},{scale}]`(via `useAnimatedStyle`)로 처리.

### 초점 기반 줌 (부드러움의 핵심)

핀치 중 **두 손가락 중점(focal point)이 화면에 고정**되도록 보정한다. 초점 `f`, 현재 scale `s`, 현재 translate `t`, 배율 변화 `k`일 때:

```
newScale = clampScale(s * k)
// 초점 아래 콘텐츠가 그대로 있도록 translate 보정
newTranslate = f - (f - t) * (newScale / s)
```

검증: 강남역을 두 손가락으로 잡고 핀치 → 강남역이 손가락 아래 그대로 있어야 함. 중심/좌상단으로 쏠리면 초점 계산 오류.

### 경계 클램핑 (순수 함수로 분리 → 단위 테스트 가능)

- `clampScale(v)`: `[MIN_SCALE 0.5, MAX_SCALE 3.0]` (기존 상수 재사용).
- `clampTranslate(t, scale, contentSize, viewport)`: 스케일된 콘텐츠가 뷰포트보다 크면 가장자리를 넘지 않게, 작으면 중앙 근처로 제한. 매 제스처 업데이트와 종료 시 적용.

### 버튼·표시기·테스트 정합성

- `+/−/초기화` 버튼 유지: **`scale` React state를 동기적으로 갱신**(기존 `125%`/`80%`/`100%`/`150%`/`200%` 테스트 그대로 통과) + shared value에 미러링(`withTiming`).
- 핀치 종료 시 `runOnJS`로 최종 scale을 state에 커밋 → `%` 표시기 동기화.
- reanimated가 jest에서 mock이라 shared value만으로는 `%` 텍스트가 re-render되지 않음 → **버튼 핸들러는 반드시 state를 직접 set** (withTiming만으로 X).

### 자동 센터링 충돌 제거

`useEffect` 의존성을 **선택역(selectedStation) 변경으로만** 좁히고, 제스처 진행 중에는 센터링 skip.

## 컴포넌트 경계

| 단위 | 책임 | 의존 |
|------|------|------|
| `SubwayMapView` (컴포넌트) | 제스처 구성·shared value·렌더 | gesture-handler, reanimated, react-native-svg |
| `clampScale` / `clampTranslate` (순수 함수) | 경계 계산 | 없음 (테스트 대상) |
| `getCenteredOffset` (기존, 유지) | 선택역 센터 오프셋 계산 | 없음 |

## 테스트 전략

- **기존 테스트 유지**: 버튼(확대/축소/초기화), `%` 표시기, base `SvgXml`(width=1525), 오버레이 Circle, viewBox — 전부 그대로 통과해야 함. transform-scale 전환으로 `SvgXml` width가 항상 1525로 고정돼 오히려 견고해짐.
- **신규 단위 테스트**: `clampScale`, `clampTranslate` 순수 함수 (happy + edge: scale 하한/상한, 콘텐츠 < 뷰포트, 콘텐츠 > 뷰포트).
- **제스처는 unit-test 불가**: jest/RNGH는 실제 핀치/팬을 못 쏨. 통과는 버튼·표시기·렌더만 증명.

## 검증 (Evidence-Based Completion)

Jest 통과 ≠ 완료. **시뮬레이터/실기기에서 직접**:

1. 두 손가락 핀치 → 부드럽게 줌인/아웃, 초점 고정 확인.
2. 한 손가락 드래그 → 부드럽게 이동.
3. 지도를 세게 밀어도 화면 밖으로 사라지지 않음(클램핑).
4. 핀치+드래그 동시 → 충돌 없음.
5. `+/−/초기화` 버튼 + `%` 표시기 정상.

## 범위 밖 (YAGNI)

- 관성 스크롤(`withDecay`)
- 더블탭 줌
- 역 라벨 표시(`showLabels`), 역 탭 상호작용 확장
- `SubwayMapScreen` (다른 컴포넌트 — 이 변경과 무관)
