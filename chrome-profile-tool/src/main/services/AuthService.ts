import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

interface User {
  id: string;
  userName: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  roles: string;
  roleName?: string;
  isAdmin?: boolean;
  isSeller?: boolean;
}

interface UserPermissions {
  isAdmin: boolean;
  isSeller: boolean;
  roleName: string;
  canViewAllFolders: boolean;
  canViewAllProfiles: boolean;
  canManageUsers: boolean;
  canCreateProfile: boolean;
  canEditProfile: boolean;
  canDeleteProfile: boolean;
  canUseProfile: boolean;
}

interface LoginResponse {
  user: User;
  token: string;
  expiresAt: string;
}

export class AuthService {
  private apiBaseUrl: string;
  private tokenFilePath: string;
  private currentUser: User | null = null;
  private currentToken: string | null = null;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.tokenFilePath = path.join(app.getPath('userData'), 'auth-token.json');
    this.loadStoredAuth();
  }

  async login(userName: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userName, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const result = await response.json();
      const data: LoginResponse = result.data;

      // Store auth data
      this.currentUser = data.user;
      this.currentToken = data.token;
      this.saveAuth(data);

      console.log(`User logged in: ${data.user.userName}`);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async loginWithFirebaseToken(firebaseToken: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/firebase-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login with Firebase token failed');
      }

      const result = await response.json();
      const data: LoginResponse = result.data;

      // Store auth data
      this.currentUser = data.user;
      this.currentToken = data.token;
      this.saveAuth(data);

      console.log(`User logged in with Firebase: ${data.user.userName}`);
      return data;
    } catch (error) {
      console.error('Firebase login error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (!this.currentToken) {
      return;
    }

    try {
      await fetch(`${this.apiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentToken}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  async validateToken(): Promise<User | null> {
    if (!this.currentToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentToken}`,
        },
      });

      if (!response.ok) {
        this.clearAuth();
        return null;
      }

      const result = await response.json();
      this.currentUser = result.data;
      return result.data;
    } catch (error) {
      console.error('Token validation error:', error);
      this.clearAuth();
      return null;
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getCurrentToken(): string | null {
    return this.currentToken;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null && this.currentToken !== null;
  }

  private saveAuth(data: LoginResponse): void {
    try {
      const authData = {
        user: data.user,
        token: data.token,
        expiresAt: data.expiresAt,
      };
      fs.writeFileSync(this.tokenFilePath, JSON.stringify(authData, null, 2));
    } catch (error) {
      console.error('Error saving auth data:', error);
    }
  }

  private loadStoredAuth(): void {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf-8'));
        
        // Check if token is expired
        const expiresAt = new Date(data.expiresAt);
        if (expiresAt > new Date()) {
          this.currentUser = data.user;
          this.currentToken = data.token;
          console.log(`Loaded stored auth for user: ${data.user.userName}`);
        } else {
          console.log('Stored token expired');
          this.clearAuth();
        }
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      this.clearAuth();
    }
  }

  private clearAuth(): void {
    this.currentUser = null;
    this.currentToken = null;
    
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        fs.unlinkSync(this.tokenFilePath);
      }
    } catch (error) {
      console.error('Error clearing auth file:', error);
    }
  }

  async getUserPermissions(): Promise<UserPermissions | null> {
    if (!this.currentToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get permissions');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return null;
    }
  }

  isAdmin(): boolean {
    return this.currentUser?.roles === '1' || this.currentUser?.isAdmin === true;
  }

  isSeller(): boolean {
    return this.currentUser?.roles === '3' || this.currentUser?.isSeller === true;
  }

  getRoleName(): string {
    if (this.isAdmin()) return 'Admin';
    if (this.isSeller()) return 'Seller';
    return 'Unknown';
  }

  hasPermission(permission: string): boolean {
    if (this.isAdmin()) {
      return true; // Admin has all permissions
    }

    if (this.isSeller()) {
      const sellerPermissions = [
        'view_own_folders',
        'view_own_profiles',
        'create_profile',
        'edit_profile',
        'delete_profile',
        'use_profile'
      ];
      return sellerPermissions.includes(permission);
    }

    return false;
  }

  canAccessAllFolders(): boolean {
    return this.isAdmin();
  }

  canAccessAllProfiles(): boolean {
    return this.isAdmin();
  }

  canManageUsers(): boolean {
    return this.isAdmin();
  }
}
