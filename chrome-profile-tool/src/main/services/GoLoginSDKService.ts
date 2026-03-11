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
      let extraParams: string[] = [];
      
      if (options?.headless) {
        extraParams = ['--headless'];
      } else {
        // Common flags for all platforms
        const commonFlags = [
          '--disable-features=RendererCodeIntegrity',
          '--force-device-scale-factor=1',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows'
        ];
        
        if (isWindows) {
          // Windows: Use CDP for window management (no Chrome window flags)
          // Chrome flags like --start-maximized are unreliable on Windows
          extraParams = [
            ...commonFlags,
            '--disable-infobars'
          ];
        } else if (isMac) {
          // macOS: Use dynamic window sizing (respects menu bar and dock)
          const { screen } = require('electron');
          const primaryDisplay = screen.getPrimaryDisplay();
          const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
          
          // Calculate optimal window size (85% of screen, minimum 1280x900 for UI compatibility)
          const windowWidth = Math.max(Math.floor(screenWidth * 0.85), 1280);
          const windowHeight = Math.max(Math.floor(screenHeight * 0.85), 900);
          
          // Calculate center position
          const windowX = Math.floor((screenWidth - windowWidth) / 2);
          const windowY = Math.floor((screenHeight - windowHeight) / 2);
          
          extraParams = [
            ...commonFlags,
            `--window-size=${windowWidth},${windowHeight}`,
            `--window-position=${windowX},${windowY}`,
            '--min-window-size=1280,900'
          ];
        } else {
          // Linux or other: Use maximize
          extraParams = [
            ...commonFlags,
            '--start-maximized'
          ];
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

      const { status, wsUrl } = await gologinInstance.start();
      
      if (status !== 'success') {
        throw new Error('Failed to start profile');
      }

      // Apply CDP-based window management for Windows (GoLogin support recommendation)
      // Chrome flags like --start-maximized are unreliable on Windows when launched programmatically
      if (isWindows && !options?.headless) {
        try {
          console.log('[CDP] Starting window management for Windows...');
          console.log('[CDP] WebSocket URL:', wsUrl);
          
          // Wait a bit for browser to fully initialize
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const { screen } = require('electron');
          const primaryDisplay = screen.getPrimaryDisplay();
          const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
          console.log(`[CDP] Target screen size: ${screenWidth}x${screenHeight}`);
          
          // Connect to browser via CDP
          const CDP = require('chrome-remote-interface');
          console.log('[CDP] Attempting to connect to browser...');
          
          // Try different connection methods
          let client;
          try {
            // Method 1: Direct wsUrl
            client = await CDP({ target: wsUrl });
          } catch (e1) {
            console.log('[CDP] Direct wsUrl failed, trying alternative methods...');
            try {
              // Method 2: Parse wsUrl to get port and connect differently
              const url = new URL(wsUrl);
              const port = url.port || '9222';
              client = await CDP({ port: parseInt(port) });
            } catch (e2) {
              console.log('[CDP] Port-based connection failed, trying localhost...');
              // Method 3: Default localhost connection
              client = await CDP();
            }
          }
          
          console.log('[CDP] Successfully connected to browser');
          const { Browser } = client;
          
          // Step 1: Get current viewport info (as recommended by GoLogin support)
          console.log('[CDP] Getting current window info...');
          const viewport = await Browser.getWindowForTarget();
          console.log('[CDP] Current viewport:', JSON.stringify(viewport, null, 2));
          
          // Step 2: Set window bounds to full screen using the windowId from viewport
          console.log(`[CDP] Setting window bounds to ${screenWidth}x${screenHeight}...`);
          const result = await Browser.setWindowBounds({
            windowId: viewport.windowId,
            bounds: {
              left: 0,
              top: 0,
              width: screenWidth,
              height: screenHeight,
              windowState: 'normal'
            }
          });
          
          console.log('[CDP] SetWindowBounds result:', JSON.stringify(result, null, 2));
          
          // Verify the change
          const newViewport = await Browser.getWindowForTarget();
          console.log('[CDP] New viewport after resize:', JSON.stringify(newViewport, null, 2));
          
          console.log(`[CDP] Successfully set window bounds to ${screenWidth}x${screenHeight}`);
          await client.close();
        } catch (error: any) {
          console.error('[CDP] Failed to set window bounds via CDP:', error);
          console.error('[CDP] Error details:', {
            message: error?.message || 'Unknown error',
            stack: error?.stack || 'No stack trace',
            wsUrl: wsUrl
          });
          // Continue execution even if CDP fails - browser will still work with default size
        }
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

  private handleBrowserClosed(profileId: string) {
    // Stop monitoring
    const monitor = this.browserMonitors.get(profileId);
    if (monitor) {
      clearInterval(monitor);
      this.browserMonitors.delete(profileId);
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
        try {
          console.log(`Stopping profile ${profileId} via SDK...`);
          
          // Use GoLogin's stop method - it handles cookie upload internally
          await gologinInstance.stop();
          console.log(`Profile ${profileId} stopped - waiting for session upload...`);
        } catch (err) {
          console.warn(`Error stopping GoLogin instance:`, err);
        }
        
        // Wait longer for session to upload to server
        // This is critical for fast open/close cycles
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('Session upload completed');
        
        // Kill browser process
        if (browserPid) {
          try {
            process.kill(browserPid, 'SIGKILL');
            console.log(`Browser process ${browserPid} killed`);
          } catch (err: any) {
            if (err.code !== 'ESRCH') {
              console.warn(`Error killing browser:`, err);
            }
          }
          this.browserPids.delete(profileId);
        }
        
        // Cleanup any remaining processes
        try {
          const { execSync } = require('child_process');
          execSync(`pkill -9 -f "gologin_profile_${profileId}"`, { stdio: 'ignore' });
        } catch (err) {
          // Ignore
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
      
      const stopPromises = [];
      for (const [profileId, gologinInstance] of this.activeGologinInstances.entries()) {
        stopPromises.push(
          (async () => {
            try {
              await gologinInstance.stop();
              console.log(`Profile ${profileId} stopped and cookies uploaded`);
            } catch (error) {
              console.error(`Error stopping profile ${profileId}:`, error);
            }
            
            // Kill browser process
            const browserPid = this.browserPids.get(profileId);
            if (browserPid) {
              try {
                process.kill(browserPid, 'SIGKILL');
                console.log(`Browser process ${browserPid} killed for profile ${profileId}`);
              } catch (err: any) {
                if (err.code !== 'ESRCH') {
                  console.warn(`Error killing browser process ${browserPid}:`, err);
                }
              }
            }
          })()
        );
      }
      
      await Promise.allSettled(stopPromises);
      
      // Kill all Orbita processes as final cleanup
      try {
        const { execSync } = require('child_process');
        execSync('pkill -9 -f "Orbita"', { stdio: 'ignore' });
        console.log('Killed all remaining Orbita processes');
      } catch (err) {
        // Ignore errors
      }
      
      this.activeGologinInstances.clear();
      this.activeBrowsers.clear();
      this.browserPids.clear();
      
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
