import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Globe, FolderOpen, Monitor, ChevronRight, Play } from 'lucide-react';

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
  onViewChange?: (view: 'dashboard' | 'profiles' | 'folders' | 'users') => void;
  onSelectFolder?: (folderId: string) => void;
}

// SVG Donut Chart component
function DonutChart({ running, available, total }: { running: number; available: number; total: number }) {
  const size = 140;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const runningPct = total > 0 ? running / total : 0;
  const runningDash = circumference * runningPct;
  const availableDash = circumference - runningDash;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* Available (background) */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={strokeWidth}
        />
        {/* Running (foreground) */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="#f97316"
          strokeWidth={strokeWidth}
          strokeDasharray={`${runningDash} ${availableDash}`}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{running}</span>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Running</span>
      </div>
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
        updateRecentProfiles(profilesData.profiles);
      } else {
        setRecentProfiles([]);
        setAllProfiles([]);
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
  const runningCount = isAdmin ? allRunningIds.size : runningProfileIds.length;
  const totalCount = goLoginTotal;
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

  return (
    <div className="h-full overflow-y-auto bg-gray-50/30">
      <div className="p-6 space-y-5 max-w-[1400px] mx-auto">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Welcome back, <span className="font-medium text-gray-700">{currentUser?.fullName || currentUser?.userName || 'Admin'}</span>
          </p>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Running Profiles - Hero Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white shadow-lg shadow-orange-200/50">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-4 -translate-x-4" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-3">
                {runningCount > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                  </span>
                )}
                <span className="text-sm font-medium text-orange-100">Running Now</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold leading-none">{runningCount}</span>
                <span className="text-orange-200 text-sm mb-0.5">profiles</span>
              </div>
              <div className="mt-3 bg-white/20 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-white rounded-full h-1.5 transition-all duration-500"
                  style={{ width: `${totalCount > 0 ? Math.round((runningCount / totalCount) * 100) : 0}%` }}
                />
              </div>
              <p className="text-orange-100 text-xs mt-1.5">{runningCount} of {totalCount} profiles active</p>
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

          {/* Available Profiles */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-amber-50 p-2.5 rounded-lg">
                <Monitor className="h-5 w-5 text-amber-600" />
              </div>
              {availableCount > 0 && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Ready</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-0.5">Available</p>
            <p className="text-3xl font-bold text-gray-900">{availableCount}</p>
            <p className="text-xs text-gray-400 mt-1">Ready to launch</p>
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

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Recent Profiles - 2 cols */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50/50 transition-colors group"
              onClick={() => onViewChange?.('profiles')}
            >
              <h2 className="text-base font-semibold text-gray-900">Recent Profiles</h2>
              <div className="flex items-center gap-1 text-xs text-orange-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
            {recentProfiles.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {recentProfiles.map((profile) => {
                  const profileId = profile.profile_id || profile.id;
                  const isRunning = isProfileRunning(profileId);
                  return (
                    <div key={profile.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isRunning ? 'bg-orange-100' : 'bg-gray-100'
                        }`}>
                          {isRunning ? (
                            <Play className="h-3.5 w-3.5 text-orange-600 fill-orange-600" />
                          ) : (
                            <Globe className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{profile.name}</p>
                          <p className="text-xs text-gray-400">
                            {profile.os?.toUpperCase()} • {profile.browserType || 'chrome'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
                            </span>
                            Running
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Ready
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 px-5">
                <Globe className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">No profiles found</p>
                <p className="text-xs text-gray-400 mt-1">Create your first profile to get started</p>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-5">

            {/* Profile Overview Chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Profile Overview</h2>
              <div className="flex items-center justify-center mb-4">
                <DonutChart running={runningCount} available={availableCount} total={totalCount} />
              </div>
              <div className="flex items-center justify-center gap-5 text-xs">
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

            {/* Folders section - only visible for Admin */}
            {isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div
                  className="flex items-center justify-between px-5 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50/50 transition-colors group"
                  onClick={() => onViewChange?.('folders')}
                >
                  <h2 className="text-base font-semibold text-gray-900">Folders</h2>
                  <div className="flex items-center gap-1 text-xs text-orange-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
                {folders.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {folders.slice(0, 6).map((folder, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-orange-50/50 transition-colors cursor-pointer group"
                        onClick={() => onSelectFolder?.(folder.id)}
                      >
                        <div className="w-7 h-7 rounded-md bg-orange-100 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-200 transition-colors">
                          <FolderOpen className="w-3.5 h-3.5 text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-orange-700 transition-colors">
                            {folder.name || `Folder ${index + 1}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-400">{folder.profilesCount || 0}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-orange-400 transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 px-5">
                    <FolderOpen className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No folders configured</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
