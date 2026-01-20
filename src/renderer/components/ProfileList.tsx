import React, { useState } from 'react';
import { Profile, Proxy } from '../../shared/types';
import { Plus, Play, Edit, Trash2, MoreHorizontal } from 'lucide-react';

interface ProfileListProps {
  profiles: Profile[];
  onProfileCreate: (profileData: any) => Promise<void>;
  onProfileUpdate: (id: string, updates: any) => Promise<void>;
  onProfileDelete: (id: string) => Promise<void>;
  onProfileLaunch: (profileId: string) => Promise<void>;
}

export function ProfileList({
  profiles,
  onProfileCreate,
  onProfileUpdate,
  onProfileDelete,
  onProfileLaunch,
}: ProfileListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const handleCreate = async (formData: FormData) => {
    try {
      setLoading('create');
      
      const profileName = formData.get('name') as string;
      console.log('Creating profile with name:', profileName);
      
      if (!profileName || profileName.trim() === '') {
        alert('Please enter a profile name');
        return;
      }
      
      // Build proxy config if provided
      let proxy = undefined;
      const proxyType = formData.get('proxy_type') as string;
      console.log('Proxy type:', proxyType);
      
      if (proxyType && proxyType !== '') {
        const proxyHost = formData.get('proxy_host') as string;
        const proxyPort = formData.get('proxy_port') as string;
        
        console.log('Proxy config:', { type: proxyType, host: proxyHost, port: proxyPort });
        
        if (proxyHost && proxyPort) {
          proxy = {
            type: proxyType as 'http' | 'https' | 'socks4' | 'socks5',
            host: proxyHost,
            port: parseInt(proxyPort),
            username: formData.get('proxy_username') as string || undefined,
            password: formData.get('proxy_password') as string || undefined,
            change_ip_url: formData.get('proxy_change_ip_url') as string || undefined,
          };
        }
      }
      
      const profileData = {
        name: profileName.trim(),
        proxy,
        fingerprint: {}, // Will be auto-generated
        status: 'active' as const,
      };
      
      console.log('Profile data to create:', profileData);
      await onProfileCreate(profileData);
      setShowCreateForm(false);
      alert('Profile created successfully!');
    } catch (error) {
      console.error('Failed to create profile:', error);
      alert(`Failed to create profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleLaunch = async (profileId: string) => {
    try {
      setLoading(profileId);
      await onProfileLaunch(profileId);
    } catch (error) {
      console.error('Failed to launch profile:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (profileId: string) => {
    if (confirm('Are you sure you want to delete this profile? This action cannot be undone.')) {
      try {
        await onProfileDelete(profileId);
      } catch (error) {
        console.error('Failed to delete profile:', error);
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profiles</h1>
          <p className="text-muted-foreground">Manage your Chrome profiles</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Profile
        </button>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg border border-border w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Create New Profile</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate(new FormData(e.currentTarget));
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    name="name"
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    placeholder="Profile name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Proxy (Optional)</label>
                  <div className="space-y-3 p-3 border border-input rounded-md bg-background">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Type</label>
                        <select
                          name="proxy_type"
                          className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
                        >
                          <option value="">No proxy</option>
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                          <option value="socks4">SOCKS4</option>
                          <option value="socks5">SOCKS5</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Host</label>
                        <input
                          name="proxy_host"
                          type="text"
                          className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
                          placeholder="127.0.0.1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1">Port</label>
                        <input
                          name="proxy_port"
                          type="number"
                          className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
                          placeholder="8080"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Username</label>
                        <input
                          name="proxy_username"
                          type="text"
                          className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
                          placeholder="Optional"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Password</label>
                        <input
                          name="proxy_password"
                          type="password"
                          className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">IP Rotation URL (Optional)</label>
                      <input
                        name="proxy_change_ip_url"
                        type="url"
                        className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
                        placeholder="https://api.proxy.com/rotate?key=xxx"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading === 'create'}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading === 'create' ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profiles Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Profile
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Proxy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {profiles.map((profile) => {
                return (
                  <tr key={profile.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-foreground">{profile.name}</div>
                        <div className="text-sm text-muted-foreground">{profile.id.slice(0, 8)}...</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {profile.proxy ? `${profile.proxy.host}:${profile.proxy.port} (${profile.proxy.type.toUpperCase()})` : 'No proxy'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        profile.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : profile.status === 'suspended'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {profile.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {profile.last_used 
                        ? new Date(profile.last_used).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleLaunch(profile.id)}
                          disabled={loading === profile.id}
                          className="p-2 text-green-600 hover:text-green-800 disabled:opacity-50"
                          title="Launch Profile"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingProfile(profile)}
                          className="p-2 text-blue-600 hover:text-blue-800"
                          title="Edit Profile"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(profile.id)}
                          className="p-2 text-red-600 hover:text-red-800"
                          title="Delete Profile"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {profiles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No profiles found. Create your first profile to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
