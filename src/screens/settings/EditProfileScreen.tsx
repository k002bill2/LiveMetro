/**
 * Edit Profile Screen
 * Allows users to edit their profile information and change password.
 *
 * Phase 47 — migrated from legacy COLORS/SPACING/RADIUS/TYPOGRAPHY API
 * to Wanted Design System tokens. Two-tone CTA hierarchy: primary
 * "프로필 저장" → blue[500] solid, secondary "비밀번호 변경" → outlined
 * semantic.labelStrong (adapts to dark mode).
 */

import React, { useCallback, useMemo, useState } from 'react';
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
import { Eye, EyeOff, Lock, User } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '@/services/auth/AuthContext';
import { useTheme } from '@/services/theme';
import {
  WANTED_TOKENS,
  weightToFontFamily,
  type WantedSemanticTheme,
} from '@/styles/modernTheme';
import { SettingsStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'EditProfile'>;

export const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, updateUserProfile, changePassword } = useAuth();
  const { isDark } = useTheme();
  const semantic = isDark ? WANTED_TOKENS.dark : WANTED_TOKENS.light;
  const styles = useMemo(() => createStyles(semantic), [semantic]);

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
              <User size={48} color={semantic.labelStrong} strokeWidth={2} />
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
                placeholderTextColor={semantic.labelAlt}
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
                <Lock size={16} color={semantic.labelAlt} strokeWidth={2} />
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
                <ActivityIndicator color="#FFFFFF" size="small" />
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
                    placeholderTextColor={semantic.labelAlt}
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isPasswordLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff size={20} color={semantic.labelAlt} strokeWidth={2} />
                    ) : (
                      <Eye size={20} color={semantic.labelAlt} strokeWidth={2} />
                    )}
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
                    placeholderTextColor={semantic.labelAlt}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isPasswordLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff size={20} color={semantic.labelAlt} strokeWidth={2} />
                    ) : (
                      <Eye size={20} color={semantic.labelAlt} strokeWidth={2} />
                    )}
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
                    placeholderTextColor={semantic.labelAlt}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isPasswordLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color={semantic.labelAlt} strokeWidth={2} />
                    ) : (
                      <Eye size={20} color={semantic.labelAlt} strokeWidth={2} />
                    )}
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
                  <ActivityIndicator color={semantic.labelStrong} size="small" />
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

const createStyles = (semantic: WantedSemanticTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: semantic.bgBase,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingTop: WANTED_TOKENS.spacing.s5,
      paddingBottom: WANTED_TOKENS.spacing.s8,
    },
    profileIconSection: {
      alignItems: 'center',
      marginBottom: WANTED_TOKENS.spacing.s6,
    },
    profileIcon: {
      width: 100,
      height: 100,
      backgroundColor: semantic.bgSubtle,
      borderRadius: WANTED_TOKENS.radius.pill,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: semantic.lineNormal,
    },
    formSection: {
      marginBottom: WANTED_TOKENS.spacing.s6,
      backgroundColor: semantic.bgBase,
      borderRadius: WANTED_TOKENS.radius.r8,
      padding: WANTED_TOKENS.spacing.s4,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
    },
    sectionTitle: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
      marginBottom: WANTED_TOKENS.spacing.s4,
    },
    inputGroup: {
      marginBottom: WANTED_TOKENS.spacing.s4,
    },
    label: {
      fontSize: 13,
      fontFamily: weightToFontFamily('600'),
      color: semantic.labelNeutral,
      marginBottom: WANTED_TOKENS.spacing.s2,
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
      borderRadius: WANTED_TOKENS.radius.r6,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    readOnlyInput: {
      backgroundColor: semantic.bgSubtle,
      borderWidth: 1,
      borderColor: semantic.lineSubtle,
      borderRadius: WANTED_TOKENS.radius.r6,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    readOnlyText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      flex: 1,
    },
    helperText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelAlt,
      marginTop: WANTED_TOKENS.spacing.s1,
    },
    errorText: {
      fontSize: 12,
      fontFamily: weightToFontFamily('500'),
      color: WANTED_TOKENS.status.red500,
      marginTop: WANTED_TOKENS.spacing.s1,
    },
    passwordInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: semantic.bgBase,
      borderWidth: 1,
      borderColor: semantic.lineNormal,
      borderRadius: WANTED_TOKENS.radius.r6,
    },
    passwordInput: {
      flex: 1,
      paddingHorizontal: WANTED_TOKENS.spacing.s4,
      paddingVertical: WANTED_TOKENS.spacing.s3,
      fontSize: 14,
      fontFamily: weightToFontFamily('500'),
      color: semantic.labelStrong,
    },
    eyeButton: {
      paddingHorizontal: WANTED_TOKENS.spacing.s3,
      paddingVertical: WANTED_TOKENS.spacing.s3,
    },
    saveButton: {
      backgroundColor: WANTED_TOKENS.blue[500],
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r6,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
      marginTop: WANTED_TOKENS.spacing.s2,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
      color: '#FFFFFF',
    },
    changePasswordButton: {
      backgroundColor: semantic.bgBase,
      paddingVertical: WANTED_TOKENS.spacing.s4,
      borderRadius: WANTED_TOKENS.radius.r6,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
      marginTop: WANTED_TOKENS.spacing.s2,
      borderWidth: 1,
      borderColor: semantic.labelStrong,
    },
    changePasswordButtonText: {
      fontSize: 14,
      fontFamily: weightToFontFamily('700'),
      color: semantic.labelStrong,
    },
  });

export default EditProfileScreen;
