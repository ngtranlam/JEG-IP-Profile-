import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { ApiService } from './services/ApiService';
import { AuthService } from './services/AuthService';
import { AutoSyncService } from './services/AutoSyncService';
import { FirebaseService } from './services/FirebaseService';
import { TotpSecret, MultiFactorResolver } from 'firebase/auth';

// Load .env from multiple possible locations
const possibleEnvPaths = [
  path.join(__dirname, '../../../.env'), // Dev mode
  path.join(process.resourcesPath, '.env'), // Production (inside app)
  path.join(app.getPath('userData'), '.env'), // User data directory
  path.join(process.cwd(), '.env'), // Current working directory
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading .env from: ${envPath}`);
    dotenv.config({ path: envPath });
    break;
  }
}

// Verify GOLOGIN_API_TOKEN is loaded
if (!process.env.GOLOGIN_API_TOKEN) {
  console.warn('WARNING: GOLOGIN_API_TOKEN not found in environment variables');
  console.warn('Checked paths:', possibleEnvPaths);
}

class ChromeProfileTool {
  private mainWindow: BrowserWindow | null = null;
  private apiService: ApiService;
  private authService: AuthService;
  private autoSyncService: AutoSyncService;
  private firebaseService: FirebaseService;
  private pendingTotpSecret: TotpSecret | null = null;
  private pendingMfaResolver: MultiFactorResolver | null = null;

  constructor() {
    const apiBaseUrl = process.env.API_BASE_URL || 'https://profile.jegdn.com/api';
    this.apiService = new ApiService();
    this.authService = new AuthService(apiBaseUrl);
    this.autoSyncService = new AutoSyncService(this.apiService, this.authService);
    this.firebaseService = new FirebaseService();
  }

  async initialize() {
    this.setupIPC();
    
    // Setup callback to notify renderer when browser is closed manually
    this.apiService.setupBrowserClosedCallback((profileId: string) => {
      console.log(`Browser closed manually for profile: ${profileId}`);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('browser-closed', profileId);
      }
    });
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      titleBarStyle: 'default',
      show: false,
    });

    // Load the React app
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupIPC() {
    // Profile management IPC handlers
    ipcMain.handle('profile:create', async (_, profileData) => {
      return await this.apiService.createProfile(profileData);
    });

    ipcMain.handle('profile:update', async (_, id, updates) => {
      return await this.apiService.updateProfile(id, updates);
    });

    ipcMain.handle('profile:delete', async (_, id) => {
      return await this.apiService.deleteProfile(id);
    });

    ipcMain.handle('profile:list', async () => {
      return await this.apiService.listProfiles();
    });

    ipcMain.handle('profile:launch', async (_, options) => {
      const profile = await this.apiService.getProfile(options.profile_id);
      if (!profile) {
        throw new Error('Profile not found');
      }

      return await this.apiService.gologinLaunchProfile(profile.id, { headless: options.headless });
    });

    // Proxy management IPC handlers
    ipcMain.handle('proxy:create', async (_, proxyData) => {
      return await this.apiService.createProxy(proxyData);
    });

    ipcMain.handle('proxy:update', async (_, id, updates) => {
      return await this.apiService.updateProxy(id, updates);
    });

    ipcMain.handle('proxy:delete', async (_, id) => {
      return await this.apiService.deleteProxy(id);
    });

    ipcMain.handle('proxy:list', async () => {
      return await this.apiService.listProxies();
    });

    ipcMain.handle('proxy:validate', async (_, id) => {
      return await this.apiService.validateProxy(id);
    });

    ipcMain.handle('proxy:rotate-ip', async (_, id) => {
      return await this.apiService.rotateProxyIP(id);
    });

    ipcMain.handle('proxy:test-config', async (_, config) => {
      return await this.apiService.testProxyConfig(config);
    });

    // GoLogin API handlers
    ipcMain.handle('gologin:list-profiles', async (_, page, search, folder) => {
      return await this.apiService.gologinListProfiles(page, search, folder);
    });

    ipcMain.handle('gologin:get-profile', async (_, profileId) => {
      return await this.apiService.gologinGetProfile(profileId);
    });

    ipcMain.handle('gologin:create-profile', async (_, profileData) => {
      return await this.apiService.gologinCreateProfile(profileData);
    });

    ipcMain.handle('gologin:create-quick-profile', async (_, os, name, osSpec) => {
      return await this.apiService.gologinCreateQuickProfile(os, name, osSpec);
    });

    ipcMain.handle('gologin:update-profile', async (_, profileId, profileData) => {
      return await this.apiService.gologinUpdateProfile(profileId, profileData);
    });

    ipcMain.handle('gologin:delete-profile', async (_, profileId) => {
      return await this.apiService.gologinDeleteProfile(profileId);
    });

    ipcMain.handle('gologin:set-proxy', async (_, profileId, proxy) => {
      return await this.apiService.gologinSetProxy(profileId, proxy);
    });

    ipcMain.handle('gologin:remove-proxy', async (_, profileId) => {
      return await this.apiService.gologinRemoveProxy(profileId);
    });

    ipcMain.handle('gologin:launch-profile', async (_, profileId, options) => {
      return await this.apiService.gologinLaunchProfile(profileId, options);
    });

    ipcMain.handle('gologin:stop-profile', async (_, profileId) => {
      return await this.apiService.gologinStopProfile(profileId);
    });

    ipcMain.handle('gologin:list-folders', async () => {
      return await this.apiService.gologinListFolders();
    });

    ipcMain.handle('gologin:create-folder', async (_, name) => {
      return await this.apiService.gologinCreateFolder(name);
    });

    ipcMain.handle('gologin:list-tags', async () => {
      return await this.apiService.gologinListTags();
    });

    ipcMain.handle('gologin:get-proxy-locations', async () => {
      return await this.apiService.gologinGetProxyLocations();
    });

    ipcMain.handle('gologin:test-connection', async () => {
      return await this.apiService.gologinTestConnection();
    });

    // Local Data IPC handlers (from database)
    ipcMain.handle('local-data:get-folders', async () => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getLocalFolders(token);
    });

    ipcMain.handle('local-data:get-profiles', async (_, page, limit, search, folderId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getLocalProfiles(token, page, limit, search, folderId);
    });

    ipcMain.handle('local-data:get-profile', async (_, profileId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getLocalProfile(token, profileId);
    });

    ipcMain.handle('local-data:get-stats', async () => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getLocalStats(token);
    });

    ipcMain.handle('local-data:sync', async (_, syncType) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.syncGoLoginData(token, syncType);
    });

    ipcMain.handle('local-data:sync-status', async () => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getSyncStatus(token);
    });

    ipcMain.handle('local-data:test-connection', async () => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.testLocalConnection(token);
    });

    // Bi-directional sync IPC handlers
    ipcMain.handle('local-data:create-profile', async (_, profileData, folderName) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.createProfileWithSync(token, profileData, folderName);
    });

    ipcMain.handle('local-data:update-profile', async (_, profileId, profileData) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.updateProfileWithSync(token, profileId, profileData);
    });

    ipcMain.handle('local-data:delete-profile', async (_, profileId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.deleteProfileWithSync(token, profileId);
    });

    ipcMain.handle('local-data:create-folder', async (_, name) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.createFolderWithSync(token, name);
    });

    ipcMain.handle('local-data:set-proxy', async (_, profileId, proxyData) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.setProxyWithSync(token, profileId, proxyData);
    });

    // Seller management IPC handlers
    ipcMain.handle('local-data:get-sellers', async () => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getSellers(token);
    });

    ipcMain.handle('local-data:assign-seller', async (_, folderId, sellerId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.assignSellerToFolder(token, folderId, sellerId);
    });

    ipcMain.handle('local-data:remove-seller', async (_, folderId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.removeSellerFromFolder(token, folderId);
    });

    ipcMain.handle('local-data:create-folder-with-seller', async (_, name, sellerId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.createFolderWithSeller(token, name, sellerId);
    });

    ipcMain.handle('local-data:update-folder', async (_, folderId, name) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.updateFolder(token, folderId, name);
    });

    ipcMain.handle('local-data:delete-folder', async (_, folderId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.deleteFolder(token, folderId);
    });

    // User management IPC handlers
    ipcMain.handle('local-data:get-users', async () => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getUsers(token);
    });

    ipcMain.handle('local-data:create-user', async (_, userData) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.createUser(token, userData);
    });

    ipcMain.handle('local-data:update-user', async (_, userData) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.updateUser(token, userData);
    });

    ipcMain.handle('local-data:delete-user', async (_, userId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.deleteUser(token, userId);
    });

    ipcMain.handle('local-data:toggle-user-status', async (_, userId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.toggleUserStatus(token, userId);
    });

    // Authentication IPC handlers
    ipcMain.handle('auth:login', async (_, userName, password) => {
      try {
        console.log(`[Login] Attempting login for userName: ${userName}`);
        
        // Step 1: Get user info from database to get email
        const dbUser = await this.apiService.getUserByUserName(userName);
        if (!dbUser) {
          console.log(`[Login] User not found in database: ${userName}`);
          throw new Error('Invalid username or password');
        }

        console.log(`[Login] User found in database:`, {
          userName: dbUser.userName,
          email: dbUser.email,
          hasEmail: !!dbUser.email
        });

        // Generate email if not exists
        const email = dbUser.email || `${userName.toLowerCase()}@jeg.local`;
        console.log(`[Login] Using email for Firebase auth: ${email}`);

        // Step 2: Authenticate with Firebase
        console.log(`[Login] Attempting Firebase authentication with email: ${email}`);
        const firebaseResult = await this.firebaseService.signInWithEmail(email, password);
        console.log(`[Login] Firebase auth result:`, {
          success: firebaseResult.success,
          hasUser: !!firebaseResult.user,
          error: firebaseResult.error
        });

        // Check if MFA is required
        if (firebaseResult.requireMFA && firebaseResult.mfaResolver) {
          console.log('[Login] MFA required');
          this.pendingMfaResolver = firebaseResult.mfaResolver;
          return {
            success: false,
            require2FA: true,
            userName: userName
          };
        }

        if (!firebaseResult.success || !firebaseResult.user) {
          console.log('[Login] Firebase auth failed, throwing error');
          throw new Error(firebaseResult.error || 'Firebase authentication failed');
        }

        // Step 3: Get Firebase ID token for backend login
        console.log('[Login] Getting Firebase ID token for backend login...');
        const firebaseToken = await firebaseResult.user.getIdToken();
        
        // Step 4: Login to backend with Firebase ID token
        console.log('[Login] Calling backend loginWithFirebaseToken...');
        const result = await this.authService.loginWithFirebaseToken(firebaseToken);
        console.log('[Login] Backend login successful');

        // Step 5: Check if password change is required from database
        if (result.user && (result.user as any).requirePasswordChange) {
          console.log('[Login] Password change required (from database)');
          return {
            success: false,
            requirePasswordChange: true,
            userName: userName
          };
        }

        return { success: true, data: result };
      } catch (error: any) {
        console.error('[Login] Error occurred:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('auth:logout', async () => {
      await this.authService.logout();
    });

    ipcMain.handle('auth:change-password', async (_, oldPassword, newPassword) => {
      try {
        const token = this.authService.getCurrentToken();
        if (!token) throw new Error('Not authenticated');
        
        // Change password in Firebase first
        await this.firebaseService.changePassword(oldPassword, newPassword);
        
        // Then update in backend database
        await this.apiService.changePassword(token, oldPassword, newPassword);
        
        // Clear requirePasswordChange flag in Firebase custom claims
        const firebaseUser = this.firebaseService.getCurrentUser();
        if (firebaseUser) {
          const idTokenResult = await firebaseUser.getIdTokenResult();
          const customClaims = idTokenResult.claims;
          
          if (customClaims.requirePasswordChange) {
            // Update custom claims to remove requirePasswordChange flag
            const updatedClaims = { ...customClaims, requirePasswordChange: false };
            // Note: Custom claims can only be updated from server-side
            // This will be handled by the backend API
          }
        }
      } catch (error: any) {
        throw new Error(error.message || 'Failed to change password');
      }
    });

    ipcMain.handle('auth:force-change-password', async (_, userName, currentPassword, newPassword) => {
      try {
        console.log(`[ForcePasswordChange] Changing password for user: ${userName}`);
        
        // Step 1: Change password in Firebase using the current password from login
        const changeResult = await this.firebaseService.changePassword(currentPassword, newPassword);
        if (!changeResult.success) {
          throw new Error(changeResult.error || 'Password change failed');
        }
        console.log('[ForcePasswordChange] Firebase password changed successfully');
        
        // Step 2: Get Firebase ID token
        const firebaseUser = this.firebaseService.getCurrentUser();
        if (!firebaseUser) {
          throw new Error('No Firebase user found');
        }
        
        const firebaseToken = await firebaseUser.getIdToken(true);
        console.log('[ForcePasswordChange] Got Firebase token');
        
        // Step 3: Call backend to update password in database and clear requirePasswordChange flag
        const response = await fetch(`${this.apiService['baseUrl']}/auth/force-change-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${firebaseToken}`,
          },
          body: JSON.stringify({ newPassword }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update password in backend');
        }
        
        console.log('[ForcePasswordChange] Backend password updated and flag cleared');
        
        // Step 4: Login to backend to get session token
        const loginResult = await this.authService.loginWithFirebaseToken(firebaseToken);
        console.log('[ForcePasswordChange] Backend login successful');
        
        return { success: true, data: loginResult };
      } catch (error: any) {
        console.error('[ForcePasswordChange] Error:', error);
        throw new Error(error.message || 'Failed to change password');
      }
    });

    ipcMain.handle('auth:validate-token', async () => {
      return await this.authService.validateToken();
    });

    ipcMain.handle('auth:get-current-user', async () => {
      return this.authService.getCurrentUser();
    });

    ipcMain.handle('auth:is-authenticated', async () => {
      return this.authService.isAuthenticated();
    });

    // Permission-related IPC handlers
    ipcMain.handle('auth:get-permissions', async () => {
      return await this.authService.getUserPermissions();
    });

    ipcMain.handle('auth:is-admin', async () => {
      return this.authService.isAdmin();
    });

    ipcMain.handle('auth:is-seller', async () => {
      return this.authService.isSeller();
    });

    ipcMain.handle('auth:get-role-name', async () => {
      return this.authService.getRoleName();
    });

    ipcMain.handle('auth:has-permission', async (_, permission) => {
      return this.authService.hasPermission(permission);
    });

    ipcMain.handle('auth:send-password-reset-email', async (_, email: string) => {
      try {
        const result = await this.firebaseService.sendPasswordResetEmail(email);
        if (!result.success) {
          throw new Error(result.error || 'Failed to send password reset email');
        }
        return { success: true };
      } catch (error: any) {
        throw new Error(error.message || 'Failed to send password reset email');
      }
    });

    // Firebase 2FA IPC handlers
    ipcMain.handle('auth:generate2FASecret', async () => {
      try {
        // Check if Firebase user is authenticated
        const currentUser = this.firebaseService.getCurrentUser();
        if (!currentUser) {
          console.log('[2FA] No Firebase user authenticated');
          throw new Error('Session expired. Please logout and login again to enable 2FA.');
        }

        const result = await this.firebaseService.generateTOTPSecret();
        if (result.success && result.totpSecret) {
          // Store the TOTP secret temporarily for enrollment
          this.pendingTotpSecret = result.totpSecret;
          return {
            success: true,
            qrCodeUrl: result.qrCodeUrl,
            secretKey: result.secretKey
          };
        }
        throw new Error(result.error || 'Failed to generate 2FA secret');
      } catch (error: any) {
        throw new Error(error.message || 'Failed to generate 2FA secret');
      }
    });

    ipcMain.handle('auth:enable2FA', async (_, verificationCode) => {
      try {
        if (!this.pendingTotpSecret) {
          throw new Error('No pending TOTP secret. Please generate a secret first.');
        }

        const result = await this.firebaseService.enable2FA(
          this.pendingTotpSecret,
          verificationCode,
          'Authenticator App'
        );

        if (result.success) {
          // Clear the pending secret after successful enrollment
          this.pendingTotpSecret = null;
          
          // Update backend database
          const firebaseUser = this.firebaseService.getCurrentUser();
          if (firebaseUser) {
            const firebaseToken = await firebaseUser.getIdToken();
            
            try {
              await fetch(`${this.apiService['baseUrl']}/auth/enable-2fa`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${firebaseToken}`,
                }
              });
            } catch (err) {
              console.error('Failed to update 2FA status in database:', err);
            }
          }
          
          // Generate recovery codes
          const recoveryCodes = Array.from({ length: 8 }, () => 
            Math.random().toString(36).substring(2, 10).toUpperCase()
          );

          return {
            success: true,
            recoveryCodes
          };
        }
        
        throw new Error(result.error || 'Failed to enable 2FA');
      } catch (error: any) {
        throw new Error(error.message || 'Failed to enable 2FA');
      }
    });

    ipcMain.handle('auth:verify2FA', async (_, userName, verificationCode) => {
      try {
        if (!this.pendingMfaResolver) {
          throw new Error('No pending MFA verification');
        }

        const result = await this.firebaseService.verify2FACode(
          this.pendingMfaResolver,
          verificationCode
        );

        if (result.success && result.user) {
          // Clear the pending resolver
          this.pendingMfaResolver = null;
          
          // Get Firebase ID token and login to backend
          console.log('[2FA Verify] Getting Firebase ID token for backend login...');
          const firebaseToken = await result.user.getIdToken();
          
          console.log('[2FA Verify] Calling backend loginWithFirebaseToken...');
          const loginResult = await this.authService.loginWithFirebaseToken(firebaseToken);
          console.log('[2FA Verify] Backend login successful');
          
          return { 
            success: true,
            user: loginResult.user,
            token: loginResult.token
          };
        }

        throw new Error(result.error || 'Invalid verification code');
      } catch (error: any) {
        throw new Error(error.message || 'Failed to verify 2FA');
      }
    });

    ipcMain.handle('auth:disable2FA', async () => {
      try {
        const result = await this.firebaseService.disable2FA();
        if (result.success) {
          // Update backend database
          const firebaseUser = this.firebaseService.getCurrentUser();
          if (firebaseUser) {
            const firebaseToken = await firebaseUser.getIdToken();
            
            try {
              await fetch(`${this.apiService['baseUrl']}/auth/disable-2fa`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${firebaseToken}`,
                }
              });
            } catch (err) {
              console.error('Failed to update 2FA status in database:', err);
            }
          }
          
          return { success: true };
        }
        throw new Error(result.error || 'Failed to disable 2FA');
      } catch (error: any) {
        throw new Error(error.message || 'Failed to disable 2FA');
      }
    });

    ipcMain.handle('auth:is2FAEnabled', async () => {
      try {
        return await this.firebaseService.is2FAEnabled();
      } catch (error) {
        return false;
      }
    });

    // Auto-sync IPC handlers
    ipcMain.handle('auto-sync:start', async () => {
      this.autoSyncService.start();
      return { success: true };
    });

    ipcMain.handle('auto-sync:stop', async () => {
      this.autoSyncService.stop();
      return { success: true };
    });

    ipcMain.handle('auto-sync:is-active', async () => {
      return this.autoSyncService.isActive();
    });

    ipcMain.handle('auto-sync:trigger-manual', async () => {
      return await this.autoSyncService.triggerManualSync();
    });

    ipcMain.handle('auto-sync:set-interval', async (_, minutes) => {
      this.autoSyncService.setSyncInterval(minutes);
      return { success: true };
    });

    // GoLogin SDK IPC handlers
    ipcMain.handle('gologin-sdk:create-profile', async (_, name, os) => {
      return await this.apiService.gologinSDKCreateProfile(name, os);
    });

    ipcMain.handle('gologin-sdk:create-profile-with-params', async (_, params) => {
      return await this.apiService.gologinSDKCreateProfileWithParams(params);
    });

    ipcMain.handle('gologin-sdk:add-proxy', async (_, profileId, countryCode) => {
      return await this.apiService.gologinSDKAddProxyToProfile(profileId, countryCode);
    });

    ipcMain.handle('gologin-sdk:change-proxy', async (_, profileId, proxy) => {
      return await this.apiService.gologinSDKChangeProfileProxy(profileId, proxy);
    });

    ipcMain.handle('gologin-sdk:add-cookies', async (_, profileId, cookies) => {
      return await this.apiService.gologinSDKAddCookies(profileId, cookies);
    });

    ipcMain.handle('gologin-sdk:refresh-fingerprints', async (_, profileIds) => {
      return await this.apiService.gologinSDKRefreshFingerprints(profileIds);
    });

    ipcMain.handle('gologin-sdk:update-user-agent', async (_, profileIds, workspaceId) => {
      return await this.apiService.gologinSDKUpdateUserAgent(profileIds, workspaceId);
    });

    ipcMain.handle('gologin-sdk:get-active-browsers', async () => {
      return await this.apiService.gologinSDKGetActiveBrowsers();
    });

    ipcMain.handle('gologin-sdk:is-profile-running', async (_, profileId) => {
      return await this.apiService.gologinSDKIsProfileRunning(profileId);
    });

    ipcMain.handle('gologin-sdk:stop-all-profiles', async () => {
      return await this.apiService.gologinSDKStopAllProfiles();
    });
  }

  startAutoSync() {
    // Start auto-sync service after user is authenticated
    if (this.authService.isAuthenticated()) {
      console.log('Starting auto-sync service...');
      this.autoSyncService.start();
    }
  }

  stopAutoSync() {
    console.log('Stopping auto-sync service...');
    this.autoSyncService.stop();
  }
}

const chromeProfileTool = new ChromeProfileTool();

app.whenReady().then(async () => {
  await chromeProfileTool.initialize();
  chromeProfileTool.createWindow();
  
  // Start auto-sync after window is created
  chromeProfileTool.startAutoSync();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      chromeProfileTool.createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Stop auto-sync and cleanup resources
  console.log('Application shutting down...');
  chromeProfileTool.stopAutoSync();
  
  // Cleanup GoLogin SDK (stop all browsers)
  try {
    await chromeProfileTool['apiService'].cleanup();
    console.log('GoLogin SDK cleanup completed');
  } catch (error) {
    console.error('Failed to cleanup GoLogin SDK:', error);
  }
  
  // Logout and clear stored auth to require login on next app start
  try {
    chromeProfileTool['authService'].logout();
    console.log('User logged out on app close');
  } catch (error) {
    console.error('Failed to logout on app close:', error);
  }
});
