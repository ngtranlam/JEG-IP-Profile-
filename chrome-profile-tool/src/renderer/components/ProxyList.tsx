import React, { useState } from 'react';
import { Proxy, ProxyValidationResult } from '../../shared/types';
import { Plus, CheckCircle, XCircle, RefreshCw, Edit, Trash2, Globe } from 'lucide-react';

interface ProxyListProps {
  proxies: Proxy[];
  onProxyCreate: (proxyData: any) => Promise<void>;
  onProxyUpdate: (id: string, updates: any) => Promise<void>;
  onProxyDelete: (id: string) => Promise<void>;
  onProxyValidate: (id: string) => Promise<ProxyValidationResult>;
  onProxyRotateIP: (id: string) => Promise<ProxyValidationResult>;
}

export function ProxyList({
  proxies,
  onProxyCreate,
  onProxyUpdate,
  onProxyDelete,
  onProxyValidate,
  onProxyRotateIP,
}: ProxyListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const handleCreate = async (formData: FormData) => {
    try {
      setLoading('create');
      const proxyData = {
        name: formData.get('name') as string,
        type: formData.get('type') as 'http' | 'https' | 'socks4' | 'socks5',
        host: formData.get('host') as string,
        port: parseInt(formData.get('port') as string),
        username: formData.get('username') as string || undefined,
        password: formData.get('password') as string || undefined,
        change_ip_url: formData.get('change_ip_url') as string || undefined,
        status: 'active' as const,
      };
      await onProxyCreate(proxyData);
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create proxy:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleValidate = async (proxyId: string) => {
    try {
      setLoading(`validate-${proxyId}`);
      const result = await onProxyValidate(proxyId);
      if (result.success) {
        alert(`Proxy validation successful!\nIP: ${result.ip}\nLocation: ${result.city}, ${result.country}`);
      } else {
        alert(`Proxy validation failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to validate proxy:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleRotateIP = async (proxyId: string) => {
    try {
      setLoading(`rotate-${proxyId}`);
      const result = await onProxyRotateIP(proxyId);
      if (result.success) {
        alert(`IP rotation successful!\nNew IP: ${result.ip}`);
      } else {
        alert(`IP rotation failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to rotate IP:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (proxyId: string) => {
    if (confirm('Are you sure you want to delete this proxy? This action cannot be undone.')) {
      try {
        await onProxyDelete(proxyId);
      } catch (error) {
        console.error('Failed to delete proxy:', error);
        alert('Failed to delete proxy. It may be in use by profiles.');
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Proxies</h1>
          <p className="text-muted-foreground">Manage your proxy servers</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Proxy
        </button>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg border border-border w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Add New Proxy</h2>
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
                    placeholder="Proxy name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    name="type"
                    required
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="socks4">SOCKS4</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Host</label>
                    <input
                      name="host"
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      placeholder="127.0.0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Port</label>
                    <input
                      name="port"
                      type="number"
                      required
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      placeholder="8080"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Username (Optional)</label>
                    <input
                      name="username"
                      type="text"
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      placeholder="username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password (Optional)</label>
                    <input
                      name="password"
                      type="password"
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      placeholder="password"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">IP Rotation URL (Optional)</label>
                  <input
                    name="change_ip_url"
                    type="url"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    placeholder="https://api.proxy.com/rotate?key=xxx"
                  />
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

      {/* Proxies Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Proxy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Current IP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {proxies.map((proxy) => (
                <tr key={proxy.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-foreground">{proxy.name}</div>
                      <div className="text-sm text-muted-foreground">{proxy.host}:{proxy.port}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {proxy.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {proxy.country && proxy.city 
                      ? `${proxy.city}, ${proxy.country}`
                      : proxy.country || 'Unknown'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {proxy.current_ip || 'Not checked'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      proxy.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : proxy.status === 'error'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {proxy.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleValidate(proxy.id)}
                        disabled={loading === `validate-${proxy.id}`}
                        className="p-2 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        title="Validate Proxy"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      {proxy.change_ip_url && (
                        <button
                          onClick={() => handleRotateIP(proxy.id)}
                          disabled={loading === `rotate-${proxy.id}`}
                          className="p-2 text-purple-600 hover:text-purple-800 disabled:opacity-50"
                          title="Rotate IP"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditingProxy(proxy)}
                        className="p-2 text-green-600 hover:text-green-800"
                        title="Edit Proxy"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(proxy.id)}
                        className="p-2 text-red-600 hover:text-red-800"
                        title="Delete Proxy"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {proxies.length === 0 && (
          <div className="text-center py-12">
            <Globe className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No proxies configured. Add your first proxy to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
