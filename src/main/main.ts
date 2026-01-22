import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ApiService } from './services/ApiService';

// Load .env from project root (2 levels up from dist/main/main/)
dotenv.config({ path: path.join(__dirname, '../../../.env') });

class ChromeProfileTool {
  private mainWindow: BrowserWindow | null = null;
  private apiService: ApiService;

  constructor() {
    this.apiService = new ApiService();
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
  }
}

const chromeProfileTool = new ChromeProfileTool();

app.whenReady().then(async () => {
  await chromeProfileTool.initialize();
  chromeProfileTool.createWindow();

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
  // Cleanup resources
  console.log('Application shutting down...');
});
