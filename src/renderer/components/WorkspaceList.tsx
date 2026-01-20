import React, { useState, useEffect } from 'react';
import { Users2, Plus, Settings, Trash2, UserPlus, Crown, Shield, Eye, RefreshCw } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  membersCount: number;
  profilesCount: number;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceListProps {
  onWorkspaceSelect?: (workspaceId: string) => void;
}

export function WorkspaceList({ onWorkspaceSelect }: WorkspaceListProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const workspacesData = await window.electronAPI.gologinListWorkspaces();
      
      // Transform API data to match our interface
      const transformedWorkspaces: Workspace[] = (workspacesData || []).map((ws: any, index: number) => ({
        id: ws.id || ws._id || `workspace-${index}`,
        name: ws.name || ws.title || `Workspace ${index + 1}`,
        description: ws.description || ws.notes || '',
        role: ws.role || ws.userRole || 'member',
        membersCount: ws.membersCount || ws.members?.length || 1,
        profilesCount: ws.profilesCount || ws.profileCount || 0,
        createdAt: ws.createdAt || ws.created_at || new Date().toISOString(),
        updatedAt: ws.updatedAt || ws.updated_at || new Date().toISOString(),
      }));
      
      setWorkspaces(transformedWorkspaces);
      
      // If no workspaces from API, show default
      if (transformedWorkspaces.length === 0) {
        setWorkspaces([
          {
            id: 'default',
            name: 'Personal Workspace',
            description: 'Your personal GoLogin workspace',
            role: 'owner',
            membersCount: 1,
            profilesCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      // Show default workspace on error
      setWorkspaces([
        {
          id: 'default',
          name: 'Personal Workspace',
          description: 'Your personal GoLogin workspace',
          role: 'owner',
          membersCount: 1,
          profilesCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadWorkspaces();
    } finally {
      setRefreshing(false);
    }
  };

  const handleWorkspaceSelect = (workspaceId: string) => {
    setSelectedWorkspace(workspaceId);
    if (onWorkspaceSelect) {
      onWorkspaceSelect(workspaceId);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-red-600" />;
      case 'member':
        return <UserPlus className="w-4 h-4 text-blue-600" />;
      case 'viewer':
        return <Eye className="w-4 h-4 text-gray-600" />;
      default:
        return <Users2 className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800';
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'member':
        return 'bg-blue-100 text-blue-800';
      case 'viewer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading workspaces...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
          <p className="text-gray-600 mt-1">Manage your GoLogin workspaces and team collaboration</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Create Workspace
          </button>
        </div>
      </div>

      {/* Workspace List */}
      <div className="flex-1 overflow-auto p-6">
        {workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Users2 className="w-16 h-16 mb-4" />
            <h3 className="text-lg font-medium mb-2">No workspaces found</h3>
            <p className="text-center mb-4">
              Create your first workspace to start collaborating with your team.
            </p>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" />
              Create Workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className={`bg-white border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer ${
                  selectedWorkspace === workspace.id ? 'ring-2 ring-blue-500 border-blue-200' : ''
                }`}
                onClick={() => handleWorkspaceSelect(workspace.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 truncate">
                        {workspace.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getRoleIcon(workspace.role)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(workspace.role)}`}>
                          {workspace.role.charAt(0).toUpperCase() + workspace.role.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                      <Settings className="w-4 h-4" />
                    </button>
                    {workspace.role === 'owner' && (
                      <button className="p-1 text-gray-400 hover:text-red-600 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {workspace.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {workspace.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{workspace.membersCount}</div>
                    <div className="text-xs text-gray-500">Members</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{workspace.profilesCount}</div>
                    <div className="text-xs text-gray-500">Profiles</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Created {new Date(workspace.createdAt).toLocaleDateString()}</span>
                  <span>Updated {new Date(workspace.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workspace Actions */}
      {selectedWorkspace && (
        <div className="border-t p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Selected: {workspaces.find(w => w.id === selectedWorkspace)?.name}
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50 transition-colors">
                View Details
              </button>
              <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                Switch to Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
