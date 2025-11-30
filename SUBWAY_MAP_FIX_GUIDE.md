# 🔧 서울 지하철 노선도 데이터 수정 가이드

## 📋 문제 요약

**현재 상태**: 전체 매칭률 **45.4%** ❌
**목표 상태**: 전체 매칭률 **95%+** ✅

---

## 🎯 수정 전략

### 방법 1: STATIONS의 key를 사용하여 LINE_STATIONS 재작성 (권장)

#### 장점
- ✅ 데이터 정합성 100% 보장
- ✅ 유지보수 용이
- ✅ 타입 안전성 확보

#### 단점
- ⚠️ 작업량 많음 (약 324개 역)
- ⚠️ 수동 작업 필요

#### 실행 방법

**1단계: STATIONS의 모든 key 추출**
```bash
# 전체 역 ID 목록 출력
node -e "console.log(Object.keys(require('./src/utils/subwayMapData').STATIONS).sort().join('\n'))" > stations_keys.txt
```

**2단계: 노선별로 역 ID 매핑**

현재 `LINE_STATIONS`의 각 역 ID를 `STATIONS`의 실제 key로 교체:

```typescript
// ❌ 현재 (매칭 실패)
'1': [
  'soyosan',        // STATIONS에 없음
  'dongducheon',    // STATIONS에 없음
  'seoul',          // ✅ STATIONS에 있음
  // ...
]

// ✅ 수정 후 (STATIONS의 실제 key 사용)
'1': [
  // 아래는 예시 - 실제로는 stations_keys.txt에서 찾아야 함
  'seoul',              // STATIONS['seoul'] 존재
  'city_hall_1',        // STATIONS['city_hall_1'] 존재
  'jongno3ga_5',        // STATIONS['jongno3ga_5'] 존재
  // ...
]
```

**3단계: 매핑 테이블 작성**

| LINE_STATIONS 현재 ID | STATIONS 실제 key | 역명 | 비고 |
|----------------------|------------------|------|------|
| soyosan | (찾기) | 소요산 | 1호선 |
| dongducheon | (찾기) | 동두천 | 1호선 |
| euljiro1ga | (찾기) | 을지로입구 | 2호선 |
| ... | ... | ... | ... |

**4단계: LINE_STATIONS 재작성**

```typescript
// src/utils/subwayMapData.ts

export const LINE_STATIONS: Record<string, string[]> = {
  '1': [
    // TODO: STATIONS의 실제 key로 교체 필요
    'seoul',
    'city_hall_1',
    'jongno3ga_5',
    'jongno5ga',
    'dongdaemun',
    'dongmyo',
    'cheongnyangni',
    'yongsan',
    'noryangjin',
    'sindorim',
    'guro',
    'incheon',
    // ... 계속
  ],
  '2': [
    'city_hall_1',
    'euljiro3ga',
    'euljiro4ga',
    'dongdaemun_hist',
    'sindang',
    'wangsimni',
    // ... 계속
  ],
  // 3-9호선도 동일하게 수정
};
```

---

### 방법 2: 자동 매칭 스크립트 작성 (중간 난이도)

#### 작동 원리
이름 기반 fuzzy matching으로 자동 매핑:

```typescript
// scripts/autoMapStations.ts
import { STATIONS, LINE_STATIONS } from '../src/utils/subwayMapData';

function findBestMatch(searchId: string): string | null {
  // 1순위: 정확한 ID 매칭
  if (STATIONS[searchId]) return searchId;

  // 2순위: 이름 포함 검색
  const matches = Object.entries(STATIONS).filter(([id, data]) =>
    id.includes(searchId) ||
    searchId.includes(id) ||
    data.name.includes(searchId)
  );

  if (matches.length === 1) return matches[0][0];

  // 3순위: 유사도 계산 (Levenshtein distance)
  // ...

  return null;
}

// 자동 매핑 실행
Object.entries(LINE_STATIONS).forEach(([lineId, stationIds]) => {
  const mapped = stationIds.map(id => findBestMatch(id) || id);
  console.log(`'${lineId}': [${mapped.map(id => `'${id}'`).join(', ')}],`);
});
```

---

### 방법 3: Alias 테이블 추가 (임시 방편)

#### 장점
- ✅ 빠른 구현
- ✅ 기존 코드 최소 변경

#### 단점
- ❌ 유지보수 어려움
- ❌ 데이터 중복

#### 구현 예시

```typescript
// src/utils/subwayMapData.ts

export const STATION_ALIASES: Record<string, string> = {
  // LINE_STATIONS ID → STATIONS key 매핑
  'soyosan': 'soyosan_1',
  'dongducheon': 'dongducheon_1',
  'euljiro1ga': 'euljiro1ga_2',
  'gimpo_airport': 'gaehwa',  // 김포공항역
  // ... 나머지 324개 매핑
};

// mapLayout.ts에서 사용
const resolveStationId = (id: string): string => {
  return STATION_ALIASES[id] || id;
};
```

---

## 🚀 즉시 실행 가능한 해결책

### Quick Fix: generateMapLayout 함수 수정

현재 지도가 렌더링되도록 임시 수정:

