import { Profile, Proxy } from '../../shared/types';

export interface GoLoginProfile {
  id: string;
  name: string;
  notes?: string;
  os: string;
  startUrl?: string;
  googleServicesEnabled?: boolean;
  lockEnabled?: boolean;
  navigator?: {
    userAgent?: string;
    resolution?: string;
    language?: string;
    platform?: string;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    maxTouchPoints?: number;
  };
  geoProxyInfo?: {
    fillBasedOnIp?: boolean;
    timezone?: {
      enabled?: boolean;
      fillBasedOnIp?: boolean;
      timezone?: string;
    };
    locale?: {
      enabled?: boolean;
      fillBasedOnIp?: boolean;
      value?: string;
    };
    geolocation?: {
      enabled?: boolean;
      fillBasedOnIp?: boolean;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
    };
  };
  storage?: {
    local?: boolean;
    extensions?: boolean;
    bookmarks?: boolean;
    history?: boolean;
    passwords?: boolean;
    session?: boolean;
  };
  proxyEnabled?: boolean;
  proxy?: {
    mode?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    changeIpUrl?: string;
  };
}

export interface GoLoginCreateProfileRequest {
  name: string;
  notes?: string;
  os: 'win' | 'mac' | 'lin';
  startUrl?: string;
  googleServicesEnabled?: boolean;
  lockEnabled?: boolean;
  navigator?: {
    userAgent?: string;
    resolution?: string;
    language?: string;
    platform?: string;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    maxTouchPoints?: number;
  };
  geoProxyInfo?: {
    fillBasedOnIp?: boolean;
    timezone?: {
      enabled?: boolean;
      fillBasedOnIp?: boolean;
      timezone?: string;
    };
    locale?: {
      enabled?: boolean;
      fillBasedOnIp?: boolean;
      value?: string;
    };
    geolocation?: {
      enabled?: boolean;
      fillBasedOnIp?: boolean;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
    };
  };
  storage?: {
    local?: boolean;
    extensions?: boolean;
    bookmarks?: boolean;
    history?: boolean;
    passwords?: boolean;
    session?: boolean;
  };
  proxyEnabled?: boolean;
  proxy?: {
    mode?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    changeIpUrl?: string;
  };
}

export class GoLoginService {
  private apiToken: string;
  private baseUrl = 'https://api.gologin.com';

  constructor(apiToken: string) {
    this.apiToken = apiToken;
    console.log('GoLogin Service initialized with API-only approach');
  }

