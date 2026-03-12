import * as path from 'path';
import * as os from 'os';

export interface GoLoginSDKProfile {
  id: string;
  name: string;
  notes?: string;
  os: string;
  browserType?: string;
  navigator?: {
    userAgent?: string;
    resolution?: string;
    language?: string;
    platform?: string;
    hardwareConcurrency?: number;
    deviceMemory?: number;
  };
  proxy?: {
    mode?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
}

export interface LaunchResult {
  browser: any;
  wsEndpoint?: string;
  profileId: string;
}

export class GoLoginSDKService {
  private gologinApi: any;
  private apiToken: string;
  private activeBrowsers: Map<string, any> = new Map();
  private activeGologinInstances: Map<string, any> = new Map(); // Store GoLogin instances
  private browserPids: Map<string, number> = new Map(); // Store browser PIDs
  private browserMonitors: Map<string, NodeJS.Timeout> = new Map(); // Monitor intervals
  private tmpDir: string;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private onBrowserClosed?: (profileId: string) => void;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
    this.tmpDir = path.join(os.tmpdir(), 'gologin_profiles');
    
    console.log('GoLogin SDK Service initializing...');
    console.log('Temp directory:', this.tmpDir);
    
    // Start initialization but don't block constructor
    this.initPromise = this.initializeSDK();
  }

  setOnBrowserClosed(callback: (profileId: string) => void) {
    this.onBrowserClosed = callback;
  }

  private async initializeSDK() {
    try {
      // Use eval to bypass TypeScript's static analysis for dynamic import
      const importGologin = new Function('specifier', 'return import(specifier)');
      const gologinModule = await importGologin('gologin');
      this.gologinApi = gologinModule.GologinApi({
        token: this.apiToken,
      });
      this.initialized = true;
      console.log('GoLogin SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize GoLogin SDK:', error);
      throw error;
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      if (this.initPromise) {
        await this.initPromise;
      } else {
        await this.initializeSDK();
      }
    }
  }

