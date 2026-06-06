/**
 * Line favorite picker: shows one chip per resolvable line at a transfer
 * station. Tapping a chip toggles local selection (no immediate write); the
 * save button applies the add/remove diff in one batch.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  LineFavoriteOption,
  FavoriteDiff,
  computeFavoriteDiff,
} from '@screens/map/lineFavoriteResolver';
import { weightToFontFamily } from '@/styles/modernTheme';

interface LineFavoritePickerProps {
  readonly options: readonly LineFavoriteOption[];
  readonly lineLabel: (lineId: string) => string;
  readonly lineColor: (lineId: string) => string;
  /** Save button background (theme token; e.g. semantic.primaryNormal). */
  readonly saveColor: string;
  /** Text color over colored backgrounds (theme token; e.g. semantic.labelOnColor). */
  readonly onColor: string;
  readonly onSave: (diff: FavoriteDiff) => void;
}

const initialSelected = (options: readonly LineFavoriteOption[]): Set<string> =>
  new Set(options.filter((o) => o.isFavorite).map((o) => o.lineId));

export const LineFavoritePicker: React.FC<LineFavoritePickerProps> = ({
  options,
  lineLabel,
  lineColor,
  saveColor,
  onColor,
  onSave,
}) => {
  const [selected, setSelected] = useState<Set<string>>(() => initialSelected(options));

  const toggle = useCallback((lineId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }, []);

  const diff = useMemo(() => computeFavoriteDiff(options, selected), [options, selected]);
  const dirty = diff.toAdd.length > 0 || diff.toRemove.length > 0;

  const handleSave = useCallback(() => {
    if (!dirty) return;
    onSave(diff);
  }, [dirty, diff, onSave]);

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {options.map((opt) => {
          const isSelected = selected.has(opt.lineId);
          return (
            <TouchableOpacity
              key={opt.lineId}
              testID={`line-chip-${opt.lineId}`}
              onPress={() => toggle(opt.lineId)}
              accessible
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${lineLabel(opt.lineId)} ${isSelected ? '선택됨' : '선택 안 됨'}`}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? lineColor(opt.lineId) : 'transparent',
                  borderColor: lineColor(opt.lineId),
                },
              ]}
            >
              <Text style={[styles.chipText, { color: isSelected ? onColor : lineColor(opt.lineId) }]}>
                {lineLabel(opt.lineId)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        testID="line-favorite-save"
        onPress={handleSave}
        disabled={!dirty}
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: !dirty }}
        accessibilityLabel="선택한 노선 즐겨찾기 저장"
        style={[styles.saveButton, { backgroundColor: saveColor }, !dirty && styles.saveButtonDisabled]}
      >
        <Text style={[styles.saveButtonText, { color: onColor }]}>즐겨찾기 저장</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 15, fontWeight: '600', fontFamily: weightToFontFamily('600') },
  saveButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { fontSize: 16, fontWeight: '600', fontFamily: weightToFontFamily('600') },
});
