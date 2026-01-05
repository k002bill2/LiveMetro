/**
 * Favorite Edit Form Component
 * Expandable inline form for editing favorite station properties
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { ArrowUp, ArrowDown, ArrowUpDown, Briefcase, Check } from 'lucide-react-native';
import { SPACING, RADIUS, TYPOGRAPHY } from '../../styles/modernTheme';
import { useTheme, ThemeColors } from '../../services/theme';
import { FavoriteWithDetails } from '../../hooks/useFavorites';

interface FavoriteEditFormProps {
  favorite: FavoriteWithDetails;
  isExpanded: boolean;
  onSave: (updates: {
    alias?: string | null;
    direction?: 'up' | 'down' | 'both';
    isCommuteStation?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}

export const FavoriteEditForm: React.FC<FavoriteEditFormProps> = ({
  favorite,
  isExpanded,
  onSave,
  onCancel,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  // Form state
  const [alias, setAlias] = useState(favorite.alias || '');
  const [direction, setDirection] = useState<'up' | 'down' | 'both'>(favorite.direction);
  const [isCommute, setIsCommute] = useState(favorite.isCommuteStation);
  const [saving, setSaving] = useState(false);

  // Animation
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  /**
   * Animate expand/collapse
   */
  useEffect(() => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 300,
        useNativeDriver: false, // height/maxHeight requires non-native driver
      }),
      Animated.timing(opacityAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 300,
        useNativeDriver: false, // Must match heightAnim to avoid parentNode error
      }),
    ]).start();
  }, [isExpanded, heightAnim, opacityAnim]);

  /**
   * Reset form when favorite changes
   */
  useEffect(() => {
    setAlias(favorite.alias || '');
    setDirection(favorite.direction);
    setIsCommute(favorite.isCommuteStation);
  }, [favorite]);

  /**
   * Handle save with validation
   */
  const handleSave = async () => {
    setSaving(true);
    try {
      const trimmedAlias = alias.trim();
      const updates = {
        alias: trimmedAlias.length > 0 ? trimmedAlias : null,
        direction,
        isCommuteStation: isCommute,
      };

      await onSave(updates);
    } catch {
      // Error saving favorite
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    // Reset to original values
    setAlias(favorite.alias || '');
    setDirection(favorite.direction);
    setIsCommute(favorite.isCommuteStation);
    onCancel();
  };

  const maxHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 350], // Approximate max height
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          maxHeight,
          opacity: opacityAnim,
        },
      ]}
      pointerEvents={isExpanded ? 'auto' : 'none'}
    >
      <View style={styles.content}>
        {/* Alias Input */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>별칭 (선택사항)</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 집, 회사, 학교"
            placeholderTextColor={colors.textTertiary}
            value={alias}
            onChangeText={setAlias}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.helperText}>{alias.length}/20</Text>
        </View>

        {/* Direction Selector */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>방향</Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segment,
                styles.segmentLeft,
                direction === 'up' && styles.segmentActive,
              ]}
              onPress={() => setDirection('up')}
            >
              <ArrowUp
                size={16}
                color={direction === 'up' ? colors.textInverse : colors.textSecondary}
              />
              <Text
                style={[
                  styles.segmentText,
                  direction === 'up' && styles.segmentTextActive,
                ]}
              >
                상행
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segment,
                styles.segmentMiddle,
                direction === 'both' && styles.segmentActive,
              ]}
              onPress={() => setDirection('both')}
            >
              <ArrowUpDown
                size={16}
                color={direction === 'both' ? colors.textInverse : colors.textSecondary}
              />
              <Text
                style={[
                  styles.segmentText,
                  direction === 'both' && styles.segmentTextActive,
                ]}
              >
                양방향
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segment,
                styles.segmentRight,
                direction === 'down' && styles.segmentActive,
              ]}
              onPress={() => setDirection('down')}
            >
              <ArrowDown
                size={16}
                color={direction === 'down' ? colors.textInverse : colors.textSecondary}
              />
              <Text
                style={[
                  styles.segmentText,
                  direction === 'down' && styles.segmentTextActive,
                ]}
              >
                하행
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Commute Toggle */}
        <View style={styles.formGroup}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Briefcase size={20} color={colors.textPrimary} />
              <Text style={styles.label}>출퇴근 역으로 설정</Text>
            </View>
            <Switch
              value={isCommute}
              onValueChange={setIsCommute}
              trackColor={{ false: colors.borderLight, true: colors.textPrimary }}
              thumbColor={colors.surface}
            />
          </View>
          <Text style={styles.helperText}>
            출퇴근 역으로 설정하면 알림 설정에서 활용할 수 있습니다
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>취소</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <>
                <Check size={20} color={colors.textInverse} />
                <Text style={styles.saveButtonText}>저장</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    overflow: 'hidden',
    marginTop: SPACING.sm,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  formGroup: {
    gap: SPACING.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: colors.textPrimary,
  },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: RADIUS.base,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: colors.textPrimary,
  },
  helperText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: colors.textTertiary,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: RADIUS.base,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: SPACING.sm,
    backgroundColor: colors.backgroundSecondary,
  },
  segmentLeft: {
    borderRightWidth: 1,
    borderRightColor: colors.borderMedium,
  },
  segmentMiddle: {
    borderRightWidth: 1,
    borderRightColor: colors.borderMedium,
  },
  segmentRight: {},
  segmentActive: {
    backgroundColor: colors.textPrimary,
  },
  segmentText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.textInverse,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: RADIUS.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    backgroundColor: colors.textPrimary,
    borderRadius: RADIUS.base,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: colors.textInverse,
  },
});
