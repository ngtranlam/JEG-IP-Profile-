import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Globe, FolderOpen, Monitor, ChevronRight, Play, Shield, Clock, X, Loader2, Check, Tag, Calendar, RefreshCw, AlertTriangle } from 'lucide-react';

interface GoLoginStats {
  totalProfiles: number;
  runningProfiles: number;
  connectionStatus: boolean;
}

interface User {
  id: string;
  userName: string;
  fullName: string;
  email: string;
  roles: string;
}

interface DashboardProps {
  goLoginStats: GoLoginStats;
  onRefresh: () => Promise<void>;
  currentUser?: User | null;
  onViewChange?: (view: 'dashboard' | 'profiles' | 'folders' | 'users' | 'proxy') => void;
  onSelectFolder?: (folderId: string) => void;
}

// SVG Donut Chart component for Profile Overview
function DonutChart({ running, available, total }: { running: number; available: number; total: number }) {
  const [isHovered, setIsHovered] = React.useState(false);
  const size = 120;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const runningPct = total > 0 ? running / total : 0;
  const runningDash = circumference * runningPct;
  const availableDash = circumference - runningDash;

  return (
    <div 
      className="relative inline-flex items-center justify-center cursor-pointer transition-transform duration-300 ease-out hover:scale-110"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => console.log(`Profile stats: ${running} running / ${total} total`)}
      style={{ filter: isHovered ? 'drop-shadow(0 4px 12px rgba(249, 115, 22, 0.3))' : 'none' }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f97316" strokeWidth={strokeWidth}
          strokeDasharray={`${runningDash} ${availableDash}`} strokeLinecap="round" className="transition-all duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`text-xl font-bold text-gray-900 transition-all duration-300 ${isHovered ? 'scale-110' : ''}`}>{running}</span>
        <span className="text-[9px] text-gray-400 uppercase tracking-wider font-medium">Running</span>
      </div>
    </div>
  );
}

