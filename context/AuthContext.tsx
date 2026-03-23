/**
 * context/AuthContext.tsx
 *
 * Supports two login flows:
 *   1. OTP login  — loginWithOTP(phone)  → verifyOTP(otp)
 *                   Firebase sends the OTP; backend validates Firebase token
 *                   and returns a JWT.
 *   2. Password   — login(email, password) (unchanged, for DJs / admins)
 *
 * New exports: loginWithOTP, verifyOTP, otpPending
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiService } from "../services/api";
import { secureStorage } from "../services/secureStorage";
import { firebaseOTP } from "../services/firebase";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface User {
  id: string | number;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  avatar?: string;
  profilePicture?: string;
  role?: "user" | "dj" | "admin";
  dateOfBirth?: string;
  isActive?: boolean;
  isVerified?: boolean;
  isEmailVerified?: boolean;
  lastLogin?: string;
  preferences?: any;
  createdAt?: string;
  updatedAt?: string;
  locationCity?: string;
  locationState?: string;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  dateOfBirth?: string;
  role?: "user" | "dj" | "admin";
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  otpPending: boolean;

  /** OTP login step 1 — sends SMS via Firebase */
  loginWithOTP: (phone: string) => Promise<void>;
  /** OTP login step 2 — verifies OTP and exchanges Firebase token for app JWT */
  verifyOTP: (otp: string) => Promise<void>;
  /** Resend OTP to the same phone number */
  resendOTP: () => Promise<void>;
  /** Classic email/password login (DJs, admins) */
  login: (emailOrPhone: string, password: string) => Promise<void>;
  /** Register new user */
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user,       setUser]       = useState<User | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [otpPending, setOtpPending] = useState(false);
  const [_otpPhone,  _setOtpPhone]  = useState("");

  useEffect(() => { checkAuthStatus(); }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await secureStorage.getAccessToken();
      if (token) {
        const userData = await apiService.getMe();
        const userObj  = userData.data ?? userData;
        setUser(normaliseUser(userObj));
      }
    } catch {
      await secureStorage.clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await apiService.getMe();
      const userObj  = userData.data ?? userData;
      setUser(normaliseUser(userObj));
    } catch (err) {
      console.error("refreshUser failed", err);
    }
  };

  // ── OTP login step 1 ──────────────────────────────────────────────────────
  const loginWithOTP = async (phone: string) => {
    await firebaseOTP.sendOTP(phone);
    _setOtpPhone(phone);
    setOtpPending(true);
  };

  // ── OTP login step 2 ──────────────────────────────────────────────────────
  const verifyOTP = async (otp: string) => {
    const { uid, phone } = await firebaseOTP.verifyOTP(otp);

    // Exchange Firebase UID + token for your app's JWT
    const idToken = await firebaseOTP.getIdToken();
    if (!idToken) throw new Error("Could not get Firebase ID token.");

    const response = await apiService.loginWithFirebase({ idToken, uid, phone });

    const { token, accessToken, user } = response;
    const finalToken = accessToken ?? token;
    if (!finalToken) throw new Error("No token returned from server.");
    if (!user)       throw new Error("No user data returned from server.");

    await secureStorage.saveTokens(finalToken, finalToken);
    await secureStorage.saveUserData(String(user.id), user.email ?? "");

    setUser(normaliseUser(user));
    setOtpPending(false);
    _setOtpPhone("");
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const resendOTP = async () => {
    if (!_otpPhone) throw new Error("No phone number to resend OTP to.");
    await firebaseOTP.sendOTP(_otpPhone);
  };

  // ── Password login ────────────────────────────────────────────────────────
  const login = async (identifier: string, password: string) => {
    const payload = identifier.includes("@")
      ? { email: identifier, password }
      : { phone: identifier, password };
    const response = await apiService.login(payload);

    const { token, accessToken, refreshToken, user } = response;
    const finalAccess  = accessToken ?? token;
    const finalRefresh = refreshToken ?? token;

    if (!finalAccess || typeof finalAccess !== "string") throw new Error("Invalid token from server.");
    if (!user || !user.id) throw new Error("Invalid user data from server.");

    await secureStorage.saveTokens(finalAccess, finalRefresh);
    await secureStorage.saveUserData(String(user.id), user.email ?? "");
    setUser(normaliseUser(user));
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const register = async (data: RegisterData) => {
    const response = await apiService.register({
      firstName:   data.firstName.trim(),
      lastName:    data.lastName.trim(),
      email:       data.email.trim().toLowerCase(),
      phone:       data.phone.trim(),
      password:    data.password,
      dateOfBirth: data.dateOfBirth?.trim() || undefined,
      role:        data.role ?? "user",
    });

    const { token, user } = response;
    if (!token || !user?.id) throw new Error("Registration failed.");

    await secureStorage.saveTokens(token, token);
    await secureStorage.saveUserData(String(user.id), user.email ?? "");
    setUser(normaliseUser(user));
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    try { await apiService.logout(); } catch {}
    try { await firebaseOTP.signOut(); } catch {}
    await secureStorage.clearAuth();
    setUser(null);
    setOtpPending(false);
  };

  const resetPassword = async (email: string) => {
    await apiService.resetPassword(email);
  };

  return (
    <AuthContext.Provider value={{
      user, isLoading, isAuthenticated: !!user, otpPending,
      loginWithOTP, verifyOTP, resendOTP,
      login, register, logout, resetPassword, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function normaliseUser(u: any): User {
  return {
    ...u,
    name: u.name ?? (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : undefined),
    id:   String(u.id ?? ""),
  };
}