// Shared types for the Chrome Profile Tool

export interface Profile {
  id: string;
  name: string;
  notes?: string;
  proxy?: ProxyConfig;
  user_data_dir: string;
  fingerprint: ProfileFingerprint;
  status: 'active' | 'suspended' | 'archived';
  created_at: string;
  updated_at: string;
  last_used?: string;
}

export interface ProxyConfig {
  type: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  change_ip_url?: string;
}

export interface Proxy {
  id: string;
  name: string;
  type: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string; // Will be encrypted in storage
  change_ip_url?: string;
  current_ip?: string;
  country?: string;
  city?: string;
  timezone?: string;
  isp?: string;
  status: 'active' | 'inactive' | 'error';
  created_at: string;
  updated_at: string;
  last_checked?: string;
}

export interface ProfileFingerprint {
  canvas_seed: string;
  webgl_vendor: string;
  webgl_renderer: string;
  user_agent: string;
  screen_resolution: {
    width: number;
    height: number;
  };
  timezone: string;
  locale: string;
  platform: string;
  fonts: string[];
  audio_seed?: string;
}

export interface LaunchOptions {
  profile_id: string;
  headless?: boolean;
  debug?: boolean;
}

export interface ProxyValidationResult {
  success: boolean;
  ip?: string;
  country?: string;
  city?: string;
  timezone?: string;
  isp?: string;
  error?: string;
}

// IPC Events between Main and Renderer processes
export interface IPCEvents {
  // Profile management
  'profile:create': (profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'>) => Promise<Profile>;
  'profile:update': (id: string, updates: Partial<Profile>) => Promise<Profile>;
  'profile:delete': (id: string) => Promise<void>;
  'profile:list': () => Promise<Profile[]>;
  'profile:launch': (options: LaunchOptions) => Promise<void>;
  
  // Proxy management
  'proxy:create': (proxy: Omit<Proxy, 'id' | 'created_at' | 'updated_at'>) => Promise<Proxy>;
  'proxy:update': (id: string, updates: Partial<Proxy>) => Promise<Proxy>;
  'proxy:delete': (id: string) => Promise<void>;
  'proxy:list': () => Promise<Proxy[]>;
  'proxy:validate': (id: string) => Promise<ProxyValidationResult>;
  'proxy:rotate-ip': (id: string) => Promise<ProxyValidationResult>;
}

export type IPCEventName = keyof IPCEvents;
export type IPCEventHandler<T extends IPCEventName> = IPCEvents[T];