// Filled Pie Chart for Proxy Status (active, expiring, inactive) with percentage labels
function ProxyStatusChart({ active, expiring, inactive }: { active: number; expiring: number; inactive: number }) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const total = active + expiring + inactive;
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 75;
  const labelRadius = radius * 0.65;
  const outerLabelRadius = radius + 24;

  const segments = [
    { value: active, color: '#10b981', label: 'Active' },
    { value: expiring, color: '#f59e0b', label: 'Expiring' },
    { value: inactive, color: '#ef4444', label: 'Inactive' },
  ].filter(s => s.value > 0);

  // Build pie slices
  let cumulativeAngle = -Math.PI / 2; // start from top
  const slices = segments.map(seg => {
    const pct = total > 0 ? seg.value / total : 0;
    const angle = pct * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    const midAngle = startAngle + angle / 2;
    cumulativeAngle = endAngle;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    const labelX = cx + labelRadius * Math.cos(midAngle);
    const labelY = cy + labelRadius * Math.sin(midAngle);
    const outerX = cx + outerLabelRadius * Math.cos(midAngle);
    const outerY = cy + outerLabelRadius * Math.sin(midAngle);

    return { ...seg, pct, path, labelX, labelY, outerX, outerY, midAngle };
  });

  if (total === 0) {
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={radius} fill="#f3f4f6" />
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="text-sm font-bold" fill="#9ca3af">No Data</text>
        </svg>
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Drop shadow filter */}
        <defs>
          <filter id="pieShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
          </filter>
          <filter id="pieShadowHover" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.25" />
          </filter>
        </defs>
        {slices.map((slice, i) => {
          const isHovered = hoveredIndex === i;
          const scale = isHovered ? 1.08 : 1;
          const translateX = isHovered ? (slice.outerX - cx) * 0.08 : 0;
          const translateY = isHovered ? (slice.outerY - cy) * 0.08 : 0;
          return (
            <g
              key={i}
              transform={`translate(${translateX}, ${translateY}) scale(${scale}) translate(${-translateX}, ${-translateY})`}
              style={{ transformOrigin: `${cx}px ${cy}px`, cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => console.log(`Clicked ${slice.label}: ${slice.value}`)}
              className="transition-all duration-300 ease-out"
            >
              <path
                d={slice.path}
                fill={slice.color}
                stroke="white"
                strokeWidth="2"
                filter={isHovered ? 'url(#pieShadowHover)' : 'url(#pieShadow)'}
                style={{ opacity: isHovered ? 0.95 : 1 }}
              />
            </g>
          );
        })}
        {/* Percentage labels inside slices */}
        {slices.map((slice, i) => (
          slice.pct >= 0.05 && (
            <text key={`pct-${i}`} x={slice.labelX} y={slice.labelY} textAnchor="middle" dominantBaseline="central"
              fill="white" fontSize="12" fontWeight="700" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              {Math.round(slice.pct * 100)}%
            </text>
          )
        ))}
        {/* Outer labels */}
        {slices.map((slice, i) => {
          const anchor = slice.outerX > cx ? 'start' : slice.outerX < cx ? 'end' : 'middle';
          return (
            <text key={`lbl-${i}`} x={slice.outerX} y={slice.outerY} textAnchor={anchor} dominantBaseline="central"
              fill="#374151" fontSize="10" fontWeight="600">
              {slice.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function Dashboard({ goLoginStats, onRefresh, currentUser, onViewChange, onSelectFolder }: DashboardProps) {
  const [recentProfiles, setRecentProfiles] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [runningProfileIds, setRunningProfileIds] = useState<string[]>([]);
  const [globalRunningIds, setGlobalRunningIds] = useState<Set<string>>(new Set());
  const [goLoginTotal, setGoLoginTotal] = useState(0);
  const [localDbTotal, setLocalDbTotal] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const globalPollingRef = useRef<NodeJS.Timeout | null>(null);
  const fullFetchDone = useRef(false);
  
  // Check if user is Admin (roles="1")
  const isAdmin = currentUser?.roles === '1';

  // Realtime polling for local running profiles (this machine)
  const fetchRunningProfiles = useCallback(async () => {
    try {
      const activeBrowsers = await window.electronAPI.gologinSDKGetActiveBrowsers();
      setRunningProfileIds(activeBrowsers || []);
    } catch (err) {
      // silent
    }
  }, []);

  // Full fetch: get ALL pages from GoLogin API (only on first load)
  const fetchAllGoLoginProfiles = useCallback(async () => {
    try {
      let allApiProfiles: any[] = [];

      const firstResult = await window.electronAPI.gologinListProfiles(1);
      if (!firstResult || !firstResult.profiles) return;

      allApiProfiles = [...firstResult.profiles];
      const claimed = firstResult.allProfilesCount || firstResult.total || firstResult.profiles.length;
      const perPage = firstResult.profiles.length;

      if (perPage > 0 && claimed > perPage) {
        const totalPages = Math.ceil(claimed / perPage);
        const results = await Promise.allSettled(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            window.electronAPI.gologinListProfiles(i + 2)
          )
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value?.profiles) {
            allApiProfiles = allApiProfiles.concat(r.value.profiles);
          }
        }
      }

      const runningIds = new Set<string>(
        allApiProfiles.filter((p: any) => p.canBeRunning === false).map((p: any) => p.id)
      );
      setGoLoginTotal(allApiProfiles.length);
      setGlobalRunningIds(runningIds);
      fullFetchDone.current = true;
    } catch (err) {
      console.warn('Failed to fetch all GoLogin profiles:', err);
    }
  }, []);

  // Quick poll: only fetch page 1 to detect running status changes (fast, 1 API call)
  const quickPollRunningStatus = useCallback(async () => {
    try {
      const result = await window.electronAPI.gologinListProfiles(1);
      if (!result || !result.profiles) return;

      // Check if total changed → need full refetch
      const newTotal = result.allProfilesCount || result.total || result.profiles.length;
      if (fullFetchDone.current && Math.abs(newTotal - goLoginTotal) > 0) {
        fetchAllGoLoginProfiles();
        return;
      }

      // Quick update: merge page 1 running IDs into existing set
      const page1RunningIds = result.profiles
        .filter((p: any) => p.canBeRunning === false)
        .map((p: any) => p.id);
      const page1AllIds = new Set(result.profiles.map((p: any) => p.id));

      setGlobalRunningIds(prev => {
        const updated = new Set(prev);
        // Remove page 1 profiles that are no longer running
        for (const id of page1AllIds) {
          if (!page1RunningIds.includes(id as string)) updated.delete(id as string);
        }
        // Add page 1 profiles that are now running
        for (const id of page1RunningIds) {
          updated.add(id);
        }
        return updated;
      });
    } catch (err) {
      // silent
    }
  }, [goLoginTotal]);

  useEffect(() => {
    syncAndLoadData();
    fetchRunningProfiles();
    fetchAllGoLoginProfiles(); // Full fetch once on mount

    // Local SDK: poll every 3s (instant, lightweight)
    pollingRef.current = setInterval(fetchRunningProfiles, 3000);
    // GoLogin API: quick poll every 30s (1 API call only)
    globalPollingRef.current = setInterval(quickPollRunningStatus, 30000);

    // Listen for browser closed events to update immediately
    const unsubscribe = window.electronAPI.onBrowserClosed(() => {
      fetchRunningProfiles();
      quickPollRunningStatus();
    });

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (globalPollingRef.current) clearInterval(globalPollingRef.current);
      unsubscribe();
    };
  }, []);

  const syncAndLoadData = async () => {
    try {
      await window.electronAPI.localDataSync();
    } catch (error) {
      console.error('Failed to sync data:', error);
    }
    
    await loadDashboardData();
  };

  const loadDashboardData = async () => {
    try {
      // Load profiles from database to get actual total count
      const profilesData = await window.electronAPI.localDataGetProfiles(1, 50);
      if (profilesData && profilesData.profiles) {
        setAllProfiles(profilesData.profiles);
        setLocalDbTotal(profilesData.total || profilesData.profiles.length);
        updateRecentProfiles(profilesData.profiles);
      } else {
        setRecentProfiles([]);
        setAllProfiles([]);
        setLocalDbTotal(0);
      }
      
      // Load folders from database - only for Admin
      if (isAdmin) {
        const foldersData = await window.electronAPI.localDataGetFolders();
        if (foldersData && Array.isArray(foldersData)) {
          const foldersWithCount = foldersData.map((folder: any) => ({
            ...folder,
            id: folder.folder_id,
            name: folder.name,
            profilesCount: folder.profilesCount || 0
          }));
          setFolders(foldersWithCount);
        } else {
          setFolders([]);
        }
        
        // Load user count for Admin
        try {
          const users = await window.electronAPI.localDataGetUsers();
          setUserCount(users?.length || 0);
        } catch (error) {
          setUserCount(0);
        }
      } else {
        setFolders([]);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setRecentProfiles([]);
      setFolders([]);
    }
  };

  // Helper: update recent profiles sorted by running status first, then last activity
  const updateRecentProfiles = (profiles: any[]) => {
    const sorted = [...profiles].sort((a: any, b: any) => {
      const aId = a.profile_id || a.id;
      const bId = b.profile_id || b.id;
      const aRunning = globalRunningIds.has(aId) || runningProfileIds.includes(aId) ? 1 : 0;
      const bRunning = globalRunningIds.has(bId) || runningProfileIds.includes(bId) ? 1 : 0;
      if (aRunning !== bRunning) return bRunning - aRunning;
      const dateA = new Date(a.last_activity || a.updated_at || 0).getTime();
      const dateB = new Date(b.last_activity || b.updated_at || 0).getTime();
      return dateB - dateA;
    }).slice(0, 10);
    setRecentProfiles(sorted);
  };

  // Re-sort recent profiles when running status changes
  useEffect(() => {
    if (allProfiles.length > 0) {
      updateRecentProfiles(allProfiles);
    }
  }, [globalRunningIds, runningProfileIds]);

  // Running = union of local SDK (instant) + GoLogin API (global from all users)
  // This ensures local launches show immediately AND remote user launches show too
  const allRunningIds = new Set([...globalRunningIds, ...runningProfileIds]);
  // For non-admin, only count running profiles that belong to them (from local DB)
  const ownProfileIds = new Set(allProfiles.map((p: any) => p.profile_id || p.id));
  const ownRunningCount = isAdmin
    ? allRunningIds.size
    : [...allRunningIds].filter(id => ownProfileIds.has(id)).length + runningProfileIds.filter(id => ownProfileIds.has(id) && !allRunningIds.has(id)).length;
  const runningCount = ownRunningCount;
  const totalCount = isAdmin ? goLoginTotal : localDbTotal;
  const availableCount = Math.max(0, totalCount - runningCount);

  // Check if a profile is running (combines local SDK + global GoLogin API data)
  const isProfileRunning = (profileId: string): boolean => {
    return globalRunningIds.has(profileId) || runningProfileIds.includes(profileId);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // ─── Proxy Dashboard Data ───
  const [proxyStats, setProxyStats] = useState({ active: 0, expiring_soon: 0, inactive: 0, total: 0 });
  const [expiringProxies, setExpiringProxies] = useState<any[]>([]);

  // Extend modal state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendProxyData, setExtendProxyData] = useState<any>(null);
  const [extendPeriod, setExtendPeriod] = useState(0);
  const [extendCoupon, setExtendCoupon] = useState('');
  const [extendPrice, setExtendPrice] = useState<{price: number; currency: string} | null>(null);
  const [extendPriceLoading, setExtendPriceLoading] = useState(false);
  const [extendLoading, setExtendLoading] = useState(false);

  const fetchProxyData = useCallback(async () => {
    try {
      // Sync first
      await window.electronAPI.extProxySync().catch(() => {});
      // Fetch stats
      const stats = await window.electronAPI.extProxyStats();
      if (stats) {
        setProxyStats({
          active: stats.active || 0,
          expiring_soon: stats.expiring_soon || 0,
          inactive: stats.inactive || 0,
          total: stats.total || 0,
        });
      }
      // Fetch expiring soon proxies
      const result = await window.electronAPI.extProxyList({ status: 'expiring_soon' });
      const list = result?.proxies || result || [];
      setExpiringProxies(Array.isArray(list) ? list.slice(0, 20) : []);
    } catch (err) {
      console.error('Failed to fetch proxy data:', err);
    }
  }, []);

  useEffect(() => {
    fetchProxyData();
  }, [fetchProxyData]);

  // Extend modal handlers
  const openExtendModal = (proxy: any) => {
    setExtendProxyData(proxy);
    setExtendPeriod(0);
    setExtendCoupon('');
    setExtendPrice(null);
    setShowExtendModal(true);
  };

  const handleExtensionPrice = async () => {
    if (!extendProxyData || !extendPeriod) return;
    const proxyId = extendProxyData.id || extendProxyData.proxy_id;
    try {
      setExtendPriceLoading(true);
      const result = await window.electronAPI.extProxyExtensionPrice(proxyId, extendPeriod);
      const inner = result?.data ?? result;
      const price = parseFloat(inner?.finalPrice ?? inner?.price ?? 0);
      const currency = inner?.currency || 'USD';
      setExtendPrice({ price, currency });
    } catch (err: any) {
      console.error('Failed to get extension price:', err);
      alert('Failed to calculate price: ' + (err.message || 'Unknown error'));
      setExtendPrice(null);
    } finally {
      setExtendPriceLoading(false);
    }
  };

  useEffect(() => {
    if (!showExtendModal || !extendProxyData || !extendPeriod) return;
    const timer = setTimeout(() => handleExtensionPrice(), 300);
    return () => clearTimeout(timer);
  }, [extendPeriod, showExtendModal]);

  const handleExtendProxy = async () => {
    if (!extendProxyData || !extendPeriod) return;
    const proxyId = extendProxyData.id || extendProxyData.proxy_id;
    if (!confirm(`Extend proxy ${proxyId} by ${extendPeriod} month(s) for $${extendPrice?.price?.toFixed(2) || '?'}?`)) return;
    try {
      setExtendLoading(true);
      await window.electronAPI.extProxyExtend(proxyId, extendPeriod, extendCoupon || undefined);
      setShowExtendModal(false);
      fetchProxyData();
    } catch (err: any) {
      alert(err.message || 'Failed to extend proxy');
    } finally {
      setExtendLoading(false);
    }
  };

  const formatExpiry = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day left';
    return `${diffDays} days left`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50/30">
      <div className="flex flex-col flex-1 min-h-0 p-6 gap-4 max-w-[1400px] mx-auto w-full">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Total Folders - Hero Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white shadow-lg shadow-orange-200/50">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-4 -translate-x-4" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-sm font-medium text-orange-100">Total Folders</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold leading-none">{folders.length}</span>
                <span className="text-orange-200 text-sm mb-0.5">folders</span>
              </div>
              <div className="mt-3 bg-white/20 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-white rounded-full h-1.5 transition-all duration-500"
                  style={{ width: `${folders.length > 0 ? '100' : '0'}%` }}
                />
              </div>
              <p className="text-orange-100 text-xs mt-1.5">Organizing your profiles</p>
            </div>
          </div>

          {/* Total Profiles */}
          <div
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-orange-200 transition-all cursor-pointer group"
            onClick={() => onViewChange?.('profiles')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="bg-orange-50 p-2.5 rounded-lg group-hover:bg-orange-100 transition-colors">
                <Globe className="h-5 w-5 text-orange-600" />
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition-colors" />
            </div>
            <p className="text-sm text-gray-500 mb-0.5">Total Profiles</p>
            <p className="text-3xl font-bold text-gray-900">{totalCount}</p>
            <p className="text-xs text-gray-400 mt-1">Click to view all</p>
          </div>

          {/* Total Proxy */}
          <div
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-orange-200 transition-all cursor-pointer group"
            onClick={() => onViewChange?.('proxy')}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="bg-emerald-50 p-2.5 rounded-lg group-hover:bg-emerald-100 transition-colors">
                <Shield className="h-5 w-5 text-emerald-600" />
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition-colors" />
            </div>
            <p className="text-sm text-gray-500 mb-0.5">Total Proxy</p>
            <p className="text-3xl font-bold text-gray-900">{proxyStats.total}</p>
            <p className="text-xs text-gray-400 mt-1">{proxyStats.active} active • {proxyStats.expiring_soon} expiring</p>
          </div>

          {/* Total Users (Admin) / Folders (Seller) */}
          {isAdmin ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="bg-orange-50 p-2.5 rounded-lg">
                  <Users className="h-5 w-5 text-orange-500" />
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-0.5">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{userCount}</p>
              <p className="text-xs text-gray-400 mt-1">System accounts</p>
            </div>
          ) : (
            <div
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-orange-200 transition-all cursor-pointer group"
              onClick={() => onViewChange?.('folders')}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="bg-orange-50 p-2.5 rounded-lg group-hover:bg-orange-100 transition-colors">
                  <FolderOpen className="h-5 w-5 text-orange-500" />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition-colors" />
              </div>
              <p className="text-sm text-gray-500 mb-0.5">Folders</p>
              <p className="text-3xl font-bold text-gray-900">{folders.length}</p>
              <p className="text-xs text-gray-400 mt-1">Profile groups</p>
            </div>
          )}
        </div>

        {/* Row 2: Folders (2/3) + Profiles Overview (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* Folders - takes 2 columns */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0">
            <div
              className="flex items-center justify-between px-5 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50/50 transition-colors group flex-shrink-0"
              onClick={() => onViewChange?.('folders')}
            >
              <h2 className="text-sm font-semibold text-gray-900">Folders</h2>
              <div className="flex items-center gap-1 text-xs text-orange-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
            {folders.length > 0 ? (
              <div className="divide-y divide-gray-50 flex-1 overflow-y-auto">
                {folders.slice(0, 10).map((folder, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2.5 px-5 py-2.5 hover:bg-orange-50/50 transition-colors cursor-pointer group"
                    onClick={() => onSelectFolder?.(folder.id)}
                  >
                    <div className="w-7 h-7 rounded-md bg-orange-100 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-200 transition-colors">
                      <FolderOpen className="w-3.5 h-3.5 text-orange-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate flex-1 group-hover:text-orange-700 transition-colors">
                      {folder.name || `Folder ${index + 1}`}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">{folder.profilesCount || 0} profiles</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center px-5">
                <FolderOpen className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">No folders</p>
              </div>
            )}
          </div>

          {/* Profiles Overview - takes 1 column */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Profiles Overview</h2>
            <div className="flex-1 flex items-center justify-center">
              <DonutChart running={runningCount} available={availableCount} total={totalCount} />
            </div>
            <div className="flex items-center justify-center gap-4 text-xs mt-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-gray-600">Running ({runningCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                <span className="text-gray-600">Available ({availableCount})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Expiring Soon (2/3) + Proxy Status (1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* Expiring Soon - takes 2 columns */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-0">
            <div
              className="flex items-center justify-between px-5 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50/50 transition-colors group flex-shrink-0"
              onClick={() => onViewChange?.('proxy')}
            >
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Expiring Soon
              </h2>
              <div className="flex items-center gap-1 text-xs text-orange-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
            {expiringProxies.length > 0 ? (
              <div className="divide-y divide-gray-50 flex-1 overflow-y-auto">
                {expiringProxies.map((proxy, idx) => {
                  const proxyId = proxy.id || proxy.proxy_id;
                  const ip = proxy.public_ip || proxy.publicIp || '';
                  const expires = proxy.expires_formatted || proxy.expires_at || proxy.expires || '';
                  const seller = proxy.seller_full_name || proxy.seller_username || proxy.name || '';
                  return (
                    <div key={proxyId || idx} className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 font-mono truncate">{ip || proxyId}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-amber-600 font-medium">{formatExpiry(expires)}</p>
                          {isAdmin && seller && (
                            <span className="text-xs text-gray-400">• {seller}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); openExtendModal(proxy); }}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-orange-600 bg-orange-50 rounded-md hover:bg-orange-100 transition-colors flex-shrink-0 ml-2"
                      >
                        <Clock className="w-3.5 h-3.5" /> Extend
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center px-5">
                <Shield className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">No proxies expiring soon</p>
              </div>
            )}
          </div>

          {/* Proxy Status - takes 1 column */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Proxy Status</h2>
            <div className="flex-1 flex items-center justify-center">
              <ProxyStatusChart
                active={proxyStats.active}
                expiring={proxyStats.expiring_soon}
                inactive={proxyStats.inactive}
              />
            </div>
            <div className="space-y-2.5 mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-gray-600">Active</span>
                </div>
                <span className="text-xs font-bold text-gray-900">{proxyStats.active}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs text-gray-600">Expiring Soon</span>
                </div>
                <span className="text-xs font-bold text-gray-900">{proxyStats.expiring_soon}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-xs text-gray-600">Inactive</span>
                </div>
                <span className="text-xs font-bold text-gray-900">{proxyStats.inactive}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ─── Extend Proxy Modal ─── */}
      {showExtendModal && extendProxyData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowExtendModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative px-6 py-5 bg-gradient-to-r from-orange-500 to-orange-600">
              <button onClick={() => setShowExtendModal(false)} className="absolute right-4 top-4 text-white/80 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5" /> Extend Proxy Period
              </h2>
              <p className="text-white/70 text-xs mt-0.5">Extend the validity period of your proxy</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-400">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Proxy ID</span>
                    <span className="text-sm font-bold text-gray-900 font-mono">{extendProxyData.id || extendProxyData.proxy_id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Public IP</span>
                    <span className="text-sm font-semibold text-gray-800 font-mono">{extendProxyData.public_ip || extendProxyData.publicIp || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Expires</span>
                    <span className="text-sm font-semibold text-amber-600">{formatExpiry(extendProxyData.expires_formatted || extendProxyData.expires_at || '')}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5 block">
                  <Calendar className="w-3.5 h-3.5 text-orange-500" /> Extension Period
                </label>
                <select
                  value={extendPeriod}
                  onChange={(e) => { setExtendPeriod(parseInt(e.target.value)); setExtendPrice(null); }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                >
                  <option value={0}>Select extension period</option>
                  <option value={1}>1 Month</option>
                  <option value={2}>2 Months</option>
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={12}>12 Months</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5 block">
                  <Tag className="w-3.5 h-3.5 text-orange-500" /> Coupon Code (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={extendCoupon}
                    onChange={(e) => setExtendCoupon(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Enter coupon code"
                  />
                  <button
                    onClick={handleExtensionPrice}
                    disabled={!extendPeriod || extendPriceLoading}
                    className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {extendPriceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Apply
                  </button>
                </div>
              </div>
              {extendPrice && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-orange-700">Extension Cost:</span>
                    <span className="text-lg font-bold text-orange-900">${extendPrice.price.toFixed(2)} {extendPrice.currency}</span>
                  </div>
                  <p className="text-[11px] text-orange-500 mt-1">For {extendPeriod} month{extendPeriod > 1 ? 's' : ''} extension</p>
                </div>
              )}
              {extendPriceLoading && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> Calculating price...
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50/50">
              <button onClick={() => setShowExtendModal(false)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors font-medium">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={handleExtendProxy}
                disabled={extendLoading || !extendPeriod || !extendPrice}
                className="flex items-center gap-1.5 px-5 py-2 text-sm text-white bg-orange-600 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {extendLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                Extend Proxy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
