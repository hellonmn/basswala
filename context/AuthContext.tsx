import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authApi, tokenStorage } from '../services/userApi';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  profilePicture?: string;
  locationCity?: string;
  isVerified: boolean;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithOTP: (phone: string) => Promise<void>;
  verifyOTP: (otp: string) => Promise<void>;
  resendOTP: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hold the Firebase confirmation result between loginWithOTP and verifyOTP
  const confirmationRef = useRef<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const pendingPhoneRef = useRef<string>('');

  useEffect(() => { checkAuthStatus(); }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await tokenStorage.get();
      if (token) {
        const cached = await tokenStorage.getUser();
        if (cached) setUser(cached);
        const res = await authApi.getMe();
        if (res.success && res.data) {
          setUser(res.data);
          await tokenStorage.saveUser(res.data);
        }
      }
    } catch {
      await tokenStorage.clearAll();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Email + password (DJ / admin fallback) ──────────────────────────────
  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    if (!res.success) throw new Error(res.message || 'Login failed');
    await tokenStorage.save(res.token);
    await tokenStorage.saveUser(res.user);
    setUser(res.user);
  };

  // ── OTP step 1: send SMS via Firebase ───────────────────────────────────
  const loginWithOTP = async (phone: string) => {
    // Firebase expects E.164 format: +91XXXXXXXXXX
    const e164 = `+91${phone}`;
    const confirmation = await auth().signInWithPhoneNumber(e164);
    confirmationRef.current = confirmation;
    pendingPhoneRef.current = phone;
  };

  // ── OTP step 2: confirm code → exchange Firebase token for app JWT ───────
  const verifyOTP = async (otp: string) => {
    if (!confirmationRef.current) {
      throw new Error('No OTP session found. Please request a new code.');
    }
    // Confirm with Firebase — throws if code is wrong
    const credential = await confirmationRef.current.confirm(otp);
    if (!credential?.user) throw new Error('Verification failed.');

    // Get Firebase ID token and exchange it for your backend JWT
    const idToken = await credential.user.getIdToken();
    const res = await authApi.firebaseLogin(idToken);
    if (!res.success) throw new Error(res.message || 'Login failed');

    await tokenStorage.save(res.token);
    await tokenStorage.saveUser(res.user);
    setUser(res.user);
    confirmationRef.current = null;
  };

  // ── OTP resend: re-trigger Firebase SMS ─────────────────────────────────
  const resendOTP = async () => {
    if (!pendingPhoneRef.current) {
      throw new Error('No phone number on record. Please start over.');
    }
    const e164 = `+91${pendingPhoneRef.current}`;
    const confirmation = await auth().signInWithPhoneNumber(e164);
    confirmationRef.current = confirmation;
  };

  const register = async (email: string, password: string, name: string) => {
    const parts = name.trim().split(' ');
    const firstName = parts[0] || name;
    const lastName = parts.slice(1).join(' ') || parts[0] || 'User';
    const res = await authApi.register({ firstName, lastName, email, phone: '0000000000', password });
    if (!res.success) throw new Error(res.message || 'Registration failed');
    await tokenStorage.save(res.token);
    await tokenStorage.saveUser(res.user);
    setUser(res.user);
  };

  const logout = async () => {
    await auth().signOut().catch(() => {}); // also sign out of Firebase
    await tokenStorage.clearAll();
    setUser(null);
    confirmationRef.current = null;
  };

  const resetPassword = async (_email: string) => {
    throw new Error('Password reset is not available yet. Please contact support.');
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.data) {
        setUser(res.data);
        await tokenStorage.saveUser(res.data);
      }
    } catch { /* silent */ }
  };

  return (
    <AuthContext.Provider value={{
      user, isLoading, isAuthenticated: !!user,
      login, loginWithOTP, verifyOTP, resendOTP,
      register, logout, resetPassword, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};