```typescript
// src/utils/mapLayout.ts

export const generateMapLayout = (lines?: SimpleSubwayLine[]): MapData => {
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const addedStations = new Set<string>();

  const lineData = lines || Object.entries(LINE_STATIONS).map(([id, stations]) => ({
    id,
    color: LINE_COLORS[id] || '#888888',
    stations,
  }));

  lineData.forEach(line => {
    const lineNodes: MapNode[] = [];

    line.stations.forEach((stationId) => {
      // 🔧 개선된 역 찾기 로직
      let stationData: StationData | undefined = STATIONS[stationId];

      if (!stationData) {
        // Fallback 1: 이름으로 검색
        stationData = Object.values(STATIONS).find(
          s => s.name === stationId || s.id === stationId || s.nameEn === stationId
        );
      }

      if (!stationData) {
        // Fallback 2: 부분 문자열 매칭
        stationData = Object.entries(STATIONS).find(([key, data]) =>
          key.includes(stationId) ||
          stationId.includes(key) ||
          data.name.includes(stationId)
        )?.[1];
      }

      if (!stationData) {
        // ⚠️ 매칭 실패 로그
        console.warn(`⚠️ Station not found: '${stationId}' in line ${line.id}`);
        return; // 건너뛰기
      }

      // 나머지 로직은 동일...
      const isTransfer = stationData.lines.length > 1;

      if (!addedStations.has(stationData.id)) {
        const node: MapNode = {
          id: stationData.id,
          stationId: stationData.id,
          x: stationData.x,
          y: stationData.y,
          name: stationData.name,
          nameEn: stationData.nameEn,
          lineId: line.id,
          color: line.color,
          isTransfer,
          lines: stationData.lines,
        };
        nodes.push(node);
        addedStations.add(stationData.id);
      }

      lineNodes.push({
        id: `${line.id}-${stationData.id}`,
        stationId: stationData.id,
        x: stationData.x,
        y: stationData.y,
        name: stationData.name,
        lineId: line.id,
        color: line.color,
        isTransfer,
        lines: stationData.lines,
      });
    });

    // 엣지 생성 로직은 동일...
  });

  return { nodes, edges, width: MAP_WIDTH, height: MAP_HEIGHT };
};
```

---

## ✅ 검증 방법

### 1. 검증 스크립트 실행
```bash
npx ts-node scripts/validateSubwayData.ts
```

**기대 결과**:
```
✅ 검증 성공: 데이터 정합성이 양호합니다.
전체 매칭률: 95%+
```

### 2. 단위 테스트 실행
```bash
npm test -- mapLayout.test.ts
```

**기대 결과**:
```
PASS src/utils/__tests__/mapLayout.test.ts
  ✓ should generate map data (정상 통과)
  ✓ should correctly map stations (정상 통과)
  ✓ should generate edges (정상 통과)
```

### 3. 시각적 확인
```bash
npm start
# 앱 실행 후 지도 화면에서 모든 노선과 역이 정상 표시되는지 확인
```

---

## 📝 체크리스트

### Phase 1: 긴급 수정 (1-2시간)
- [ ] `mapLayout.ts`의 fallback 로직 강화
- [ ] 테스트 파일의 예상 값 수정 (좌표: 4900x4400)
- [ ] 앱 실행하여 일부 역이라도 정상 표시되는지 확인

### Phase 2: 데이터 정합성 확보 (1-2일)
- [ ] `stations_keys.txt` 생성 (모든 STATIONS key 추출)
- [ ] 매핑 테이블 작성 (현재 ID → 실제 key)
- [ ] `LINE_STATIONS` 전체 재작성
- [ ] 검증 스크립트 통과 확인

### Phase 3: 자동화 및 CI/CD (향후)
- [ ] 자동 매핑 스크립트 개발
- [ ] CI/CD에 검증 스크립트 추가
- [ ] SVG → JSON 변환 자동화

---

## 🔗 관련 파일

- **데이터 정의**: `src/utils/subwayMapData.ts`
- **지도 생성**: `src/utils/mapLayout.ts`
- **검증 스크립트**: `scripts/validateSubwayData.ts`
- **테스트**: `src/utils/__tests__/mapLayout.test.ts`
- **분석 리포트**: `SUBWAY_MAP_DATA_ANALYSIS.md`

---

## 💡 추가 참고사항

### 역 ID 명명 규칙

**현재 STATIONS의 패턴**:
- 일반 역: `station_name` (예: `seoul`, `gangnam`)
- 환승역: `station_name_line` (예: `city_hall_1`, `jongno3ga_5`)
- 중복 역명: `station_name_line` (예: `sports_complex_9`)

**LINE_STATIONS의 패턴** (문제):
- 영어 역명: `euljiro1ga`, `gimpo_airport`
- 일관성 없음: 같은 역이 노선마다 다른 ID

### 권장 명명 규칙

앞으로 새로운 역 추가 시:
```typescript
// ✅ 좋은 예
{
  id: 'gangnam_2_sinbundang',  // 명확한 노선 정보
  name: '강남',
  lines: ['2', 'sinbundang']
}

// ❌ 나쁜 예
{
  id: 'gangnam',  // 어느 노선인지 불명확
  name: '강남',
  lines: ['2', 'sinbundang']
}
```

---

**작성일**: 2025-11-28
**작성자**: Claude Code
**버전**: 1.0
