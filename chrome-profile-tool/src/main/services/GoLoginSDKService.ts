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
      
      const gologinInstance = new GoLogin({
        token: this.apiToken,
        profile_id: profileId,
        tmpdir: this.tmpDir,
        extra_params: options?.headless ? ['--headless'] : ['--start-maximized'],
        uploadCookiesToServer: true,
        writeCookesFromServer: true,
        autoUpdateBrowser: false,
        restoreLastSession: true,
      });

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
