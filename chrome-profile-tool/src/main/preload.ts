import { contextBridge, ipcRenderer } from 'electron';
import { IPCEvents } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Profile management
  createProfile: (profileData: Parameters<IPCEvents['profile:create']>[0]) => 
    ipcRenderer.invoke('profile:create', profileData),
  
  updateProfile: (id: string, updates: Parameters<IPCEvents['profile:update']>[1]) => 
    ipcRenderer.invoke('profile:update', id, updates),
  
  deleteProfile: (id: string) => 
    ipcRenderer.invoke('profile:delete', id),
  
  listProfiles: () => 
    ipcRenderer.invoke('profile:list'),
  
  launchProfile: (options: Parameters<IPCEvents['profile:launch']>[0]) => 
    ipcRenderer.invoke('profile:launch', options),

  // Proxy management
  createProxy: (proxyData: Parameters<IPCEvents['proxy:create']>[0]) => 
    ipcRenderer.invoke('proxy:create', proxyData),
  
  updateProxy: (id: string, updates: Parameters<IPCEvents['proxy:update']>[1]) => 
    ipcRenderer.invoke('proxy:update', id, updates),
  
  deleteProxy: (id: string) => 
    ipcRenderer.invoke('proxy:delete', id),
  
  listProxies: () => 
    ipcRenderer.invoke('proxy:list'),
  
  validateProxy: (id: string) => 
    ipcRenderer.invoke('proxy:validate', id),
  
  rotateProxyIP: (id: string) => 
    ipcRenderer.invoke('proxy:rotate-ip', id),

  testProxyConfig: (config: { host: string; port: number; username?: string; password?: string }) => 
    ipcRenderer.invoke('proxy:test-config', config),

  // GoLogin API methods
  gologinGetCookies: (profileId: string) =>
    ipcRenderer.invoke('gologin:get-cookies', profileId),
  
  gologinImportCookies: (profileId: string, cookies: any[]) =>
    ipcRenderer.invoke('gologin:import-cookies', profileId, cookies),
  
  gologinRemoveCookies: (profileId: string) =>
    ipcRenderer.invoke('gologin:remove-cookies', profileId),

  // GoLogin API methods (existing)
  gologinListProfiles: (page?: number, search?: string, folder?: string) => 
    ipcRenderer.invoke('gologin:list-profiles', page, search, folder),
  
  gologinGetProfile: (profileId: string) => 
    ipcRenderer.invoke('gologin:get-profile', profileId),
  
  gologinCreateProfile: (profileData: any) => 
    ipcRenderer.invoke('gologin:create-profile', profileData),
  
  gologinCreateQuickProfile: (os: 'win' | 'mac' | 'lin', name: string, osSpec?: string) => 
    ipcRenderer.invoke('gologin:create-quick-profile', os, name, osSpec),
  
  gologinUpdateProfile: (profileId: string, profileData: any) => 
    ipcRenderer.invoke('gologin:update-profile', profileId, profileData),
  
  gologinDeleteProfile: (profileId: string) => 
    ipcRenderer.invoke('gologin:delete-profile', profileId),
  
  gologinSetProxy: (profileId: string, proxy: any) => 
    ipcRenderer.invoke('gologin:set-proxy', profileId, proxy),
  
  gologinRemoveProxy: (profileId: string) => 
    ipcRenderer.invoke('gologin:remove-proxy', profileId),
  
  gologinLaunchProfile: (profileId: string, options?: any) => 
    ipcRenderer.invoke('gologin:launch-profile', profileId, options),
  
  gologinStopProfile: (profileId: string) => 
    ipcRenderer.invoke('gologin:stop-profile', profileId),
  
  gologinListFolders: () => 
    ipcRenderer.invoke('gologin:list-folders'),
  
  gologinCreateFolder: (name: string) => 
    ipcRenderer.invoke('gologin:create-folder', name),
  
  gologinListTags: () => 
    ipcRenderer.invoke('gologin:list-tags'),
  
  gologinGetProxyLocations: () => 
    ipcRenderer.invoke('gologin:get-proxy-locations'),

  gologinTestConnection: () => 
    ipcRenderer.invoke('gologin:test-connection'),

  // Local Data API methods (from database)
  localDataGetFolders: () => 
    ipcRenderer.invoke('local-data:get-folders'),
  
  localDataGetProfiles: (page?: number, limit?: number, search?: string, folderId?: string) => 
    ipcRenderer.invoke('local-data:get-profiles', page, limit, search, folderId),
  
  localDataGetProfile: (profileId: string) => 
    ipcRenderer.invoke('local-data:get-profile', profileId),
  
  localDataGetStats: () => 
    ipcRenderer.invoke('local-data:get-stats'),
  
  localDataSync: (syncType?: 'full' | 'folders' | 'profiles') => 
    ipcRenderer.invoke('local-data:sync', syncType),
  
  localDataSyncStatus: () => 
    ipcRenderer.invoke('local-data:sync-status'),
  
  localDataTestConnection: () => 
    ipcRenderer.invoke('local-data:test-connection'),

  // Bi-directional sync methods
  localDataCreateProfile: (profileData: any, folderName?: string) => 
    ipcRenderer.invoke('local-data:create-profile', profileData, folderName),
  
  localDataUpdateProfile: (profileId: string, profileData: any) => 
    ipcRenderer.invoke('local-data:update-profile', profileId, profileData),
  
  localDataDeleteProfile: (profileId: string) => 
    ipcRenderer.invoke('local-data:delete-profile', profileId),
  
  localDataSetProxy: (profileId: string, proxyData: any) => 
    ipcRenderer.invoke('local-data:set-proxy', profileId, proxyData),

  // Seller management methods
  localDataGetSellers: () => 
    ipcRenderer.invoke('local-data:get-sellers'),
  
  localDataAssignSeller: (folderId: string, sellerId: number) => 
    ipcRenderer.invoke('local-data:assign-seller', folderId, sellerId),
  
  localDataRemoveSeller: (folderId: string) => 
    ipcRenderer.invoke('local-data:remove-seller', folderId),
  
  localDataCreateFolder: (name: string, sellerId?: number) => 
    ipcRenderer.invoke('local-data:create-folder-with-seller', name, sellerId),
  
  localDataUpdateFolder: (folderId: string, name: string) => 
    ipcRenderer.invoke('local-data:update-folder', folderId, name),
  
  localDataDeleteFolder: (folderId: string) => 
    ipcRenderer.invoke('local-data:delete-folder', folderId),

  // Profile-Folder management methods
  localDataAssignProfileFolders: (profileId: string, folderIds: string[]) =>
    ipcRenderer.invoke('local-data:assign-profile-folders', profileId, folderIds),
  
  localDataRemoveProfileFolders: (profileId: string, folderIds: string[]) =>
    ipcRenderer.invoke('local-data:remove-profile-folders', profileId, folderIds),
  
  localDataSetProfileFolders: (profileId: string, folderIds: string[]) =>
    ipcRenderer.invoke('local-data:set-profile-folders', profileId, folderIds),
  
  localDataGetProfileFolders: (profileId: string) =>
    ipcRenderer.invoke('local-data:get-profile-folders', profileId),

  // User management methods
  localDataGetUsers: () => 
    ipcRenderer.invoke('local-data:get-users'),
  
  localDataCreateUser: (userData: any) => 
    ipcRenderer.invoke('local-data:create-user', userData),
  
  localDataUpdateUser: (userData: any) => 
    ipcRenderer.invoke('local-data:update-user', userData),
  
  localDataDeleteUser: (userId: number) => 
    ipcRenderer.invoke('local-data:delete-user', userId),
  
  localDataToggleUserStatus: (userId: number) => 
    ipcRenderer.invoke('local-data:toggle-user-status', userId),

  // GoLogin SDK methods
  gologinSDKCreateProfile: (name: string, os?: 'win' | 'mac' | 'lin') =>
    ipcRenderer.invoke('gologin-sdk:create-profile', name, os),
  
  gologinSDKCreateProfileWithParams: (params: any) =>
    ipcRenderer.invoke('gologin-sdk:create-profile-with-params', params),
  
  gologinSDKAddProxy: (profileId: string, countryCode: string) =>
    ipcRenderer.invoke('gologin-sdk:add-proxy', profileId, countryCode),
  
  gologinSDKChangeProxy: (profileId: string, proxy: any) =>
    ipcRenderer.invoke('gologin-sdk:change-proxy', profileId, proxy),
  
  gologinSDKAddCookies: (profileId: string, cookies: any[]) =>
    ipcRenderer.invoke('gologin-sdk:add-cookies', profileId, cookies),
  
  gologinSDKRefreshFingerprints: (profileIds: string[]) =>
    ipcRenderer.invoke('gologin-sdk:refresh-fingerprints', profileIds),
  
  gologinSDKUpdateUserAgent: (profileIds: string[], workspaceId?: string) =>
    ipcRenderer.invoke('gologin-sdk:update-user-agent', profileIds, workspaceId),
  
  gologinSDKGetActiveBrowsers: () =>
    ipcRenderer.invoke('gologin-sdk:get-active-browsers'),
  
  gologinSDKIsProfileRunning: (profileId: string) =>
    ipcRenderer.invoke('gologin-sdk:is-profile-running', profileId),
  
  gologinSDKStopAllProfiles: () =>
    ipcRenderer.invoke('gologin-sdk:stop-all-profiles'),

  // Event listeners
  onBrowserClosed: (callback: (profileId: string) => void) => {
    const listener = (_event: any, profileId: string) => callback(profileId);
    ipcRenderer.on('browser-closed', listener);
    return () => ipcRenderer.removeListener('browser-closed', listener);
  },

  // Authentication
  auth: {
    login: (userName: string, password: string) => 
      ipcRenderer.invoke('auth:login', userName, password),
    
    logout: () => 
      ipcRenderer.invoke('auth:logout'),
    
    changePassword: (oldPassword: string, newPassword: string) =>
      ipcRenderer.invoke('auth:change-password', oldPassword, newPassword),
    
    forceChangePassword: (userName: string, currentPassword: string, newPassword: string) =>
      ipcRenderer.invoke('auth:force-change-password', userName, currentPassword, newPassword),
    
    sendPasswordResetEmail: (email: string) =>
      ipcRenderer.invoke('auth:send-password-reset-email', email),
    
    validateToken: () => 
      ipcRenderer.invoke('auth:validate-token'),
    
    getCurrentUser: () => 
      ipcRenderer.invoke('auth:get-current-user'),
    
    isAuthenticated: () => 
      ipcRenderer.invoke('auth:is-authenticated'),
    
    getUserPermissions: () => 
      ipcRenderer.invoke('auth:get-permissions'),
    
    isAdmin: () => 
      ipcRenderer.invoke('auth:is-admin'),
    
    isSeller: () => 
      ipcRenderer.invoke('auth:is-seller'),
    
    getRoleName: () => 
      ipcRenderer.invoke('auth:get-role-name'),
    
    hasPermission: (permission: string) => 
      ipcRenderer.invoke('auth:has-permission', permission),
    
    // Firebase 2FA methods
    generate2FASecret: () =>
      ipcRenderer.invoke('auth:generate2FASecret'),
    
    enable2FA: (verificationCode: string) =>
      ipcRenderer.invoke('auth:enable2FA', verificationCode),
    
    verify2FA: (userName: string, verificationCode: string) =>
      ipcRenderer.invoke('auth:verify2FA', userName, verificationCode),
    
    disable2FA: () =>
      ipcRenderer.invoke('auth:disable2FA'),
    
    is2FAEnabled: () =>
      ipcRenderer.invoke('auth:is2FAEnabled'),
    
    saveCredentials: (userName: string, password: string) =>
      ipcRenderer.invoke('auth:save-credentials', userName, password),
    
    clearSavedCredentials: () =>
      ipcRenderer.invoke('auth:clear-saved-credentials'),
    
    getSavedCredentials: () =>
      ipcRenderer.invoke('auth:get-saved-credentials'),
  },
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      createProfile: (profileData: Parameters<IPCEvents['profile:create']>[0]) => Promise<ReturnType<IPCEvents['profile:create']>>;
      updateProfile: (id: string, updates: Parameters<IPCEvents['profile:update']>[1]) => Promise<ReturnType<IPCEvents['profile:update']>>;
      deleteProfile: (id: string) => Promise<ReturnType<IPCEvents['profile:delete']>>;
      listProfiles: () => Promise<ReturnType<IPCEvents['profile:list']>>;
      launchProfile: (options: Parameters<IPCEvents['profile:launch']>[0]) => Promise<ReturnType<IPCEvents['profile:launch']>>;
      
      createProxy: (proxyData: Parameters<IPCEvents['proxy:create']>[0]) => Promise<ReturnType<IPCEvents['proxy:create']>>;
      updateProxy: (id: string, updates: Parameters<IPCEvents['proxy:update']>[1]) => Promise<ReturnType<IPCEvents['proxy:update']>>;
      deleteProxy: (id: string) => Promise<ReturnType<IPCEvents['proxy:delete']>>;
      listProxies: () => Promise<ReturnType<IPCEvents['proxy:list']>>;
      validateProxy: (id: string) => Promise<ReturnType<IPCEvents['proxy:validate']>>;
      rotateProxyIP: (id: string) => Promise<ReturnType<IPCEvents['proxy:rotate-ip']>>;
      testProxyConfig: (config: { host: string; port: number; username?: string; password?: string }) => Promise<{
        http?: { success: boolean; ip?: string; country?: string; city?: string; ping?: number; error?: string };
        socks5?: { success: boolean; ip?: string; country?: string; city?: string; ping?: number; error?: string };
        socks4?: { success: boolean; ip?: string; country?: string; city?: string; ping?: number; error?: string };
      }>;
      
      // GoLogin API methods
      gologinGetCookies: (profileId: string) => Promise<any>;
      gologinImportCookies: (profileId: string, cookies: any[]) => Promise<any>;
      gologinRemoveCookies: (profileId: string) => Promise<any>;
      gologinListProfiles: (page?: number, search?: string, folder?: string) => Promise<any>;
      gologinGetProfile: (profileId: string) => Promise<any>;
      gologinCreateProfile: (profileData: any) => Promise<any>;
      gologinCreateQuickProfile: (os: 'win' | 'mac' | 'lin', name: string, osSpec?: string) => Promise<any>;
      gologinUpdateProfile: (profileId: string, profileData: any) => Promise<any>;
      gologinDeleteProfile: (profileId: string) => Promise<void>;
      gologinSetProxy: (profileId: string, proxy: any) => Promise<void>;
      gologinRemoveProxy: (profileId: string) => Promise<void>;
      gologinLaunchProfile: (profileId: string, options?: any) => Promise<any>;
      gologinStopProfile: (profileId: string) => Promise<void>;
      gologinListFolders: () => Promise<any[]>;
      gologinCreateFolder: (name: string) => Promise<any>;
      gologinListTags: () => Promise<any[]>;
      gologinTestConnection: () => Promise<boolean>;
      gologinGetProxyLocations: () => Promise<any[]>;
      
      // Local Data API methods
      localDataGetFolders: () => Promise<any[]>;
      localDataGetProfiles: (page?: number, limit?: number, search?: string, folderId?: string) => Promise<any>;
      localDataGetProfile: (profileId: string) => Promise<any>;
      localDataGetStats: () => Promise<any>;
      localDataSync: (syncType?: 'full' | 'folders' | 'profiles') => Promise<any>;
      localDataSyncStatus: () => Promise<any>;
      localDataTestConnection: () => Promise<boolean>;
      
      // Bi-directional sync methods
      localDataCreateProfile: (profileData: any, folderName?: string) => Promise<any>;
      localDataUpdateProfile: (profileId: string, profileData: any) => Promise<any>;
      localDataDeleteProfile: (profileId: string) => Promise<void>;
      localDataSetProxy: (profileId: string, proxyData: any) => Promise<void>;
      
      // Seller management methods
      localDataGetSellers: () => Promise<any[]>;
      localDataAssignSeller: (folderId: string, sellerId: number) => Promise<void>;
      localDataRemoveSeller: (folderId: string) => Promise<void>;
      localDataCreateFolder: (name: string, sellerId?: number) => Promise<any>;
      localDataUpdateFolder: (folderId: string, name: string) => Promise<void>;
      localDataDeleteFolder: (folderId: string) => Promise<void>;
      
      // Profile-Folder management methods
      localDataAssignProfileFolders: (profileId: string, folderIds: string[]) => Promise<void>;
      localDataRemoveProfileFolders: (profileId: string, folderIds: string[]) => Promise<void>;
      localDataSetProfileFolders: (profileId: string, folderIds: string[]) => Promise<void>;
      localDataGetProfileFolders: (profileId: string) => Promise<any[]>;
      
      // User management methods
      localDataGetUsers: () => Promise<any[]>;
      localDataCreateUser: (userData: any) => Promise<any>;
      localDataUpdateUser: (userData: any) => Promise<void>;
      localDataDeleteUser: (userId: number) => Promise<void>;
      localDataToggleUserStatus: (userId: number) => Promise<void>;
      
      // GoLogin SDK methods
      gologinSDKCreateProfile: (name: string, os?: 'win' | 'mac' | 'lin') => Promise<any>;
      gologinSDKCreateProfileWithParams: (params: any) => Promise<any>;
      gologinSDKAddProxy: (profileId: string, countryCode: string) => Promise<void>;
      gologinSDKChangeProxy: (profileId: string, proxy: any) => Promise<void>;
      gologinSDKAddCookies: (profileId: string, cookies: any[]) => Promise<void>;
      gologinSDKRefreshFingerprints: (profileIds: string[]) => Promise<void>;
      gologinSDKUpdateUserAgent: (profileIds: string[], workspaceId?: string) => Promise<void>;
      gologinSDKGetActiveBrowsers: () => Promise<string[]>;
      gologinSDKIsProfileRunning: (profileId: string) => Promise<boolean>;
      gologinSDKStopAllProfiles: () => Promise<void>;
      
      // Event listeners
      onBrowserClosed: (callback: (profileId: string) => void) => () => void;
      
      // Authentication
      auth: {
        login: (userName: string, password: string) => Promise<any>;
        logout: () => Promise<void>;
        validateToken: () => Promise<any>;
        getCurrentUser: () => Promise<any>;
        isAuthenticated: () => Promise<boolean>;
        changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
        getUserPermissions: () => Promise<any>;
        isAdmin: () => Promise<boolean>;
        isSeller: () => Promise<boolean>;
        getRoleName: () => Promise<string>;
        hasPermission: (permission: string) => Promise<boolean>;
      };
    };
  }
}
