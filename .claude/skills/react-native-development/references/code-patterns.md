# React Native Code Patterns — LiveMetro

컴포넌트 구조 · 성능 · 네비게이션 · 스타일링 · 흔한 패턴 모음. SKILL.md "Core Principles"에서 referenced.

## 1. Component Structure (memo + displayName)

```tsx
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ComponentProps {
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
  container: { /* ... */ },
  title: { /* ... */ },
});
```

## 2. File Organization

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

## 3. Performance (memo · useMemo · useCallback)

```tsx
// Expensive components
export const ExpensiveComponent = memo(({ data }) => {
  // ...
}, (prevProps, nextProps) => {
  return prevProps.data === nextProps.data;
});

// Expensive calculations
const processedData = useMemo(() => {
  return heavyComputation(data);
}, [data]);

// Stable callback references
const handlePress = useCallback(() => {
  // ...
}, [dependencies]);
```

## 4. Navigation Pattern (typed Props)

```tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ScreenName'>;

export const ScreenComponent: React.FC<Props> = ({ navigation, route }) => {
  const handleNavigate = () => {
    navigation.navigate('OtherScreen', { param: 'value' });
  };
};
```

## 5. Error Handling in Components

```tsx
const [error, setError] = useState<string | null>(null);

try {
  await someAsyncOperation();
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error');
  console.error('Operation failed:', err);
}

// Display error
{error && (
  <Text style={styles.error}>{error}</Text>
)}
```

## 6. Responsive Design

```tsx
import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    width: width * 0.9,
    padding: width < 375 ? 12 : 16,
  },
});
```

> **주의**: 모듈 레벨 `Dimensions.get`은 회전 시 갱신 안 됨. 컴포넌트 내부에서 회전 대응이 필요하면 `useWindowDimensions()` 훅 사용.

## 7. Platform-Specific Styles

```tsx
const styles = StyleSheet.create({
  text: {
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'Roboto' },
    }),
  },
});
```

## 8. Loading State 패턴

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

## 9. FlatList Rendering

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

## 10. Form Input

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
