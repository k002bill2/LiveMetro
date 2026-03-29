---
name: react-native-development
description: React Native component development with TypeScript, Expo, and React Navigation. Use when creating UI components, screens, or implementing navigation flows.
---

# React Native Development Guidelines

## Checklists

개발 시 다음 체크리스트를 참조하세요:
- `.claude/checklists/rn-specific.md` - useEffect, 상태관리, 네비게이션, 리스트/이미지 최적화, Expo 특화

## When to Use This Skill
- Creating new React Native components
- Building screens with navigation
- Implementing custom hooks
- Working with Expo SDK features
- Styling with StyleSheet and responsive design

## Core Principles

### 1. Component Structure
```tsx
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ComponentProps {
  // Props with JSDoc comments
  title: string;
  onPress?: () => void;
}

export const Component: React.FC<ComponentProps> = memo(({
  title,
  onPress
}) => {
  // 1. Hooks (useState, useEffect, custom hooks)
  // 2. Derived state
  // 3. Event handlers
  // 4. Return JSX

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
});

Component.displayName = 'Component';

const styles = StyleSheet.create({
  container: {
    // Styles here
  },
  title: {
    // Styles here
  },
});
```

### 2. File Organization
```
src/
├── components/        # Reusable UI components
│   └── train/        # Domain-specific components
├── screens/          # Screen components
│   └── home/         # Feature-based screens
├── hooks/            # Custom React hooks
├── navigation/       # Navigation configuration
└── utils/            # Helper functions
```

### 3. TypeScript Standards
- Always use TypeScript strict mode
- Define interfaces for all component props
- Use type inference where possible
- Avoid `any` type - use `unknown` with type guards

### 4. Performance Best Practices
```tsx
// Use memo for expensive components
export const ExpensiveComponent = memo(({ data }) => {
  // Component logic
}, (prevProps, nextProps) => {
  // Custom comparison if needed
  return prevProps.data === nextProps.data;
});

// Use useMemo for expensive calculations
const processedData = useMemo(() => {
  return heavyComputation(data);
}, [data]);

// Use useCallback for stable callback references
const handlePress = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

### 5. Navigation Pattern
```tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ScreenName'>;

export const ScreenComponent: React.FC<Props> = ({ navigation, route }) => {
  const handleNavigate = () => {
    navigation.navigate('OtherScreen', {
      param: 'value'
    });
  };

  // Screen implementation
};
```

### 6. Error Handling
```tsx
const [error, setError] = useState<string | null>(null);

try {
  await someAsyncOperation();
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error');
  console.error('Operation failed:', err);
}

// Display error to user
{error && (
  <Text style={styles.error}>{error}</Text>
)}
```

## Styling Guidelines

### 1. Responsive Design
```tsx
import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    width: width * 0.9,
    padding: width < 375 ? 12 : 16, // Smaller phones
  },
});
```

### 2. Platform-Specific Styles
```tsx
const styles = StyleSheet.create({
  text: {
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'Roboto',
      },
    }),
  },
});
```

## Common Patterns

### 1. Loading States
```tsx
const [loading, setLoading] = useState(true);
const [data, setData] = useState<DataType | null>(null);

useEffect(() => {
  fetchData()
    .then(setData)
    .finally(() => setLoading(false));
}, []);

if (loading) {
  return <ActivityIndicator size="large" />;
}
```

### 2. List Rendering
```tsx
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemComponent item={item} />}
  ListEmptyComponent={<EmptyState />}
  ListHeaderComponent={<Header />}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
/>
```

### 3. Form Input Handling
```tsx
const [value, setValue] = useState('');

<TextInput
  value={value}
  onChangeText={setValue}
  placeholder="Enter text"
  autoCapitalize="none"
  autoCorrect={false}
/>
```

## Testing Requirements
- Write unit tests for all components
- Test user interactions
- Test error states
- Mock API calls and navigation

## Accessibility
- Add `accessibilityLabel` to touchable elements
- Use `accessibilityRole` appropriately
- Ensure proper contrast ratios
- Support screen readers

## BANNED Patterns (Hard Failures)

아래 패턴이 발견되면 즉시 수정해야 합니다. 예외 없음.

### Code Patterns
| BANNED | USE INSTEAD | WHY |
|--------|-------------|-----|
| `style={{ color: 'red' }}` (인라인 스타일) | `StyleSheet.create()` | 매 렌더마다 새 객체 생성 → 성능 저하 |
| `<ScrollView>{items.map(...)}` | `<FlatList data={items} />` | 전체 리스트 렌더링 → 메모리 폭발 |
| `import X from '../../components/X'` | `import X from '@components/X'` | 상대 경로 → 리팩토링 시 경로 파손 |
| `any` 타입 | `unknown` + type guard | 타입 안전성 무력화 |
| `console.log()` in production | 제거 또는 `__DEV__` 가드 | 성능 저하 + 정보 노출 |
| `useEffect` without cleanup | return cleanup function | 메모리 누수 |
| `setTimeout`/`setInterval` without clear | `clearTimeout`/`clearInterval` in cleanup | 언마운트 후 상태 업데이트 크래시 |
| `onPress={() => navigate(...)}` (인라인) | `useCallback`으로 감싸기 | 매 렌더마다 새 함수 생성 |
| 하드코딩 색상 `'#007AFF'` | `colors.primary` (테마) | 다크모드 미지원 |
| `Dimensions.get('window')` 모듈 레벨 | `useWindowDimensions()` 훅 | 화면 회전 시 갱신 안 됨 |

### Architecture Patterns
| BANNED | USE INSTEAD |
|--------|-------------|
| 한 파일에 여러 컴포넌트 export | 컴포넌트당 1파일 |
| 800줄 초과 파일 | 유틸리티/하위 컴포넌트로 분리 |
| Props drilling 3단계 이상 | Context 또는 composition |
| 비동기 로직을 컴포넌트에 직접 | Custom hook으로 추출 |

## Pre-Output Checklist

코드 출력 전 다음을 반드시 확인:
- [ ] 모든 `useEffect`에 cleanup 함수 있는가?
- [ ] `accessibilityLabel`이 모든 터치 요소에 있는가?
- [ ] `StyleSheet.create()`로 스타일 정의했는가?
- [ ] path alias (`@/`)를 사용했는가?
- [ ] `any` 타입이 없는가?
- [ ] 컴포넌트에 `displayName`이 있는가?

## Important Notes
- Always use path aliases (@/) instead of relative imports
- Clean up subscriptions and timers in useEffect cleanup
- Handle keyboard dismissal on iOS and Android
- Test on both platforms before committing
