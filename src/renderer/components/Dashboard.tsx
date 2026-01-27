import React, { useState, useEffect } from 'react';
import { Users, Globe, Activity, AlertCircle, RefreshCw, Cloud, Play, Settings, FolderOpen, TrendingUp, Server, Zap } from 'lucide-react';

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
}

export function Dashboard({ goLoginStats, onRefresh, currentUser }: DashboardProps) {
  const [recentProfiles, setRecentProfiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Check if user is Admin (roles="1")
  const isAdmin = currentUser?.roles === '1';

  useEffect(() => {
    syncAndLoadData();
  }, []);

  const syncAndLoadData = async () => {
    try {
      // Sync data from GoLogin first
      console.log('Syncing data from GoLogin...');
      await window.electronAPI.localDataSync();
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Failed to sync data:', error);
      // Continue loading even if sync fails
    }
    
    // Load dashboard data after sync
    await loadDashboardData();
  };

  const loadDashboardData = async () => {
    try {
      // Load recent profiles from database
      const profilesData = await window.electronAPI.localDataGetProfiles(1, 50);
      if (profilesData && profilesData.profiles) {
        const sortedProfiles = [...profilesData.profiles]
          .sort((a, b) => {
            const dateA = new Date(a.last_activity || a.updated_at || 0).getTime();
            const dateB = new Date(b.last_activity || b.updated_at || 0).getTime();
            return dateB - dateA;
          })
          .slice(0, 5);
        setRecentProfiles(sortedProfiles);
      } else {
        setRecentProfiles([]);
      }
      
      // Load folders from database - only for Admin
      if (isAdmin) {
        const foldersData = await window.electronAPI.localDataGetFolders();
        if (foldersData && Array.isArray(foldersData)) {
          const foldersWithCount = foldersData.map(folder => ({
            ...folder,
            id: folder.folder_id,
            name: folder.name,
            profilesCount: folder.profilesCount || 0
          })).slice(0, 4);
          setFolders(foldersWithCount);
        } else {
          setFolders([]);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
      await loadDashboardData();
    } finally {
      setRefreshing(false);
    }
  };

  const stats = [
    {
      title: 'Total Profiles',
      value: goLoginStats.totalProfiles,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      change: '+12%',
      changeType: 'positive'
    },
    {
      title: 'Running Profiles',
      value: goLoginStats.runningProfiles,
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      change: `${goLoginStats.runningProfiles}/${goLoginStats.totalProfiles}`,
      changeType: 'neutral'
    },
    {
      title: 'Connection Status',
      value: goLoginStats.connectionStatus ? 'Connected' : 'Disconnected',
      icon: Cloud,
      color: goLoginStats.connectionStatus ? 'text-green-600' : 'text-red-600',
      bgColor: goLoginStats.connectionStatus ? 'bg-green-50' : 'bg-red-50',
      borderColor: goLoginStats.connectionStatus ? 'border-green-200' : 'border-red-200',
      change: goLoginStats.connectionStatus ? 'Online' : 'Offline',
      changeType: goLoginStats.connectionStatus ? 'positive' : 'negative'
    },
    {
      title: 'Available Profiles',
      value: Math.max(0, goLoginStats.totalProfiles - goLoginStats.runningProfiles),
      icon: Zap,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      change: 'Ready to use',
      changeType: 'neutral'
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">JEG Anditect Browser</h1>
          <p className="text-gray-600 text-lg">Overview of your Anditect browser profiles</p>
        </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`${stat.bgColor} p-2 rounded-lg`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                  stat.changeType === 'positive' ? 'bg-green-100 text-green-700' :
                  stat.changeType === 'negative' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {stat.change}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Profiles</h2>
            <div className="bg-blue-50 px-3 py-1 rounded-full">
              <span className="text-sm font-medium text-blue-700">{recentProfiles.length} profiles</span>
            </div>
          </div>
          {recentProfiles.length > 0 ? (
            <div className="space-y-3">
              {recentProfiles.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Globe className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{profile.name}</p>
                      <p className="text-sm text-gray-500">
                        {profile.os?.toUpperCase()} • {profile.browserType || 'chrome'}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    profile.canBeRunning 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {profile.canBeRunning ? 'Available' : 'Busy'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Globe className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No profiles found</p>
              <p className="text-sm text-gray-400">Create your first profile to get started</p>
            </div>
          )}
        </div>

        {/* Folders section - only visible for Admin */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Folders</h2>
              <div className="bg-purple-50 px-3 py-1 rounded-full">
                <span className="text-sm font-medium text-purple-700">{folders.length} folders</span>
              </div>
            </div>
            <div className="space-y-3">
              {folders.length > 0 ? (
                folders.map((folder, index) => (
                  <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <FolderOpen className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{folder.name || `Folder ${index + 1}`}</p>
                      <p className="text-sm text-gray-500">{folder.profilesCount || 0} profiles</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No folders configured</p>
                  <p className="text-sm text-gray-400">Organize your profiles with folders</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
          <TrendingUp className="h-6 w-6 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="group p-6 text-left bg-white rounded-xl border border-blue-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-blue-100 p-2 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Play className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Create Profile</h3>
            </div>
            <p className="text-sm text-gray-600">Set up a new GoLogin profile with custom settings</p>
          </button>
          <button className="group p-6 text-left bg-white rounded-xl border border-green-200 hover:border-green-300 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-green-100 p-2 rounded-lg group-hover:bg-green-200 transition-colors">
                <Settings className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Manage Proxies</h3>
            </div>
            <p className="text-sm text-gray-600">Configure proxy settings and test connections</p>
          </button>
          <button className="group p-6 text-left bg-white rounded-xl border border-purple-200 hover:border-purple-300 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-purple-100 p-2 rounded-lg group-hover:bg-purple-200 transition-colors">
                <Cloud className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Sync Cloud</h3>
            </div>
            <p className="text-sm text-gray-600">Synchronize profiles with GoLogin cloud service</p>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
