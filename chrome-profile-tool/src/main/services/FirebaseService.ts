import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  MultiFactorResolver,
  getMultiFactorResolver,
  UserCredential,
  User as FirebaseUser
} from 'firebase/auth';
import { firebaseConfig } from '../config/firebase.config';

export class FirebaseService {
  private app: FirebaseApp;
  private auth: Auth;

  constructor() {
    this.app = initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<{
    success: boolean;
    user?: FirebaseUser;
    requireMFA?: boolean;
    mfaResolver?: MultiFactorResolver;
    error?: string;
  }> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return {
        success: true,
        user: userCredential.user
      };
    } catch (error: any) {
      console.log('[FirebaseService] Sign in error:', {
        code: error.code,
        message: error.message,
        hasResolver: !!error.resolver,
        hasCustomData: !!error.customData,
        customDataResolver: !!error.customData?._serverResponse?.mfaPendingCredential
      });
      
      // Check if MFA is required
      if (error.code === 'auth/multi-factor-auth-required') {
        console.log('[FirebaseService] MFA required, extracting resolver');
        // Use getMultiFactorResolver to get the resolver from the error
        const resolver = getMultiFactorResolver(this.auth, error);
        
        console.log('[FirebaseService] Resolver obtained:', {
          hasResolver: !!resolver,
          hintsCount: resolver?.hints?.length || 0
        });
        
        return {
          success: false,
          requireMFA: true,
          mfaResolver: resolver
        };
      }
      
      // Custom error messages for better UX
      let errorMessage = error.message || 'Sign in failed';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please check and try again.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'User not found. Please check your username.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Create new user with email and password
   */
  async createUser(email: string, password: string): Promise<{
    success: boolean;
    user?: FirebaseUser;
    error?: string;
  }> {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      return {
        success: true,
        user: userCredential.user
      };
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please check and try again.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'User not found. Please check your username.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Change user password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const user = this.auth.currentUser;
      if (!user || !user.email) {
        throw new Error('No authenticated user');
      }

      // Re-authenticate user before changing password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      return { success: true };
    } catch (error: any) {
      let errorMessage = 'Password change failed';
      
      // Handle specific error codes with user-friendly messages
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please login again to change password';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'User not found';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await sendPasswordResetEmail(this.auth, email);
      return { success: true };
    } catch (error: any) {
      let errorMessage = 'Failed to send password reset email';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Generate TOTP secret for 2FA enrollment
   */
  async generateTOTPSecret(): Promise<{
    success: boolean;
    totpSecret?: TotpSecret;
    qrCodeUrl?: string;
    secretKey?: string;
    error?: string;
  }> {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Check if user already has 2FA enabled
      const enrolledFactors = multiFactor(user).enrolledFactors;
      if (enrolledFactors.length > 0) {
        return {
          success: false,
          error: '2FA is already enabled. Please disable it first before setting up a new authenticator.'
        };
      }

      const multiFactorSession = await multiFactor(user).getSession();
      const totpSecret = await TotpMultiFactorGenerator.generateSecret(multiFactorSession);

      // Generate QR code URL
      const qrCodeUrl = totpSecret.generateQrCodeUrl(
        user.email || 'user@jeg.com',
        'JEG Profiles'
      );

      return {
        success: true,
        totpSecret,
        qrCodeUrl,
        secretKey: totpSecret.secretKey
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to generate TOTP secret'
      };
    }
  }

  /**
   * Enable 2FA with verification code
   */
  async enable2FA(totpSecret: TotpSecret, verificationCode: string, displayName: string = '2FA'): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }

      const multiFactorAssertion = TotpMultiFactorGenerator.assertionForEnrollment(
        totpSecret,
        verificationCode
      );

      await multiFactor(user).enroll(multiFactorAssertion, displayName);

      return { success: true };
    } catch (error: any) {
      let errorMessage = error.message || 'Failed to enable 2FA';
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid verification code';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Verify 2FA code during sign-in
   */
  async verify2FACode(mfaResolver: MultiFactorResolver, verificationCode: string): Promise<{
    success: boolean;
    user?: FirebaseUser;
    error?: string;
  }> {
    try {
      const selectedHint = mfaResolver.hints[0];
      
      const multiFactorAssertion = TotpMultiFactorGenerator.assertionForSignIn(
        selectedHint.uid,
        verificationCode
      );

      const userCredential = await mfaResolver.resolveSignIn(multiFactorAssertion);

      return {
        success: true,
        user: userCredential.user
      };
    } catch (error: any) {
      let errorMessage = error.message || 'Invalid verification code';
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid or expired verification code';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Disable 2FA
   */
  async disable2FA(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }

      const enrolledFactors = multiFactor(user).enrolledFactors;
      if (enrolledFactors.length === 0) {
        return {
          success: false,
          error: '2FA is not enabled'
        };
      }

      // Unenroll ALL factors (especially TOTP)
      console.log(`[FirebaseService] Unenrolling ${enrolledFactors.length} factors`);
      for (const factor of enrolledFactors) {
        console.log(`[FirebaseService] Unenrolling factor: ${factor.factorId}`);
        await multiFactor(user).unenroll(factor);
      }

      return { success: true };
    } catch (error: any) {
      console.error('[FirebaseService] Failed to disable 2FA:', error);
      return {
        success: false,
        error: error.message || 'Failed to disable 2FA'
      };
    }
  }

  /**
   * Check if user has 2FA enabled
   */
  async is2FAEnabled(): Promise<boolean> {
    try {
      const user = this.auth.currentUser;
      if (!user) return false;

      const enrolledFactors = multiFactor(user).enrolledFactors;
      return enrolledFactors.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current Firebase user
   */
  getCurrentUser(): FirebaseUser | null {
    return this.auth.currentUser;
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    await this.auth.signOut();
  }

  /**
   * Get Firebase ID token for API calls
   */
  async getIdToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    if (!user) return null;
    
    return await user.getIdToken();
  }
}
