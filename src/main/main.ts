import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DatabaseManager } from './database/DatabaseManager';
import { ProfileManager } from './managers/ProfileManager';
import { ProxyManager } from './managers/ProxyManager';
import { GoLoginService } from './services/GoLoginService';

dotenv.config();

class ChromeProfileTool {
  private mainWindow: BrowserWindow | null = null;
  private databaseManager: DatabaseManager;
  private profileManager: ProfileManager;
  private proxyManager: ProxyManager;
  private goLoginService: GoLoginService;

  constructor() {
    this.databaseManager = new DatabaseManager();
    this.profileManager = new ProfileManager(this.databaseManager);
    this.proxyManager = new ProxyManager(this.databaseManager);
    
    const apiToken = process.env.GOLOGIN_API_TOKEN;
    if (!apiToken) {
      throw new Error('GOLOGIN_API_TOKEN is not set in environment variables');
    }
    this.goLoginService = new GoLoginService(apiToken);
  }

  async initialize() {
    await this.databaseManager.initialize();
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
      return await this.profileManager.createProfile(profileData);
    });

    ipcMain.handle('profile:update', async (_, id, updates) => {
      return await this.profileManager.updateProfile(id, updates);
    });

    ipcMain.handle('profile:delete', async (_, id) => {
      return await this.profileManager.deleteProfile(id);
    });

    ipcMain.handle('profile:list', async () => {
      return await this.profileManager.listProfiles();
    });

    ipcMain.handle('profile:launch', async (_, options) => {
      const profile = await this.profileManager.getProfile(options.profile_id);
      if (!profile) {
        throw new Error('Profile not found');
      }

      return await this.goLoginService.launchProfile(profile.id, { headless: options.headless });
    });

    // Proxy management IPC handlers
    ipcMain.handle('proxy:create', async (_, proxyData) => {
      return await this.proxyManager.createProxy(proxyData);
    });

    ipcMain.handle('proxy:update', async (_, id, updates) => {
      return await this.proxyManager.updateProxy(id, updates);
    });

    ipcMain.handle('proxy:delete', async (_, id) => {
      return await this.proxyManager.deleteProxy(id);
    });

    ipcMain.handle('proxy:list', async () => {
      return await this.proxyManager.listProxies();
    });

    ipcMain.handle('proxy:validate', async (_, id) => {
      return await this.proxyManager.validateProxy(id);
    });

    ipcMain.handle('proxy:rotate-ip', async (_, id) => {
      return await this.proxyManager.rotateIP(id);
    });

    ipcMain.handle('proxy:test-config', async (_, config) => {
      return await this.proxyManager.testProxyConfig(config);
    });

    // GoLogin API handlers
    ipcMain.handle('gologin:list-profiles', async (_, page, search, folder) => {
      return await this.goLoginService.listProfiles(page, search, folder);
    });

    ipcMain.handle('gologin:get-profile', async (_, profileId) => {
      return await this.goLoginService.getProfile(profileId);
    });

    ipcMain.handle('gologin:create-profile', async (_, profileData) => {
      return await this.goLoginService.createProfile(profileData);
    });

    ipcMain.handle('gologin:create-quick-profile', async (_, os, name, osSpec) => {
      return await this.goLoginService.createQuickProfile(os, name, osSpec);
    });

    ipcMain.handle('gologin:update-profile', async (_, profileId, profileData) => {
      return await this.goLoginService.updateProfile(profileId, profileData);
    });

    ipcMain.handle('gologin:delete-profile', async (_, profileId) => {
      return await this.goLoginService.deleteProfile(profileId);
    });

    ipcMain.handle('gologin:set-proxy', async (_, profileId, proxy) => {
      return await this.goLoginService.setProfileProxy(profileId, proxy);
    });

    ipcMain.handle('gologin:remove-proxy', async (_, profileId) => {
      return await this.goLoginService.removeProfileProxy(profileId);
    });

    ipcMain.handle('gologin:launch-profile', async (_, profileId, options) => {
      return await this.goLoginService.launchProfile(profileId, options);
    });

    ipcMain.handle('gologin:stop-profile', async (_, profileId) => {
      return await this.goLoginService.stopProfile(profileId);
    });

    ipcMain.handle('gologin:list-workspaces', async () => {
      return await this.goLoginService.listWorkspaces();
    });

    ipcMain.handle('gologin:list-folders', async () => {
      return await this.goLoginService.listFolders();
    });

    ipcMain.handle('gologin:create-folder', async (_, name) => {
      return await this.goLoginService.createFolder(name);
    });

    ipcMain.handle('gologin:list-tags', async () => {
      return await this.goLoginService.listTags();
    });

    ipcMain.handle('gologin:get-proxy-locations', async () => {
      return await this.goLoginService.getProxyLocations();
    });

    ipcMain.handle('gologin:test-connection', async () => {
      return await this.goLoginService.testConnection();
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
