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
import { X, Search } from 'lucide-react-native';
import { useTheme } from '@/services/theme';
import { WANTED_TOKENS, weightToFontFamily, type WantedSemanticTheme } from '@/styles/modernTheme';
import { trainService } from '@/services/train/trainService';

interface StationLite {
  id: string;
  name: string;
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
    let cancelled = false;
    if (query.trim().length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    trainService
      .searchStations(query.trim())
      .then((res) => {
        if (cancelled) return;
        const lite: StationLite[] = res.map((s) => ({ id: s.id, name: s.name }));
        setResults(lite);
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return (): void => {
      cancelled = true;
    };
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
      <View style={styles.container} testID="station-picker-modal">
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
              <Text style={styles.resultText}>{item.name}</Text>
            </Pressable>
          )}
        />
      </View>
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
