import React, { useState, useEffect, useRef } from 'react';
import { Plus, ShoppingCart, Filter, ChevronDown, Search, RefreshCw, Globe, X, Save, Trash2, Edit, Copy, ArrowLeft, Eye, EyeOff, Check } from 'lucide-react';

interface Proxy {
  id: number;
  proxyId: string;
  name: string;
  publicIp: string;
  notes: string;
  network: string;
  ipVersion: string;
  connectionType: string;
  monthlyCost: number;
  expires: string;
  status: 'active' | 'expiring' | 'inactive';
  location?: string;
  isp?: string;
  username?: string;
  password?: string;
  connectIp?: string;
  httpPort?: string;
}

interface ProxyManagementProps {
  currentUser?: any;
}

// Mock data for UI development
const mockProxies: Proxy[] = [
  { id: 1, proxyId: '1877575', name: 'Trần Đức Minh', publicIp: '166.88.179.81', notes: '-', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 3.59, expires: '2026-04-12 03:06', status: 'active', location: 'US', isp: 'Comcast', username: 'BFCDlwI7vmigIn', password: 'proxy_pass_123', connectIp: '166.88.179.81', httpPort: '42359' },
  { id: 2, proxyId: '1877572', name: '-', publicIp: '198.143.32.152', notes: '-', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 0.00, expires: '2026-06-12 03:02', status: 'active', location: 'US', isp: 'Verizon', username: 'user_572', password: 'pass_572', connectIp: '198.143.32.152', httpPort: '42360' },
  { id: 3, proxyId: '1872604', name: '-', publicIp: '169.203.162.191', notes: '-', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 0.00, expires: '2026-04-10 07:38', status: 'expiring', location: 'UK', isp: 'BT', username: 'user_604', password: 'pass_604', connectIp: '169.203.162.191', httpPort: '42361' },
  { id: 4, proxyId: '1872602', name: '-', publicIp: '82.39.67.93', notes: '-', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 0.00, expires: '2026-04-10 07:38', status: 'expiring', location: 'UK', isp: 'Virgin Media', username: 'user_602', password: 'pass_602', connectIp: '82.39.67.93', httpPort: '42362' },
  { id: 5, proxyId: '1872600', name: 'Trần Đức Minh', publicIp: '185.203.139.163', notes: '-', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 3.41, expires: '2026-04-10 07:38', status: 'active', location: 'DE', isp: 'Deutsche Telekom', username: 'user_600', password: 'pass_600', connectIp: '185.203.139.163', httpPort: '42363' },
  { id: 6, proxyId: '1872257', name: 'Nguyễn Đoan Thục Uyên', publicIp: '82.41.246.87', notes: '-', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 3.59, expires: '2026-04-10 03:42', status: 'active', location: 'UK', isp: 'Sky', username: 'user_257', password: 'pass_257', connectIp: '82.41.246.87', httpPort: '42364' },
  { id: 7, proxyId: '1872182', name: 'Lê Ngọc Phương Trinh', publicIp: '82.41.246.68', notes: 'acc etsy 12', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 3.59, expires: '2026-04-10 02:49', status: 'active', location: 'UK', isp: 'Sky', username: 'user_182', password: 'pass_182', connectIp: '82.41.246.68', httpPort: '42365' },
  { id: 8, proxyId: '1869943', name: 'Phạm Hữu Tuấn', publicIp: '82.39.69.28', notes: 'stephenmartin@theshiretailor.com UK', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 3.59, expires: '2026-04-09 08:15', status: 'active', location: 'UK', isp: 'Virgin Media', username: 'user_943', password: 'pass_943', connectIp: '82.39.69.28', httpPort: '42366' },
  { id: 9, proxyId: '1869536', name: 'Vương Khánh Hùng', publicIp: '178.92.61.37', notes: '-', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 3.59, expires: '2026-04-09 04:19', status: 'active', location: 'UA', isp: 'Kyivstar', username: 'user_536', password: 'pass_536', connectIp: '178.92.61.37', httpPort: '42367' },
  { id: 10, proxyId: '1869520', name: 'Nguyễn Phương Thảo', publicIp: '204.252.81.242', notes: 'Merch 8', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 3.59, expires: '2026-05-09 04:05', status: 'active', location: 'US', isp: 'AT&T', username: 'user_520', password: 'pass_520', connectIp: '204.252.81.242', httpPort: '42368' },
  { id: 11, proxyId: '1869515', name: 'Nguyễn Phương Thảo', publicIp: '204.252.83.33', notes: 'Merch 10', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 3.59, expires: '2026-05-09 04:04', status: 'active', location: 'US', isp: 'AT&T', username: 'user_515', password: 'pass_515', connectIp: '204.252.83.33', httpPort: '42369' },
  { id: 12, proxyId: '1869513', name: 'Nguyễn Phương Thảo', publicIp: '204.252.83.115', notes: 'Merch 17', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 3.59, expires: '2026-05-09 04:02', status: 'active', location: 'US', isp: 'AT&T', username: 'user_513', password: 'pass_513', connectIp: '204.252.83.115', httpPort: '42370' },
  { id: 13, proxyId: '1869512', name: 'Nguyễn Phương Thảo', publicIp: '204.252.86.178', notes: 'merch10_crockeryatt2000@outlook.com', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 3.59, expires: '2026-05-09 03:59', status: 'active', location: 'US', isp: 'Comcast', username: 'user_512', password: 'pass_512', connectIp: '204.252.86.178', httpPort: '42371' },
  { id: 14, proxyId: '1869506', name: 'Nguyễn Phương Thảo', publicIp: '204.252.85.37', notes: 'Merch 5', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 3.59, expires: '2026-05-09 03:57', status: 'active', location: 'US', isp: 'Comcast', username: 'user_506', password: 'pass_506', connectIp: '204.252.85.37', httpPort: '42372' },
  { id: 15, proxyId: '1869451', name: 'Trần Nhật Hoàng', publicIp: '187.189.172.13', notes: '-', network: 'STATIC RESIDENTIAL', ipVersion: 'IPv4', connectionType: 'HTTP', monthlyCost: 3.59, expires: '2026-04-09 03:35', status: 'inactive', location: 'MX', isp: 'Totalplay', username: 'user_451', password: 'pass_451', connectIp: '187.189.172.13', httpPort: '42373' },
];

