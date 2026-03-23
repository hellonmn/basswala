/**
 * services/firebase.ts
 * Firebase Phone Auth service for OTP-based login
 *
 * Setup:
 *   npm install @react-native-firebase/app @react-native-firebase/auth
 *   npx expo prebuild --clean
 *
 * Add google-services.json (Android) and GoogleService-Info.plist (iOS)
 * to your project root before running.
 */

import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";

export type ConfirmationResult = FirebaseAuthTypes.ConfirmationResult;

class FirebaseOTPService {
  private _confirmation: ConfirmationResult | null = null;

  /**
   * Send OTP to a phone number.
   * Phone must be in E.164 format, e.g. +919876543210
   */
  async sendOTP(phoneNumber: string): Promise<void> {
    const formatted = this._formatPhone(phoneNumber);
    this._confirmation = await auth().signInWithPhoneNumber(formatted);
  }

  /**
   * Verify the 6-digit OTP entered by the user.
   * Returns the Firebase UID on success.
   */
  async verifyOTP(otp: string): Promise<{ uid: string; phone: string }> {
    if (!this._confirmation) {
      throw new Error("No pending OTP confirmation. Send OTP first.");
    }
    const credential = await this._confirmation.confirm(otp);
    if (!credential?.user) {
      throw new Error("OTP verification failed.");
    }
    const uid   = credential.user.uid;
    const phone = credential.user.phoneNumber ?? "";
    return { uid, phone };
  }

  /**
   * Get Firebase ID token for the currently signed-in user.
   * Pass this to your backend to authenticate server-side.
   */
  async getIdToken(): Promise<string | null> {
    const user = auth().currentUser;
    if (!user) return null;
    return user.getIdToken(true);
  }

  /** Sign out the current Firebase session */
  async signOut(): Promise<void> {
    await auth().signOut();
  }

  /** Convert 10-digit Indian number to E.164 if needed */
  private _formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (phone.startsWith("+")) return phone;
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    return `+${digits}`;
  }
}

export const firebaseOTP = new FirebaseOTPService();