# Common Patterns - LiveMetro

React Native + Expo + Firebase 패턴 모음.

## 1. 컴포넌트 패턴

```tsx
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  title: string;
  subtitle?: string;
}

export const StationCard: React.FC<Props> = memo(({ title, subtitle }) => (
  <View style={styles.container} accessibilityLabel={`${title} 역`}>
    <Text style={styles.title}>{title}</Text>
    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
  </View>
));

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 8, backgroundColor: '#fff' },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#757575', marginTop: 4 },
});
```

## 2. 훅 패턴

### 데이터 페칭 + Cleanup
```tsx
export function useRealtimeArrivals(stationId: string): ArrivalInfo[] {
  const [arrivals, setArrivals] = useState<ArrivalInfo[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchData = async (): Promise<void> => {
      const data = await seoulSubwayApi.getRealtimeArrivals(stationId);
      if (mounted) setArrivals(data);
    };
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30초 폴링
    return () => { mounted = false; clearInterval(interval); };
  }, [stationId]);

  return arrivals;
}
```

## 3. 서비스 패턴

```tsx
class StationService {
  async getStation(stationId: string): Promise<Station | null> {
    try {
      const cached = await AsyncStorage.getItem(`station_${stationId}`);
      if (cached) return JSON.parse(cached);
      const doc = await getDoc(doc(db, 'stations', stationId));
      return doc.exists() ? (doc.data() as Station) : null;
    } catch {
      return null;
    }
  }
}
export const stationService = new StationService();
```

## 4. 에러 처리

```tsx
try {
  const data = await fetchData();
  return data;
} catch (error) {
  // 빈 배열/null 반환 (throw 금지)
  return [];
}
```

## 5. 네비게이션

```tsx
// 타입 안전 네비게이션
navigation.navigate('StationDetail', { stationId: '0150' });
```
