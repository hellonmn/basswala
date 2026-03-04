import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';
import { secureStorage } from '../services/secureStorage';

interface User {
  id: string | number;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  profilePicture?: string;
  role?: 'user' | 'dj' | 'admin';
  dateOfBirth?: string;
  isActive?: boolean;
  isVerified?: boolean;
  lastLogin?: string;
  preferences?: any;
  createdAt?: string;
  updatedAt?: string;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  dateOfBirth?: string;
  role?: 'user' | 'dj' | 'admin';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await secureStorage.getAccessToken();
      if (token) {
        const userData = await apiService.getMe();
        // Handle both { data: user } and direct user response
        const userObj = userData.data || userData;
        setUser(userObj);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await secureStorage.clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (identifier: string, password: string) => {
    try {
      const payload = identifier.includes('@')
        ? { email: identifier, password }
        : { phone: identifier, password };

      const response = await apiService.login(payload);

      console.log('Login response:', response);

      // Backend returns { success: true, token: "...", user: {...} }
      // Similar to registration endpoint
      const { token, accessToken, refreshToken, user } = response;

      // Use token if accessToken not present (backend returns single token)
      const finalAccessToken = accessToken || token;
      const finalRefreshToken = refreshToken || token;

      console.log('Login tokens:', { finalAccessToken, finalRefreshToken });
      console.log('Login user:', user);

      if (!finalAccessToken || typeof finalAccessToken !== 'string') {
        throw new Error('Invalid or missing access token from server');
      }

      if (!user || typeof user !== 'object') {
        throw new Error('Invalid or missing user data from server');
      }

      if (user.id === undefined || user.id === null) {
        throw new Error('User ID is missing from login response');
      }

      if (!user.email || typeof user.email !== 'string') {
        throw new Error('User email is missing or invalid from login response');
      }

      await secureStorage.saveTokens(finalAccessToken, finalRefreshToken);
      // Convert ID to string for storage
      await secureStorage.saveUserData(String(user.id), user.email);

      setUser(user);
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || error.response?.data?.message || 'Login failed');
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await apiService.register({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        password: data.password,
        dateOfBirth: data.dateOfBirth?.trim() || undefined,
        role: data.role || 'user',
      });

      console.log('Register API response:', response);
      
      // Backend returns { success: true, token: "...", user: {...} }
      const { token, user } = response;

      console.log('Register response tokens:', { token });
      console.log('Register response user:', user);

      // Validate token
      if (!token || typeof token !== 'string') {
        throw new Error('Missing or invalid access token from registration');
      }

      // Validate user object
      if (!user || typeof user !== 'object') {
        throw new Error('Missing or invalid user data from registration');
      }

      // Check user.id exists (can be number or string)
      if (user.id === undefined || user.id === null) {
        throw new Error('User ID is missing from registration response');
      }

      // Check email exists
      if (!user.email || typeof user.email !== 'string') {
        throw new Error('User email is missing or invalid from registration response');
      }

      // Save tokens (using token as both access and refresh since backend only returns one)
      await secureStorage.saveTokens(token, token);
      
      // Convert ID to string for storage
      await secureStorage.saveUserData(String(user.id), user.email);

      setUser(user);
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(
        error.message ||
          error.response?.data?.message ||
          'Registration failed – please check your details'
      );
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await secureStorage.clearAuth();
      setUser(null);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await apiService.resetPassword(email);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Password reset failed');
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};