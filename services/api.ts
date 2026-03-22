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

  private processQueue(error: Error | null): void {
    this.failedQueue.forEach((prom) => {
      if (error) prom.reject(error);
      else prom.resolve();
    });
    this.failedQueue = [];
  }

  // ========== AUTH ==========

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

  async getMe() {
    const response = await this.api.get("/auth/me");
    return response.data;
  }

  async logout() {
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

  // ========== USER ==========

  async getProfile() {
    const response = await this.api.get("/users/profile");
    return response.data;
  }

  // ========== EQUIPMENT ==========

  async getEquipment(params?: { category?: string; search?: string }) {
    const response = await this.api.get("/equipment", { params });
    return response.data;
  }

  async getEquipmentById(id: string) {
    const response = await this.api.get(`/equipment/${id}`);
    return response.data;
  }

  // ========== RENTALS ==========

  /**
   * Create a rental AFTER payment is verified.
   * Maps to: POST /api/payments/create-booking
   *
   * FIXED: was incorrectly calling /payments/create-rental (404).
   * Backend route is /payments/create-booking (paymentController.createBookingWithPayment).
   *
   * Requires a Payment record with status='success' in the DB
   * (created by verifyPayment before this is called).
   */
  async createRental(data: {
    equipmentId: string;      // maps to djId in backend — update if you add an Equipment model
    startDate: string;
    endDate: string;
    deliveryAddress?: string;
    paymentId?: string;       // razorpay_payment_id
    paymentMethod?: string;
    razorpayOrderId?: string; // razorpay_order_id
  }) {
    // Calculate duration in days from startDate → endDate
    const start = new Date(data.startDate);
    const end   = new Date(data.endDate);
    const durationDays = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );

    // POST /api/payments/create-booking
    const response = await this.api.post("/payments/create-booking", {
      djId:               data.equipmentId,       // your Equipment ID — rename field if backend changes
      razorpay_order_id:  data.razorpayOrderId,
      razorpay_payment_id: data.paymentId,
      eventDetails: {
        eventType:        "Other",                // default; pass from UI if available
        eventDate:        data.startDate,
        startTime:        "10:00",                // default; pass from UI if available
        endTime:          "18:00",                // default; pass from UI if available
        duration:         durationDays,
        guestCount:       null,
        specialRequests:  null,
        basePrice:        0,                      // backend derives from Payment record
        additionalCharges: [],
      },
      eventLocation: {
        latitude:         0,                      // pass real coordinates from BookingFlowScreen if available
        longitude:        0,
        street:           data.deliveryAddress ?? "",
        city:             "",
        state:            "",
        zipCode:          "",
        country:          "India",
      },
    });

    // Normalise response so callers can use res.rental.id OR res.booking.id
    const raw = response.data;
    return {
      ...raw,
      rental: raw.booking ?? raw.rental ?? null,
    };
  }

  async getRentals(params?: { status?: string }) {
    // GET /api/users/bookings  (lists the logged-in user's bookings)
    const response = await this.api.get("/users/bookings", { params });
    return response.data;
  }

  async getRentalById(id: string) {
    const response = await this.api.get(`/bookings/${id}`);
    return response.data;
  }

  async cancelRental(id: string) {
    const response = await this.api.delete(`/rentals/${id}`);
    return response.data;
  }

  // ========== PAYMENTS ==========

  /**
   * Step 1 — Create a Razorpay order.
   * Pass amount in rupees — backend converts to paise.
   * Returns: { orderId, amount, currency, keyId }
   */
  async createPaymentOrder(amountInRupees: number) {
    const response = await this.api.post("/payments/create-order", {
      amount:   amountInRupees,
      currency: "INR",
      notes:    { source: "basswala_app" },
    });
    return response.data;
  }

  /**
   * Step 2 — Verify Razorpay signature after UPI Intent or Card payment.
   * Must be called BEFORE createRental so the Payment DB record is 'success'.
   * Returns: { success, verified, paymentId, status }
   */
  async verifyPayment(data: {
    orderId:   string;
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

  /**
   * Get payment status by Razorpay order ID.
   * Returns: { success, payment }
   */
  async getPaymentStatus(orderId: string) {
    const response = await this.api.get(`/payments/status/${orderId}`);
    return response.data;
  }

  /**
   * Get logged-in user's full payment history.
   * Returns: { success, count, totalPages, currentPage, payments }
   */
  async getPaymentHistory(params?: { page?: number; limit?: number; status?: string }) {
    const response = await this.api.get("/payments/history", { params });
    return response.data;
  }

  /**
   * UPI Collect — route through your backend (secret key stays server-side).
   *
   * NOTE: This endpoint does NOT exist in your current backend yet.
   * You need to add it to routes/payments.js + paymentController.js.
   *
   * Until then, PaymentStep.tsx uses RazorpayCustomUI.payViaUPICollect()
   * (SDK collect flow) which works with test keys and does NOT call this.
   *
   * Expected backend route: POST /api/payments/upi-collect
   * Expected response: { success, paymentId, status }
   */
  async initiateUPICollect(data: {
    orderId:  string;
    amount:   number;
    vpa:      string;
    contact:  string;
    email:    string;
  }) {
    const response = await this.api.post("/payments/upi-collect", data);
    return response.data;
  }

  /**
   * Poll UPI payment status — call every 4s until status is 'captured' or 'failed'.
   *
   * NOTE: This endpoint does NOT exist in your current backend yet.
   * You need to add it to routes/payments.js + paymentController.js.
   *
   * Until then, PaymentStep.tsx skips this and uses the SDK collect callback directly.
   *
   * Expected backend route: GET /api/payments/upi-status/:paymentId
   * Expected response: { success, status, paymentId }
   */
  async getUPIPaymentStatus(paymentId: string) {
    const response = await this.api.get(`/payments/upi-status/${paymentId}`);
    return response.data;
  }

  /**
   * Admin only — initiate a refund for a captured payment.
   * Returns: { success, message, refund: { id, amount, status } }
   */
  async initiateRefund(paymentId: string, data?: { amount?: number; reason?: string }) {
    const response = await this.api.post(`/payments/refund/${paymentId}`, data ?? {});
    return response.data;
  }
}

export const apiService = new ApiService();