const countryFlags: Record<string, string> = {
  'US': '🇺🇸', 'UK': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷', 'UA': '🇺🇦', 'MX': '🇲🇽',
  'CA': '🇨🇦', 'AU': '🇦🇺', 'JP': '🇯🇵', 'BR': '🇧🇷', 'IN': '🇮🇳', 'VN': '🇻🇳',
};

export function ProxyManagement({ currentUser }: ProxyManagementProps) {
  const [proxies, setProxies] = useState<Proxy[]>(mockProxies);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'expiring' | 'inactive'>('active');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'cost_high' | 'cost_low'>('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedProxy, setSelectedProxy] = useState<Proxy | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterNetwork, setFilterNetwork] = useState('all');
  const [filterIpVersion, setFilterIpVersion] = useState('all');
  const [filterConnectionType, setFilterConnectionType] = useState('all');
  const [filterAuthType, setFilterAuthType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterIsp, setFilterIsp] = useState('all');
  const [filterCountry, setFilterCountry] = useState('all');
  const [filterSeller, setFilterSeller] = useState('all');

  const sortRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser?.roles === '1';
  const isLeader = currentUser?.roles === '2';

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) {
        setShowActionMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterNetwork('all');
    setFilterIpVersion('all');
    setFilterConnectionType('all');
    setFilterAuthType('all');
    setFilterStatus('all');
    setFilterIsp('all');
    setFilterCountry('all');
    setFilterSeller('all');
  };

  const uniqueIsps = [...new Set(proxies.map(p => p.isp).filter(Boolean))];
  const uniqueCountries = [...new Set(proxies.map(p => p.location).filter(Boolean))];
  const uniqueSellers = [...new Set(proxies.map(p => p.name).filter(n => n && n !== '-'))];

  const filteredProxies = proxies.filter(p => {
    if (p.status !== activeTab) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!(
        p.proxyId.toLowerCase().includes(term) ||
        p.name.toLowerCase().includes(term) ||
        p.publicIp.toLowerCase().includes(term) ||
        p.notes.toLowerCase().includes(term)
      )) return false;
    }
    if (filterNetwork !== 'all' && p.network !== filterNetwork) return false;
    if (filterIpVersion !== 'all' && p.ipVersion !== filterIpVersion) return false;
    if (filterConnectionType !== 'all' && p.connectionType !== filterConnectionType) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    if (filterIsp !== 'all' && p.isp !== filterIsp) return false;
    if (filterCountry !== 'all' && p.location !== filterCountry) return false;
    if (filterSeller !== 'all' && p.name !== filterSeller) return false;
    return true;
  });

  const sortedProxies = [...filteredProxies].sort((a, b) => {
    switch (sortOrder) {
      case 'newest': return b.id - a.id;
      case 'oldest': return a.id - b.id;
      case 'cost_high': return b.monthlyCost - a.monthlyCost;
      case 'cost_low': return a.monthlyCost - b.monthlyCost;
      default: return 0;
    }
  });

  const activeCount = proxies.filter(p => p.status === 'active').length;
  const expiringCount = proxies.filter(p => p.status === 'expiring').length;
  const inactiveCount = proxies.filter(p => p.status === 'inactive').length;
  const totalMonthlyCost = proxies.reduce((sum, p) => sum + p.monthlyCost, 0);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedProxies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedProxies.map(p => p.id)));
    }
  };

  const getExpiryDotColor = (expires: string) => {
    const now = new Date();
    const expiryDate = new Date(expires);
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) return 'bg-red-500';
    if (daysLeft <= 7) return 'bg-red-500';
    if (daysLeft <= 30) return 'bg-orange-400';
    return 'bg-green-500';
  };

  const getSortLabel = () => {
    switch (sortOrder) {
      case 'newest': return 'Newest first';
      case 'oldest': return 'Oldest first';
      case 'cost_high': return 'Cost: High → Low';
      case 'cost_low': return 'Cost: Low → High';
      default: return 'Newest first';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading proxies...</div>
      </div>
    );
  }

  // ─── Proxy Details View ───
  if (selectedProxy) {
    const p = selectedProxy;
    return (
      <div className="flex flex-col h-full bg-gray-50">
        {/* Detail Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
          <h1 className="text-xl font-bold text-gray-900">Proxy Details</h1>
          <button
            onClick={() => { setSelectedProxy(null); setShowPassword(false); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to List
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Details */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Details</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                  p.status === 'active' ? 'bg-green-100 text-green-700' :
                  p.status === 'expiring' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                }`}>
                  {p.status}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="flex justify-between py-3">
                  <span className="text-sm text-gray-500">Proxy ID</span>
                  <span className="text-sm font-medium text-gray-900">{p.proxyId}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-sm text-gray-500">Expires</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{p.expires}</span>
                    <span className={`w-2 h-2 rounded-full ${getExpiryDotColor(p.expires)}`} />
                  </div>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-sm text-gray-500">Proxy Type</span>
                  <span className="text-sm font-medium text-gray-900">{p.network}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-sm text-gray-500">Protocol</span>
                  <span className="text-sm font-medium text-gray-900">{p.connectionType}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-sm text-gray-500">Public IP</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-gray-900">{p.publicIp}</span>
                    <button onClick={() => copyToClipboard(p.publicIp)} className="text-gray-400 hover:text-orange-500">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-sm text-gray-500">Location</span>
                  <span className="text-sm font-medium text-gray-900">
                    {countryFlags[p.location || ''] || ''} {p.location || '-'}
                  </span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-sm text-gray-500">ISP</span>
                  <span className="text-sm font-medium text-gray-900">{p.isp || '-'}</span>
                </div>
                <div className="flex justify-between py-3">
                  <span className="text-sm text-gray-500">Assigned to</span>
                  <div className="flex items-center gap-2">
                    <select
                      defaultValue={p.name}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="-">-- None --</option>
                      <option value="Trần Đức Minh">Trần Đức Minh</option>
                      <option value="Nguyễn Phương Thảo">Nguyễn Phương Thảo</option>
                      <option value="Lê Ngọc Phương Trinh">Lê Ngọc Phương Trinh</option>
                      <option value="Phạm Hữu Tuấn">Phạm Hữu Tuấn</option>
                    </select>
                    <button className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors flex items-center gap-1">
                      <Save className="w-3 h-3" /> Save
                    </button>
                  </div>
                </div>
              </div>

              <button className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors">
                <RefreshCw className="w-4 h-4" />
                Extend Proxy
              </button>
            </div>

            {/* Right: Authentication */}
            <div className="bg-white rounded-xl border p-6">
              <div className="mb-1">
                <h2 className="text-lg font-bold text-gray-900">Authentication</h2>
                <p className="text-xs text-gray-400">Username & Password</p>
              </div>

              <div className="space-y-4 mt-5">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Username</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={p.username || ''}
                      className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-800"
                    />
                    <button onClick={() => copyToClipboard(p.username || '')} className="p-2 text-gray-400 hover:text-orange-500 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Password</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      readOnly
                      value={p.password || ''}
                      className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-800"
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="p-2 text-gray-400 hover:text-orange-500 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => copyToClipboard(p.password || '')} className="p-2 text-gray-400 hover:text-orange-500 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Connect IP</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={p.connectIp || p.publicIp}
                      className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-800"
                    />
                    <button onClick={() => copyToClipboard(p.connectIp || p.publicIp)} className="p-2 text-gray-400 hover:text-orange-500 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">HTTP Port</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={p.httpPort || ''}
                      className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-800"
                    />
                    <button onClick={() => copyToClipboard(p.httpPort || '')} className="p-2 text-gray-400 hover:text-orange-500 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const info = `${p.connectIp || p.publicIp}:${p.httpPort}:${p.username}:${p.password}`;
                    copyToClipboard(info);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy Proxy Info
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Proxy List View ───
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b">
        <h1 className="text-xl font-bold text-gray-900">Proxy Management</h1>
        <div className="flex items-center gap-4">
          <div className="text-right mr-2">
            <p className="text-[11px] text-gray-400">Total Monthly Cost</p>
            <p className="text-lg font-bold text-gray-900">${totalMonthlyCost.toFixed(2)}</p>
          </div>
          {(isAdmin || isLeader) && (
            <>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Proxy
              </button>
              <button
                onClick={() => setShowOrderModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-xs font-medium"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Order Proxy
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b bg-gray-50/50">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'active'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            Active
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'active' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
            }`}>{activeCount}</span>
          </button>
          <button
            onClick={() => setActiveTab('expiring')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'expiring'
                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            Expiring soon
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'expiring' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'
            }`}>{expiringCount}</span>
          </button>
          <button
            onClick={() => setActiveTab('inactive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'inactive'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            Inactive
            <span className={`w-2 h-2 rounded-full ${activeTab === 'inactive' ? 'bg-red-500' : 'bg-red-400'}`} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
              showFilters ? 'border-orange-300 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {getSortLabel()}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showSortDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[150px]">
                {[
                  { value: 'newest', label: 'Newest first' },
                  { value: 'oldest', label: 'Oldest first' },
                  { value: 'cost_high', label: 'Cost: High → Low' },
                  { value: 'cost_low', label: 'Cost: Low → High' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortOrder(opt.value as any); setShowSortDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                      sortOrder === opt.value ? 'text-orange-600 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="px-6 py-4 border-b bg-white space-y-3">
          <div className="grid grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
            {/* Network */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Network</label>
              <select value={filterNetwork} onChange={(e) => setFilterNetwork(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                <option value="all">All</option>
                <option value="STATIC RESIDENTIAL">Static Residential</option>
                <option value="DATACENTER">Datacenter</option>
                <option value="MOBILE">Mobile</option>
              </select>
            </div>
            {/* IP Version */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">IP Version</label>
              <select value={filterIpVersion} onChange={(e) => setFilterIpVersion(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                <option value="all">All</option>
                <option value="IPv4">IPv4</option>
                <option value="IPv6">IPv6</option>
              </select>
            </div>
            {/* Connection Type */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Connection Type</label>
              <select value={filterConnectionType} onChange={(e) => setFilterConnectionType(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                <option value="all">All</option>
                <option value="HTTP">HTTP</option>
                <option value="SOCKS5">SOCKS5</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {/* Authentication Type */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Authentication Type</label>
              <select value={filterAuthType} onChange={(e) => setFilterAuthType(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                <option value="all">All</option>
                <option value="user_pass">Username/Password</option>
                <option value="ip_whitelist">IP Whitelist</option>
              </select>
            </div>
            {/* Status */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="expiring">Expiring</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {/* ISP */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">ISP</label>
              <select value={filterIsp} onChange={(e) => setFilterIsp(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                <option value="all">All</option>
                {uniqueIsps.map(isp => (
                  <option key={isp} value={isp}>{isp}</option>
                ))}
              </select>
            </div>
            {/* Country */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Country</label>
              <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                <option value="all">All</option>
                {uniqueCountries.map(c => (
                  <option key={c} value={c}>{countryFlags[c!] || ''} {c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {/* Seller */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Seller</label>
              <select value={filterSeller} onChange={(e) => setFilterSeller(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                <option value="all">All Sellers</option>
                {uniqueSellers.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">{sortedProxies.length} result(s)</span>
            <div className="flex items-center gap-2">
              <button onClick={clearAllFilters} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                Clear all filters
              </button>
              <button onClick={() => setShowFilters(false)} className="px-4 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium">
                Search
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {sortedProxies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Globe className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-500">No proxies found</p>
            <p className="text-xs mt-1">
              {searchTerm ? 'Try adjusting your search terms.' : 'Add your first proxy to get started.'}
            </p>
          </div>
        ) : (
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b sticky top-0 z-10">
              <tr>
                <th className="w-[36px] px-3 py-2.5">
                  <input type="checkbox" checked={selectedIds.size === sortedProxies.length && sortedProxies.length > 0} onChange={toggleSelectAll} className="w-3.5 h-3.5 text-orange-600 border-gray-300 rounded focus:ring-orange-500" />
                </th>
                <th className="w-[90px] px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Proxy ID</th>
                <th className="w-[130px] px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Name</th>
                <th className="w-[140px] px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Public IP</th>
                <th className="w-[160px] px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Notes</th>
                <th className="w-[100px] px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Network</th>
                <th className="w-[65px] px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">IP Ver.</th>
                <th className="w-[75px] px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Connection</th>
                <th className="w-[80px] px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Monthly Cost</th>
                <th className="w-[100px] px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Expires</th>
                <th className="w-[75px] px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedProxies.map((proxy) => (
                <tr
                  key={proxy.id}
                  onClick={() => setSelectedProxy(proxy)}
                  className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${
                    selectedIds.has(proxy.id) ? 'bg-orange-50/30' : ''
                  }`}
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(proxy.id)} onChange={() => toggleSelect(proxy.id)} className="w-3.5 h-3.5 text-orange-600 border-gray-300 rounded focus:ring-orange-500" />
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${proxy.status === 'active' ? 'bg-green-500' : proxy.status === 'expiring' ? 'bg-orange-400' : 'bg-red-500'}`} />
                      <span className="text-xs font-medium text-gray-900">{proxy.proxyId}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="text-xs text-gray-700 truncate block">{proxy.name}</span>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-orange-600 font-medium">{proxy.publicIp}</span>
                      <button onClick={(e) => { e.stopPropagation(); copyToClipboard(proxy.publicIp); }} className="text-gray-300 hover:text-orange-500 transition-colors flex-shrink-0" title="Copy IP">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="text-xs text-gray-500 truncate block">{proxy.notes}</span>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">
                      STATIC RESIDENTIAL
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="text-xs text-gray-600">{proxy.ipVersion}</span>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="text-xs text-gray-600">{proxy.connectionType}</span>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`text-xs font-medium ${proxy.monthlyCost > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      ${proxy.monthlyCost.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-600 whitespace-nowrap">{proxy.expires}</span>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getExpiryDotColor(proxy.expires)}`} />
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block" ref={showActionMenu === proxy.id ? actionRef : undefined}>
                      <button
                        onClick={() => setShowActionMenu(showActionMenu === proxy.id ? null : proxy.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-orange-600 bg-orange-50 rounded-md hover:bg-orange-100 transition-colors border border-orange-200"
                      >
                        Actions
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                      {showActionMenu === proxy.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1 min-w-[130px]">
                          <button onClick={() => { setSelectedProxy(proxy); setShowActionMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Eye className="w-3 h-3" /> View Details
                          </button>
                          <button className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <RefreshCw className="w-3 h-3" /> Renew
                          </button>
                          <button onClick={() => { copyToClipboard(`${proxy.connectIp || proxy.publicIp}:${proxy.httpPort}:${proxy.username}:${proxy.password}`); setShowActionMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Copy className="w-3 h-3" /> Copy Config
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer with selection info */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-6 py-2.5 border-t bg-orange-50">
          <span className="text-xs text-orange-700 font-medium">{selectedIds.size} proxy(s) selected</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-xs text-orange-600 bg-white border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">Renew Selected</button>
            <button className="px-3 py-1 text-xs text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-100 transition-colors">Delete Selected</button>
          </div>
        </div>
      )}

      {/* ─── Add Manual Proxy Modal ─── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            {/* Yellow header */}
            <div className="bg-gradient-to-r from-orange-400 to-yellow-400 px-6 py-5 rounded-t-xl relative">
              <button onClick={() => setShowAddModal(false)} className="absolute top-3 right-4 text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5" /> ADD MANUAL PROXY
              </h2>
              <p className="text-xs text-white/80 mt-0.5">ADD YOUR OWN PROXY FROM EXTERNAL SOURCES</p>
            </div>
            <div className="p-6 space-y-5">
              {/* Quick Input */}
              <div>
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1.5">
                  <span className="text-yellow-500">⚡</span> Quick Input
                </label>
                <input
                  type="text"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Paste proxy info: IP:Port:Username:Password (e.g., 202.55.134.143:37893:40czx8bj:oYxV1c6g)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Location <span className="text-red-500">*</span></label>
                  <select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                    <option value="">Select Location</option>
                    <option value="US">🇺🇸 United States</option>
                    <option value="UK">🇬🇧 United Kingdom</option>
                    <option value="DE">🇩🇪 Germany</option>
                    <option value="FR">🇫🇷 France</option>
                    <option value="CA">🇨🇦 Canada</option>
                    <option value="AU">🇦🇺 Australia</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">ISP <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Enter ISP name"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">e.g., Verizon, Comcast, AT&T</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Expires <span className="text-red-500">*</span></label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Connect IP <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="192.168.1.1"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">IP address to connect to</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Username <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="username"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    className="w-full px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">HTTP Port <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="8080"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Notes</label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    placeholder="Optional notes about this proxy"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowAddModal(false)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button className="flex items-center gap-1.5 px-5 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium">
                <Plus className="w-3.5 h-3.5" /> Add Proxy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Order New Proxy Modal ─── */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            {/* Yellow header */}
            <div className="bg-gradient-to-r from-orange-400 to-yellow-400 px-6 py-5 rounded-t-xl relative">
              <button onClick={() => setShowOrderModal(false)} className="absolute top-3 right-4 text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5" /> ORDER NEW PROXY
              </h2>
              <p className="text-xs text-white/80 mt-0.5">CONFIGURE YOUR PROXY SERVICE BASED ON YOUR NEEDS</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Country <span className="text-red-500">*</span></label>
                  <select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                    <option value="US">🇺🇸 United States</option>
                    <option value="UK">🇬🇧 United Kingdom</option>
                    <option value="DE">🇩🇪 Germany</option>
                    <option value="FR">🇫🇷 France</option>
                    <option value="CA">🇨🇦 Canada</option>
                    <option value="AU">🇦🇺 Australia</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">ISP Provider <span className="text-red-500">*</span></label>
                  <select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                    <option value="">Select ISP (Required)</option>
                    <option value="comcast">Comcast</option>
                    <option value="verizon">Verizon</option>
                    <option value="att">AT&T</option>
                    <option value="spectrum">Spectrum</option>
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">Choose specific ISP for better targeting</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Quantity <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    defaultValue="1"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Duration <span className="text-red-500">*</span></label>
                  <select className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                    <option value="1">1 Month</option>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Coupon Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Enter coupon code"
                    />
                    <button className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
                      <Check className="w-3.5 h-3.5" /> Apply
                    </button>
                  </div>
                </div>
              </div>

              {/* Pricing Summary */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                  📋 Pricing Summary
                </h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Unit Price:</span>
                    <span className="text-gray-700">$0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Price (No Discounts):</span>
                    <span className="text-gray-700">$0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Discount Amount:</span>
                    <span className="text-green-600">-$0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="text-gray-700">$0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment Fee:</span>
                    <span className="text-gray-700">$0.00</span>
                  </div>
                </div>
                <div className="flex justify-between mt-3 pt-2 border-t text-sm font-bold">
                  <span className="text-gray-800">Total Price:</span>
                  <span className="text-gray-900">$0.00</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowOrderModal(false)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button className="flex items-center gap-1.5 px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium">
                <ShoppingCart className="w-3.5 h-3.5" /> Place Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
