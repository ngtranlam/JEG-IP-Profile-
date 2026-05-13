import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { ApiService } from './services/ApiService';
import { AuthService } from './services/AuthService';
import { AutoSyncService } from './services/AutoSyncService';
import { FirebaseService } from './services/FirebaseService';
import { TotpSecret, MultiFactorResolver } from 'firebase/auth';
import { extractDesign, cleanupTempFiles } from './services/DesignToolService';
import { DesignToolReportService } from './services/DesignToolReportService';
import sharp from 'sharp';

// Load .env from multiple possible locations
const possibleEnvPaths = [
  path.join(__dirname, '../../../.env'), // Dev mode
  path.join(process.resourcesPath, '.env'), // Production - extraResources
  path.join(process.resourcesPath, 'app', '.env'), // Alternative path
  path.join(app.getPath('userData'), '.env'), // User data directory
  path.join(process.cwd(), '.env'), // Current working directory
];

console.log('=== Environment Loading ===');
console.log('process.resourcesPath:', process.resourcesPath);
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
console.log('Checking .env paths:');

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  const exists = fs.existsSync(envPath);
  console.log(`  ${envPath}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
  if (exists && !envLoaded) {
    console.log(`✓ Loading .env from: ${envPath}`);
    dotenv.config({ path: envPath });
    envLoaded = true;
  }
}

// Verify GOLOGIN_API_TOKEN is loaded
if (!process.env.GOLOGIN_API_TOKEN) {
  console.error('❌ GOLOGIN_API_TOKEN not found in environment variables');
  console.error('Please ensure .env file exists in one of the checked paths');
} else {
  console.log('✓ GOLOGIN_API_TOKEN loaded successfully');
}

// Helper: recursively copy a directory
function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

class ChromeProfileTool {
  private mainWindow: BrowserWindow | null = null;
  private apiService: ApiService;
  private authService: AuthService;
  private autoSyncService: AutoSyncService;
  private firebaseService: FirebaseService;
  private pendingTotpSecret: TotpSecret | null = null;
  private pendingMfaResolver: MultiFactorResolver | null = null;
  private reportService: DesignToolReportService;

  constructor() {
    const apiBaseUrl = process.env.API_BASE_URL || 'https://profile.jegdn.com/api';
    this.apiService = new ApiService();
    this.authService = new AuthService(apiBaseUrl);
    this.autoSyncService = new AutoSyncService(this.apiService, this.authService);
    this.firebaseService = new FirebaseService();
    this.reportService = new DesignToolReportService();
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
      this.mainWindow.loadURL(
        isDev
          ? 'http://localhost:5173'
          : `file://${path.join(__dirname, '../../renderer/index.html')}`
      );
      // TEMPORARY: Open DevTools for debugging
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

    ipcMain.handle('gologin:get-browser-versions', async () => {
      return await this.apiService.gologinGetBrowserVersions();
    });

    ipcMain.handle('gologin:get-browser-version-detail', async (_, majorVersion) => {
      return await this.apiService.gologinGetBrowserVersionDetail(majorVersion);
    });

    ipcMain.handle('gologin:get-fingerprint', async (_, os, resolution) => {
      return await this.apiService.gologinGetFingerprint(os, resolution);
    });

    ipcMain.handle('gologin:get-cookies', async (_, profileId) => {
      return await this.apiService.gologinGetCookies(profileId);
    });

    ipcMain.handle('gologin:import-cookies', async (_, profileId, cookies) => {
      return await this.apiService.gologinImportCookies(profileId, cookies);
    });

    ipcMain.handle('gologin:remove-cookies', async (_, profileId) => {
      return await this.apiService.gologinRemoveCookies(profileId);
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

    // Profile-Folder management IPC handlers
    ipcMain.handle('local-data:assign-profile-folders', async (_, profileId, folderIds) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.assignProfileToFolders(token, profileId, folderIds);
    });

    ipcMain.handle('local-data:remove-profile-folders', async (_, profileId, folderIds) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.removeProfileFromFolders(token, profileId, folderIds);
    });

    ipcMain.handle('local-data:set-profile-folders', async (_, profileId, folderIds) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.setProfileFolders(token, profileId, folderIds);
    });

    ipcMain.handle('local-data:get-profile-folders', async (_, profileId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getProfileFolders(token, profileId);
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

    // Team management IPC handlers
    ipcMain.handle('teams:list', async () => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getTeams(token);
    });

    ipcMain.handle('teams:create', async (_, data) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.createTeam(token, data);
    });

    ipcMain.handle('teams:update', async (_, teamId, data) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.updateTeam(token, teamId, data);
    });

    ipcMain.handle('teams:delete', async (_, teamId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.deleteTeam(token, teamId);
    });

    ipcMain.handle('teams:get-members', async (_, teamId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getTeamMembers(token, teamId);
    });

    ipcMain.handle('teams:add-member', async (_, teamId, userId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.addTeamMember(token, teamId, userId);
    });

    ipcMain.handle('teams:remove-member', async (_, teamId, userId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.removeTeamMember(token, teamId, userId);
    });

    ipcMain.handle('teams:get-member-folders', async (_, teamId, userId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getMemberFolders(token, teamId, userId);
    });

    ipcMain.handle('teams:set-member-folders', async (_, teamId, userId, folderIds) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.setMemberFolders(token, teamId, userId, folderIds);
    });

    // External Proxy Management IPC handlers
    ipcMain.handle('ext-proxy:list', async (_, filters) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getExternalProxyList(token, filters || {});
    });

    ipcMain.handle('ext-proxy:stats', async (_, sellerUsername) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getExternalProxyStats(token, sellerUsername);
    });

    ipcMain.handle('ext-proxy:detail', async (_, proxyId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getExternalProxyDetail(token, proxyId);
    });

    ipcMain.handle('ext-proxy:order-options', async (_, serviceType, planId) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getProxyOrderOptions(token, serviceType, planId);
    });

    ipcMain.handle('ext-proxy:calculate-price', async (_, orderData) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.calculateProxyPrice(token, orderData);
    });

    ipcMain.handle('ext-proxy:order', async (_, orderData) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.placeProxyOrder(token, orderData);
    });

    ipcMain.handle('ext-proxy:sync', async () => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.syncExternalProxies(token);
    });

    // ===== v2 Write IPC handlers =====

    ipcMain.handle('ext-proxy:update-note', async (_, proxyId, notes) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.updateProxyNote(token, proxyId, notes);
    });

    ipcMain.handle('ext-proxy:extension-price', async (_, proxyId, periodInMonths) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getProxyExtensionPrice(token, proxyId, periodInMonths);
    });

    ipcMain.handle('ext-proxy:extend', async (_, proxyId, periodInMonths, couponCode) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.extendProxy(token, proxyId, periodInMonths, couponCode);
    });

    ipcMain.handle('ext-proxy:add-manual', async (_, data) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.addManualProxy(token, data);
    });

    ipcMain.handle('ext-proxy:update-manual-expiration', async (_, proxyId, expiresAt) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.updateManualProxyExpiration(token, proxyId, expiresAt);
    });

    ipcMain.handle('ext-proxy:change-whitelisted-ips', async (_, proxyId, ips) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.changeProxyWhitelistedIps(token, proxyId, ips);
    });

    ipcMain.handle('ext-proxy:sellers', async () => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.getProxySellers(token);
    });

    ipcMain.handle('ext-proxy:update-seller', async (_, proxyId, sellerUsername) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.updateProxySeller(token, proxyId, sellerUsername);
    });

    ipcMain.handle('ext-proxy:delete', async (_, proxyId, reason) => {
      const token = this.authService.getCurrentToken();
      if (!token) throw new Error('Not authenticated');
      return await this.apiService.deleteExternalProxy(token, proxyId, reason);
    });

    // Design Tool IPC handlers
    ipcMain.handle('design-tool:extract', async (_, options) => {
      try {
        const token = this.authService.getCurrentToken();
        if (!token) throw new Error('Not authenticated');
        
        const imageBuffer = Buffer.from(options.imageBase64, 'base64');
        const result = await extractDesign(this.apiService, {
          imageBuffer,
          outputSize: options.outputSize,
          designType: options.designType,
          removeBackground: options.removeBackground,
          upscaleEnabled: options.upscaleEnabled,
          upscaleScale: options.upscaleScale,
          redesignEnabled: options.redesignEnabled,
          redesignPrompt: options.redesignPrompt,
          cropCoordinates: options.cropCoordinates,
          authToken: token,
          aiModel: options.aiModel,
        });
        return result;
      } catch (error: any) {
        console.error('[DesignTool IPC] Extract failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    // Design Tool Report IPC handlers
    ipcMain.handle('report:track-usage', async (_, toolType, optionsUsed, requestId) => {
      try {
        // Always ensure username is set from current auth
        const user = this.authService.getCurrentUser();
        if (user?.userName) {
          this.reportService.setUsername(user.userName);
        }
        console.log(`[ReportAPI IPC] Tracking: ${toolType}, user=${this.reportService.getUsername()}`);
        return await this.reportService.trackUsage(toolType, optionsUsed || {}, requestId);
      } catch (error: any) {
        console.error('[ReportAPI IPC] Track usage failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('report:usage-report', async (_, startDate, endDate) => {
      try {
        const user = this.authService.getCurrentUser();
        if (user?.userName) {
          this.reportService.setUsername(user.userName);
        }
        return await this.reportService.getUsageReport(startDate, endDate);
      } catch (error: any) {
        console.error('[ReportAPI IPC] Get report failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    // Image Gen IPC handler
    ipcMain.handle('image-gen:generate', async (_, options) => {
      try {
        const token = this.authService.getCurrentToken();
        if (!token) throw new Error('Not authenticated');
        
        console.log('[ImageGen IPC] Starting mockup generation:', {
          platform: options.platform,
          mockupType: options.mockupType,
          aspectRatio: options.aspectRatio,
          frameSize: `${options.frameWidth}x${options.frameHeight}`,
        });

        // Step 0: Process image with frame data (matching processImageWithFrame from source)
        const originalBuffer = Buffer.from(options.imageBase64, 'base64');
        const metadata = await sharp(originalBuffer).metadata();
        const origW = metadata.width || 0;
        const origH = metadata.height || 0;
        const imgScale = options.imageScale || 1;
        const frameW = Math.round(options.frameWidth || 300);
        const frameH = Math.round(options.frameHeight || 300);
        const posX = Math.round(options.imagePositionX || 0);
        const posY = Math.round(options.imagePositionY || 0);

        // Scale original image
        const scaledW = Math.round(origW * imgScale);
        const scaledH = Math.round(origH * imgScale);
        const scaledBuffer = await sharp(originalBuffer)
          .resize(scaledW, scaledH, { fit: 'fill' })
          .png()
          .toBuffer();

        // Calculate visible portion of scaled image within frame bounds
        // (matching imagecopy behavior in PHP which auto-clips to canvas)
        const srcX = Math.max(0, -posX);
        const srcY = Math.max(0, -posY);
        const dstX = Math.max(0, posX);
        const dstY = Math.max(0, posY);
        const copyW = Math.min(scaledW - srcX, frameW - dstX);
        const copyH = Math.min(scaledH - srcY, frameH - dstY);

        // Extract only the visible portion
        const visibleBuffer = await sharp(scaledBuffer)
          .extract({ left: srcX, top: srcY, width: Math.max(1, copyW), height: Math.max(1, copyH) })
          .png()
          .toBuffer();

        // Create frame canvas and composite visible portion at position
        const frameBuffer = await sharp({
          create: { width: frameW, height: frameH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
        })
          .composite([{ input: visibleBuffer, left: dstX, top: dstY }])
          .png()
          .toBuffer();

        const processedBase64 = frameBuffer.toString('base64');
        console.log('[ImageGen IPC] Frame processed:', `${frameW}x${frameH}`, `scaled: ${scaledW}x${scaledH}`, `pos: ${posX},${posY}`);

        // Step 1-2: Call Gemini via server with processed image
        const result = await this.apiService.designToolGenerateMockup(token, {
          imageBase64: processedBase64,
          platform: options.platform,
          processingType: options.processingType,
          mockupSide: options.mockupSide,
          modelEnabled: options.modelEnabled,
          gender: options.gender,
          pose: options.pose,
          ageMin: options.ageMin,
          ageMax: options.ageMax,
          customPrompt: options.customPrompt,
          mockupType: options.mockupType,
          color: options.color,
          referenceImageBase64: options.referenceImageBase64,
          aspectRatio: options.aspectRatio,
        });

        if (!result || !result.success || !result.imageBase64) {
          throw new Error(result?.error || 'Mockup generation failed');
        }

        // Step 3-4: Scale Gemini result to target size and place on canvas (matching source)
        const targetSize = options.aspectRatio === '9:16'
          ? { width: 576, height: 1024 }
          : { width: 1024, height: 1024 };

        const geminiBuffer = Buffer.from(result.imageBase64, 'base64');
        const geminiMeta = await sharp(geminiBuffer).metadata();
        const gW = geminiMeta.width || 1024;
        const gH = geminiMeta.height || 1024;

        // Scale to fit target while maintaining aspect ratio
        const scaleX = targetSize.width / gW;
        const scaleY = targetSize.height / gH;
        const fitScale = Math.min(scaleX, scaleY);
        const newW = Math.round(gW * fitScale);
        const newH = Math.round(gH * fitScale);

        const scaledResult = await sharp(geminiBuffer)
          .resize(newW, newH, { fit: 'fill' })
          .png()
          .toBuffer();

        // Place on target-size canvas (centered)
        const offsetX = Math.round((targetSize.width - newW) / 2);
        const offsetY = Math.round((targetSize.height - newH) / 2);

        const finalBuffer = await sharp({
          create: { width: targetSize.width, height: targetSize.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
        })
          .composite([{ input: scaledResult, left: offsetX, top: offsetY }])
          .png()
          .toBuffer();

        const finalBase64 = finalBuffer.toString('base64');
        console.log('[ImageGen IPC] Final output:', `${targetSize.width}x${targetSize.height}`);

        return { success: true, imageBase64: finalBase64 };
      } catch (error: any) {
        console.error('[ImageGen IPC] Failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    // Upscale IPC handlers
    ipcMain.handle('upscale:start', async (_, options) => {
      try {
        const token = this.authService.getCurrentToken();
        if (!token) throw new Error('Not authenticated');

        console.log('[Upscale IPC] Starting upscale:', {
          model: options.model,
          scale: options.scale,
          enhanceFace: options.enhanceFace,
        });

        const result = await this.apiService.designToolUpscaleStart(
          token,
          options.imageBase64,
          options.scale,
          options.model,
          options.enhanceFace,
        );

        if (result && result.success && result.taskId) {
          return { success: true, taskId: result.taskId };
        } else {
          throw new Error(result?.error || 'Failed to start upscale task');
        }
      } catch (error: any) {
        console.error('[Upscale IPC] Start failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('upscale:status', async (_, taskId: string) => {
      try {
        const token = this.authService.getCurrentToken();
        if (!token) throw new Error('Not authenticated');

        const result = await this.apiService.designToolUpscaleStatus(token, taskId);
        return result;
      } catch (error: any) {
        console.error('[Upscale IPC] Status check failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('upscale:download', async (_, downloadUrl: string) => {
      try {
        const token = this.authService.getCurrentToken();
        if (!token) throw new Error('Not authenticated');

        console.log('[Upscale IPC] Downloading result...');
        const result = await this.apiService.designToolUpscaleDownload(token, downloadUrl);

        if (result && result.success && result.imageBase64) {
          return { success: true, imageBase64: result.imageBase64, size: result.size };
        } else {
          throw new Error(result?.error || 'Failed to download upscale result');
        }
      } catch (error: any) {
        console.error('[Upscale IPC] Download failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    // Video Script Generation IPC handler
    ipcMain.handle('video:generate-script', async (_, imageBase64: string, duration: string, animation: string) => {
      try {
        const token = this.authService.getCurrentToken();
        if (!token) throw new Error('Not authenticated');

        console.log('[Video IPC] Generating script...', { duration, animation });
        const result = await this.apiService.designToolVideoGenerateScript(token, imageBase64, duration, animation);
        return result;
      } catch (error: any) {
        console.error('[Video IPC] Generate script failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    // Video Gen IPC handlers
    ipcMain.handle('video:start', async (_, options) => {
      try {
        const token = this.authService.getCurrentToken();
        if (!token) throw new Error('Not authenticated');

        console.log('[Video IPC] Starting video gen:', {
          aiModel: options.aiModel,
          duration: options.duration,
          dualMode: options.dualMode,
        });

        const result = await this.apiService.designToolVideoStart(token, {
          imageBase64: options.imageBase64,
          secondImageBase64: options.secondImageBase64,
          prompt: options.prompt,
          aiModel: options.aiModel,
          duration: options.duration,
          dualMode: options.dualMode,
        });

        if (result && result.success && result.taskId) {
          return { success: true, taskId: result.taskId };
        } else {
          throw new Error(result?.error || 'Failed to start video task');
        }
      } catch (error: any) {
        console.error('[Video IPC] Start failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('video:status', async (_, taskId: string, isMotionControl: boolean) => {
      try {
        const token = this.authService.getCurrentToken();
        if (!token) throw new Error('Not authenticated');

        const result = await this.apiService.designToolVideoStatus(token, taskId, isMotionControl);
        return result;
      } catch (error: any) {
        console.error('[Video IPC] Status check failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('video:download', async (_, videoUrl: string) => {
      try {
        const token = this.authService.getCurrentToken();
        if (!token) throw new Error('Not authenticated');

        console.log('[Video IPC] Downloading video...');
        const result = await this.apiService.designToolVideoDownload(token, videoUrl);

        if (result && result.success && result.videoBase64) {
          return { success: true, videoBase64: result.videoBase64, size: result.size };
        } else {
          throw new Error(result?.error || 'Failed to download video');
        }
      } catch (error: any) {
        console.error('[Video IPC] Download failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('motion:start', async (_, options) => {
      try {
        const token = this.authService.getCurrentToken();
        if (!token) throw new Error('Not authenticated');

        console.log('[Motion IPC] Starting motion control:', {
          mode: options.mode,
          keepOriginalSound: options.keepOriginalSound,
        });

        const result = await this.apiService.designToolMotionStart(token, {
          referenceImageBase64: options.referenceImageBase64,
          videoUrl: options.videoUrl,
          prompt: options.prompt,
          mode: options.mode,
          keepOriginalSound: options.keepOriginalSound,
        });

        if (result && result.success && result.taskId) {
          return { success: true, taskId: result.taskId };
        } else {
          throw new Error(result?.error || 'Failed to start motion control task');
        }
      } catch (error: any) {
        console.error('[Motion IPC] Start failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('design-tool:save-video', async (_, base64Data: string, filename?: string) => {
      try {
        const result = await dialog.showSaveDialog({
          defaultPath: filename || `kling_video_${Date.now()}.mp4`,
          filters: [{ name: 'Video Files', extensions: ['mp4'] }]
        });
        if (!result.canceled && result.filePath) {
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(result.filePath, buffer);
          return { success: true, filePath: result.filePath };
        }
        return { success: false, error: 'Cancelled' };
      } catch (error: any) {
        console.error('[Video IPC] Save video failed:', error.message);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('design-tool:cleanup', async () => {
      cleanupTempFiles();
      return { success: true };
    });

    ipcMain.handle('design-tool:save-result', async (_, base64Data, filename) => {
      try {
        const result = await dialog.showSaveDialog({
          defaultPath: filename || `design_result_${Date.now()}.png`,
          filters: [{ name: 'PNG Images', extensions: ['png'] }]
        });
        if (!result.canceled && result.filePath) {
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(result.filePath, buffer);
          return { success: true, filePath: result.filePath };
        }
        return { success: false, error: 'Cancelled' };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
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

        // Set username for report service
        if (result.user?.userName) {
          this.reportService.setUsername(result.user.userName);
          console.log(`[ReportAPI] Username set: ${result.user.userName}`);
        }

        return { success: true, data: result };
      } catch (error: any) {
        console.error('[Login] Error occurred:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('auth:logout', async () => {
      this.reportService.setUsername('');
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
        
        if (loginResult.user?.userName) {
          this.reportService.setUsername(loginResult.user.userName);
        }
        
        return { success: true, data: loginResult };
      } catch (error: any) {
        console.error('[ForcePasswordChange] Error:', error);
        throw new Error(error.message || 'Failed to change password');
      }
    });

    ipcMain.handle('auth:validate-token', async () => {
      const result = await this.authService.validateToken();
      // Ensure report service username is set after token validation
      if (result?.userName && !this.reportService.getUsername()) {
        this.reportService.setUsername(result.userName);
        console.log(`[ReportAPI] Username set from validate-token: ${result.userName}`);
      }
      return result;
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
          
          if (loginResult.user?.userName) {
            this.reportService.setUsername(loginResult.user.userName);
          }
          
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

    // Saved credentials handlers
    ipcMain.handle('auth:save-credentials', async (_, userName, password) => {
      try {
        const credentialsPath = path.join(app.getPath('userData'), 'saved-credentials.json');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 60); // 60 days from now
        
        const credentials = {
          userName,
          password: Buffer.from(password).toString('base64'), // Simple encoding
          expiresAt: expiresAt.toISOString()
        };
        
        fs.writeFileSync(credentialsPath, JSON.stringify(credentials), 'utf-8');
        console.log('Credentials saved for 60 days');
        return { success: true };
      } catch (error: any) {
        console.error('Failed to save credentials:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('auth:clear-saved-credentials', async () => {
      try {
        const credentialsPath = path.join(app.getPath('userData'), 'saved-credentials.json');
        if (fs.existsSync(credentialsPath)) {
          fs.unlinkSync(credentialsPath);
          console.log('Saved credentials cleared');
        }
        return { success: true };
      } catch (error: any) {
        console.error('Failed to clear credentials:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('auth:get-saved-credentials', async () => {
      try {
        const credentialsPath = path.join(app.getPath('userData'), 'saved-credentials.json');
        if (!fs.existsSync(credentialsPath)) {
          return null;
        }
        
        const data = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
        const expiresAt = new Date(data.expiresAt);
        
        // Check if credentials expired
        if (expiresAt < new Date()) {
          console.log('Saved credentials expired, removing...');
          fs.unlinkSync(credentialsPath);
          return null;
        }
        
        return {
          userName: data.userName,
          password: Buffer.from(data.password, 'base64').toString('utf-8'),
          expiresAt: data.expiresAt
        };
      } catch (error: any) {
        console.error('Failed to get saved credentials:', error);
        return null;
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

    // Extension management IPC handlers
    ipcMain.handle('extension:select-folder', async () => {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) return null;
      
      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
        title: 'Select Extension Folder',
      });
      
      if (result.canceled || result.filePaths.length === 0) return null;
      
      const folderPath = result.filePaths[0];
      const manifestPath = path.join(folderPath, 'manifest.json');
      
      if (!fs.existsSync(manifestPath)) {
        return { error: 'No manifest.json found in selected folder. Please select a valid Chrome extension folder.' };
      }
      
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const extName = manifest.name || path.basename(folderPath);
        const extVersion = manifest.version || '0.0.0';
        
        // Look for icon
        let iconPath = '';
        const icons = manifest.icons || {};
        const iconSizes = ['128', '64', '48', '32', '16'];
        for (const size of iconSizes) {
          if (icons[size]) {
            const fullIconPath = path.join(folderPath, icons[size]);
            if (fs.existsSync(fullIconPath)) {
              iconPath = fullIconPath;
              break;
            }
          }
        }
        
        return {
          name: extName,
          version: extVersion,
          folderPath,
          iconPath,
          manifestVersion: manifest.manifest_version || 2,
          description: manifest.description || '',
        };
      } catch (err: any) {
        return { error: `Failed to parse manifest.json: ${err.message}` };
      }
    });

    ipcMain.handle('extension:add-to-profile', async (_, profileId: string, extensionData: { name: string; version: string; folderPath: string; iconPath: string }) => {
      try {
        const extensionsDir = path.join(app.getPath('userData'), 'extensions', profileId);
        if (!fs.existsSync(extensionsDir)) {
          fs.mkdirSync(extensionsDir, { recursive: true });
        }
        
        // Generate unique ID for this extension
        const extId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const destDir = path.join(extensionsDir, extId);
        
        // Copy extension folder to managed location
        copyDirSync(extensionData.folderPath, destDir);
        
        // Read icon as base64 if available
        let iconBase64 = '';
        if (extensionData.iconPath && fs.existsSync(extensionData.iconPath)) {
          const iconBuffer = fs.readFileSync(extensionData.iconPath);
          const ext = path.extname(extensionData.iconPath).toLowerCase();
          const mimeType = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : 'image/jpeg';
          iconBase64 = `data:${mimeType};base64,${iconBuffer.toString('base64')}`;
        }
        
        // Save metadata
        const metadataPath = path.join(extensionsDir, 'extensions.json');
        let metadata: any[] = [];
        if (fs.existsSync(metadataPath)) {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        }
        
        metadata.push({
          id: extId,
          name: extensionData.name,
          version: extensionData.version,
          path: destDir,
          icon: iconBase64,
          addedAt: new Date().toISOString(),
        });
        
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
        
        return { success: true, extension: metadata[metadata.length - 1] };
      } catch (err: any) {
        console.error('[Extension] Failed to add:', err);
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('extension:remove-from-profile', async (_, profileId: string, extensionId: string) => {
      try {
        const extensionsDir = path.join(app.getPath('userData'), 'extensions', profileId);
        const metadataPath = path.join(extensionsDir, 'extensions.json');
        
        if (!fs.existsSync(metadataPath)) {
          return { success: false, error: 'No extensions found' };
        }
        
        let metadata: any[] = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        const ext = metadata.find(e => e.id === extensionId);
        
        if (ext && ext.path && fs.existsSync(ext.path)) {
          fs.rmSync(ext.path, { recursive: true, force: true });
        }
        
        metadata = metadata.filter(e => e.id !== extensionId);
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
        
        return { success: true };
      } catch (err: any) {
        console.error('[Extension] Failed to remove:', err);
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle('extension:get-profile-extensions', async (_, profileId: string) => {
      try {
        const metadataPath = path.join(app.getPath('userData'), 'extensions', profileId, 'extensions.json');
        if (!fs.existsSync(metadataPath)) {
          return [];
        }
        return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      } catch (err: any) {
        console.error('[Extension] Failed to get extensions:', err);
        return [];
      }
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
