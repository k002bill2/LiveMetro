# 현재 위치 노선도 (Current-Location Subway Map) — Design Spec

- **Date**: 2026-06-26
- **Branch**: `worktree-location-map-current` (base: `origin/main` @ 00f2e08)
- **Scope**: v1 — 노선도(스키매틱) 현재역 하이라이트, 클라이언트 전용, 네이티브 의존 0

## 1. 문제 (Problem)

사용자가 처음 요청한 3가지(경로안내·현재위치·알림) 중 **현재위치 시각화**가 유일한 미착수 항목. 앱에는 오늘 "지도 위 내 위치"를 보여주는 화면이 없다(지리 지도 SDK 미설치, `SubwayMapView` SVG 노선도는 존재하나 死 — re-export만 되고 렌더 0건).

## 2. 왜 지리 지도가 아니라 노선도인가 (핵심 결정 근거)

문자 그대로의 "지도 위 GPS 파란 점"(react-native-maps)은 **지하철 앱에 부적합**:
- **네이티브 의존** → Expo Go 테스트 불가, EAS 재빌드 필요, Google Maps API 키.
- **지하 GPS 무용** → 통근 대부분 구간에서 파란 점이 틀리거나 멈춤.

대신 **노선도 상의 "현재 역" 하이라이트**가 정직하고 유용: 마지막 GPS fix → 가장 가까운 역(`useNearbyStations.closestStation`) → 노선도에서 그 역 강조. 지하에서도 "강남역 근처"가 성립하고, 네이티브 의존 0, Expo Go에서 동작. 이미 있는(死) `SubwayMapView`가 `selectedStation` 하이라이트를 이미 지원하므로 부활해 재사용.

## 3. 목표 / 비목표

### Goals (v1)
- G1. SVG 노선도(`SubwayMapView`)를 화면에 렌더(부활).
- G2. 사용자의 가장 가까운 역을 노선도에서 `selectedStation`으로 강조 + "현재 위치: OO역 근처 (Nm)" 헤더.
- G3. 위치 없음/권한 거부/획득 실패 시 가짜 위치 없이 정직한 상태 표시(지도는 보이되 강조 없음).
- G4. 홈에서 이 화면으로 진입.

### Non-Goals (의도적)
- 지리 지도(react-native-maps)·GPS 파란 점.
- 실시간 이동 추적(통근 중 역→역 자동 진행 — 길안내 영역).
- 기존 역목록 `SubwayMapScreen` 변경(별도 화면 신설).
- `SubwayMapView` 시각 디자인 개편(부활·하이라이트까지만; 폴리시는 실기기 후속).

## 4. 아키텍처 (Units & Interfaces)

### 4.1 `subwayMapViewData` (신규 · 정적 어댑터)
- **위치**: `src/components/map/subwayMapViewData.ts`
- **Produces**: `SUBWAY_MAP_STATIONS: readonly SubwayMapStation[]`, `SUBWAY_MAP_LINES: readonly LineSegment[]` — `subwayMapData.STATIONS`/`LINE_*`를 `SubwayMapView`의 props 형태({id,name,x,y,lineIds,isTransfer} / {lineId,fromStation,toStation,color})로 변환. 정적이라 모듈 로드 시 1회 계산(상수).
- **의존**: `@/utils/subwayMapData`(STATIONS, LINE_COLORS, 노선 순서).

### 4.2 `useCurrentStationId` (신규 · 훅)
- **위치**: `src/hooks/useCurrentStationId.ts`
- **시그니처**: `useCurrentStationId(): { currentStationId: string | null; currentStationName: string | null; distanceM: number | null; status: 'locating' | 'located' | 'unavailable' }`
- **책임**: `useNearbyStations` 래핑. `closestStation`이 있으면 그 `id`를 `resolveInternalStationId`로 STATIONS 키(슬러그)에 매핑해 `currentStationId` 산출. 로딩 중=locating, 좌표/closest 있음=located, 권한거부/에러/무fix=unavailable. throw 금지.
- **의존**: `@hooks/useNearbyStations`, `@utils/stationIdResolver`.

### 4.3 `CurrentLocationMapScreen` (신규 · 화면)
- **위치**: `src/screens/map/CurrentLocationMapScreen.tsx`
- **렌더**: 헤더(`located`→"현재 위치: {name} 근처 ({dist})", `locating`→"위치 확인 중…", `unavailable`→"위치를 확인할 수 없어요") + `<SubwayMapView stations={SUBWAY_MAP_STATIONS} lines={SUBWAY_MAP_LINES} selectedStation={currentStationId ?? undefined} showLabels onStationPress={...}/>`. `unavailable`이어도 노선도는 렌더(강조만 없음). `memo`/`StyleSheet.create`/`accessibilityLabel`.
- **의존**: 4.1, 4.2, `SubwayMapView`.

### 4.4 네비/진입점 (수정)
- `RootNavigator.tsx` — `CurrentLocationMap` 라우트 등록(헤더 표시).
- 홈(`HomeScreen`) — "내 위치 노선도" 진입 어포던스 → `navigate('CurrentLocationMap')`.

## 5. 데이터 흐름
```
useNearbyStations.closestStation.id
   → useCurrentStationId (resolveInternalStationId → 슬러그) → currentStationId + status
CurrentLocationMapScreen:
   헤더(status) + SubwayMapView(SUBWAY_MAP_STATIONS/LINES, selectedStation=currentStationId)
홈 "내 위치 노선도" → navigate('CurrentLocationMap')
```

## 6. 에러 처리
- 위치 권한 거부/무fix/에러 → status='unavailable', 지도는 렌더(강조 없음), 가짜 위치 금지.
- `closestStation.id` 미해결(resolve null) → currentStationId=null(강조 없음), 헤더는 이름만(있으면).
- `subwayMapViewData` 변환 실패는 빌드타임 정적이라 런타임 에러 경로 없음(데이터 결손 역은 skip).

## 7. 테스트 전략 (TDD)
- `subwayMapViewData`: STATIONS→stations 변환(좌표/lineIds/isTransfer), lines 세그먼트 생성, 빈/결손 graceful.
- `useCurrentStationId`: closest 있음→located+슬러그매핑, 로딩→locating, 무위치/에러→unavailable, resolve null→currentStationId null (useNearbyStations mock).
- `CurrentLocationMapScreen`: located→헤더+selectedStation 전달, unavailable→안내+지도 렌더(강조없음), onStationPress 동작 (SubwayMapView mock으로 prop 검증).
- 커버리지: `jest.config.js` 게이트.
- **시각 검증은 범위 밖**(死 SVG 부활 — Expo Go/실기기 후속).

## 8. 영향 파일
- **신규(3+테스트)**: `subwayMapViewData.ts`, `useCurrentStationId.ts`, `CurrentLocationMapScreen.tsx`.
- **수정(2)**: `RootNavigator.tsx`(라우트), `HomeScreen.tsx`(진입 어포던스).
- **불변**: `SubwayMapView.tsx`(부활해 재사용, 미수정 원칙 — 필요 시 최소 prop 보정만), 기존 `SubwayMapScreen.tsx`.

## 9. 위험 & 완화
- **死 SubwayMapView 런타임 미검증**: 데이터/훅/배선 TDD + SubwayMapView는 화면 테스트서 mock. 실 SVG 렌더 시각 검증은 실기기 후속(명시).
- **id 스킴 불일치**: `resolveInternalStationId`로 매핑(출퇴근 작업서 검증).
- **노선도 좌표 품질**: stations.json x/y 스키매틱 좌표 사용(657역). 품질 이슈는 데이터 수정 별건.