  // Profile Management
  async listProfiles(page = 1, search?: string, folder?: string): Promise<{ profiles: GoLoginProfile[]; total: number }> {
    try {
      console.log('Fetching profiles from GoLogin API...');
      const response = await fetch(`${this.baseUrl}/browser/v2?page=${page}${search ? `&search=${search}` : ''}${folder ? `&folder=${folder}` : ''}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('API Response not OK:', response.status, response.statusText);
        throw new Error(`Failed to list profiles: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Raw API Response:', JSON.stringify(data, null, 2));
      
      // Handle different possible response structures
      let profiles = [];
      let total = 0;
      
      if (data.profiles) {
        profiles = data.profiles;
        total = data.allProfilesCount || data.total || profiles.length;
      } else if (data.data) {
        profiles = data.data;
        total = data.total || profiles.length;
      } else if (Array.isArray(data)) {
        profiles = data;
        total = profiles.length;
      }
      
      console.log(`Found ${profiles.length} profiles, total: ${total}`);
      
      return {
        profiles: profiles || [],
        total: total || 0,
      };
    } catch (error) {
      console.error('Error listing profiles:', error);
      throw error;
    }
  }

  async getProfile(profileId: string): Promise<GoLoginProfile> {
    try {
      const response = await fetch(`${this.baseUrl}/browser/${profileId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get profile: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  }

  async createProfile(profileData: GoLoginCreateProfileRequest): Promise<GoLoginProfile> {
    try {
      console.log('Creating profile with data:', JSON.stringify(profileData, null, 2));
      
      const response = await fetch(`${this.baseUrl}/browser/custom`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create profile: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
  }

  async createQuickProfile(os: 'win' | 'mac' | 'lin', name: string, osSpec?: string): Promise<GoLoginProfile> {
    try {
      console.log('Creating quick profile:', { os, name, osSpec });
      const response = await fetch(`${this.baseUrl}/browser/quick`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          os,
          name,
          osSpec,
        }),
      });

      console.log('Create profile response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create profile error response:', errorText);
        throw new Error(`Failed to create quick profile: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Profile created successfully:', result);
      return result;
    } catch (error) {
      console.error('Error creating quick profile:', error);
      throw error;
    }
  }

  async updateProfile(profileId: string, profileData: Partial<GoLoginCreateProfileRequest>): Promise<GoLoginProfile> {
    try {
      const response = await fetch(`${this.baseUrl}/browser/${profileId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update profile: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  async deleteProfile(profileId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/browser/${profileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete profile: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error;
    }
  }

  // Proxy Management
  async setProfileProxy(profileId: string, proxy: {
    mode: 'http' | 'https' | 'socks4' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
    changeIpUrl?: string;
  }): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/browser/${profileId}/proxy`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: proxy.mode,
          host: proxy.host,
          port: proxy.port,
          username: proxy.username,
          password: proxy.password,
          changeIpUrl: proxy.changeIpUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to set profile proxy: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error setting profile proxy:', error);
      throw error;
    }
  }

  async removeProfileProxy(profileId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/browser/${profileId}/proxy`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to remove profile proxy: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error removing profile proxy:', error);
      throw error;
    }
  }

  // Browser Launching
  async launchProfile(profileId: string, options?: { headless?: boolean }): Promise<{ browser: any; wsEndpoint: string }> {
    try {
      console.log(`Launching GoLogin profile locally: ${profileId}`);
      
      // Use GoLogin Local Rest API to start profile (creates separate browser window)
      const response = await fetch('http://localhost:36912/browser/start-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId: profileId,
          sync: true
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Local launch profile API error:', errorText);
        throw new Error(`Failed to launch profile locally: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`Profile ${profileId} launched locally:`, data);
      
      return { 
        browser: null, 
        wsEndpoint: data.wsUrl || '' 
      };
    } catch (error) {
      console.error(`Error launching profile ${profileId}:`, error);
      throw error;
    }
  }

  async stopProfile(profileId: string): Promise<void> {
    try {
      console.log(`Stopping GoLogin profile locally: ${profileId}`);
      
      // Use GoLogin Local Rest API to stop profile
      const response = await fetch('http://localhost:36912/browser/stop-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId: profileId
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Local stop profile API error:', errorText);
        throw new Error(`Failed to stop profile locally: ${response.statusText} - ${errorText}`);
      }

      console.log(`Profile ${profileId} stopped locally successfully`);
    } catch (error) {
      console.error(`Error stopping profile ${profileId}:`, error);
      throw error;
    }
  }

  // Get proxy locations
  async getProxyLocations(): Promise<any[]> {
    try {
      console.log('Fetching proxy locations from GoLogin API...');
      const response = await fetch(`${this.baseUrl}/users-proxies/countries`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Proxy locations API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Proxy locations API error response:', errorText);
        throw new Error(`Failed to get proxy locations: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Raw proxy locations API response:', JSON.stringify(data, null, 2));
      
      return data.countryList || [];
    } catch (error) {
      console.error('Error getting proxy locations:', error);
      return [];
    }
  }


  // Folder Management
  async listFolders(): Promise<any[]> {
    try {
      console.log('Fetching folders from GoLogin API...');
      const response = await fetch(`${this.baseUrl}/folders`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Folder API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Folder API error response:', errorText);
        throw new Error(`Failed to list folders: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Raw folder API response:', JSON.stringify(data, null, 2));
      
      // Handle different possible response structures
      let folders = [];
      if (Array.isArray(data)) {
        folders = data;
      } else if (data.data) {
        folders = data.data;
      } else if (data.folders) {
        folders = data.folders;
      }
      
      console.log(`Found ${folders.length} folders`);
      return folders || [];
    } catch (error) {
      console.error('Error listing folders:', error);
      throw error;
    }
  }

  async createFolder(name: string): Promise<any> {
    try {
      console.log('Creating folder:', name);
      const response = await fetch(`${this.baseUrl}/folders/folder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create folder: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  // Tags Management
  async listTags(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/tag`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list tags: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error listing tags:', error);
      throw error;
    }
  }

  // Utility Methods
  async testConnection(): Promise<boolean> {
    try {
      const { profiles } = await this.listProfiles(1);
      console.log('GoLogin API connection successful');
      return true;
    } catch (error) {
      console.error('GoLogin API connection failed:', error);
      return false;
    }
  }

  // Convert local profile to GoLogin format
  convertToGoLoginProfile(localProfile: Profile): GoLoginCreateProfileRequest {
    return {
      name: localProfile.name,
      notes: localProfile.notes || '',
      os: this.mapOsType(localProfile.fingerprint.platform),
      navigator: {
        userAgent: localProfile.fingerprint.user_agent,
        resolution: `${localProfile.fingerprint.screen_resolution.width}x${localProfile.fingerprint.screen_resolution.height}`,
        language: localProfile.fingerprint.locale,
        platform: localProfile.fingerprint.platform,
        hardwareConcurrency: 8,
        deviceMemory: 8,
        maxTouchPoints: 0,
      },
      geoProxyInfo: {
        fillBasedOnIp: true,
        timezone: {
          enabled: true,
          fillBasedOnIp: true,
          timezone: localProfile.fingerprint.timezone,
        },
        locale: {
          enabled: true,
          fillBasedOnIp: true,
          value: localProfile.fingerprint.locale,
        },
      },
      proxyEnabled: !!localProfile.proxy,
      proxy: localProfile.proxy ? {
        mode: this.mapProxyType(localProfile.proxy.type),
        host: localProfile.proxy.host,
        port: localProfile.proxy.port,
        username: localProfile.proxy.username,
        password: localProfile.proxy.password,
      } : undefined,
    };
  }

  private mapOsType(platform: string): 'win' | 'mac' | 'lin' {
    if (platform.toLowerCase().includes('win')) return 'win';
    if (platform.toLowerCase().includes('mac')) return 'mac';
    return 'lin';
  }

  private mapProxyType(type: string): 'http' | 'https' | 'socks4' | 'socks5' {
    const lowerType = type.toLowerCase();
    if (lowerType === 'https') return 'https';
    if (lowerType === 'socks4') return 'socks4';
    if (lowerType === 'socks5') return 'socks5';
    return 'http';
  }
}
