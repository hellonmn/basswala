/**
 * services/api.ts  — adds loginWithFirebase() for OTP flow.
 * All existing methods are unchanged.
 */

import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import { secureStorage } from "./secureStorage";

const API_BASE_URL = __DEV__
  ? "https://eternal-viper-hardly.ngrok-free.app/api"
  : "https://eternal-viper-hardly.ngrok-free.app/api";

class ApiService {
  private api: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: {
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
  }[] = [];

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
    });
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.api.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await secureStorage.getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then(() => this.api(originalRequest))
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = await secureStorage.getRefreshToken();
            if (!refreshToken) throw new Error("No refresh token available");

            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            });

            const { accessToken, refreshToken: newRefreshToken } = response.data;
            await secureStorage.saveTokens(accessToken, newRefreshToken);

            this.failedQueue.forEach((prom) => prom.resolve());
            this.failedQueue = [];

            return this.api(originalRequest);
          } catch (refreshError) {
            this.failedQueue.forEach((prom) => prom.reject(refreshError));
            this.failedQueue = [];
            await secureStorage.clearAuth();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  AUTH
  // ═══════════════════════════════════════════════════════════════════════════

  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    role?: "user" | "dj" | "admin";
    dateOfBirth?: string | null;
    location?: {
      latitude: number;
      longitude: number;
      address?: Record<string, string>;
    };
  }) {
    const response = await this.api.post("/auth/register", data);
    return response.data;
  }

  async login(credentials: {
    email?: string;
    phone?: string;
    password: string;
    location?: {
      latitude: number;
      longitude: number;
      address?: Record<string, string>;
    };
  }) {
    if (!credentials.email && !credentials.phone) {
      throw new Error("Email or phone is required for login");
    }
    const response = await this.api.post("/auth/login", credentials);
    return response.data;
  }

  /**
   * Exchange a Firebase Phone Auth ID token for the app's own JWT.
   *
   * Backend route expected:  POST /api/auth/firebase-login
   * Backend should:
   *   1. Verify idToken via Firebase Admin SDK (admin.auth().verifyIdToken)
   *   2. Find or create a User record keyed on phone number
   *   3. Return { token, user }
   *
   * Example Node.js handler:
   *   const admin = require('firebase-admin');
   *   app.post('/api/auth/firebase-login', async (req, res) => {
   *     const { idToken, phone } = req.body;
   *     const decoded = await admin.auth().verifyIdToken(idToken);
   *     let user = await User.findOne({ where: { phone: decoded.phone_number } });
   *     if (!user) {
   *       // auto-create minimal user
   *       user = await User.create({ phone: decoded.phone_number, role: 'user', isActive: true });
   *     }
   *     const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
   *     res.json({ success: true, token, user });
   *   });
   */
  async loginWithFirebase(data: {
    idToken: string;
    uid: string;
    phone: string;
  }) {
    const response = await this.api.post("/auth/firebase-login", data);
    return response.data;
  }

  async getMe() {
    const response = await this.api.get("/auth/me");
    return response.data;
  }

  async logout() {
    const refreshToken = await secureStorage.getRefreshToken();
    try {
      await this.api.post("/auth/logout", { refreshToken });
    } catch {}
    await secureStorage.clearAuth();
  }

  async resetPassword(email: string) {
    const response = await this.api.post("/auth/reset-password", { email });
    return response.data;
  }

  async updateLocation(data: {
    latitude: number;
    longitude: number;
    address?: Record<string, any>;
  }) {
    const response = await this.api.put("/auth/location", data);
    return response.data;
  }

  async updateProfile(data: Partial<{
    firstName?: string;
    lastName?: string;
    phone?: string;
    dateOfBirth?: string;
    profilePicture?: string;
    preferences?: any;
  }>) {
    const response = await this.api.put("/auth/profile", data);
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  USER
  // ═══════════════════════════════════════════════════════════════════════════

  async getProfile() {
    const response = await this.api.get("/users/profile");
    return response.data;
  }

  async getMyBookings(params?: { status?: string; page?: number; limit?: number }) {
    const response = await this.api.get("/users/bookings", { params });
    return response.data;
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    const response = await this.api.put("/users/change-password", data);
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  EQUIPMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async getEquipment(params?: { category?: string; search?: string }) {
    const response = await this.api.get("/equipment", { params });
    return response.data;
  }

  async getEquipmentById(id: string) {
    const response = await this.api.get(`/equipment/${id}`);
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENTALS
  // ═══════════════════════════════════════════════════════════════════════════

  async createRental(data: {
    equipmentId: string;
    startDate: string;
    endDate: string;
    deliveryAddress?: string;
    paymentId?: string;
    paymentMethod?: string;
    razorpayOrderId?: string;
  }) {
    const start = new Date(data.startDate);
    const end   = new Date(data.endDate);
    const durationDays = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const response = await this.api.post("/payments/create-booking", {
      djId:                data.equipmentId,
      razorpay_order_id:   data.razorpayOrderId,
      razorpay_payment_id: data.paymentId,
      eventDetails: {
        eventType: "Other",
        eventDate: data.startDate,
        startTime: "10:00",
        endTime:   "18:00",
        duration:  durationDays,
        guestCount: null,
        specialRequests: null,
        basePrice: 0,
        additionalCharges: [],
      },
      eventLocation: {
        latitude:  0,
        longitude: 0,
        street:    data.deliveryAddress ?? "",
        city: "", state: "", zipCode: "", country: "India",
      },
    });

    const raw = response.data;
    return { ...raw, rental: raw.booking ?? raw.rental ?? null };
  }

  async getRentals(params?: { status?: string }) {
    const response = await this.api.get("/users/bookings", { params });
    return response.data;
  }

  async cancelRental(id: string) {
    const response = await this.api.delete(`/rentals/${id}`);
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  async createPaymentOrder(amountInRupees: number) {
    const response = await this.api.post("/payments/create-order", {
      amount: amountInRupees,
      currency: "INR",
      notes: { source: "basswala_app" },
    });
    return response.data;
  }

  async verifyPayment(data: {
    orderId: string;
    paymentId: string;
    signature: string;
  }) {
    const response = await this.api.post("/payments/verify-payment", {
      razorpay_order_id:   data.orderId,
      razorpay_payment_id: data.paymentId,
      razorpay_signature:  data.signature,
    });
    return response.data;
  }

  async getPaymentStatus(orderId: string) {
    const response = await this.api.get(`/payments/status/${orderId}`);
    return response.data;
  }

  async getPaymentHistory(params?: { page?: number; limit?: number; status?: string }) {
    const response = await this.api.get("/payments/history", { params });
    return response.data;
  }

  async initiateUPICollect(data: {
    orderId: string;
    amount: number;
    vpa: string;
    contact: string;
    email: string;
  }) {
    const response = await this.api.post("/payments/upi-collect", data);
    return response.data;
  }

  async getUPIPaymentStatus(paymentId: string) {
    const response = await this.api.get(`/payments/upi-status/${paymentId}`);
    return response.data;
  }

  async initiateRefund(paymentId: string, data?: { amount?: number; reason?: string }) {
    const response = await this.api.post(`/payments/refund/${paymentId}`, data ?? {});
    return response.data;
  }
}

export const apiService = new ApiService();