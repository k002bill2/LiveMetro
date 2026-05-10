import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { X, Search } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { searchGraphStations } from '@/utils/subwayMapData';
import { LineBadge } from '@/components/design/LineBadge';

interface StationLite {
  id: string;
  name: string;
  lineId?: string;
}

interface Props {
  visible: boolean;
  initialQuery?: string;
  onClose: () => void;
  onSelect: (station: StationLite) => void;
  /** This phase: parent passes empty array; persistence is out of scope (see spec §2). */
  recentStations?: ReadonlyArray<StationLite>;
}

export const StationPickerModal: React.FC<Props> = ({
  visible,
  initialQuery = '',
  onClose,
  onSelect,
  recentStations = [],
}) => {
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = createStyles(semantic);

  const [query, setQuery] = useState<string>(initialQuery);
  const [results, setResults] = useState<StationLite[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!visible) {
      setQuery(initialQuery);
      setResults([]);
    }
  }, [visible, initialQuery]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }
    // Search the routing graph (stations.json slug ids), not Firestore or
    // seoulStations.json. routeService.getDiverseRoutes consumes graph slug
    // ids — using any other id source breaks route lookup. Synchronous, so
    // no debounce or SWR is needed.
    const found = searchGraphStations(trimmed);
    setResults(
      found.map((s) => ({ id: s.id, name: s.name, lineId: s.lines[0] }))
    );
    setLoading(false);
  }, [query]);

  const handleSelect = useCallback(
    (station: StationLite): void => {
      onSelect(station);
    },
    [onSelect]
  );

  const displayList = query.trim().length === 0 ? recentStations : results;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Inner SafeAreaProvider is intentional: iOS Modal mounts a new UIWindow
          that breaks native inset propagation from the root provider. Each
          provider measures its own native frame independently, so this does
          not double-count padding. */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']} testID="station-picker-modal">
          <View style={styles.header}>
          <View style={styles.searchBox}>
            <Search size={18} color={semantic.labelAlt} strokeWidth={1.7} />
            <TextInput
              style={styles.input}
              placeholder="역 이름을 입력하세요"
              placeholderTextColor={semantic.labelAlt}
              value={query}
              onChangeText={setQuery}
              testID="station-picker-search-input"
              autoFocus
            />
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            testID="station-picker-close"
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <X size={24} color={semantic.labelStrong} />
          </Pressable>
        </View>

        {loading && <ActivityIndicator style={styles.loader} color={semantic.primaryNormal} />}

        <FlatList
          data={displayList as StationLite[]}
          keyExtractor={(item): string => item.id}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {query.trim().length === 0 ? '최근 검색이 없습니다' : '검색 결과가 없습니다'}
              </Text>
            ) : null
          }
          renderItem={({ item }): React.ReactElement => (
            <Pressable
              onPress={(): void => handleSelect(item)}
              style={styles.resultRow}
              accessibilityRole="button"
              accessibilityLabel={`${item.name} 선택`}
            >
              {item.lineId ? <LineBadge line={item.lineId} size={22} /> : null}
              <Text style={styles.resultText}>{item.name}</Text>
            </Pressable>
          )}
        />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};

StationPickerModal.displayName = 'StationPickerModal';

const createStyles = (semantic: WantedSemanticTheme): ReturnType<typeof StyleSheet.create> =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgSubtlePage,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderBottomWidth: 1,
      borderBottomColor: semantic.lineSubtle,
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s2,
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r4,
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s2,
    },
    input: {
      flex: 1,
      fontSize: WANTED_TOKENS.type.body1.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    loader: {
      marginTop: WANTED_TOKENS.spacing.s4,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: WANTED_TOKENS.spacing.s3,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: semantic.lineSubtle,
    },
    resultText: {
      fontSize: WANTED_TOKENS.type.body1.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    empty: {
      textAlign: 'center',
      marginTop: WANTED_TOKENS.spacing.s8,
      fontSize: WANTED_TOKENS.type.body2.size,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
    },
  });