  async createProfileRandomFingerprint(name: string, os: 'win' | 'mac' | 'lin' = 'win'): Promise<GoLoginSDKProfile> {
    try {
      await this.ensureInitialized();
      console.log(`Creating profile with random fingerprint: ${name}, OS: ${os}`);
      const profile = await this.gologinApi.createProfileRandomFingerprint(name, os);
      console.log('Profile created:', profile.id);
      return profile;
    } catch (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
  }

  async createProfileWithCustomParams(params: any): Promise<GoLoginSDKProfile> {
    try {
      await this.ensureInitialized();
      console.log('Creating profile with custom params:', params);
      const profile = await this.gologinApi.createProfileWithCustomParams(params);
      console.log('Profile created:', profile.id);
      return profile;
    } catch (error) {
      console.error('Error creating profile with custom params:', error);
      throw error;
    }
  }

  async addGologinProxyToProfile(profileId: string, countryCode: string): Promise<void> {
    try {
      await this.ensureInitialized();
      console.log(`Adding GoLogin proxy to profile ${profileId}, country: ${countryCode}`);
      await this.gologinApi.addGologinProxyToProfile(profileId, countryCode);
      console.log('Proxy added successfully');
    } catch (error) {
      console.error('Error adding proxy:', error);
      throw error;
    }
  }

  async changeProfileProxy(profileId: string, proxy: {
    mode: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
  }): Promise<void> {
    try {
      await this.ensureInitialized();
      console.log(`Changing proxy for profile ${profileId}`);
      await this.gologinApi.changeProfileProxy(profileId, proxy);
      console.log('Proxy changed successfully');
    } catch (error) {
      console.error('Error changing proxy:', error);
      throw error;
    }
  }

  async addCookiesToProfile(profileId: string, cookies: any[]): Promise<void> {
    try {
      await this.ensureInitialized();
      console.log(`Adding cookies to profile ${profileId}`);
      await this.gologinApi.addCookiesToProfile(profileId, cookies);
      console.log('Cookies added successfully');
    } catch (error) {
      console.error('Error adding cookies:', error);
      throw error;
    }
  }

  async refreshProfilesFingerprint(profileIds: string[]): Promise<void> {
    try {
      await this.ensureInitialized();
      console.log(`Refreshing fingerprint for profiles: ${profileIds.join(', ')}`);
      await this.gologinApi.refreshProfilesFingerprint(profileIds);
      console.log('Fingerprints refreshed successfully');
    } catch (error) {
      console.error('Error refreshing fingerprints:', error);
      throw error;
    }
  }

  async updateUserAgentToLatestBrowser(profileIds: string[], workspaceId?: string): Promise<void> {
    try {
      await this.ensureInitialized();
      console.log(`Updating user agent for profiles: ${profileIds.join(', ')}`);
      await this.gologinApi.updateUserAgentToLatestBrowser(profileIds, workspaceId);
      console.log('User agents updated successfully');
    } catch (error) {
      console.error('Error updating user agents:', error);
      throw error;
    }
  }

  async launchProfile(profileId: string, options?: { headless?: boolean }): Promise<LaunchResult> {
    try {
      await this.ensureInitialized();
      console.log(`Launching profile ${profileId} with SDK...`);
      
      if (this.activeBrowsers.has(profileId)) {
        console.log(`Profile ${profileId} is already running`);
        const browser = this.activeBrowsers.get(profileId);
        return {
          browser,
          profileId,
        };
      }

      // Create new GoLogin instance for this profile
      // Note: Do NOT clear cache - let GoLogin SDK manage session sync
      const importGologin = new Function('specifier', 'return import(specifier)');
      const gologinModule = await importGologin('gologin');
      const { GoLogin } = gologinModule;
      
      // Detect OS
      const isWindows = process.platform === 'win32';
      const isMac = process.platform === 'darwin';
      
      // Build extra_params based on OS
      // IMPORTANT: GoLogin SDK internally adds --window-size based on profile's navigator.resolution
      // Do NOT add --window-size in extra_params to avoid conflicts
      let extraParams: string[] = [];
      
      if (options?.headless) {
        extraParams = ['--headless'];
      } else {
        // Common flags for all platforms (no window sizing flags)
        const commonFlags = [
          '--disable-features=RendererCodeIntegrity',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows'
        ];
        
        if (isMac) {
          // macOS: Add window-position to center the window
          const { screen } = require('electron');
          const primaryDisplay = screen.getPrimaryDisplay();
          const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
          const windowWidth = Math.max(Math.floor(screenWidth * 0.85), 1280);
          const windowHeight = Math.max(Math.floor(screenHeight * 0.85), 900);
          const windowX = Math.floor((screenWidth - windowWidth) / 2);
          const windowY = Math.floor((screenHeight - windowHeight) / 2);
          
          extraParams = [
            ...commonFlags,
            '--force-device-scale-factor=1',
            `--window-size=${windowWidth},${windowHeight}`,
            `--window-position=${windowX},${windowY}`,
            '--min-window-size=1280,900'
          ];
        } else {
          // Windows & Linux: No force-device-scale-factor to respect OS display scaling
          extraParams = [...commonFlags];
        }
      }
      
      const gologinInstance = new GoLogin({
        token: this.apiToken,
        profile_id: profileId,
        tmpdir: this.tmpDir,
        extra_params: extraParams,
        uploadCookiesToServer: true,
        writeCookesFromServer: true,
        autoUpdateBrowser: false,
        restoreLastSession: true,
      });

      // Update profile resolution for Windows to match actual screen size
      // GoLogin SDK uses profile's navigator.resolution to set --window-size internally
      // changeProfileResolution() is the official SDK method for this (gologin.js line 1499)
      if (isWindows && !options?.headless) {
        try {
          const { screen } = require('electron');
          const primaryDisplay = screen.getPrimaryDisplay();
          const { width, height } = primaryDisplay.bounds;
          const scaleFactor = primaryDisplay.scaleFactor;
          // Account for Windows display scaling (e.g. 150% scaling on 1920x1080 → bounds returns 1280x720)
          const physicalWidth = Math.round(width * scaleFactor);
          const physicalHeight = Math.round(height * scaleFactor);
          const resolution = `${physicalWidth}x${physicalHeight}`;
          
          await gologinInstance.changeProfileResolution(resolution);
          console.log(`Updated profile resolution to ${resolution} for Windows full screen`);
        } catch (resError) {
          console.warn('Failed to update profile resolution:', resError);
        }
      }

      const { status, wsUrl } = await gologinInstance.start();
      
      if (status !== 'success') {
        throw new Error('Failed to start profile');
      }

      // Get browser PID to kill later
      try {
        const browserProcess = gologinInstance.getOrbitaBrowserPid?.();
        if (browserProcess && typeof browserProcess === 'number') {
          this.browserPids.set(profileId, browserProcess);
          console.log(`Browser PID for profile ${profileId}: ${browserProcess}`);
        }
      } catch (err) {
        console.warn('Could not get browser PID:', err);
      }

      // Store both GoLogin instance and browser info
      this.activeGologinInstances.set(profileId, gologinInstance);
      this.activeBrowsers.set(profileId, { wsUrl });
      
      // Start monitoring browser process
      this.startBrowserMonitoring(profileId);
      
      console.log(`Profile ${profileId} launched successfully via SDK`);
      
      return {
        browser: { wsUrl },
        wsEndpoint: wsUrl,
        profileId,
      };
    } catch (error) {
      console.error(`Error launching profile ${profileId}:`, error);
      throw error;
    }
  }

  private startBrowserMonitoring(profileId: string) {
    const browserPid = this.browserPids.get(profileId);
    if (!browserPid) return;

    // Check every 2 seconds if browser process is still alive
    const monitor = setInterval(() => {
      try {
        // Try to send signal 0 to check if process exists
        process.kill(browserPid, 0);
      } catch (err: any) {
        if (err.code === 'ESRCH') {
          // Process not found - browser was closed
          console.log(`Browser process ${browserPid} for profile ${profileId} was closed manually`);
          this.handleBrowserClosed(profileId);
        }
      }
    }, 2000);

    this.browserMonitors.set(profileId, monitor);
  }

  private async handleBrowserClosed(profileId: string) {
    // Stop monitoring
    const monitor = this.browserMonitors.get(profileId);
    if (monitor) {
      clearInterval(monitor);
      this.browserMonitors.delete(profileId);
    }

    // Upload session data (tabs, cookies) to GoLogin server
    // This is CRITICAL - without this, tabs are lost on next launch
    const gologinInstance = this.activeGologinInstances.get(profileId);
    if (gologinInstance) {
      try {
        console.log(`Browser closed for profile ${profileId}, uploading session data...`);
        await gologinInstance.stop();
        console.log(`Session data uploaded for profile ${profileId}`);
      } catch (err) {
        console.warn(`Failed to upload session for profile ${profileId}:`, err);
      }
    }

    // Cleanup
    this.activeGologinInstances.delete(profileId);
    this.activeBrowsers.delete(profileId);
    this.browserPids.delete(profileId);

    // Notify callback
    if (this.onBrowserClosed) {
      this.onBrowserClosed(profileId);
    }
  }

  async stopProfile(profileId: string): Promise<void> {
    try {
      console.log(`Stopping profile ${profileId}...`);
      
      // Stop monitoring first
      const monitor = this.browserMonitors.get(profileId);
      if (monitor) {
        clearInterval(monitor);
        this.browserMonitors.delete(profileId);
      }
      
      const gologinInstance = this.activeGologinInstances.get(profileId);
      const browserPid = this.browserPids.get(profileId);
      
      if (gologinInstance) {
        // Step 1: Close browser gracefully so Chrome flushes session files to disk
        // This follows the same pattern as GoLogin SDK's killAndCommit():
        // kill browser first → wait → then upload session data
        if (browserPid) {
          try {
            console.log(`Closing browser gracefully (SIGTERM) for profile ${profileId}...`);
            process.kill(browserPid, 'SIGTERM');
            
            // Wait for browser to close (up to 5 seconds)
            for (let i = 0; i < 10; i++) {
              await new Promise(resolve => setTimeout(resolve, 500));
              try {
                process.kill(browserPid, 0); // Check if still alive
              } catch {
                console.log(`Browser process ${browserPid} closed gracefully`);
                break;
              }
            }
            
            // Force kill if still alive after 5 seconds
            try {
              process.kill(browserPid, 0);
              process.kill(browserPid, 'SIGKILL');
              console.log(`Browser process ${browserPid} force killed`);
            } catch {
              // Already dead - good
            }
          } catch (err: any) {
            if (err.code !== 'ESRCH') {
              console.warn(`Error closing browser:`, err);
            }
          }
          this.browserPids.delete(profileId);
        }
        
        // Step 2: Upload session data via GoLogin SDK
        // Browser is now closed, session files are flushed to disk
        try {
          console.log(`Uploading session data for profile ${profileId}...`);
          await gologinInstance.stop();
          console.log(`Session data uploaded for profile ${profileId}`);
        } catch (err) {
          console.warn(`Error uploading session for profile ${profileId}:`, err);
        }
        
        this.activeGologinInstances.delete(profileId);
        this.activeBrowsers.delete(profileId);
      } else {
        console.warn(`No active GoLogin instance found for profile ${profileId}`);
      }
      
      console.log(`Profile ${profileId} stopped successfully`);
    } catch (error) {
      console.error(`Error stopping profile ${profileId}:`, error);
      throw error;
    }
  }

  async stopAllProfiles(): Promise<void> {
    try {
      console.log('Stopping all active profiles...');
      
      const profileIds = Array.from(this.activeGologinInstances.keys());
      const stopPromises = profileIds.map(profileId =>
        this.stopProfile(profileId).catch(err =>
          console.error(`Error stopping profile ${profileId}:`, err)
        )
      );
      
      await Promise.allSettled(stopPromises);
      
      // Final cleanup in case any were missed
      this.activeGologinInstances.clear();
      this.activeBrowsers.clear();
      this.browserPids.clear();
      
      // Clear all monitors
      for (const monitor of this.browserMonitors.values()) {
        clearInterval(monitor);
      }
      this.browserMonitors.clear();
      
      console.log('All profiles stopped');
    } catch (error) {
      console.error('Error stopping all profiles:', error);
      throw error;
    }
  }

  getActiveBrowsers(): string[] {
    return Array.from(this.activeGologinInstances.keys());
  }

  isProfileRunning(profileId: string): boolean {
    return this.activeGologinInstances.has(profileId);
  }

  async cleanup(): Promise<void> {
    await this.stopAllProfiles();
  }
}
