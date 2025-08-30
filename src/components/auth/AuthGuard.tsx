/**
 * Authentication Guard Component
 * Handles authentication state and provides loading states
 */

import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../../services/auth/AuthContext';
import { LoadingScreen } from '../common/LoadingScreen';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  fallback 
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="인증 상태를 확인하고 있습니다..." />;
  }

  if (!user && fallback) {
    return <View>{fallback}</View>;
  }

  return <View>{children}</View>;
};