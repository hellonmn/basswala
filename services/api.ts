import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import { secureStorage } from "./secureStorage";

/**
 * API Service with built-in security features:
 * - Automatic token injection
 * - Token refresh on 401
 * - Request/Response interceptors
 * - Error handling
 */

const API_BASE_URL = __DEV__
  ? "https://indicated-volunteer-debug-work.trycloudflare.com/api" // Development
  : "https://your-production-api.com/api"; // Production

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
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor - Add auth token to headers
    this.api.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await secureStorage.getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Response interceptor - Handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        // If error is 401 and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // If already refreshing, queue this request
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then(() => {
                return this.api(originalRequest);
              })
              .catch((err) => {
                return Promise.reject(err);
              });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = await secureStorage.getRefreshToken();
            if (!refreshToken) {
              throw new Error("No refresh token available");
            }

            // Refresh the token
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            });

            const { accessToken, refreshToken: newRefreshToken } =
              response.data;
            await secureStorage.saveTokens(accessToken, newRefreshToken);

            // Retry all queued requests
            this.failedQueue.forEach((prom) => prom.resolve());
            this.failedQueue = [];

            return this.api(originalRequest);
          } catch (refreshError) {
            // Refresh failed - clear auth and redirect to login
            this.failedQueue.forEach((prom) => prom.reject(refreshError));
            this.failedQueue = [];
            await secureStorage.clearAuth();
            // You can emit an event here to redirect to login
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      },
    );
  }

  /**
   * Process failed queue
   */
  private processQueue(error: Error | null): void {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve();
      }
    });
    this.failedQueue = [];
  }

  // ========== AUTH ENDPOINTS ==========

  /**
   * Register a new user - full payload matching backend
   */
  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    role?: "user" | "dj" | "admin";
    dateOfBirth?: string | null; // e.g. "1995-04-12"
    location?: {
      latitude: number;
      longitude: number;
      address?: {
        street?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        country?: string;
      };
    };
  }) {
    const response = await this.api.post("/auth/register", data);
    return response.data;
  }

  /**
   * Legacy register method (name → firstName/lastName split)
   * Use this temporarily while transitioning your UI
   * @deprecated Prefer the full register() method
   */
  async registerLegacy(email: string, password: string, name: string) {
    console.warn("registerLegacy is deprecated – please use full register payload");

    const parts = name.trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";

    return this.register({
      firstName,
      lastName: lastName || name.trim(),
      email,
      phone: "", // collect phone in UI soon
      password,
      // role, dateOfBirth, location → optional, omitted here
    });
  }

  /**
   * Login with email or phone + optional location update
   */
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
   * Get current authenticated user's profile (/auth/me)
   */
  async getMe() {
    const response = await this.api.get("/auth/me");
    return response.data;
  }

  async logout() {
    // If your backend logout endpoint still expects refreshToken
    const refreshToken = await secureStorage.getRefreshToken();
    try {
      await this.api.post("/auth/logout", { refreshToken });
    } catch (err) {
      console.warn("Logout request failed, clearing local auth anyway", err);
    }
    await secureStorage.clearAuth();
  }

  async resetPassword(email: string) {
    const response = await this.api.post("/auth/reset-password", { email });
    return response.data;
  }

  async verifyEmail(token: string) {
    const response = await this.api.post("/auth/verify-email", { token });
    return response.data;
  }

  /**
   * Update user's current location
   */
  async updateLocation(data: {
    latitude: number;
    longitude: number;
    address?: Record<string, any>;
  }) {
    const response = await this.api.put("/auth/location", data);
    return response.data;
  }

  /**
   * Update user profile fields
   */
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

  // ========== USER ENDPOINTS ==========

  async getProfile() {
    // Note: you had /users/profile – keeping it, but consider aligning with /auth/me
    const response = await this.api.get("/users/profile");
    return response.data;
  }

  async updateProfileLegacy(data: any) {
    // If you still use /users/profile PUT somewhere – consider migrating to /auth/profile
    const response = await this.api.put("/users/profile", data);
    return response.data;
  }

  // ========== DJ EQUIPMENT ENDPOINTS ==========

  async getEquipment(params?: { category?: string; search?: string }) {
    const response = await this.api.get("/equipment", { params });
    return response.data;
  }

  async getEquipmentById(id: string) {
    const response = await this.api.get(`/equipment/${id}`);
    return response.data;
  }

  // ========== RENTAL ENDPOINTS ==========

  async createRental(data: {
    equipmentId: string;
    startDate: string;
    endDate: string;
    deliveryAddress?: string;
  }) {
    const response = await this.api.post("/rentals", data);
    return response.data;
  }

  async getRentals(params?: { status?: string }) {
    const response = await this.api.get("/rentals", { params });
    return response.data;
  }

  async getRentalById(id: string) {
    const response = await this.api.get(`/rentals/${id}`);
    return response.data;
  }

  async cancelRental(id: string) {
    const response = await this.api.delete(`/rentals/${id}`);
    return response.data;
  }

  // ========== PAYMENT ENDPOINTS ==========

  async createPaymentIntent(rentalId: string) {
    const response = await this.api.post("/payments/create-intent", {
      rentalId,
    });
    return response.data;
  }

  async confirmPayment(paymentIntentId: string) {
    const response = await this.api.post("/payments/confirm", {
      paymentIntentId,
    });
    return response.data;
  }
}

export const apiService = new ApiService();