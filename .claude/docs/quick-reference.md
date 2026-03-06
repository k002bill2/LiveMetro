# LiveMetro Quick Reference
> Seoul Metro Real-time Arrival App - React Native + Firebase

## Tech Stack 요약

| Layer | Tech | Version |
|-------|------|---------|
| **Framework** | React Native + Expo | 0.76+ / SDK 52 |
| **Language** | TypeScript | 5.6+ |
| **State** | Zustand | 5.0+ |
| **Backend** | Firebase (Auth + Firestore) | 11.x |
| **API** | Seoul Open Data API | 30초 폴링 |
| **Navigation** | React Navigation | 6.x |

---

## 디렉토리 구조

```
src/
├── components/       # UI 컴포넌트
│   ├── train/        # 열차 관련
│   ├── station/      # 역 관련
│   └── common/       # 공통
├── screens/          # 스크린
├── services/         # 서비스 (Firebase, Seoul API, Cache)
├── hooks/            # 커스텀 훅
├── models/           # 데이터 모델
├── types/            # TypeScript 타입
├── navigation/       # React Navigation 설정
└── config/           # Firebase 등 설정
```

---

## 주요 명령어

### 검증 및 품질
```bash
/check-health      # 타입체크 + 린트 + 테스트 + 빌드
/verify-app        # Boris Cherny 스타일 검증 루프
/test-coverage     # 테스트 커버리지 분석
/review            # 변경 파일 코드 리뷰
```

### 세션 관리
```bash
/dev-docs          # Dev Docs 3-파일 생성
/update-dev-docs   # Dev Docs 업데이트
/save-and-compact  # 저장 + /compact
/resume            # 이전 세션 컨텍스트 복원
```

### Git 워크플로우
```bash
/commit-push-pr    # 커밋 -> 푸시 -> PR 자동화
```

---

## Sub-agents

| Agent | Domain | Model |
|-------|--------|-------|
| `mobile-ui-specialist` | React Native UI + Services | Sonnet |
| `test-automation-specialist` | Jest + RNTL | Haiku |
| `quality-validator` | 품질 검증 | Haiku |
| `eval-grader` | 에이전트 평가 채점 | Inherit |
| `eval-task-runner` | 평가 태스크 실행 | Inherit |

---

## 코드 패턴

### React Native Component
```tsx
import { StyleSheet, View, Text, Pressable } from 'react-native';

export const StationCard = memo(({ station, onPress }: StationCardProps) => (
  <Pressable
    style={styles.container}
    onPress={() => onPress(station.id)}
    accessibilityLabel={`${station.name} 역`}
  >
    <Text style={styles.title}>{station.name}</Text>
  </Pressable>
));

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 8 },
  title: { fontSize: 16, fontWeight: '600' },
});
```

### Zustand Store
```typescript
export const useStore = create<State>((set, get) => ({
  data: null,
  fetchData: async () => {
    const result = await trainService.getArrivals();
    set({ data: result });
  },
}));
```

### Firebase Service
```typescript
export const getFavorites = async (userId: string): Promise<Station[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'users', userId, 'favorites'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Station));
  } catch (error) {
    console.error('getFavorites error:', error);
    return []; // throw 지양, 빈 배열 반환
  }
};
```

---

## 환경 변수

```bash
# Firebase (firebase.config.ts에서 관리)
EXPO_PUBLIC_FIREBASE_API_KEY=xxx
EXPO_PUBLIC_FIREBASE_PROJECT_ID=xxx

# Seoul API
EXPO_PUBLIC_SEOUL_API_KEY=xxx
```

---

## 테스트 커버리지 목표

| Metric | Target |
|--------|--------|
| Statements | 75% |
| Functions | 70% |
| Branches | 60% |

---

## 자주 쓰는 검증 명령

```bash
npm run type-check    # TypeScript
npm run lint          # ESLint
npm test              # Jest
npm test -- --coverage  # 커버리지
```

---

## 문제 해결

| 증상 | 해결 |
|------|------|
| Skill 미작동 | skill-rules.json + Hook 확인 |
| 타입 에러 | `npm run type-check` 실행 |
| 테스트 실패 | 커버리지 확인, 의존성 체크 |
| Seoul API 오류 | 30초 폴링 간격 확인, API 키 체크 |
| Context 부족 | `/update-dev-docs` -> `/compact` |

---

*Last Updated: 2026-03-06*
