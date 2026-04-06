import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Clipboard, Check, ChevronDown, Globe, Monitor } from 'lucide-react';

interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  path: string;
  icon?: string;
  addedAt?: string;
}

interface EditProfileModalProps {
  profileId: string;
  profileName: string;
  profileProxy?: {
    mode?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    changeIpUrl?: string;
  };
  onClose: () => void;
  onSave: (profileId: string, data: any) => Promise<void>;
}

export function EditProfileModal({ profileId, profileName, profileProxy, onClose, onSave }: EditProfileModalProps) {
  const [activeTab, setActiveTab] = useState('proxy');
  const [name, setName] = useState(profileName);
  const [saving, setSaving] = useState(false);

  // Proxy state - determine initial mode from profile data
  const initialProxyMode = profileProxy?.host ? 'your' : (profileProxy?.mode === 'none' ? 'none' : 'your');
  const [proxyMode, setProxyMode] = useState(initialProxyMode);
  const [proxyType, setProxyType] = useState(profileProxy?.mode || 'http');
  const [proxyHost, setProxyHost] = useState(profileProxy?.host || '');
  const [proxyPort, setProxyPort] = useState(profileProxy?.port?.toString() || '');
  const [proxyUsername, setProxyUsername] = useState(profileProxy?.username || '');
  const [proxyPassword, setProxyPassword] = useState(profileProxy?.password || '');
  const [proxyChangeIpUrl, setProxyChangeIpUrl] = useState(profileProxy?.changeIpUrl || '');
  const [proxyDirty, setProxyDirty] = useState(false);
  const [checkingProxy, setCheckingProxy] = useState(false);
  const [deviceIp, setDeviceIp] = useState<string>('');
  const [loadingDeviceIp, setLoadingDeviceIp] = useState(false);

  const fetchDeviceIp = async () => {
    setLoadingDeviceIp(true);
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setDeviceIp(data.ip || '');
    } catch (error) {
      console.error('Failed to fetch device IP:', error);
      setDeviceIp('Unable to detect IP');
    } finally {
      setLoadingDeviceIp(false);
    }
  };
  const [proxyCheckResult, setProxyCheckResult] = useState<{
    status: 'success' | 'error';
    message: string;
    ip?: string;
    country?: string;
    flag?: string;
  } | null>(null);

  // Extensions state
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [loadingExtensions, setLoadingExtensions] = useState(false);
  const [addingExtension, setAddingExtension] = useState(false);
  const [confirmExtension, setConfirmExtension] = useState<{
    name: string;
    version: string;
    folderPath: string;
    iconPath: string;
    description: string;
  } | null>(null);

  // Browser version state
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [currentUserAgent, setCurrentUserAgent] = useState('');
  const [currentChromeVersion, setCurrentChromeVersion] = useState('');
  const [selectedMajorVersion, setSelectedMajorVersion] = useState('');
  const [profileOs, setProfileOs] = useState('win');
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [versionDirty, setVersionDirty] = useState(false);

  const tabs = [
    { id: 'overview', name: 'Overview' },
    { id: 'proxy', name: 'Proxy' },
    { id: 'timezone', name: 'Timezone' },
    { id: 'extensions', name: 'Extensions' },
    { id: 'bookmarks', name: 'Bookmarks' },
    { id: 'geolocation', name: 'Geolocation' },
    { id: 'advanced', name: 'Advanced' },
  ];

  // Extract Chrome major version from userAgent string
  const extractChromeVersion = (ua: string): string => {
    const match = ua.match(/Chrome\/(\d+)/);
    return match ? match[1] : '';
  };

  // Load full profile data and browser versions on mount
  useEffect(() => {
    loadExtensions();
    loadFullProfile();
    loadBrowserVersions();
    if (initialProxyMode === 'none') {
      fetchDeviceIp();
    }
  }, [profileId]);

  const loadExtensions = async () => {
    setLoadingExtensions(true);
    try {
      const exts = await window.electronAPI.extensionGetProfileExtensions(profileId);
      setExtensions(exts || []);
    } catch (err) {
      console.error('Failed to load extensions:', err);
    } finally {
      setLoadingExtensions(false);
    }
  };

  const loadFullProfile = async () => {
    setLoadingProfile(true);
    try {
      const profile = await window.electronAPI.gologinGetFullProfile(profileId);
      if (profile) {
        const ua = profile.navigator?.userAgent || '';
        setCurrentUserAgent(ua);
        const majorV = extractChromeVersion(ua);
        setCurrentChromeVersion(majorV);
        setSelectedMajorVersion(majorV);
        setProfileOs(profile.os || 'win');
      }
    } catch (err) {
      console.error('Failed to load full profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadBrowserVersions = async () => {
    setLoadingVersions(true);
    try {
      const data = await window.electronAPI.gologinGetBrowserVersions();
      // API returns { supportedOrbitaVersions: ["105", "106", ...] }
      const versions = data?.supportedOrbitaVersions || data;
      if (Array.isArray(versions)) {
        // Sort versions descending (newest first)
        const sorted = [...versions].sort((a: string, b: string) => parseInt(b) - parseInt(a));
        setAvailableVersions(sorted);
      }
    } catch (err) {
      console.error('Failed to load browser versions:', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleAddExtension = async () => {
    try {
      const result = await window.electronAPI.extensionSelectFolder();
      if (!result) return; // User cancelled
      
      if (result.error) {
        alert(result.error);
        return;
      }
      
      // Show confirmation dialog
      setConfirmExtension(result);
    } catch (err: any) {
      alert('Failed to select extension folder: ' + err.message);
    }
  };

  const handleConfirmAddExtension = async () => {
    if (!confirmExtension) return;
    
    setAddingExtension(true);
    try {
      const result = await window.electronAPI.extensionAddToProfile(profileId, {
        name: confirmExtension.name,
        version: confirmExtension.version,
        folderPath: confirmExtension.folderPath,
        iconPath: confirmExtension.iconPath,
      });
      
      if (result.success && result.extension) {
        setExtensions(prev => [...prev, result.extension]);
      } else {
        alert('Failed to add extension: ' + (result.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Failed to add extension: ' + err.message);
    } finally {
      setAddingExtension(false);
      setConfirmExtension(null);
    }
  };

  const handleRemoveExtension = async (extensionId: string) => {
    try {
      const result = await window.electronAPI.extensionRemoveFromProfile(profileId, extensionId);
      if (result.success) {
        setExtensions(prev => prev.filter(e => e.id !== extensionId));
      } else {
        alert('Failed to remove extension: ' + (result.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Failed to remove extension: ' + err.message);
    }
  };

  const handlePasteProxy = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const input = text.trim();
      
      const urlRegex = /^(https?|socks4|socks5):\/\/(?:([^:@]+):([^@]+)@)?([^:]+):(\d+)$/;
      const urlMatch = input.match(urlRegex);
      
      if (urlMatch) {
        const [, mode, username, password, host, port] = urlMatch;
        setProxyType(mode);
        setProxyHost(host);
        setProxyPort(port);
        setProxyUsername(username || '');
        setProxyPassword(password || '');
        setProxyDirty(true);
        return;
      }
      
      const colonFormat = input.split(':');
      if (colonFormat.length >= 2) {
        setProxyType('http');
        setProxyHost(colonFormat[0]);
        setProxyPort(colonFormat[1]);
        setProxyUsername(colonFormat[2] || '');
        setProxyPassword(colonFormat[3] || '');
        setProxyDirty(true);
        return;
      }
      
      alert('Invalid proxy format.');
    } catch (error) {
      alert('Failed to paste from clipboard');
    }
  };

  // Helper to mark proxy as dirty when any proxy field changes
  const updateProxyField = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setProxyDirty(true);
  };

  const handleCheckProxy = async () => {
    if (!proxyHost || !proxyPort) {
      setProxyCheckResult({ status: 'error', message: 'Please enter proxy host and port' });
      return;
    }

    setCheckingProxy(true);
    setProxyCheckResult(null);

    try {
      const port = parseInt(proxyPort);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error('Invalid port number');
      }

      const testResults = await window.electronAPI.testProxyConfig({
        host: proxyHost.trim(),
        port,
        username: proxyUsername || undefined,
        password: proxyPassword || undefined,
      });

      let hasSuccess = false;
      let successIp = '';
      let successCountry = '';

      for (const [type, result] of Object.entries(testResults) as [string, any][]) {
        if (result.success) {
          hasSuccess = true;
          successIp = result.ip || proxyHost;
          successCountry = result.country || '';
          break;
        }
      }

      if (!hasSuccess) {
        throw new Error('Proxy connection failed. Try another proxy server.');
      }

      setProxyCheckResult({
        status: 'success',
        message: `Proxy is working`,
        ip: successIp,
        country: successCountry,
      });
    } catch (error: any) {
      setProxyCheckResult({
        status: 'error',
        message: error.message || 'Proxy check failed',
      });
    } finally {
      setCheckingProxy(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const errors: string[] = [];
    
    try {
      // 1. Update profile name if changed
      if (name !== profileName) {
        try {
          await onSave(profileId, { name });
        } catch (err: any) {
          errors.push('Name: ' + err.message);
        }
      }
      
      // 2. Update proxy only if user changed proxy settings
      if (proxyDirty) {
        try {
          if (proxyMode === 'your' && proxyHost && proxyPort) {
            await window.electronAPI.gologinSetProxy(profileId, {
              mode: proxyType,
              host: proxyHost,
              port: parseInt(proxyPort),
              username: proxyUsername || '',
              password: proxyPassword || '',
              changeIpUrl: proxyChangeIpUrl || '',
            });
          } else if (proxyMode === 'none') {
            await window.electronAPI.gologinSetProxy(profileId, {
              mode: 'none',
              host: '',
              port: 0,
              username: '',
              password: '',
            });
          }
        } catch (err: any) {
          errors.push('Proxy: ' + err.message);
        }
      }
      
      // 3. Update browser version if user changed it
      if (versionDirty && selectedMajorVersion && selectedMajorVersion !== currentChromeVersion) {
        try {
          // Get a new fingerprint for the selected OS to get a matching userAgent
          const fingerprint = await window.electronAPI.gologinGetFingerprint(profileOs);
          if (fingerprint?.navigator?.userAgent) {
            // Replace the Chrome version in the new fingerprint's userAgent with the selected version
            const newUa = fingerprint.navigator.userAgent.replace(
              /Chrome\/\d+/,
              `Chrome/${selectedMajorVersion}`
            );
            await onSave(profileId, {
              navigator: {
                ...fingerprint.navigator,
                userAgent: newUa,
              },
            });
          }
        } catch (err: any) {
          errors.push('Browser version: ' + err.message);
        }
      }
      
      // Extensions are already saved locally via IPC handlers - no extra save needed
      
      if (errors.length > 0) {
        alert('Some changes failed to save:\n' + errors.join('\n'));
      }
      onClose();
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Edit Browser Profile</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Profile Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Browser Profile Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-80 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Proxy Tab */}
          {activeTab === 'proxy' && (
            <div>
              {/* Proxy mode selector */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => { setProxyMode('gologin'); setProxyDirty(true); }}
                  className={`px-4 py-1.5 text-sm rounded border ${
                    proxyMode === 'gologin' ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-gray-300 text-gray-600'
                  }`}
                >
                  Gologin proxy
                </button>
                <button
                  onClick={() => { setProxyMode('your'); setProxyDirty(true); }}
                  className={`px-4 py-1.5 text-sm rounded border ${
                    proxyMode === 'your' ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-gray-300 text-gray-600'
                  }`}
                >
                  Your proxy
                </button>
                <button
                  onClick={() => { setProxyMode('none'); setProxyDirty(true); fetchDeviceIp(); }}
                  className={`px-4 py-1.5 text-sm rounded border ${
                    proxyMode === 'none' ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-gray-300 text-gray-600'
                  }`}
                >
                  Without proxy
                </button>
                <button
                  onClick={handlePasteProxy}
                  className="p-1.5 text-gray-400 hover:text-gray-600 border rounded"
                  title="Paste proxy from clipboard"
                >
                  <Clipboard className="w-4 h-4" />
                </button>
              </div>

              {proxyMode === 'your' && (
                <>
                  {/* Choose saved proxy */}
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Choose saved proxy</h3>
                    <select className="w-80 px-3 py-2 border rounded-lg text-sm text-gray-500">
                      <option value="">Select saved proxy</option>
                    </select>
                  </div>

                  <hr className="my-6" />

                  {/* Add or edit proxy */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Add or edit proxy</h3>
                    
                    <div className="mb-4">
                      <label className="block text-sm text-gray-600 mb-1">Proxy Type, Host and Port</label>
                      <div className="flex items-center gap-1">
                        <select
                          value={proxyType}
                          onChange={(e) => { setProxyType(e.target.value); setProxyDirty(true); }}
                          className="w-32 px-3 py-2 border rounded-lg text-sm"
                        >
                          <option value="http">Auto</option>
                          <option value="http">HTTP</option>
                          <option value="socks4">SOCKS4</option>
                          <option value="socks5">SOCKS5</option>
                        </select>
                        <input
                          type="text"
                          value={proxyHost}
                          onChange={(e) => { setProxyHost(e.target.value); setProxyDirty(true); }}
                          placeholder="IP Address"
                          className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        />
                        <span className="text-gray-400">:</span>
                        <input
                          type="text"
                          value={proxyPort}
                          onChange={(e) => { setProxyPort(e.target.value); setProxyDirty(true); }}
                          placeholder="port"
                          className="w-20 px-3 py-2 border rounded-lg text-sm"
                        />
                        <button
                          onClick={() => { setProxyHost(''); setProxyPort(''); setProxyUsername(''); setProxyPassword(''); setProxyDirty(true); }}
                          className="p-2 text-gray-400 hover:text-red-500"
                          title="Clear"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm text-gray-600 mb-1">Login</label>
                      <input
                        type="text"
                        value={proxyUsername}
                        onChange={(e) => { setProxyUsername(e.target.value); setProxyDirty(true); }}
                        placeholder="Proxy Username"
                        className="w-80 px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm text-gray-600 mb-1">Password</label>
                      <input
                        type="text"
                        value={proxyPassword}
                        onChange={(e) => { setProxyPassword(e.target.value); setProxyDirty(true); }}
                        placeholder="Proxy Password"
                        className="w-80 px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm text-gray-600 mb-1">Change IP URL</label>
                      <input
                        type="text"
                        value={proxyChangeIpUrl}
                        onChange={(e) => { setProxyChangeIpUrl(e.target.value); setProxyDirty(true); }}
                        placeholder="Change IP URL for mobile proxy"
                        className="w-80 px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>

                    <button
                      onClick={handleCheckProxy}
                      disabled={checkingProxy || !proxyHost || !proxyPort}
                      className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
                    >
                      {checkingProxy ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Checking...
                        </>
                      ) : (
                        'Check Proxy'
                      )}
                    </button>

                    {/* Proxy check result */}
                    {proxyCheckResult && (
                      <div className={`mt-4 p-3 rounded-lg text-sm ${
                        proxyCheckResult.status === 'success'
                          ? 'bg-green-50 border border-green-200 text-green-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}>
                        {proxyCheckResult.status === 'success' ? (
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4" />
                            <span>{proxyCheckResult.message}</span>
                            {proxyCheckResult.ip && (
                              <span className="font-medium ml-1">
                                — IP: {proxyCheckResult.ip}
                                {proxyCheckResult.country && ` (${proxyCheckResult.country})`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <X className="w-4 h-4" />
                            <span>{proxyCheckResult.message}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {proxyMode === 'gologin' && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  GoLogin proxy settings will be available soon.
                </div>
              )}

              {proxyMode === 'none' && (
                <div className="py-6">
                  <div className="text-center text-gray-500 text-sm mb-4">
                    Profile will run without proxy.
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {loadingDeviceIp ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        Detecting your IP address...
                      </div>
                    ) : deviceIp ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                        <span className="text-sm text-green-700">Your IP:</span>
                        <span className="text-sm font-medium text-green-800">{deviceIp}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Extensions Tab */}
          {activeTab === 'extensions' && (
            <div>
              <button
                onClick={handleAddExtension}
                disabled={addingExtension}
                className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 mb-6"
              >
                <Plus className="w-4 h-4" />
                Add extensions
              </button>

              {loadingExtensions ? (
                <div className="text-center py-8 text-gray-500 text-sm">Loading extensions...</div>
              ) : extensions.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No extensions added yet. Click "Add extensions" to load an extension from a local folder.
                </div>
              ) : (
                <div className="space-y-3">
                  {extensions.map((ext) => (
                    <div key={ext.id} className="flex items-center gap-3 py-2">
                      {/* Extension icon */}
                      {ext.icon ? (
                        <img src={ext.icon} alt="" className="w-8 h-8 rounded" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                          {ext.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      
                      {/* Extension info */}
                      <span className="text-sm text-gray-800">
                        {ext.name} V{ext.version}
                      </span>

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Remove button */}
                      <button
                        onClick={() => handleRemoveExtension(ext.id)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              {loadingProfile ? (
                <div className="text-center py-8 text-gray-500 text-sm">Loading profile data...</div>
              ) : (
                <>
                  {/* Operating System */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Operating System</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg w-80">
                      <Monitor className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">
                        {profileOs === 'win' ? 'Windows' : profileOs === 'mac' ? 'macOS' : profileOs === 'lin' ? 'Linux' : profileOs === 'android' ? 'Android' : profileOs}
                      </span>
                    </div>
                  </div>

                  {/* Browser Version */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Chrome Browser Version</label>
                    {currentUserAgent && (
                      <p className="text-xs text-gray-400 mb-2 truncate max-w-lg" title={currentUserAgent}>
                        Current UA: {currentUserAgent}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <select
                          value={selectedMajorVersion}
                          onChange={(e) => {
                            setSelectedMajorVersion(e.target.value);
                            setVersionDirty(true);
                          }}
                          disabled={loadingVersions || availableVersions.length === 0}
                          className="w-80 px-3 py-2 border rounded-lg text-sm appearance-none pr-8 bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
                        >
                          {!selectedMajorVersion && (
                            <option value="">Select Chrome version</option>
                          )}
                          {availableVersions.map((v) => (
                            <option key={v} value={v}>
                              Chrome {v}
                              {v === currentChromeVersion ? ' (current)' : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      {loadingVersions && (
                        <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    {selectedMajorVersion && selectedMajorVersion !== currentChromeVersion && (
                      <p className="text-xs text-orange-600 mt-2">
                        Version will be updated from Chrome {currentChromeVersion || '?'} → Chrome {selectedMajorVersion} on save.
                      </p>
                    )}
                  </div>

                  {/* Profile Info */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Profile ID</label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border">{profileId}</code>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Timezone Tab */}
          {activeTab === 'timezone' && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Timezone settings will be available soon.
            </div>
          )}

          {/* Bookmarks Tab */}
          {activeTab === 'bookmarks' && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Bookmark settings will be available soon.
            </div>
          )}

          {/* Geolocation Tab */}
          {activeTab === 'geolocation' && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Geolocation settings will be available soon.
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Advanced settings will be available soon.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 border border-orange-500 text-orange-600 text-sm rounded-lg hover:bg-orange-50"
          >
            Cancel
          </button>
        </div>

        {/* Confirm Extension Dialog */}
        {confirmExtension && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold mb-3">Load Extension</h3>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{confirmExtension.name}</p>
                <p className="text-xs text-gray-500">Version: {confirmExtension.version}</p>
                {confirmExtension.description && (
                  <p className="text-xs text-gray-500 mt-1">{confirmExtension.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1 break-all">{confirmExtension.folderPath}</p>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to load this extension into the profile?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmExtension(null)}
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAddExtension}
                  disabled={addingExtension}
                  className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {addingExtension ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Load Extension
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
