import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

/**
 * Basswala User App - API Service
 * Connects to the captain backend for browsing DJs, equipment, and creating bookings.
 *
 * UPDATE THIS URL to your actual backend:
 */
const API_BASE_URL = __DEV__
  ? "https://eternal-viper-hardly.ngrok-free.app/api"
  : "https://eternal-viper-hardly.ngrok-free.app/api";

// ─── TOKEN STORAGE ────────────────────────────────────────────────────────────
const TOKEN_KEY = 'user_jwt_token';
const USER_KEY  = 'user_data';

export const tokenStorage = {
  async save(token: string)     { await SecureStore.setItemAsync(TOKEN_KEY, token); },
  async get(): Promise<string | null> { return SecureStore.getItemAsync(TOKEN_KEY); },
  async clear()                 { await SecureStore.deleteItemAsync(TOKEN_KEY); },
  async saveUser(user: any)     { await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)); },
  async getUser(): Promise<any> {
    const s = await SecureStore.getItemAsync(USER_KEY);
    return s ? JSON.parse(s) : null;
  },
  async clearAll() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },
};

// ─── AXIOS INSTANCE ───────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.get();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const authApi = {
  async login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    return res.data; // { success, token, user }
  },

  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }) {
    const res = await api.post('/auth/register', { ...data, role: 'user' });
    return res.data;
  },

  async getMe() {
    const res = await api.get('/auth/me');
    return res.data;
  },

  async firebaseLogin(idToken: string) {
    const res = await api.post('/auth/firebase-login', { idToken });
    return res.data;
  },
};

// ─── SERVICES — PUBLIC BROWSE ─────────────────────────────────────────────────
// These hit /api/services/* which is the public-facing captain service API

export const servicesApi = {
  /** Browse all verified captains */
  async getCaptains(params?: { city?: string }) {
    const res = await api.get('/services/captains', { params });
    return res.data; // { success, count, data: Captain[] }
  },

  /** Nearby captains by lat/lng */
  async getNearbyCaptains(params: {
    latitude: number;
    longitude: number;
    maxDistance?: number;
  }) {
    const res = await api.get('/services/captains/nearby', { params });
    return res.data;
  },

  /** All available DJs across all captains */
  async getAllDJs(params?: {
    genre?: string;
    city?: string;
    minRate?: number;
    maxRate?: number;
    search?: string;
  }) {
    const res = await api.get('/services/djs', { params });
    return res.data; // { success, count, data: CaptainDJ[] }
  },

  /** DJs of a specific captain */
  async getCaptainDJs(captainId: number, params?: {
    genre?: string;
    minRate?: number;
    maxRate?: number;
  }) {
    const res = await api.get(`/services/captains/${captainId}/djs`, { params });
    return res.data;
  },

  /** All available equipment across all captains */
  async getAllEquipment(params?: {
    category?: string;
    city?: string;
    minRate?: number;
    maxRate?: number;
    search?: string;
  }) {
    const res = await api.get('/services/equipment', { params });
    return res.data;
  },

  /** Equipment of a specific captain */
  async getCaptainEquipment(captainId: number, params?: { category?: string }) {
    const res = await api.get(`/services/captains/${captainId}/equipment`, { params });
    return res.data;
  },
};

// ─── BOOKINGS — AUTHENTICATED USER ───────────────────────────────────────────
export const bookingApi = {
  /**
   * Create a booking for a captain's DJ and/or equipment.
   * This is what the user submits → captain sees it in their dashboard.
   */
  async create(data: {
    captainId: number;
    captainDJId?: number;
    equipmentItems?: { equipmentId: number; quantity: number; days: number }[];
    eventType: string;
    eventDate: string;       // ISO string e.g. "2026-04-10"
    startTime: string;       // "18:00"
    endTime: string;         // "23:00"
    durationHours: number;
    guestCount?: number;
    specialRequests?: string;
    deliveryLocation: {
      latitude: number;
      longitude: number;
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  }) {
    const res = await api.post('/services/bookings', data);
    return res.data;
  },

  /** Get all bookings for the logged-in user */
  async getMyBookings(params?: { status?: string; page?: number; limit?: number }) {
    const res = await api.get('/services/bookings/my', { params });
    return res.data;
  },

  /** Get single booking detail */
  async getById(id: number) {
    const res = await api.get(`/services/bookings/${id}`);
    return res.data;
  },

  /** Cancel a booking */
  async cancel(id: number) {
    const res = await api.delete(`/services/bookings/${id}`);
    return res.data;
  },

  /** Submit a review after completion */
  async addReview(id: number, data: { rating: number; review?: string }) {
    const res = await api.put(`/services/bookings/${id}/review`, data);
    return res.data;
  },

  EVENT_TYPES: [
    'Wedding', 'Birthday', 'Corporate', 'Club',
    'Private Party', 'Festival', 'School Event', 'Other',
  ] as const,
};

// ─── USER PROFILE ─────────────────────────────────────────────────────────────
export const userApi = {
  async getProfile() {
    const res = await api.get('/users/profile');
    return res.data;
  },

  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    profilePicture?: string;
  }) {
    const res = await api.put('/users/profile', data);
    return res.data;
  },

  async getMyBookings(params?: { status?: string; page?: number; limit?: number }) {
    const res = await api.get('/users/bookings', { params });
    return res.data;
  },

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    const res = await api.put('/users/change-password', data);
    return res.data;
  },
};

export default api;