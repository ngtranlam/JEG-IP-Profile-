import * as dotenv from 'dotenv';
import * as path from 'path';
import { GoLoginSDKService } from './GoLoginSDKService';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '../../../.env') });

export class ApiService {
  private baseUrl: string;
  private gologinSDK: GoLoginSDKService | null = null;

  constructor() {
    // Use production URL by default, fallback to env variable for development
    this.baseUrl = process.env.API_BASE_URL || 'https://profile.jegdn.com/api';
    console.log('API Service initialized with base URL:', this.baseUrl);
    
    // Initialize GoLogin SDK if token is available
    const gologinToken = process.env.GOLOGIN_API_TOKEN;
    if (gologinToken) {
      this.gologinSDK = new GoLoginSDKService(gologinToken);
      console.log('GoLogin SDK initialized');
    } else {
      console.warn('GOLOGIN_API_TOKEN not found in environment variables');
    }
  }

  setupBrowserClosedCallback(callback: (profileId: string) => void) {
    if (this.gologinSDK) {
      this.gologinSDK.setOnBrowserClosed(callback);
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const requestOptions = { ...defaultOptions, ...options };

    try {
      console.log(`Making API request: ${requestOptions.method || 'GET'} ${url}`);
      
      const response = await fetch(url, requestOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  // Profile API methods
  async createProfile(profileData: any): Promise<any> {
    const response = await this.makeRequest('/profiles', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
    return response.data;
  }

  async updateProfile(id: string, updates: any): Promise<any> {
    const response = await this.makeRequest(`/profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  }

  async deleteProfile(id: string): Promise<void> {
    await this.makeRequest(`/profiles/${id}`, {
      method: 'DELETE',
    });
  }

  async getProfile(id: string): Promise<any> {
    const response = await this.makeRequest(`/profiles/${id}`);
    return response.data;
  }

  async listProfiles(): Promise<any[]> {
    const response = await this.makeRequest('/profiles');
    return response.data;
  }

  // Proxy API methods
  async createProxy(proxyData: any): Promise<any> {
    const response = await this.makeRequest('/proxies', {
      method: 'POST',
      body: JSON.stringify(proxyData),
    });
    return response.data;
  }

  async updateProxy(id: string, updates: any): Promise<any> {
    const response = await this.makeRequest(`/proxies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  }

  async deleteProxy(id: string): Promise<void> {
    await this.makeRequest(`/proxies/${id}`, {
      method: 'DELETE',
    });
  }

  async getProxy(id: string): Promise<any> {
    const response = await this.makeRequest(`/proxies/${id}`);
    return response.data;
  }

  async listProxies(): Promise<any[]> {
    const response = await this.makeRequest('/proxies');
    return response.data;
  }

  async validateProxy(id: string): Promise<any> {
    const response = await this.makeRequest(`/proxies/${id}/validate`, {
      method: 'POST',
    });
    return response.data;
  }

  async rotateProxyIP(id: string): Promise<any> {
    const response = await this.makeRequest(`/proxies/${id}/rotate-ip`, {
      method: 'POST',
    });
    return response.data;
  }

  async testProxyConfig(config: any): Promise<any> {
    const response = await this.makeRequest('/proxies/test-config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
    return response.data;
  }

  // GoLogin API methods
  async gologinListProfiles(page?: number, search?: string, folder?: string): Promise<any> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (search) params.append('search', search);
    if (folder) params.append('folder', folder);
    
    const queryString = params.toString();
    const endpoint = `/gologin${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.makeRequest(endpoint);
    return response.data;
  }

  async gologinGetProfile(profileId: string): Promise<any> {
    const response = await this.makeRequest(`/gologin/${profileId}`);
    return response.data;
  }

  async gologinCreateProfile(profileData: any): Promise<any> {
    const response = await this.makeRequest('/gologin', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
    return response.data;
  }

  async gologinCreateQuickProfile(os: string, name: string, osSpec?: string): Promise<any> {
    const response = await this.makeRequest('/gologin/quick', {
      method: 'POST',
      body: JSON.stringify({ os, name, osSpec }),
    });
    return response.data;
  }

  async gologinUpdateProfile(profileId: string, profileData: any): Promise<any> {
    const response = await this.makeRequest(`/gologin/${profileId}`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    return response.data;
  }

  async gologinGetCookies(profileId: string): Promise<any> {
    const response = await this.makeRequest(`/gologin/${profileId}/cookies`, {
      method: 'GET',
    });
    return response.data;
  }

  async gologinImportCookies(profileId: string, cookies: any[]): Promise<any> {
    const response = await this.makeRequest(`/gologin/${profileId}/cookies`, {
      method: 'POST',
      body: JSON.stringify(cookies),
    });
    return response.data;
  }

  async gologinRemoveCookies(profileId: string): Promise<any> {
    const response = await this.makeRequest(`/gologin/${profileId}/cookies?cleanCookies=true`, {
      method: 'POST',
      body: JSON.stringify([]),
    });
    return response.data;
  }

  async gologinDeleteProfile(profileId: string): Promise<void> {
    await this.makeRequest(`/gologin/${profileId}`, {
      method: 'DELETE',
    });
  }

  async gologinSetProxy(profileId: string, proxy: any): Promise<void> {
    await this.makeRequest(`/gologin/${profileId}/set-proxy`, {
      method: 'POST',
      body: JSON.stringify(proxy),
    });
  }

  async gologinRemoveProxy(profileId: string): Promise<void> {
    await this.makeRequest(`/gologin/${profileId}/remove-proxy`, {
      method: 'POST',
    });
  }

  async gologinLaunchProfile(profileId: string, options?: any): Promise<any> {
    try {
      console.log(`Launching GoLogin profile: ${profileId}`);
      
      if (!this.gologinSDK) {
        throw new Error('GoLogin SDK not initialized. Please set GOLOGIN_API_TOKEN in .env file');
      }

      const result = await this.gologinSDK.launchProfile(profileId, options);
      console.log('Profile launched successfully via SDK:', {
        hasWsEndpoint: !!result.wsEndpoint,
        profileId: result.profileId
      });
      
      // Don't return browser object - it can't be serialized over IPC
      return {
        status: 'success',
        profileId: result.profileId,
        wsEndpoint: result.wsEndpoint || '',
        message: 'Profile launched successfully'
      };
    } catch (error: any) {
      console.error(`Error launching profile ${profileId}:`, error);
      throw new Error(`Failed to launch profile: ${error.message || error}`);
    }
  }

  async gologinStopProfile(profileId: string): Promise<any> {
    try {
      console.log(`Stopping GoLogin profile: ${profileId}`);
      
      if (!this.gologinSDK) {
        throw new Error('GoLogin SDK not initialized. Please set GOLOGIN_API_TOKEN in .env file');
      }

      await this.gologinSDK.stopProfile(profileId);
      console.log('Profile stopped successfully via SDK');
      
      return { status: 'success', message: 'Profile stopped' };
    } catch (error: any) {
      console.error(`Error stopping profile ${profileId}:`, error);
      // Don't throw error for stop - just log it
      return { status: 'error', message: error.message || 'Failed to stop profile' };
    }
  }

  async gologinListFolders(): Promise<any[]> {
    const response = await this.makeRequest('/gologin/folders');
    return response.data;
  }

  async gologinCreateFolder(name: string): Promise<any> {
    const response = await this.makeRequest('/gologin/folders', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return response.data;
  }

  async gologinListTags(): Promise<any[]> {
    const response = await this.makeRequest('/gologin/tags');
    return response.data;
  }

  async gologinGetProxyLocations(): Promise<any[]> {
    const response = await this.makeRequest('/gologin/proxy-locations');
    return response.data;
  }

  async gologinTestConnection(): Promise<boolean> {
    const response = await this.makeRequest('/gologin/test-connection', {
      method: 'POST',
    });
    return response.data;
  }

  // Local Data API methods (from database)
  async getLocalFolders(token: string): Promise<any[]> {
    const response = await this.makeRequest('/local_data/folders', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async getLocalProfiles(token: string, page: number = 1, limit: number = 50, search?: string, folderId?: string): Promise<any> {
    let endpoint = `/local_data/profiles?page=${page}&limit=${limit}`;
    if (search) endpoint += `&search=${encodeURIComponent(search)}`;
    if (folderId) endpoint += `&folder=${folderId}`;
    
    const response = await this.makeRequest(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async getLocalProfile(token: string, profileId: string): Promise<any> {
    const response = await this.makeRequest(`/local_data/profile/${profileId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async getLocalStats(token: string): Promise<any> {
    const response = await this.makeRequest('/local_data/stats', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async syncGoLoginData(token: string, syncType: 'full' | 'folders' | 'profiles' = 'full'): Promise<any> {
    const response = await this.makeRequest('/local_data/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ type: syncType }),
    });
    return response.data;
  }

  async getSyncStatus(token: string): Promise<any> {
    const response = await this.makeRequest('/local_data/sync_status', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async testLocalConnection(token: string): Promise<boolean> {
    const response = await this.makeRequest('/local_data/test_connection', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.success;
  }

  // Bi-directional sync methods
  async createProfileWithSync(token: string, profileData: any, folderName?: string): Promise<any> {
    const response = await this.makeRequest('/local_data/create_profile', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ profileData, folderName }),
    });
    return response.data;
  }

  async updateProfileWithSync(token: string, profileId: string, profileData: any): Promise<any> {
    const response = await this.makeRequest('/local_data/update_profile', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ profileId, profileData }),
    });
    return response.data;
  }

  async deleteProfileWithSync(token: string, profileId: string): Promise<void> {
    await this.makeRequest('/local_data/delete_profile', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ profileId }),
    });
  }

  async createFolderWithSync(token: string, name: string): Promise<any> {
    const response = await this.makeRequest('/local_data/create_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });
    return response.data;
  }

  async setProxyWithSync(token: string, profileId: string, proxyData: any): Promise<void> {
    await this.makeRequest('/local_data/set_proxy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ profileId, proxyData }),
    });
  }

  // Seller management methods
  async getSellers(token: string): Promise<any[]> {
    const response = await this.makeRequest('/local_data/sellers', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async assignSellerToFolder(token: string, folderId: string, sellerId: number): Promise<void> {
    await this.makeRequest('/local_data/assign_seller', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ folderId, sellerId }),
    });
  }

  async removeSellerFromFolder(token: string, folderId: string): Promise<void> {
    await this.makeRequest('/local_data/remove_seller', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ folderId }),
    });
  }

  async createFolderWithSeller(token: string, name: string, sellerId?: number): Promise<any> {
    const response = await this.makeRequest('/local_data/create_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, sellerId }),
    });
    return response.data;
  }

  async updateFolder(token: string, folderId: string, name: string): Promise<void> {
    await this.makeRequest('/local_data/update_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ folderId, name }),
    });
  }

  async deleteFolder(token: string, folderId: string): Promise<void> {
    await this.makeRequest('/local_data/delete_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ folderId }),
    });
  }

  // Profile-Folder management methods
  async assignProfileToFolders(token: string, profileId: string, folderIds: string[]): Promise<void> {
    await this.makeRequest('/local_data/assign_profile_folders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ profileId, folderIds }),
    });
  }

  async removeProfileFromFolders(token: string, profileId: string, folderIds: string[]): Promise<void> {
    await this.makeRequest('/local_data/remove_profile_folders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ profileId, folderIds }),
    });
  }

  async setProfileFolders(token: string, profileId: string, folderIds: string[]): Promise<void> {
    await this.makeRequest('/local_data/set_profile_folders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ profileId, folderIds }),
    });
  }

  async getProfileFolders(token: string, profileId: string): Promise<any[]> {
    const response = await this.makeRequest('/local_data/get_profile_folders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ profileId }),
    });
    return response.data;
  }

  // User management methods
  async getUsers(token: string): Promise<any[]> {
    const response = await this.makeRequest('/local_data/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async createUser(token: string, userData: any): Promise<any> {
    const response = await this.makeRequest('/local_data/create_user', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    });
    return response.data;
  }

  async updateUser(token: string, userData: any): Promise<void> {
    await this.makeRequest('/local_data/update_user', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(token: string, userId: number): Promise<void> {
    await this.makeRequest('/local_data/delete_user', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ id: userId }),
    });
  }

  async toggleUserStatus(token: string, userId: number): Promise<void> {
    await this.makeRequest('/local_data/toggle_user_status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ id: userId }),
    });
  }

  async changePassword(token: string, oldPassword: string, newPassword: string): Promise<void> {
    await this.makeRequest('/auth/change_password', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  }

  async getUserByUserName(userName: string): Promise<any> {
    const response = await this.makeRequest(`/auth/user/${userName}`, {
      method: 'GET',
    });
    return response.data;
  }

  // GoLogin SDK methods
  async gologinSDKCreateProfile(name: string, os: 'win' | 'mac' | 'lin' = 'win'): Promise<any> {
    if (!this.gologinSDK) {
      throw new Error('GoLogin SDK not initialized. Please set GOLOGIN_API_TOKEN in .env file');
    }
    return await this.gologinSDK.createProfileRandomFingerprint(name, os);
  }

  async gologinSDKCreateProfileWithParams(params: any): Promise<any> {
    if (!this.gologinSDK) {
      throw new Error('GoLogin SDK not initialized. Please set GOLOGIN_API_TOKEN in .env file');
    }
    return await this.gologinSDK.createProfileWithCustomParams(params);
  }

  async gologinSDKAddProxyToProfile(profileId: string, countryCode: string): Promise<void> {
    if (!this.gologinSDK) {
      throw new Error('GoLogin SDK not initialized. Please set GOLOGIN_API_TOKEN in .env file');
    }
    await this.gologinSDK.addGologinProxyToProfile(profileId, countryCode);
  }

  async gologinSDKChangeProfileProxy(profileId: string, proxy: any): Promise<void> {
    if (!this.gologinSDK) {
      throw new Error('GoLogin SDK not initialized. Please set GOLOGIN_API_TOKEN in .env file');
    }
    await this.gologinSDK.changeProfileProxy(profileId, proxy);
  }

  async gologinSDKAddCookies(profileId: string, cookies: any[]): Promise<void> {
    if (!this.gologinSDK) {
      throw new Error('GoLogin SDK not initialized. Please set GOLOGIN_API_TOKEN in .env file');
    }
    await this.gologinSDK.addCookiesToProfile(profileId, cookies);
  }

  async gologinSDKRefreshFingerprints(profileIds: string[]): Promise<void> {
    if (!this.gologinSDK) {
      throw new Error('GoLogin SDK not initialized. Please set GOLOGIN_API_TOKEN in .env file');
    }
    await this.gologinSDK.refreshProfilesFingerprint(profileIds);
  }

  async gologinSDKUpdateUserAgent(profileIds: string[], workspaceId?: string): Promise<void> {
    if (!this.gologinSDK) {
      throw new Error('GoLogin SDK not initialized. Please set GOLOGIN_API_TOKEN in .env file');
    }
    await this.gologinSDK.updateUserAgentToLatestBrowser(profileIds, workspaceId);
  }

  async gologinSDKGetActiveBrowsers(): Promise<string[]> {
    if (!this.gologinSDK) {
      return [];
    }
    return this.gologinSDK.getActiveBrowsers();
  }

  async gologinSDKIsProfileRunning(profileId: string): Promise<boolean> {
    if (!this.gologinSDK) {
      return false;
    }
    return this.gologinSDK.isProfileRunning(profileId);
  }

  async gologinSDKStopAllProfiles(): Promise<void> {
    if (!this.gologinSDK) {
      throw new Error('GoLogin SDK not initialized. Please set GOLOGIN_API_TOKEN in .env file');
    }
    await this.gologinSDK.stopAllProfiles();
  }

  async cleanup(): Promise<void> {
    if (this.gologinSDK) {
      await this.gologinSDK.cleanup();
    }
  }
}
