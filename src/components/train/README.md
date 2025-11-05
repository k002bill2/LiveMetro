# Train Components

React Native components for displaying real-time Seoul subway train information.

## Components

### TrainArrivalCard

Enhanced individual train arrival card with Seoul Metro official colors.

**Features:**
- ✅ Seoul subway line official colors
- ✅ Real-time countdown display
- ✅ Delay status indicators
- ✅ Fully accessible (WCAG 2.1 AA)
- ✅ Performance optimized with React.memo
- ✅ TypeScript strict mode compliant

**Usage:**

```tsx
import { TrainArrivalCard } from '@components/train';

<TrainArrivalCard
  train={trainData}
  stationName="강남"
  lineName="2호선"
  onPress={() => handleTrainPress(trainData.id)}
/>
```

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `train` | `Train` | ✅ | Train data object |
| `lineName` | `string` | ❌ | Line name to display (e.g., "2호선") |
| `stationName` | `string` | ❌ | Station name for context |
| `onPress` | `() => void` | ❌ | Press handler (makes card interactive) |
| `style` | `ViewStyle` | ❌ | Custom container style |

**Examples:**

See [TrainArrivalCard.example.tsx](./TrainArrivalCard.example.tsx) for comprehensive usage examples.

---

### TrainArrivalList

Real-time train arrival list with auto-refresh and performance optimizations.

**Features:**
- ✅ Real-time subscription to train updates
- ✅ Pull-to-refresh support
- ✅ FlatList performance optimizations
- ✅ Empty state and loading states
- ✅ Throttled updates (1 second)

**Usage:**

```tsx
import { TrainArrivalList } from '@components/train';

<TrainArrivalList stationId="gangnam" />
```

---

### StationCard

Station information card with transfer lines and distance.

**Usage:**

```tsx
import { StationCard } from '@components/train';

<StationCard station={stationData} />
```

---

## Testing

```bash
# Run tests
npm test src/components/train

# Run with coverage
npm test -- --coverage src/components/train

# Watch mode
npm test -- --watch src/components/train
```

## Development Guidelines

### Component Structure

Follow the standard React Native component template:

```tsx
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ComponentProps {
  /** Prop description */
  prop: string;
}

/**
 * Component description
 * @example
 * <Component prop="value" />
 */
export const Component: React.FC<ComponentProps> = memo(({ prop }) => {
  return (
    <View style={styles.container}>
      <Text>{prop}</Text>
    </View>
  );
});

Component.displayName = 'Component';

const styles = StyleSheet.create({
  container: {
    // styles
  },
});
```

### Performance Guidelines

1. **Use React.memo** for all components
2. **Use useCallback** for event handlers
3. **Use useMemo** for expensive calculations
4. **Implement getItemLayout** for FlatLists
5. **Optimize re-renders** with proper dependencies

### Accessibility Guidelines

All components must include:

- ✅ `accessible={true}`
- ✅ `accessibilityRole` (button, summary, etc.)
- ✅ `accessibilityLabel` (descriptive label)
- ✅ `accessibilityHint` (for interactive elements)

### Seoul Metro Colors

Always use official colors from `colorUtils.ts`:

```tsx
import { getSubwayLineColor, getLineTextColor } from '@utils/colorUtils';

const lineColor = getSubwayLineColor('2'); // Returns #00a84d
const textColor = getLineTextColor('2');    // Returns 'white'
```

### Testing Requirements

Each component must have:

1. **Rendering tests** - Component renders without crashing
2. **Interaction tests** - User interactions work correctly
3. **Accessibility tests** - Proper ARIA attributes
4. **Edge case tests** - Handles missing/null data
5. **Snapshot tests** - Visual regression prevention

---

## Architecture

### Data Flow

```
Seoul Subway API → Firebase Firestore → Local AsyncStorage
                         ↓
                  TrainService
                         ↓
                   Custom Hooks
                         ↓
                React Components
```

### Component Hierarchy

```
TrainArrivalList (List Container)
├── TrainArrivalItem (Individual Item - internal)
└── TrainArrivalCard (New Enhanced Card)
```

---

## Related Documentation

- [Component Guidelines](.claude/skills/react-native-development/SKILL.md)
- [Project Architecture](../../vooster-docs/architecture.md)
- [Clean Code Guidelines](../../vooster-docs/clean-code.md)
- [Color Utilities](../../utils/colorUtils.ts)

---

## Migration Guide

### From TrainArrivalItem to TrainArrivalCard

The new `TrainArrivalCard` is a standalone, reusable component that can be used independently:

**Before:**
```tsx
// TrainArrivalItem was internal to TrainArrivalList
<TrainArrivalList stationId="gangnam" />
```

**After:**
```tsx
// Use TrainArrivalCard directly for custom layouts
{trains.map(train => (
  <TrainArrivalCard
    key={train.id}
    train={train}
    lineName="2호선"
    stationName="강남"
  />
))}
```

**Benefits:**
- ✅ Reusable in different contexts
- ✅ Better Seoul Metro color integration
- ✅ More flexible styling options
- ✅ Enhanced accessibility
- ✅ Cleaner separation of concerns

---

*Last updated: 2025-11-06*
*Follows React Native best practices and Seoul Metro design system*
