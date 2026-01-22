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
    };
  }
}
