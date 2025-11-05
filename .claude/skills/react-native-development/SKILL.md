---
name: react-native-development
description: React Native + TypeScript development guidelines for LiveMetro subway app. Use when creating/modifying UI components, screens, or navigation.
---

# React Native Development Guidelines

## Core Principles

1. **TypeScript Strict Mode** - All components must be fully typed
2. **Functional Components Only** - No class components
3. **Expo SDK** - Use Expo's managed workflow
4. **Custom Hooks** - Extract business logic into reusable hooks
5. **Accessibility First** - All components must be accessible

## Component Structure

### Standard Component Template

```tsx
import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ComponentProps {
  /** Prop description with JSDoc */
  title: string;
  onPress?: () => void;
  disabled?: boolean;
}

/**
 * Component description
 * @example
 * <Component title="Example" onPress={() => {}} />
 */
export const Component: React.FC<ComponentProps> = memo(({
  title,
  onPress,
  disabled = false
}) => {
  // 1. Custom hooks
  // 2. Derived state
  // 3. Event handlers
  // 4. Effects (if needed)

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        accessible
        accessibilityLabel={title}
        accessibilityRole="button"
      >
        <Text style={styles.title}>{title}</Text>
      </TouchableOpacity>
    </View>
  );
});

Component.displayName = 'Component';

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
});
```

## Custom Hooks Pattern

```tsx
import { useState, useEffect, useCallback } from 'react';

interface UseFeatureOptions {
  refetchInterval?: number;
  retryAttempts?: number;
}

interface UseFeatureReturn {
  data: DataType | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook description
 */
export const useFeature = (
  param: string,
  options: UseFeatureOptions = {}
): UseFeatureReturn => {
  const [data, setData] = useState<DataType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall(param);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [param]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
```

## Screen Structure

```tsx
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const Screen: React.FC = () => {
  // Hooks
  const { data, loading, error } = useCustomHook();

  // Handlers
  const handleAction = useCallback(() => {
    // Handle action
  }, []);

  // Render states
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <EmptyState />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Content */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
});
```

## Styling Guidelines

### 1. Use StyleSheet.create()
```tsx
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});
```

### 2. Seoul Subway Line Colors (from colorUtils.ts)
```tsx
import { getSubwayLineColor } from '@utils/colorUtils';

const lineColor = getSubwayLineColor('1호선'); // Returns official color
```

### 3. Responsive Design
```tsx
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const isSmallDevice = width < 375;
```

## Navigation Pattern

```tsx
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const Component: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const handleNavigate = () => {
    navigation.navigate('ScreenName', {
      param1: 'value',
    });
  };

  return <Button onPress={handleNavigate} />;
};
```

## Performance Optimization

### 1. Use React.memo for Expensive Components
```tsx
export const ExpensiveComponent = memo(({ data }) => {
  return <View>{/* Render logic */}</View>;
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.data === nextProps.data;
});
```

### 2. useCallback for Event Handlers
```tsx
const handlePress = useCallback(() => {
  // Handler logic
}, [dependencies]);
```

### 3. useMemo for Expensive Calculations
```tsx
const processedData = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);
```

### 4. FlatList for Long Lists
```tsx
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemComponent item={item} />}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  removeClippedSubviews
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

## Error Handling

```tsx
import { ErrorBoundary } from '@components/common/ErrorBoundary';

export const Screen: React.FC = () => {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      {/* Screen content */}
    </ErrorBoundary>
  );
};
```

## Accessibility Requirements

```tsx
<TouchableOpacity
  accessible
  accessibilityLabel="지하철 1호선 선택"
  accessibilityHint="터치하면 1호선 역 목록을 표시합니다"
  accessibilityRole="button"
  onPress={handlePress}
>
  <Text>1호선</Text>
</TouchableOpacity>
```

## Testing Pattern

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';

describe('Component', () => {
  it('should render correctly', () => {
    const { getByText } = render(<Component title="Test" />);
    expect(getByText('Test')).toBeTruthy();
  });

  it('should handle press events', async () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Component onPress={onPress} />);

    fireEvent.press(getByRole('button'));
    await waitFor(() => {
      expect(onPress).toHaveBeenCalled();
    });
  });
});
```

## Import Order

```tsx
// 1. External libraries
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

// 2. Internal modules (use path aliases)
import { useRealtimeTrains } from '@hooks/useRealtimeTrains';
import { TrainCard } from '@components/train/TrainCard';

// 3. Types
import type { Train } from '@models/train';

// 4. Styles
import { styles } from './Component.styles';
```

## Common Patterns in LiveMetro

### 1. Real-time Data Subscription
```tsx
const { trains, loading, error, refetch } = useRealtimeTrains(
  stationName,
  { refetchInterval: 30000 }
);
```

### 2. Location-based Features
```tsx
const { location, error } = useLocation();
const nearbyStations = useNearbyStations(location);
```

### 3. Notification Handling
```tsx
const { sendNotification } = useNotifications();

await sendNotification({
  title: '지연 알림',
  body: `${stationName} ${lineName} 지연`,
});
```

## Remember

- ✅ Always use TypeScript strict mode
- ✅ Extract business logic into custom hooks
- ✅ Use Seoul subway line colors from colorUtils
- ✅ Implement proper error boundaries
- ✅ Add accessibility labels
- ✅ Optimize FlatList with getItemLayout
- ✅ Use React.memo for expensive components
- ✅ Follow the 3-tier data architecture (API → Firebase → AsyncStorage)

## Additional Resources

- Project architecture: [vooster-docs/architecture.md](../../vooster-docs/architecture.md)
- Clean code guidelines: [vooster-docs/clean-code.md](../../vooster-docs/clean-code.md)
- Custom hooks: [src/hooks/](../../src/hooks/)
