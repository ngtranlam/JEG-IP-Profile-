import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ApiService } from './services/ApiService';
import { AuthService } from './services/AuthService';
import { AutoSyncService } from './services/AutoSyncService';

// Load .env from project root (2 levels up from dist/main/main/)
dotenv.config({ path: path.join(__dirname, '../../../.env') });

class ChromeProfileTool {
  private mainWindow: BrowserWindow | null = null;
  private apiService: ApiService;
  private authService: AuthService;
  private autoSyncService: AutoSyncService;

  constructor() {
    const apiBaseUrl = process.env.API_BASE_URL || 'https://profile.jegdn.com/api';
    this.apiService = new ApiService();
    this.authService = new AuthService(apiBaseUrl);
    this.autoSyncService = new AutoSyncService(this.apiService, this.authService);
  }

  async initialize() {
    this.setupIPC();
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
        const result = await this.authService.login(userName, password);
        return { success: true, data: result };
      } catch (error: any) {
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
        await this.apiService.changePassword(token, oldPassword, newPassword);
      } catch (error: any) {
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
});
