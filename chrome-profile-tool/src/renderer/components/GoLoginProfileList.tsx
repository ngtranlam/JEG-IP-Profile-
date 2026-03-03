import React, { useState, useEffect } from 'react';
import { Plus, Search, Play, Trash2, Settings, Folder, Tag, Globe, X, Upload, FolderOpen, Check, Edit } from 'lucide-react';

interface GoLoginProfile {
  id: string;
  name: string;
  notes?: string;
  os: string;
  startUrl?: string;
  proxyEnabled?: boolean;
  proxy?: {
    mode?: string;
    host?: string;
    port?: number;
  };
  createdAt?: string;
  updatedAt?: string;
  browserType?: string;
  canBeRunning?: boolean;
}

interface GoLoginProfileListProps {
  onProfileLaunch?: (profileId: string) => void;
  onRefresh?: () => Promise<void>;
  currentUser?: any;
}

export function GoLoginProfileList({ onProfileLaunch, onRefresh, currentUser }: GoLoginProfileListProps) {
  const isSeller = currentUser?.roles === '3';
  const [profiles, setProfiles] = useState<GoLoginProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [folders, setFolders] = useState<any[]>([]);
  const [hasAssignedFolders, setHasAssignedFolders] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileOS, setNewProfileOS] = useState<'win' | 'mac' | 'lin'>('win');
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('proxy');
  const [proxyType, setProxyType] = useState('custom');
  const [proxyConfig, setProxyConfig] = useState({
    type: 'auto',
    host: '',
    port: '',
    username: '',
    password: '',
    changeIpUrl: ''
  });
  const [newProfileFolder, setNewProfileFolder] = useState('');
  const [profileNotes, setProfileNotes] = useState('');
  const [proxyCheckResult, setProxyCheckResult] = useState<{
    status: 'success' | 'error' | null;
    message: string;
    details?: Array<{ type: string; ip: string; ping: number; location?: string; flag?: string; selected?: boolean; error?: string }>;
  } | null>(null);
  const [checkingProxy, setCheckingProxy] = useState(false);
  const [proxyLocations, setProxyLocations] = useState<any[]>([]);
  const [runningProfiles, setRunningProfiles] = useState<Set<string>>(new Set());
  const [checkingProfiles, setCheckingProfiles] = useState<Set<string>>(new Set());
  const [stoppingProfiles, setStoppingProfiles] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState<string>('');
  const [showCookiesManager, setShowCookiesManager] = useState(false);
  const [showImportCookies, setShowImportCookies] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [cookiesText, setCookiesText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [cookies, setCookies] = useState<any[]>([]);
  const [loadingCookies, setLoadingCookies] = useState(false);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [selectedProfileForFolders, setSelectedProfileForFolders] = useState<string | null>(null);
  const [profileFolders, setProfileFolders] = useState<string[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [showEditProxy, setShowEditProxy] = useState(false);
  const [selectedProfileForProxy, setSelectedProfileForProxy] = useState<string | null>(null);
  const [proxyMode, setProxyMode] = useState('http');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');

  // Listen for browser closed events
  useEffect(() => {
    const unsubscribe = window.electronAPI.onBrowserClosed((profileId: string) => {
      console.log(`Browser closed manually for profile: ${profileId}`);
      // Remove from running profiles
      setRunningProfiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(profileId);
        return newSet;
      });
      // Refresh profiles list
      loadProfiles();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Helper function to detect country from IP address
  const getCountryFromIP = (ip: string): string | null => {
    if (!ip) return null;
    
    // Parse IP to number for range checking
    const ipParts = ip.split('.').map(Number);
    if (ipParts.length !== 4 || ipParts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return null;
    }
    
    const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    
    // Common IP ranges for major countries (simplified detection)
    // US ranges
    if ((ipNum >= 0x03000000 && ipNum <= 0x06FFFFFF) || // 3.0.0.0 - 6.255.255.255
        (ipNum >= 0x08000000 && ipNum <= 0x0FFFFFFF) || // 8.0.0.0 - 15.255.255.255
        (ipNum >= 0x17000000 && ipNum <= 0x18FFFFFF) || // 23.0.0.0 - 24.255.255.255
        (ipNum >= 0x32000000 && ipNum <= 0x33FFFFFF) || // 50.0.0.0 - 51.255.255.255
        (ipNum >= 0x41000000 && ipNum <= 0x42FFFFFF)) { // 65.0.0.0 - 66.255.255.255
      return 'US';
    }
    
    // Vietnam ranges
    if ((ipNum >= 0x0E000000 && ipNum <= 0x0EFFFFFF) || // 14.0.0.0 - 14.255.255.255
        (ipNum >= 0x1B000000 && ipNum <= 0x1BFFFFFF) || // 27.0.0.0 - 27.255.255.255
        (ipNum >= 0x31000000 && ipNum <= 0x31FFFFFF) || // 49.0.0.0 - 49.255.255.255
        (ipNum >= 0x5E000000 && ipNum <= 0x5EFFFFFF)) { // 94.0.0.0 - 94.255.255.255
      return 'VN';
    }
    
    // UK ranges
    if ((ipNum >= 0x02000000 && ipNum <= 0x02FFFFFF) || // 2.0.0.0 - 2.255.255.255
        (ipNum >= 0x51000000 && ipNum <= 0x52FFFFFF)) { // 81.0.0.0 - 82.255.255.255
      return 'UK';
    }
    
    // Germany ranges
    if ((ipNum >= 0x2E000000 && ipNum <= 0x2FFFFFFF)) { // 46.0.0.0 - 47.255.255.255
      return 'DE';
    }
    
    // France ranges
    if ((ipNum >= 0x2D000000 && ipNum <= 0x2DFFFFFF)) { // 45.0.0.0 - 45.255.255.255
      return 'FR';
    }
    
    // Singapore ranges
    if ((ipNum >= 0x2B000000 && ipNum <= 0x2BFFFFFF)) { // 43.0.0.0 - 43.255.255.255
      return 'SG';
    }
    
    return null;
  };

  // Helper function to get country flag and name
  const getCountryInfo = (countryCode: string) => {
    const countryMap: { [key: string]: { flag: string; name: string } } = {
      'US': { flag: '🇺🇸', name: 'United States' },
      'UK': { flag: '🇬🇧', name: 'United Kingdom' },
      'DE': { flag: '🇩🇪', name: 'Germany' },
      'FR': { flag: '🇫🇷', name: 'France' },
      'CA': { flag: '🇨🇦', name: 'Canada' },
      'IN': { flag: '🇮🇳', name: 'India' },
      'JP': { flag: '🇯🇵', name: 'Japan' },
      'AU': { flag: '🇦🇺', name: 'Australia' },
      'BR': { flag: '🇧🇷', name: 'Brazil' },
      'NL': { flag: '🇳🇱', name: 'Netherlands' },
      'IT': { flag: '🇮🇹', name: 'Italy' },
      'ES': { flag: '🇪🇸', name: 'Spain' },
      'SE': { flag: '🇸🇪', name: 'Sweden' },
      'NO': { flag: '🇳🇴', name: 'Norway' },
      'CH': { flag: '🇨🇭', name: 'Switzerland' },
      'SG': { flag: '🇸🇬', name: 'Singapore' },
      'HK': { flag: '🇭🇰', name: 'Hong Kong' },
      'KR': { flag: '🇰🇷', name: 'South Korea' },
      'TW': { flag: '🇹🇼', name: 'Taiwan' },
      'MX': { flag: '🇲🇽', name: 'Mexico' },
      'AR': { flag: '🇦🇷', name: 'Argentina' },
      'CL': { flag: '🇨🇱', name: 'Chile' },
      'CO': { flag: '🇨🇴', name: 'Colombia' },
      'PE': { flag: '🇵🇪', name: 'Peru' },
      'VE': { flag: '🇻🇪', name: 'Venezuela' },
      'PL': { flag: '🇵🇱', name: 'Poland' },
      'CZ': { flag: '🇨🇿', name: 'Czech Republic' },
      'HU': { flag: '🇭🇺', name: 'Hungary' },
      'RO': { flag: '🇷🇴', name: 'Romania' },
      'BG': { flag: '🇧🇬', name: 'Bulgaria' },
      'HR': { flag: '🇭🇷', name: 'Croatia' },
      'SI': { flag: '🇸🇮', name: 'Slovenia' },
      'SK': { flag: '🇸🇰', name: 'Slovakia' },
      'LT': { flag: '🇱🇹', name: 'Lithuania' },
      'LV': { flag: '🇱🇻', name: 'Latvia' },
      'EE': { flag: '🇪🇪', name: 'Estonia' },
      'FI': { flag: '🇫🇮', name: 'Finland' },
      'DK': { flag: '🇩🇰', name: 'Denmark' },
      'BE': { flag: '🇧🇪', name: 'Belgium' },
      'AT': { flag: '🇦🇹', name: 'Austria' },
      'IE': { flag: '🇮🇪', name: 'Ireland' },
      'PT': { flag: '🇵🇹', name: 'Portugal' },
      'GR': { flag: '🇬🇷', name: 'Greece' },
      'TR': { flag: '🇹🇷', name: 'Turkey' },
      'RU': { flag: '🇷🇺', name: 'Russia' },
      'UA': { flag: '🇺🇦', name: 'Ukraine' },
      'BY': { flag: '🇧🇾', name: 'Belarus' },
      'MD': { flag: '🇲🇩', name: 'Moldova' },
      'RS': { flag: '🇷🇸', name: 'Serbia' },
      'BA': { flag: '🇧🇦', name: 'Bosnia and Herzegovina' },
      'ME': { flag: '🇲🇪', name: 'Montenegro' },
      'MK': { flag: '🇲🇰', name: 'North Macedonia' },
      'AL': { flag: '🇦🇱', name: 'Albania' },
      'XK': { flag: '🇽🇰', name: 'Kosovo' },
      'IL': { flag: '🇮🇱', name: 'Israel' },
      'AE': { flag: '🇦🇪', name: 'United Arab Emirates' },
      'SA': { flag: '🇸🇦', name: 'Saudi Arabia' },
      'EG': { flag: '🇪🇬', name: 'Egypt' },
      'ZA': { flag: '🇿🇦', name: 'South Africa' },
      'NG': { flag: '🇳🇬', name: 'Nigeria' },
      'KE': { flag: '🇰🇪', name: 'Kenya' },
      'MA': { flag: '🇲🇦', name: 'Morocco' },
      'TN': { flag: '🇹🇳', name: 'Tunisia' },
      'DZ': { flag: '🇩🇿', name: 'Algeria' },
      'TH': { flag: '🇹🇭', name: 'Thailand' },
      'VN': { flag: '🇻🇳', name: 'Vietnam' },
      'MY': { flag: '🇲🇾', name: 'Malaysia' },
      'ID': { flag: '🇮🇩', name: 'Indonesia' },
      'PH': { flag: '🇵🇭', name: 'Philippines' },
      'BD': { flag: '🇧🇩', name: 'Bangladesh' },
      'PK': { flag: '🇵🇰', name: 'Pakistan' },
      'LK': { flag: '🇱🇰', name: 'Sri Lanka' },
      'NP': { flag: '🇳🇵', name: 'Nepal' },
      'MM': { flag: '🇲🇲', name: 'Myanmar' },
      'KH': { flag: '🇰🇭', name: 'Cambodia' },
      'LA': { flag: '🇱🇦', name: 'Laos' },
      'MN': { flag: '🇲🇳', name: 'Mongolia' },
      'KZ': { flag: '🇰🇿', name: 'Kazakhstan' },
      'UZ': { flag: '🇺🇿', name: 'Uzbekistan' },
      'KG': { flag: '🇰🇬', name: 'Kyrgyzstan' },
      'TJ': { flag: '🇹🇯', name: 'Tajikistan' },
      'TM': { flag: '🇹🇲', name: 'Turkmenistan' },
      'AF': { flag: '🇦🇫', name: 'Afghanistan' },
      'IQ': { flag: '🇮🇶', name: 'Iraq' },
      'IR': { flag: '🇮🇷', name: 'Iran' },
      'SY': { flag: '🇸🇾', name: 'Syria' },
      'LB': { flag: '🇱🇧', name: 'Lebanon' },
      'JO': { flag: '🇯🇴', name: 'Jordan' },
      'PS': { flag: '🇵🇸', name: 'Palestine' },
      'CY': { flag: '🇨🇾', name: 'Cyprus' },
      'MT': { flag: '🇲🇹', name: 'Malta' },
      'IS': { flag: '🇮🇸', name: 'Iceland' },
      'LU': { flag: '🇱🇺', name: 'Luxembourg' },
      'LI': { flag: '🇱🇮', name: 'Liechtenstein' },
      'MC': { flag: '🇲🇨', name: 'Monaco' },
      'SM': { flag: '🇸🇲', name: 'San Marino' },
      'VA': { flag: '🇻🇦', name: 'Vatican City' },
      'AD': { flag: '🇦🇩', name: 'Andorra' }
    };
    
    return countryMap[countryCode.toUpperCase()] || { flag: '🌐', name: countryCode };
  };

  // Sync data once on component mount
  useEffect(() => {
    syncData();
    loadFolders();
    loadProxyLocations();
    testConnection();
  }, []);

  // Reload profiles when page, search, or folder changes
  useEffect(() => {
    loadProfiles();
  }, [currentPage, searchTerm, selectedFolder]);

  const syncData = async () => {
    try {
      console.log('Syncing data from GoLogin...');
      await window.electronAPI.localDataSync();
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Failed to sync data:', error);
      // Continue loading even if sync fails
    }
  };

  const testConnection = async () => {
    try {
      const isConnected = await window.electronAPI.gologinTestConnection();
      setConnectionStatus(isConnected);
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus(false);
    }
  };

  const loadProfiles = async () => {
    try {
      setLoading(true);
      // Use local_data API with role-based filtering
      console.log('Loading profiles with filters:', { 
        page: currentPage, 
        search: searchTerm, 
        folder: selectedFolder 
      });
      
      const result = await window.electronAPI.localDataGetProfiles(
        currentPage,
        50, // limit
        searchTerm || undefined,
        selectedFolder || undefined
      );
      
      // Transform and normalize profile data from database
      console.log('Raw profiles from database:', result.profiles);
      console.log('Total profiles:', result.total);
      const transformedProfiles = (result.profiles || []).map((profile: any) => ({
        id: profile.profile_id || profile.id,
        name: profile.name || `Profile ${profile.profile_id?.slice(0, 8) || 'Unknown'}`,
        notes: profile.notes || '',
        os: profile.os || 'win',
        startUrl: profile.start_url || '',
        proxyEnabled: profile.proxy_enabled === 1,
        proxy: profile.proxy_enabled ? {
          mode: profile.proxy_type,
          host: profile.proxy_host,
          port: profile.proxy_port,
        } : undefined,
        createdAt: profile.created_at || new Date().toISOString(),
        updatedAt: profile.updated_at || new Date().toISOString(),
        browserType: profile.browser_type || 'chrome',
        canBeRunning: profile.can_be_running !== 0,
        folder_names: profile.folder_names || null,
      }));
      
      console.log('Transformed profiles:', transformedProfiles);
      console.log('Setting profiles state with', transformedProfiles.length, 'profiles');
      setProfiles(transformedProfiles);
      setTotalProfiles(result.total || transformedProfiles.length);
    } catch (error) {
      console.error('Failed to load profiles from database:', error);
      setProfiles([]);
      setTotalProfiles(0);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      // Use local_data API with role-based filtering
      const folderList = await window.electronAPI.localDataGetFolders();
      setFolders(folderList || []);
      
      // Check if Seller has any assigned folders
      if (isSeller) {
        setHasAssignedFolders((folderList || []).length > 0);
      }
    } catch (error) {
      console.error('Failed to load folders from database:', error);
      if (isSeller) {
        setHasAssignedFolders(false);
      }
    }
  };

  const loadProxyLocations = async () => {
    try {
      // Temporarily comment out until type is fixed
      // const locations = await window.electronAPI.gologinGetProxyLocations();
      // setProxyLocations(locations || []);
      console.log('Proxy locations loading temporarily disabled');
    } catch (error) {
      console.error('Failed to load proxy locations:', error);
    }
  };

  const handlePasteProxyForCreate = async () => {
    try {
      // Read from clipboard
      const clipboardText = await navigator.clipboard.readText();
      
      if (!clipboardText.trim()) {
        alert('Clipboard is empty');
        return;
      }

      // Parse different formats:
      // Format 1: ip:port:username:password (65.195.36.15:47670:awCCKSxYKom601Q:a2HbwzMPTlFUUWU)
      // Format 2: http://username:password@domain:port
      // Format 3: domain:port:username:password
      
      const input = clipboardText.trim();
      
      // Check for http:// format
      if (input.startsWith('http://') || input.startsWith('https://')) {
        try {
          const url = new URL(input);
          setProxyConfig(prev => ({
            ...prev,
            type: input.startsWith('https://') ? 'https' : 'http',
            host: url.hostname,
            port: url.port || (input.startsWith('https://') ? '443' : '80'),
            username: url.username || '',
            password: url.password || ''
          }));
        } catch (error) {
          alert('Invalid URL format in clipboard');
          return;
        }
      } else {
        // Parse ip:port:username:password format
        const parts = input.split(':');
        if (parts.length >= 2) {
          setProxyConfig(prev => ({
            ...prev,
            host: parts[0],
            port: parts[1],
            username: parts[2] || '',
            password: parts[3] || ''
          }));
        } else {
          alert('Invalid format in clipboard. Expected: ip:port:username:password or http://username:password@domain:port');
          return;
        }
      }

      setProxyCheckResult({ status: null, message: '' });
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      alert('Failed to read clipboard. Please make sure you have copied proxy information.');
    }
  };

  const handleCheckProxy = async () => {
    if (!proxyConfig.host || !proxyConfig.port) {
      setProxyCheckResult({
        status: 'error',
        message: 'Please enter proxy host and port'
      });
      return;
    }

    setCheckingProxy(true);
    setProxyCheckResult(null);
    
    try {
      // Validate proxy format
      const proxyHost = proxyConfig.host.trim();
      const proxyPort = parseInt(proxyConfig.port);
      
      // Basic validation
      if (!proxyHost || isNaN(proxyPort) || proxyPort < 1 || proxyPort > 65535) {
        throw new Error('Invalid proxy host or port format');
      }

      // Validate IP address format (basic check)
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
      
      if (!ipRegex.test(proxyHost) && !domainRegex.test(proxyHost)) {
        throw new Error('Invalid proxy host format. Use IP address or domain name.');
      }

      // Test proxy using real backend API
      const testResults = await window.electronAPI.testProxyConfig({
        host: proxyHost,
        port: proxyPort,
        username: proxyConfig.username || undefined,
        password: proxyConfig.password || undefined,
      });

      // Process results
      const results = [];
      let hasSuccess = false;

      for (const [type, result] of Object.entries(testResults)) {
        if (result.success) {
          hasSuccess = true;
          const countryInfo = result.country ? getCountryInfo(result.country) : { flag: '🌐', name: result.city || 'Unknown' };
          
          results.push({
            type: type.toUpperCase(),
            ip: result.ip || proxyHost,
            ping: result.ping || 0,
            location: countryInfo.name,
            flag: countryInfo.flag,
            selected: type === 'http' // Default select HTTP
          });
        } else {
          results.push({
            type: type.toUpperCase(),
            ip: proxyHost,
            ping: 0,
            location: 'Failed',
            flag: '❌',
            selected: false,
            error: result.error
          });
        }
      }

      if (!hasSuccess) {
        throw new Error('No proxy type succeeded. All connection attempts failed.');
      }

      setProxyCheckResult({
        status: 'success',
        message: 'Proxy configuration validated',
        details: results
      });
    } catch (error) {
      console.error('Proxy check error:', error);
      
      let errorMessage = 'No Proxy found. Try another proxy server.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setProxyCheckResult({
        status: 'error',
        message: errorMessage
      });
    } finally {
      setCheckingProxy(false);
    }
  };

  const handleCreateQuickProfile = async () => {
    if (!newProfileName.trim()) return;
    
    setCreating(true);
    try {
      // Format profile data according to GoLogin API specification
      const profileData: any = {
        os: newProfileOS, // Required parameter
        name: newProfileName, // Optional parameter
      };

      // Add osSpec for Mac M1/M2/M3/M4 or Windows 11
      if (newProfileOS === 'mac') {
        profileData.osSpec = 'M1'; // Default to M1, could be made configurable
      } else if (newProfileOS === 'win') {
        // Leave osSpec empty for Windows 10, or set to "win11" for Windows 11
        // profileData.osSpec = 'win11';
      }

      // Add proxy configuration (always required now)
      if (proxyConfig.host && proxyConfig.port) {
        profileData.proxy = {
          mode: proxyConfig.type === 'auto' ? 'http' : proxyConfig.type,
          host: proxyConfig.host,
          port: parseInt(proxyConfig.port)
        };

        // Add authentication if provided
        if (proxyConfig.username) {
          profileData.proxy.username = proxyConfig.username;
        }
        if (proxyConfig.password) {
          profileData.proxy.password = proxyConfig.password;
        }
        if (proxyConfig.changeIpUrl) {
          profileData.proxy.changeIpUrl = proxyConfig.changeIpUrl;
        }
      } else {
        // Default to HTTP proxy mode if no proxy specified
        profileData.proxy = {
          mode: 'http',
          host: '',
          port: 80
        };
      }

      // Add notes if provided
      if (profileNotes.trim()) {
        profileData.notes = profileNotes;
      }
      
      // Get folder name from folder ID
      let folderName = null;
      if (isSeller) {
        // Seller: automatically use their first assigned folder
        if (folders.length > 0) {
          folderName = folders[0].name;
        }
      } else {
        // Admin: use selected folder
        if (newProfileFolder) {
          const selectedFolder = folders.find(f => f.folder_id === newProfileFolder);
          if (selectedFolder) {
            folderName = selectedFolder.name;
          }
        }
      }
      
      // Use localDataCreateProfile to create profile with folder assignment
      await window.electronAPI.localDataCreateProfile(profileData, folderName);
      setShowCreateModal(false);
      setNewProfileName('');
      setNewProfileOS('win');
      setNewProfileFolder('');
      setProfileNotes('');
      setProxyConfig({
        type: 'auto',
        host: '',
        port: '',
        username: '',
        password: '',
        changeIpUrl: ''
      });
      setProxyCheckResult({ status: null, message: '' });
      await loadProfiles();
    } catch (error) {
      console.error('Error creating profile:', error);
      alert('Failed to create profile. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;

    try {
      await window.electronAPI.localDataDeleteProfile(profileId);
      alert('Profile deleted successfully!');
      await loadProfiles();
    } catch (error: any) {
      console.error('Failed to delete profile:', error);
      alert('Failed to delete profile. Please try again.');
      // Reload on error to sync state
      await loadProfiles();
    }
  };

  const fetchCookies = async (profileId: string) => {
    setLoadingCookies(true);
    try {
      const result = await window.electronAPI.gologinGetCookies(profileId);
      setCookies(result || []);
    } catch (error: any) {
      console.error('Failed to fetch cookies:', error);
      setCookies([]);
    } finally {
      setLoadingCookies(false);
    }
  };

  const fetchProfileFolders = async (profileId: string) => {
    setLoadingFolders(true);
    try {
      const result = await window.electronAPI.localDataGetProfileFolders(profileId);
      const folderIds = result.map((f: any) => f.folder_id);
      setProfileFolders(folderIds);
    } catch (error: any) {
      console.error('Failed to fetch profile folders:', error);
      setProfileFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  };

  const handleOpenFolderManager = async (profileId: string) => {
    setSelectedProfileForFolders(profileId);
    setShowFolderManager(true);
    await fetchProfileFolders(profileId);
  };

  const handleSaveProfileFolders = async () => {
    if (!selectedProfileForFolders) return;

    try {
      await window.electronAPI.localDataSetProfileFolders(selectedProfileForFolders, profileFolders);
      alert('Profile folders updated successfully!');
      setShowFolderManager(false);
      await loadProfiles();
    } catch (error: any) {
      console.error('Failed to update profile folders:', error);
      alert('Failed to update profile folders. Please try again.');
    }
  };

  const toggleFolderSelection = (folderId: string) => {
    setProfileFolders(prev => {
      if (prev.includes(folderId)) {
        return prev.filter(id => id !== folderId);
      } else {
        return [...prev, folderId];
      }
    });
  };

  const handleOpenEditProxy = (profile: GoLoginProfile) => {
    setSelectedProfileForProxy(profile.id);
    setProxyMode(profile.proxy?.mode || 'http');
    setProxyHost(profile.proxy?.host || '');
    setProxyPort(profile.proxy?.port?.toString() || '');
    setProxyUsername((profile.proxy as any)?.username || '');
    setProxyPassword((profile.proxy as any)?.password || '');
    setShowEditProxy(true);
  };

  const handlePasteProxy = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const input = text.trim();
      
      // Format 1: protocol://[username:password@]host:port
      const urlRegex = /^(https?|socks4|socks5):\/\/(?:([^:@]+):([^@]+)@)?([^:]+):(\d+)$/;
      const urlMatch = input.match(urlRegex);
      
      if (urlMatch) {
        const [, mode, username, password, host, port] = urlMatch;
        setProxyMode(mode);
        setProxyHost(host);
        setProxyPort(port);
        setProxyUsername(username || '');
        setProxyPassword(password || '');
        return;
      }
      
      // Format 2: ip:port:username:password or host:port:username:password
      const colonFormat = input.split(':');
      if (colonFormat.length >= 2) {
        setProxyMode('http'); // Default to http
        setProxyHost(colonFormat[0]);
        setProxyPort(colonFormat[1]);
        setProxyUsername(colonFormat[2] || '');
        setProxyPassword(colonFormat[3] || '');
        return;
      }
      
      alert('Invalid proxy format. Supported formats:\n- protocol://[username:password@]host:port\n- ip:port:username:password');
    } catch (error) {
      console.error('Failed to paste proxy:', error);
      alert('Failed to paste from clipboard');
    }
  };

  const handleSaveProxy = async () => {
    if (!selectedProfileForProxy) return;

    try {
      const proxyData = {
        mode: proxyMode,
        host: proxyHost,
        port: parseInt(proxyPort),
        username: proxyUsername,
        password: proxyPassword,
      };

      await window.electronAPI.localDataSetProxy(selectedProfileForProxy, proxyData);
      alert('Proxy updated successfully!');
      setShowEditProxy(false);
      await loadProfiles();
    } catch (error: any) {
      console.error('Failed to update proxy:', error);
      alert('Failed to update proxy: ' + (error.message || 'Unknown error'));
    }
  };

  const handleClearCookies = async () => {
    if (!selectedProfileId) return;
    if (!confirm('Are you sure you want to clear all cookies?')) return;

    try {
      await window.electronAPI.gologinRemoveCookies(selectedProfileId);
      alert('Cookies cleared successfully!');
      await fetchCookies(selectedProfileId);
    } catch (error: any) {
      console.error('Failed to clear cookies:', error);
      alert('Failed to clear cookies: ' + (error.message || 'Unknown error'));
    }
  };

  const handleExportCookies = () => {
    if (cookies.length === 0) {
      alert('No cookies to export');
      return;
    }

    const dataStr = JSON.stringify(cookies, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cookies_${selectedProfileId}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLaunchProfile = async (profileId: string) => {
    try {
      // Set checking state
      setCheckingProfiles(prev => new Set(prev).add(profileId));
      
      await window.electronAPI.gologinLaunchProfile(profileId, { headless: false });
      
      // Remove from checking, add to running
      setCheckingProfiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(profileId);
        return newSet;
      });
      setRunningProfiles(prev => new Set(prev).add(profileId));
      
      if (onProfileLaunch) {
        onProfileLaunch(profileId);
      }
    } catch (error) {
      console.error('Failed to launch profile:', error);
      // Remove from checking on error
      setCheckingProfiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(profileId);
        return newSet;
      });
      alert('Failed to launch profile. Please try again.');
    }
  };

  const handleStopProfile = async (profileId: string) => {
    try {
      // Add to stopping profiles
      setStoppingProfiles(prev => new Set(prev).add(profileId));
      
      await window.electronAPI.gologinStopProfile(profileId);
      
      // Remove from running profiles
      setRunningProfiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(profileId);
        return newSet;
      });
      
      // Refresh profiles list after stopping
      await loadProfiles();
    } catch (error) {
      console.error('Failed to stop profile:', error);
      alert('Failed to stop profile. Please try again.');
    } finally {
      // Remove from stopping profiles
      setStoppingProfiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(profileId);
        return newSet;
      });
    }
  };

  const handleNoteDoubleClick = (profileId: string, currentNote: string) => {
    setEditingNoteId(profileId);
    setEditingNoteValue(currentNote || '');
  };

  const handleNoteSave = async (profileId: string) => {
    if (editingNoteId !== profileId) return;

    try {
      // Update profile notes via API
      await window.electronAPI.localDataUpdateProfile(profileId, {
        notes: editingNoteValue
      });

      // Update local state
      setProfiles(prevProfiles =>
        prevProfiles.map(p =>
          p.id === profileId ? { ...p, notes: editingNoteValue } : p
        )
      );

      // Exit edit mode
      setEditingNoteId(null);
      setEditingNoteValue('');
    } catch (error) {
      console.error('Failed to update note:', error);
      alert('Failed to save note. Please try again.');
      // Reload profiles to sync state
      await loadProfiles();
    }
  };

  const handleNoteBlur = (profileId: string) => {
    handleNoteSave(profileId);
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent, profileId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNoteSave(profileId);
    } else if (e.key === 'Escape') {
      setEditingNoteId(null);
      setEditingNoteValue('');
    }
  };

  const ConnectionStatus = () => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
      connectionStatus === true ? 'bg-green-100 text-green-800' :
      connectionStatus === false ? 'bg-red-100 text-red-800' :
      'bg-yellow-100 text-yellow-800'
    }`}>
      <div className={`w-2 h-2 rounded-full ${
        connectionStatus === true ? 'bg-green-500' :
        connectionStatus === false ? 'bg-red-500' :
        'bg-yellow-500'
      }`} />
      <span className="text-sm font-medium">
        {connectionStatus === true ? 'GoLogin Connected' :
         connectionStatus === false ? 'GoLogin Disconnected' :
         'Testing Connection...'}
      </span>
    </div>
  );

  if (loading && profiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading GoLogin profiles...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-medium text-gray-900">Browser Profiles</h1>
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            connectionStatus === true 
              ? 'bg-green-100 text-green-800' 
              : connectionStatus === false 
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
          }`}>
            {connectionStatus === true ? 'Connected' : connectionStatus === false ? 'Disconnected' : 'Checking...'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isSeller && !hasAssignedFolders) {
                alert('You cannot create profiles because you have not been assigned to any folders yet. Please contact the IT department for support.');
                return;
              }
              setShowCreateModal(true);
            }}
            disabled={isSeller && !hasAssignedFolders}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded transition-colors ${
              isSeller && !hasAssignedFolders
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add profile
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search profiles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border-0 bg-transparent focus:outline-none"
          />
          {/* Hide folder filter for Sellers - they only see their assigned folders */}
          {!isSeller && folders.length > 0 && (
            <select
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Folders</option>
              {folders.map((folder) => (
                <option key={folder.folder_id} value={folder.folder_id}>
                  {folder.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-gray-500">Loading profiles...</div>
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Globe className="w-12 h-12 mb-3" />
            {isSeller && !hasAssignedFolders ? (
              // Message for Seller with NO assigned folders
              <>
                <h3 className="text-base font-medium mb-2">No Access to Profiles</h3>
                <p className="text-sm text-center mb-4 max-w-md">
                  You have not been assigned access to manage any profiles yet. 
                  Please contact the IT department for support.
                </p>
              </>
            ) : isSeller && hasAssignedFolders ? (
              // Message for Seller with assigned folders but no profiles yet
              <>
                <h3 className="text-base font-medium mb-2">No profiles found</h3>
                <p className="text-sm text-center mb-4">
                  {searchTerm 
                    ? 'Try adjusting your search criteria.' 
                    : 'No profiles have been created in your assigned folders yet.'}
                </p>
              </>
            ) : (
              // Message for Admin with no profiles
              <>
                <h3 className="text-base font-medium mb-2">No profiles found</h3>
                <p className="text-sm text-center mb-4">
                  {searchTerm || selectedFolder 
                    ? 'Try adjusting your search or filter criteria.' 
                    : 'Create your first GoLogin profile to get started.'}
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add profile
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="min-w-full">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b text-xs font-medium text-gray-700 uppercase tracking-wider">
              <div className="col-span-2 flex items-center gap-2">
                <span>Name</span>
                <div className="flex flex-col">
                  <button className="text-gray-400 hover:text-gray-600">↑</button>
                  <button className="text-gray-400 hover:text-gray-600">↓</button>
                </div>
                <Plus className="w-3 h-3 text-gray-400" />
              </div>
              <div className="col-span-2">State</div>
              <div className="col-span-2">Seller</div>
              <div className="col-span-2">Notes</div>
              <div className="col-span-3">Location</div>
              <div className="col-span-1"></div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100">
              {profiles.map((profile) => {
                // Debug: log first profile to check folder_names
                if (profiles.indexOf(profile) === 0) {
                  console.log('Profile data:', profile);
                  console.log('folder_names:', (profile as any).folder_names);
                }
                return (
                <div key={profile.id} className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                  {/* Name */}
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {profile.name}
                    </span>
                  </div>

                  {/* State */}
                  <div className="col-span-2 flex items-center gap-2">
                    {(() => {
                      const isRunning = runningProfiles.has(profile.id);
                      const isChecking = checkingProfiles.has(profile.id);
                      const isCloudUpdating = (profile as any).isCloudUpdating;
                      
                      return (
                        <>
                          <button
                            onClick={() => handleLaunchProfile(profile.id)}
                            disabled={isRunning || isChecking}
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                              isRunning || isChecking
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                                : 'bg-teal-100 text-teal-800 hover:bg-teal-200'
                            }`}
                          >
                            Run
                          </button>
                          {isRunning && (
                            <button
                              onClick={() => handleStopProfile(profile.id)}
                              disabled={stoppingProfiles.has(profile.id)}
                              className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                                stoppingProfiles.has(profile.id)
                                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              }`}
                            >
                              {stoppingProfiles.has(profile.id) && (
                                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              )}
                              {stoppingProfiles.has(profile.id) ? 'Stopping...' : 'Stop'}
                            </button>
                          )}
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full ${
                              isRunning ? 'bg-green-500' : 
                              isChecking ? 'bg-yellow-500' : 
                              isCloudUpdating ? 'bg-blue-500' : 
                              profile.canBeRunning ? 'bg-gray-300' : 'bg-red-500'
                            }`}></div>
                            <span className="ml-1 text-xs text-gray-600">
                              {isRunning ? 'running' : 
                               isChecking ? 'checking' : 
                               isCloudUpdating ? 'cloud updating' : 
                               profile.canBeRunning ? 'ready' : 'locked'}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Seller */}
                  <div className="col-span-2 flex items-center overflow-hidden">
                    <span className="text-xs text-gray-600 truncate" title={(profile as any).folder_names || '-'}>
                      {(profile as any).folder_names || '-'}
                    </span>
                  </div>

                  {/* Notes */}
                  <div className="col-span-2 flex items-center">
                    {editingNoteId === profile.id ? (
                      <input
                        type="text"
                        value={editingNoteValue}
                        onChange={(e) => setEditingNoteValue(e.target.value)}
                        onBlur={() => handleNoteBlur(profile.id)}
                        onKeyDown={(e) => handleNoteKeyDown(e, profile.id)}
                        className="w-full px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <span
                        onDoubleClick={() => handleNoteDoubleClick(profile.id, profile.notes || '')}
                        className="text-xs text-blue-600 truncate cursor-pointer hover:bg-blue-50 px-2 py-1 rounded w-full"
                        title="Double-click to edit"
                      >
                        {profile.notes || 'select text for formatting...'}
                      </span>
                    )}
                  </div>

                  {/* Location */}
                  <div className="col-span-3 flex items-center gap-2">
                    {(() => {
                      // Check proxy mode and get location
                      if (!profile.proxy || profile.proxy.mode === 'none') {
                        return (
                          <>
                            <span className="text-sm">🏠</span>
                            <span className="text-xs text-gray-600">Local IP</span>
                          </>
                        );
                      }

                      // Get country info from various proxy fields
                      const customName = (profile.proxy as any)?.customName;
                      const proxyRegion = (profile as any)?.proxyRegion;
                      const autoProxyRegion = (profile.proxy as any)?.autoProxyRegion;
                      const host = profile.proxy.host;
                      
                      let countryCode: string | null = null;
                      let displayText = host || 'Custom Proxy';
                      
                      // Priority 1: customName (for geolocation proxies)
                      if (customName) {
                        const trimmedName = customName.trim();
                        const exactMatch = Object.entries({
                          'France': 'FR', 'Germany': 'DE', 'United States': 'US', 'USA': 'US',
                          'United Kingdom': 'UK', 'UK': 'UK', 'Canada': 'CA', 'Japan': 'JP',
                          'Australia': 'AU', 'Netherlands': 'NL', 'Singapore': 'SG', 'Vietnam': 'VN',
                          'Brazil': 'BR', 'Italy': 'IT', 'Spain': 'ES', 'Russia': 'RU', 'India': 'IN',
                          'South Korea': 'KR', 'Korea': 'KR', 'Switzerland': 'CH', 'Sweden': 'SE',
                          'Norway': 'NO', 'Finland': 'FI', 'Denmark': 'DK', 'Belgium': 'BE',
                          'Austria': 'AT', 'Poland': 'PL', 'Czech Republic': 'CZ', 'Mexico': 'MX',
                          'Argentina': 'AR', 'Thailand': 'TH', 'Malaysia': 'MY', 'Indonesia': 'ID',
                          'Philippines': 'PH', 'Hong Kong': 'HK', 'Taiwan': 'TW'
                        }).find(([name]) => name.toLowerCase() === trimmedName.toLowerCase());
                        
                        if (exactMatch) {
                          countryCode = exactMatch[1];
                        }
                      }
                      // Priority 2: proxyRegion (from profile level)
                      else if (proxyRegion && proxyRegion !== '') {
                        countryCode = proxyRegion.toUpperCase();
                      }
                      // Priority 3: autoProxyRegion (from proxy object)
                      else if (autoProxyRegion && autoProxyRegion !== 'us') {
                        countryCode = autoProxyRegion.toUpperCase();
                      }
                      // Priority 4: Detect from IP address
                      else if (host && host !== '') {
                        // Try IP-based detection first
                        const detectedCountry = getCountryFromIP(host);
                        if (detectedCountry) {
                          countryCode = detectedCountry;
                        } else {
                          // Fallback to domain analysis
                          const lowerHost = host.toLowerCase();
                          if (lowerHost.includes('.us') || lowerHost.includes('usa')) {
                            countryCode = 'US';
                          } else if (lowerHost.includes('.uk') || lowerHost.includes('.gb')) {
                            countryCode = 'UK';
                          } else if (lowerHost.includes('.de') || lowerHost.includes('germany')) {
                            countryCode = 'DE';
                          } else if (lowerHost.includes('.fr') || lowerHost.includes('france')) {
                            countryCode = 'FR';
                          } else if (lowerHost.includes('.vn') || lowerHost.includes('vietnam')) {
                            countryCode = 'VN';
                          }
                        }
                      }
                      
                      const countryInfo = countryCode ? getCountryInfo(countryCode) : { flag: '🌐', name: '' };
                      
                      return (
                        <>
                          <span className="text-sm">{countryInfo.flag}</span>
                          <span className="text-xs text-gray-600">{displayText}</span>
                          <button
                            onClick={() => handleOpenEditProxy(profile)}
                            className="text-gray-400 hover:text-blue-600 transition-colors ml-2"
                            title="Edit Proxy"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </>
                      );
                    })()}
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end gap-2">
                    {!isSeller && (
                      <button
                        onClick={() => handleOpenFolderManager(profile.id)}
                        className="text-gray-400 hover:text-purple-600 transition-colors"
                        title="Manage Folders"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        setSelectedProfileId(profile.id);
                        setShowCookiesManager(true);
                        await fetchCookies(profile.id);
                      }}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Cookies Manager"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete Profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {totalProfiles > 0 && (
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-xs text-gray-600">
            Showing {profiles.length} of {totalProfiles} profiles
          </div>
          {totalProfiles > 30 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                {currentPage}
              </span>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage * 30 >= totalProfiles}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Create Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">New Browser Profile</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Profile Name and Folder */}
            <div className="p-6 border-b bg-gray-50">
              <div className={isSeller ? "grid grid-cols-1 gap-4" : "grid grid-cols-2 gap-4"}>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="Profile Name"
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                {!isSeller && (
                  <select
                    value={newProfileFolder}
                    onChange={(e) => setNewProfileFolder(e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No folder</option>
                    {folders.map((folder) => (
                      <option key={folder.folder_id} value={folder.folder_id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b">
              <div className="flex overflow-x-auto">
                {[
                  { id: 'overview', name: 'Overview' },
                  { id: 'proxy', name: 'Proxy' },
                  { id: 'timezone', name: 'Timezone' },
                  { id: 'extensions', name: 'Extensions' },
                  { id: 'bookmarks', name: 'Bookmarks' },
                  { id: 'webrtc', name: 'WebRTC' },
                  { id: 'geolocation', name: 'Geolocation' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6 overflow-y-auto max-h-96">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Operating System
                    </label>
                    <select
                      value={newProfileOS}
                      onChange={(e) => setNewProfileOS(e.target.value as 'win' | 'mac' | 'lin')}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="win">Windows</option>
                      <option value="mac">macOS</option>
                      <option value="lin">Linux</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={profileNotes}
                      onChange={(e) => setProfileNotes(e.target.value)}
                      placeholder="Add notes for this profile..."
                      rows={3}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'proxy' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Add or edit proxy</h3>
                    <button
                      onClick={handlePasteProxyForCreate}
                      className="flex items-center gap-2 px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                      title="Paste proxy from clipboard"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Paste
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Proxy Type, Host and Port
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={proxyConfig.type}
                        onChange={(e) => setProxyConfig(prev => ({ ...prev, type: e.target.value }))}
                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="auto">Auto</option>
                        <option value="http">HTTP</option>
                        <option value="https">HTTPS</option>
                        <option value="socks4">SOCKS4</option>
                        <option value="socks5">SOCKS5</option>
                      </select>
                      <input
                        type="text"
                        value={proxyConfig.host}
                        onChange={(e) => setProxyConfig(prev => ({ ...prev, host: e.target.value }))}
                        placeholder="IP Address"
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={proxyConfig.port}
                        onChange={(e) => setProxyConfig(prev => ({ ...prev, port: e.target.value }))}
                        placeholder="port"
                        className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Login
                    </label>
                    <input
                      type="text"
                      value={proxyConfig.username}
                      onChange={(e) => setProxyConfig(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Proxy Username"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={proxyConfig.password}
                      onChange={(e) => setProxyConfig(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Proxy Password"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Change IP URL
                    </label>
                    <input
                      type="text"
                      value={proxyConfig.changeIpUrl}
                      onChange={(e) => setProxyConfig(prev => ({ ...prev, changeIpUrl: e.target.value }))}
                      placeholder="Change IP URL for mobile proxy"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <button 
                    onClick={handleCheckProxy}
                    disabled={checkingProxy || !proxyConfig.host || !proxyConfig.port}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkingProxy ? 'Checking...' : 'Check Proxy'}
                  </button>

                  {/* Proxy Check Result */}
                  {proxyCheckResult && proxyCheckResult.status && (
                    <div className="mt-4">
                      {proxyCheckResult.status === 'success' && proxyCheckResult.details && proxyCheckResult.details.length > 0 && (
                        <div className="border border-green-300 rounded-lg p-4 bg-green-50">
                          <div className="flex items-center mb-3">
                            <span className="text-lg mr-2">{proxyCheckResult.details[0].flag || '🌐'}</span>
                            <span className="text-sm font-medium text-gray-700">
                              Proxy in {proxyCheckResult.details[0].location || 'Unknown Location'}
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {proxyCheckResult.details.map((detail, index) => (
                              <div 
                                key={index}
                                onClick={() => {
                                  // Update selected proxy type
                                  setProxyConfig(prev => ({ ...prev, type: detail.type.toLowerCase() }));
                                  setProxyCheckResult(prev => {
                                    if (!prev) return null;
                                    return {
                                      status: prev.status,
                                      message: prev.message,
                                      details: prev.details?.map((d, i) => ({
                                        ...d,
                                        selected: i === index
                                      }))
                                    };
                                  });
                                }}
                                className={`flex items-center justify-between p-3 bg-white border rounded-lg cursor-pointer transition-all ${
                                  detail.selected 
                                    ? 'border-green-500 ring-2 ring-green-200' 
                                    : 'border-green-200 hover:border-green-300'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  {detail.selected && (
                                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                  {!detail.selected && <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>}
                                  <div>
                                    <div className="font-medium text-gray-900">{detail.type}</div>
                                    <div className="text-sm text-gray-600">{detail.ip}</div>
                                  </div>
                                </div>
                                <div className="flex items-center">
                                  <span className="text-sm font-medium text-green-600">{Math.round(detail.ping)} ms</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {proxyCheckResult.status === 'error' && (
                        <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center mr-3">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-sm text-red-700">{proxyCheckResult.message}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'timezone' && (
                <div className="text-center py-8 text-gray-500">
                  <p>Timezone settings will be available soon</p>
                </div>
              )}

              {activeTab === 'extensions' && (
                <div className="text-center py-8 text-gray-500">
                  <p>Extension settings will be available soon</p>
                </div>
              )}

              {activeTab === 'bookmarks' && (
                <div className="text-center py-8 text-gray-500">
                  <p>Bookmark settings will be available soon</p>
                </div>
              )}

              {activeTab === 'webrtc' && (
                <div className="text-center py-8 text-gray-500">
                  <p>WebRTC settings will be available soon</p>
                </div>
              )}

              {activeTab === 'geolocation' && (
                <div className="text-center py-8 text-gray-500">
                  <p>Geolocation settings will be available soon</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-2 text-gray-600 border rounded-lg hover:bg-gray-100 transition-colors"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateQuickProfile}
                disabled={!newProfileName.trim() || creating}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cookies Manager Modal */}
      {showCookiesManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-semibold text-gray-800">Cookies manager</h2>
              <button
                onClick={() => {
                  setShowCookiesManager(false);
                  setSelectedProfileId(null);
                  setCookies([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-auto">
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => {
                    setShowCookiesManager(false);
                    setShowImportCookies(true);
                  }}
                  className="px-3 py-1.5 border border-green-500 text-green-600 rounded text-sm font-medium hover:bg-green-50 transition-colors"
                >
                  Import
                </button>
                <button
                  onClick={handleExportCookies}
                  disabled={cookies.length === 0}
                  className="px-3 py-1.5 border border-green-500 text-green-600 rounded text-sm font-medium hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export
                </button>
                <button
                  onClick={handleClearCookies}
                  disabled={cookies.length === 0}
                  className="px-3 py-1.5 border border-red-500 text-red-600 rounded text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear
                </button>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4 pb-3 border-b">
                <div className="flex items-center gap-1 text-sm font-medium text-gray-600">Name</div>
                <div className="flex items-center gap-1 text-sm font-medium text-gray-600">URL</div>
                <div className="flex items-center gap-1 text-sm font-medium text-gray-600">Value</div>
                <div className="flex items-center gap-1 text-sm font-medium text-gray-600">Expires</div>
              </div>

              {loadingCookies ? (
                <div className="py-12 text-center">
                  <p className="text-gray-400 text-sm">Loading cookies...</p>
                </div>
              ) : cookies.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-400 text-sm">No cookies found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cookies.map((cookie, index) => (
                    <div key={index} className="grid grid-cols-4 gap-4 py-3 border-b text-sm">
                      <div className="truncate text-gray-800">{cookie.name}</div>
                      <div className="truncate text-gray-600">{cookie.domain || cookie.url || '-'}</div>
                      <div className="truncate text-gray-600">{'*'.repeat(Math.min(cookie.value?.length || 0, 20))}</div>
                      <div className="truncate text-gray-600">
                        {cookie.expirationDate 
                          ? new Date(cookie.expirationDate * 1000).toLocaleDateString()
                          : cookie.session ? 'Session' : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Cookies Modal */}
      {showImportCookies && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-semibold text-gray-800">Cookies manager</h2>
              <button
                onClick={() => {
                  setShowImportCookies(false);
                  setCookiesText('');
                  setIsDragging(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {profiles.find(p => p.id === selectedProfileId)?.name || 'Profile'}
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Cookies are supported in <span className="font-medium">JSON</span> and <span className="font-medium">Netscape</span> format
              </p>
              <div
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json,.txt';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setCookiesText(event.target?.result as string || '');
                      };
                      reader.readAsText(file);
                    }
                  };
                  input.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setCookiesText(event.target?.result as string || '');
                    };
                    reader.readAsText(file);
                  }
                }}
                className={`border-2 border-dashed rounded-lg p-12 mb-6 text-center transition-colors cursor-pointer ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-400 font-medium">Drag & Drop Cookies File</p>
                </div>
              </div>
              <div className="text-center text-gray-400 font-medium mb-6">OR</div>
              <textarea
                value={cookiesText}
                onChange={(e) => setCookiesText(e.target.value)}
                placeholder="Paste cookies"
                className="w-full h-64 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowImportCookies(false);
                  setCookiesText('');
                  setIsDragging(false);
                }}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedProfileId || !cookiesText.trim()) return;
                  
                  try {
                    // Parse cookies from text
                    let cookies: any[] = [];
                    
                    // Try JSON format first
                    try {
                      const parsed = JSON.parse(cookiesText);
                      cookies = Array.isArray(parsed) ? parsed : [parsed];
                    } catch {
                      // Try Netscape format
                      const lines = cookiesText.split('\n');
                      cookies = lines
                        .filter(line => line.trim() && !line.startsWith('#'))
                        .map(line => {
                          const parts = line.split('\t');
                          if (parts.length >= 7) {
                            return {
                              domain: parts[0],
                              hostOnly: parts[1] === 'FALSE',
                              path: parts[2],
                              secure: parts[3] === 'TRUE',
                              expirationDate: parseInt(parts[4]),
                              name: parts[5],
                              value: parts[6],
                              httpOnly: false,
                              session: false,
                              sameSite: 'no_restriction'
                            };
                          }
                          return null;
                        })
                        .filter(c => c !== null);
                    }
                    
                    if (cookies.length === 0) {
                      alert('No valid cookies found. Please check the format.');
                      return;
                    }
                    
                    // Import cookies via API
                    await window.electronAPI.gologinImportCookies(selectedProfileId, cookies);
                    
                    alert(`Successfully imported ${cookies.length} cookie(s)!`);
                    setShowImportCookies(false);
                    setCookiesText('');
                    setShowCookiesManager(true);
                    await fetchCookies(selectedProfileId);
                  } catch (error: any) {
                    console.error('Failed to import cookies:', error);
                    alert('Failed to import cookies: ' + (error.message || 'Unknown error'));
                  }
                }}
                disabled={!cookiesText.trim()}
                className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Proxy Modal */}
      {showEditProxy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Edit Proxy</h2>
              <button
                onClick={() => {
                  setShowEditProxy(false);
                  setSelectedProfileForProxy(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">Enter proxy details</p>
                <button
                  onClick={handlePasteProxy}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  title="Paste proxy from clipboard"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Paste
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Protocol</label>
                <select
                  value={proxyMode}
                  onChange={(e) => setProxyMode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks4">SOCKS4</option>
                  <option value="socks5">SOCKS5</option>
                  <option value="none">No Proxy</option>
                </select>
              </div>

              {proxyMode !== 'none' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                      <input
                        type="text"
                        value={proxyHost}
                        onChange={(e) => setProxyHost(e.target.value)}
                        placeholder="proxy.example.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                      <input
                        type="text"
                        value={proxyPort}
                        onChange={(e) => setProxyPort(e.target.value)}
                        placeholder="8080"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={proxyUsername}
                      onChange={(e) => setProxyUsername(e.target.value)}
                      placeholder="username"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={proxyPassword}
                      onChange={(e) => setProxyPassword(e.target.value)}
                      placeholder="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowEditProxy(false);
                  setSelectedProfileForProxy(null);
                }}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProxy}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Manager Modal */}
      {showFolderManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Manage Profile Folders</h2>
              <button
                onClick={() => {
                  setShowFolderManager(false);
                  setSelectedProfileForFolders(null);
                  setProfileFolders([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              {loadingFolders ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {folders.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No folders available</p>
                  ) : (
                    folders.map((folder) => (
                      <div
                        key={folder.folder_id}
                        className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleFolderSelection(folder.folder_id)}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          profileFolders.includes(folder.folder_id)
                            ? 'border-orange-500 bg-orange-500'
                            : 'border-gray-300 bg-white'
                        }`}>
                          {profileFolders.includes(folder.folder_id) && (
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Folder className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{folder.name}</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">
                          {folder.profilesCount || 0} profiles
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center p-6 border-t bg-gray-50">
              <p className="text-sm text-gray-600">
                {profileFolders.length} folder{profileFolders.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowFolderManager(false);
                    setSelectedProfileForFolders(null);
                    setProfileFolders([]);
                  }}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfileFolders}
                  disabled={loadingFolders}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
