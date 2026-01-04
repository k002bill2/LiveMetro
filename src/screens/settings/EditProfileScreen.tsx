/**
 * Edit Profile Screen
 * Allows users to edit their profile information and change password
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '@/services/auth/AuthContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/styles/modernTheme';
import { SettingsStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'EditProfile'>;

export const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, updateUserProfile, changePassword } = useAuth();

  // Profile state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isLoading, setIsLoading] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSave = useCallback(async (): Promise<void> => {
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      Alert.alert('입력 오류', '이름을 입력해주세요.');
      return;
    }

    if (trimmedName === user?.displayName) {
      navigation.goBack();
      return;
    }

    setIsLoading(true);

    try {
      await updateUserProfile({ displayName: trimmedName });
      Alert.alert('완료', '프로필이 수정되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('오류', '프로필 수정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  }, [displayName, user?.displayName, updateUserProfile, navigation]);

  const handleChangePassword = useCallback(async (): Promise<void> => {
    // Validation
    if (!currentPassword) {
      Alert.alert('입력 오류', '현재 비밀번호를 입력해주세요.');
      return;
    }

    if (!newPassword) {
      Alert.alert('입력 오류', '새 비밀번호를 입력해주세요.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('입력 오류', '새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('입력 오류', '새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('입력 오류', '현재 비밀번호와 다른 비밀번호를 입력해주세요.');
      return;
    }

    setIsPasswordLoading(true);

    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert('완료', '비밀번호가 변경되었습니다.', [
        {
          text: '확인',
          onPress: () => {
            // Clear password fields
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
          },
        },
      ]);
    } catch (error) {
      console.error('Password change error:', error);
      const errorMessage = error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    } finally {
      setIsPasswordLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, changePassword]);

  // Check if user is anonymous (no email)
  const isAnonymousUser = !user?.email || user?.isAnonymous;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Icon */}
          <View style={styles.profileIconSection}>
            <View style={styles.profileIcon}>
              <Ionicons name="person" size={48} color={COLORS.black} />
            </View>
          </View>

          {/* Profile Form Section */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>프로필 정보</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>이름</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="이름을 입력하세요"
                placeholderTextColor={COLORS.gray[400]}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={30}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>이메일</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>
                  {user?.email || '이메일 없음'}
                </Text>
                <Ionicons name="lock-closed" size={16} color={COLORS.gray[400]} />
              </View>
              <Text style={styles.helperText}>
                이메일은 변경할 수 없습니다.
              </Text>
            </View>

            {/* Save Profile Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.saveButtonText}>프로필 저장</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Password Change Section */}
          {!isAnonymousUser && (
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>비밀번호 변경</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>현재 비밀번호</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="현재 비밀번호"
                    placeholderTextColor={COLORS.gray[400]}
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isPasswordLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    <Ionicons
                      name={showCurrentPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={COLORS.gray[400]}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>새 비밀번호</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="새 비밀번호 (6자 이상)"
                    placeholderTextColor={COLORS.gray[400]}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isPasswordLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={COLORS.gray[400]}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>새 비밀번호 확인</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="새 비밀번호 다시 입력"
                    placeholderTextColor={COLORS.gray[400]}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isPasswordLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={COLORS.gray[400]}
                    />
                  </TouchableOpacity>
                </View>
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <Text style={styles.errorText}>
                    비밀번호가 일치하지 않습니다.
                  </Text>
                )}
              </View>

              {/* Change Password Button */}
              <TouchableOpacity
                style={[
                  styles.changePasswordButton,
                  isPasswordLoading && styles.buttonDisabled,
                ]}
                onPress={handleChangePassword}
                disabled={isPasswordLoading}
              >
                {isPasswordLoading ? (
                  <ActivityIndicator color={COLORS.black} size="small" />
                ) : (
                  <Text style={styles.changePasswordButtonText}>비밀번호 변경</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING['3xl'],
  },
  profileIconSection: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
  },
  profileIcon: {
    width: 100,
    height: 100,
    backgroundColor: COLORS.surface.card,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border.medium,
  },
  formSection: {
    marginBottom: SPACING['2xl'],
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
  },
  readOnlyInput: {
    backgroundColor: COLORS.surface.card,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readOnlyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.tertiary,
    flex: 1,
  },
  helperText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.tertiary,
    marginTop: SPACING.xs,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.semantic.error,
    marginTop: SPACING.xs,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    borderRadius: RADIUS.md,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.primary,
  },
  eyeButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  saveButton: {
    backgroundColor: COLORS.black,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: SPACING.sm,
  },
  buttonDisabled: {
    backgroundColor: COLORS.gray[400],
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.white,
  },
  changePasswordButton: {
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.black,
  },
  changePasswordButtonText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.black,
  },
});

export default EditProfileScreen;
