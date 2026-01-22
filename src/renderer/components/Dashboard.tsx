import React, { useState, useEffect } from 'react';
import { Users, Globe, Activity, AlertCircle, RefreshCw, Cloud, Play, Settings, FolderOpen } from 'lucide-react';

interface GoLoginStats {
  totalProfiles: number;
  runningProfiles: number;
  connectionStatus: boolean;
}

interface DashboardProps {
  goLoginStats: GoLoginStats;
  onRefresh: () => Promise<void>;
}

export function Dashboard({ goLoginStats, onRefresh }: DashboardProps) {
  const [recentProfiles, setRecentProfiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load recent profiles
      const profilesData = await window.electronAPI.gologinListProfiles(1);
      setRecentProfiles(profilesData.profiles?.slice(0, 5) || []);
      
      // Load folders
      const foldersData = await window.electronAPI.gologinListFolders();
      setFolders(foldersData?.slice(0, 3) || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
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
    },
    {
      title: 'Running Profiles',
      value: goLoginStats.runningProfiles,
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Connection Status',
      value: goLoginStats.connectionStatus ? 'Connected' : 'Disconnected',
      icon: Cloud,
      color: goLoginStats.connectionStatus ? 'text-green-600' : 'text-red-600',
      bgColor: goLoginStats.connectionStatus ? 'bg-green-50' : 'bg-red-50',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">GoLogin Dashboard</h1>
          <p className="text-muted-foreground">Overview of your GoLogin cloud profiles and services</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-card rounded-lg border border-border p-6">
              <div className="flex items-center">
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Profiles</h2>
          {recentProfiles.length > 0 ? (
            <div className="space-y-3">
              {recentProfiles.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between p-3 bg-accent rounded-md">
                  <div>
                    <p className="font-medium text-foreground">{profile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {profile.os?.toUpperCase()} • {profile.browserType || 'Chrome'}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    profile.canBeRunning 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {profile.canBeRunning ? 'Available' : 'Locked'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No profiles found</p>
          )}
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Folders</h2>
          <div className="space-y-3">
            {folders.length > 0 ? (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Folders</h3>
                {folders.map((folder, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-accent rounded-md mb-2">
                    <FolderOpen className="w-4 h-4 text-purple-600" />
                    <span className="text-sm">{folder.name || `Folder ${index + 1}`}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No folders configured</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 text-left bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Play className="w-5 h-5" />
              <h3 className="font-medium">Create Quick Profile</h3>
            </div>
            <p className="text-sm opacity-90">Set up a new GoLogin profile instantly</p>
          </button>
          <button className="p-4 text-left bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-5 h-5" />
              <h3 className="font-medium">Manage Proxies</h3>
            </div>
            <p className="text-sm opacity-90">Configure proxy settings for profiles</p>
          </button>
          <button className="p-4 text-left bg-accent text-accent-foreground rounded-md hover:bg-accent/80 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Cloud className="w-5 h-5" />
              <h3 className="font-medium">Sync Profiles</h3>
            </div>
            <p className="text-sm opacity-90">Synchronize with GoLogin cloud</p>
          </button>
        </div>
      </div>
    </div>
  );
}
