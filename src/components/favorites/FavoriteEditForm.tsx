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
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../styles/modernTheme';
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
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
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
    } catch (error) {
      console.error('Error saving favorite:', error);
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

  if (!isExpanded) {
    return null;
  }

  const maxHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 300], // Approximate max height
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
    >
      <View style={styles.content}>
        {/* Alias Input */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>별칭 (선택사항)</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 집, 회사, 학교"
            placeholderTextColor={COLORS.text.tertiary}
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
              <Ionicons
                name="arrow-up"
                size={16}
                color={direction === 'up' ? COLORS.white : COLORS.text.secondary}
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
              <Ionicons
                name="swap-vertical"
                size={16}
                color={direction === 'both' ? COLORS.white : COLORS.text.secondary}
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
              <Ionicons
                name="arrow-down"
                size={16}
                color={direction === 'down' ? COLORS.white : COLORS.text.secondary}
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
              <Ionicons name="briefcase" size={20} color={COLORS.text.primary} />
              <Text style={styles.label}>출퇴근 역으로 설정</Text>
            </View>
            <Switch
              value={isCommute}
              onValueChange={setIsCommute}
              trackColor={{ false: COLORS.gray[300], true: COLORS.black }}
              thumbColor={COLORS.white}
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
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color={COLORS.white} />
                <Text style={styles.saveButtonText}>저장</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    marginTop: SPACING.sm,
  },
  content: {
    backgroundColor: COLORS.surface.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  formGroup: {
    gap: SPACING.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    borderRadius: RADIUS.base,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
  },
  helperText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.border.medium,
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
    backgroundColor: COLORS.white,
  },
  segmentLeft: {
    borderRightWidth: 1,
    borderRightColor: COLORS.border.medium,
  },
  segmentMiddle: {
    borderRightWidth: 1,
    borderRightColor: COLORS.border.medium,
  },
  segmentRight: {},
  segmentActive: {
    backgroundColor: COLORS.black,
  },
  segmentText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
  },
  segmentTextActive: {
    color: COLORS.white,
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
    borderColor: COLORS.border.dark,
    borderRadius: RADIUS.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.base,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.white,
  },
});
