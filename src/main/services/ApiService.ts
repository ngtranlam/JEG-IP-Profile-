import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '../../../.env') });

export class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost/api';
    console.log('API Service initialized with base URL:', this.baseUrl);
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
    // Launch profile must use Local Rest API, not Cloud API
    try {
      console.log(`Launching GoLogin profile locally: ${profileId}`);
      
      const response = await fetch('http://localhost:36912/browser/start-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId: profileId,
          sync: true,
          ...options
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Local launch profile API error:', errorText);
        throw new Error(`Failed to launch profile locally: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Profile launched successfully:', data);
      
      return {
        browser: data.browser || null,
        wsEndpoint: data.wsUrl || '' 
      };
    } catch (error) {
      console.error(`Error launching profile ${profileId}:`, error);
      throw error;
    }
  }

  async gologinStopProfile(profileId: string): Promise<any> {
    // Stop profile must use Local Rest API, not Cloud API
    try {
      console.log(`Stopping GoLogin profile locally: ${profileId}`);
      
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

      // Stop profile returns 204 No Content (empty response)
      if (response.status === 204) {
        console.log('Profile stopped successfully (204 No Content)');
        return { status: 'success', message: 'Profile stopped' };
      }

      const data = await response.json();
      console.log('Profile stopped successfully:', data);
      return data;
    } catch (error) {
      console.error(`Error stopping profile ${profileId}:`, error);
      throw error;
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
}
