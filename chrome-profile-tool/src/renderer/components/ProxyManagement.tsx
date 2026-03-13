import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, ShoppingCart, Filter, ChevronDown, Search, RefreshCw, Globe, X, Save, Trash2, Edit, Copy, ArrowLeft, Eye, EyeOff, Check, Loader2, Clock, Tag, Calendar } from 'lucide-react';

interface Proxy {
  id: string;
  proxyId: string;
  displayId: string;
  name: string;
  sellerFullName: string;
  sellerUsername: string;
  publicIp: string;
  notes: string;
  network: string;
  ipVersion: string;
  connectionType: string;
  monthlyCost: number;
  expires: string;
  status: 'active' | 'expiring' | 'inactive';
  location: string;
  country: string;
  countryFlag: string;
  isp: string;
  username: string;
  password: string;
  connectIp: string;
  httpPort: string;
  httpsPort: string;
  socks5Port: string;
  bandwidth: string;
  source: string;
  isManual: boolean;
}

interface ProxyStats {
  active: number;
  expiring_soon: number;
  inactive: number;
  total: number;
  total_monthly_cost: number;
}

interface OrderOptions {
  countries: string[] | Record<string, string>;
  isps: Record<string, { id: string; label?: string; name?: string }[]>;
  plans: { id: string; name: string; description: string }[];
}

interface PriceData {
  unitPrice: number;
  unitPriceAfterDiscount: number;
  totalPrice: number;
  finalPrice: number;
  discount: number;
  discountPercentage: number;
  currency: string;
}

interface ProxyManagementProps {
  currentUser?: any;
}

const countryNames: Record<string, string> = {
  'US': 'United States', 'UK': 'United Kingdom', 'GB': 'United Kingdom', 'DE': 'Germany', 'FR': 'France',
  'UA': 'Ukraine', 'MX': 'Mexico', 'CA': 'Canada', 'AU': 'Australia', 'JP': 'Japan',
  'BR': 'Brazil', 'IN': 'India', 'VN': 'Vietnam', 'IT': 'Italy', 'ES': 'Spain',
  'NL': 'Netherlands', 'PL': 'Poland', 'PT': 'Portugal', 'SE': 'Sweden', 'NO': 'Norway',
  'DK': 'Denmark', 'FI': 'Finland', 'AT': 'Austria', 'CH': 'Switzerland', 'BE': 'Belgium',
  'IE': 'Ireland', 'CZ': 'Czech Republic', 'RO': 'Romania', 'HU': 'Hungary', 'GR': 'Greece',
  'TR': 'Turkey', 'ZA': 'South Africa', 'KR': 'South Korea', 'TW': 'Taiwan', 'SG': 'Singapore',
  'HK': 'Hong Kong', 'TH': 'Thailand', 'PH': 'Philippines', 'ID': 'Indonesia', 'MY': 'Malaysia',
  'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia', 'PE': 'Peru', 'IL': 'Israel',
  'AE': 'United Arab Emirates', 'SA': 'Saudi Arabia', 'EG': 'Egypt', 'NG': 'Nigeria',
  'KE': 'Kenya', 'PK': 'Pakistan', 'BD': 'Bangladesh', 'RU': 'Russia', 'BG': 'Bulgaria',
  'HR': 'Croatia', 'SK': 'Slovakia', 'SI': 'Slovenia', 'LT': 'Lithuania', 'LV': 'Latvia',
  'EE': 'Estonia', 'RS': 'Serbia', 'BA': 'Bosnia', 'AL': 'Albania', 'MK': 'North Macedonia',
  'GE': 'Georgia', 'AM': 'Armenia', 'AZ': 'Azerbaijan', 'KZ': 'Kazakhstan', 'UZ': 'Uzbekistan',
  'NZ': 'New Zealand', 'PR': 'Puerto Rico', 'CR': 'Costa Rica', 'PA': 'Panama', 'EC': 'Ecuador',
  'UY': 'Uruguay', 'PY': 'Paraguay', 'BO': 'Bolivia', 'DO': 'Dominican Republic', 'GT': 'Guatemala',
};

const countryFlags: Record<string, string> = {
  'US': '🇺🇸', 'UK': '🇬🇧', 'GB': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷', 'UA': '🇺🇦', 'MX': '🇲🇽',
  'CA': '🇨🇦', 'AU': '🇦🇺', 'JP': '🇯🇵', 'BR': '🇧🇷', 'IN': '🇮🇳', 'VN': '🇻🇳',
  'IT': '🇮🇹', 'ES': '🇪🇸', 'NL': '🇳🇱', 'PL': '🇵🇱', 'PT': '🇵🇹', 'SE': '🇸🇪',
  'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'AT': '🇦🇹', 'CH': '🇨🇭', 'BE': '🇧🇪',
  'IE': '🇮🇪', 'CZ': '🇨🇿', 'RO': '🇷🇴', 'HU': '🇭🇺', 'GR': '🇬🇷', 'TR': '🇹🇷',
  'ZA': '🇿🇦', 'KR': '🇰🇷', 'TW': '🇹🇼', 'SG': '🇸🇬', 'HK': '🇭🇰', 'TH': '🇹🇭',
  'PH': '🇵🇭', 'ID': '🇮🇩', 'MY': '🇲🇾', 'AR': '🇦🇷', 'CL': '🇨🇱', 'CO': '🇨🇴',
  'PE': '🇵🇪', 'IL': '🇮🇱', 'AE': '🇦🇪', 'SA': '🇸🇦', 'EG': '🇪🇬', 'NG': '🇳🇬',
  'KE': '🇰🇪', 'PK': '🇵🇰', 'BD': '🇧🇩', 'RU': '🇷🇺', 'NZ': '🇳🇿',
};

function mapApiStatus(rawStatus: string): 'active' | 'expiring' | 'inactive' {
  const s = rawStatus?.toUpperCase();
  if (s === 'ACTIVE') return 'active';
  if (s === 'EXPIRING_SOON' || s === 'EXPIRING') return 'expiring';
  return 'inactive';
}

// Helper function to get country flag emoji from country code
function getCountryFlag(countryCode: string | undefined): string {
  if (!countryCode) return '🌐';
  const code = countryCode.toUpperCase();
  // Convert country code to flag emoji using regional indicator symbols
  const codePoints = [...code].map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function mapApiProxy(p: any): Proxy {
  return {
    id: p.id || p.proxy_id || '',
    proxyId: p.id || p.proxy_id || '',
    displayId: p.display_id || p.id || '',
    name: p.name || '-',
    sellerFullName: p.seller_full_name || p.name || '-',
    sellerUsername: p.seller_username || p.name || '',
    publicIp: p.public_ip || '',
    notes: p.notes || '-',
    network: p.network_type || 'STATIC RESIDENTIAL',
    ipVersion: p.ip_version || 'IPv4',
    connectionType: p.proxy_type || 'HTTP',
    monthlyCost: parseFloat(p.monthly_cost_raw ?? p.monthly_cost ?? 0),
    expires: p.expires_formatted || p.expires_at || '',
    status: mapApiStatus(p.status || p.raw_status || ''),
    location: p.country_code || '',
    country: p.country_code || '',
    countryFlag: p.country_flag || countryFlags[p.country_code] || '',
    isp: p.isp_name || '',
    username: p.username || '',
    password: p.password || '',
    connectIp: p.connect_ip || p.public_ip || '',
    httpPort: p.http_port || '',
    httpsPort: p.https_port || '',
    socks5Port: p.socks5_port || '',
    bandwidth: p.bandwidth || 'Unlimited',
    source: p.source || 'api',
    isManual: p.is_manual || false,
  };
}

export function ProxyManagement({ currentUser }: ProxyManagementProps) {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'expiring' | 'inactive'>('active');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'cost_high' | 'cost_low'>('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedProxy, setSelectedProxy] = useState<Proxy | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  // Add Proxy modal fields
  const [addProxyIp, setAddProxyIp] = useState('');
  const [addProxyPort, setAddProxyPort] = useState('');
  const [addProxyUsername, setAddProxyUsername] = useState('');
  const [addProxyPassword, setAddProxyPassword] = useState('');
  const [addProxyLocation, setAddProxyLocation] = useState('');
  const [addProxyIsp, setAddProxyIsp] = useState('');
  const [addProxyExpires, setAddProxyExpires] = useState('');
  const [addProxyHttpPort, setAddProxyHttpPort] = useState('');
  const [addProxyNotes, setAddProxyNotes] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterNetwork, setFilterNetwork] = useState('all');
  const [filterIpVersion, setFilterIpVersion] = useState('all');
  const [filterConnectionType, setFilterConnectionType] = useState('all');
  const [filterAuthType, setFilterAuthType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterIsp, setFilterIsp] = useState('all');
  const [filterCountry, setFilterCountry] = useState('all');
  const [filterSeller, setFilterSeller] = useState('all');
  const [sellersList, setSellersList] = useState<{id: number; userName: string; fullName: string}[]>([]);

  // Notes editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');

  // Extend modal state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendProxy, setExtendProxy] = useState<Proxy | null>(null);
  const [extendPeriod, setExtendPeriod] = useState(0);
  const [extendCoupon, setExtendCoupon] = useState('');
  const [extendPrice, setExtendPrice] = useState<{price: number; currency: string} | null>(null);
  const [extendPriceLoading, setExtendPriceLoading] = useState(false);
  const [extendLoading, setExtendLoading] = useState(false);

  // Stats from API
  const [stats, setStats] = useState<ProxyStats>({ active: 0, expiring_soon: 0, inactive: 0, total: 0, total_monthly_cost: 0 });

  // Order modal state
  const [orderOptions, setOrderOptions] = useState<OrderOptions | null>(null);
  const [orderCountry, setOrderCountry] = useState('US');
  const [orderIsp, setOrderIsp] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderDuration, setOrderDuration] = useState(1);
  const [orderCoupon, setOrderCoupon] = useState('');
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);

  const sortRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser?.roles === '1';
  const isLeader = currentUser?.roles === '2';

  // Fetch proxy list from API
  const fetchProxies = useCallback(async (statusFilter?: string) => {
    try {
      setLoading(true);
      setError(null);
      const filters: any = {};
      const tabStatus = statusFilter || activeTab;
      if (tabStatus === 'active') filters.status = 'active';
      else if (tabStatus === 'expiring') filters.status = 'expiring_soon';
      else if (tabStatus === 'inactive') filters.status = 'inactive';

      if (searchTerm) filters.search = searchTerm;
      if (filterCountry !== 'all') filters.country = filterCountry;
      if (filterNetwork !== 'all') filters.network = filterNetwork;
      if (filterIsp !== 'all') filters.isp = filterIsp;
      if (isAdmin && filterSeller !== 'all') filters.seller_username = filterSeller;

      const result = await window.electronAPI.extProxyList(filters);
      const apiProxies = result?.proxies || result || [];
      setProxies(Array.isArray(apiProxies) ? apiProxies.map(mapApiProxy) : []);
    } catch (err: any) {
      console.error('Failed to fetch proxies:', err);
      setError(err.message || 'Failed to load proxies');
      setProxies([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm, filterCountry, filterNetwork, filterIsp, filterSeller, isAdmin]);

  // Fetch stats from API
  const fetchStats = useCallback(async () => {
    try {
      const sellerUsername = isAdmin && filterSeller !== 'all' ? filterSeller : undefined;
      const result = await window.electronAPI.extProxyStats(sellerUsername);
      if (result) {
        setStats({
          active: result.active || 0,
          expiring_soon: result.expiring_soon || 0,
          inactive: result.inactive || 0,
          total: result.total || 0,
          total_monthly_cost: result.total_monthly_cost || 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [isAdmin, filterSeller]);

  // Auto-sync on page load, then fetch
  useEffect(() => {
    const initLoad = async () => {
      try {
        await window.electronAPI.extProxySync();
      } catch (err) {
        console.error('Auto-sync failed:', err);
      }
      fetchProxies();
      fetchStats();
      // Fetch sellers list for admin filter
      if (isAdmin) {
        try {
          const sellers = await window.electronAPI.extProxySellers() as any;
          console.log('[Sellers] Raw:', sellers);
          const raw = Array.isArray(sellers) ? sellers : sellers?.data || [];
          const list = raw.map((s: any) => ({
            id: s.id || 0,
            userName: s.userName || s.username || '',
            fullName: s.fullName || s.full_name || s.name || s.userName || '',
          }));
          setSellersList(list);
        } catch (err) {
          console.error('Failed to fetch sellers:', err);
        }
      }
    };
    initLoad();
  }, [fetchProxies, fetchStats, isAdmin]);

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

  // Client-side filtering for fields not supported by API
  const filteredProxies = proxies.filter(p => {
    if (filterIpVersion !== 'all' && p.ipVersion !== filterIpVersion) return false;
    if (filterConnectionType !== 'all' && p.connectionType !== filterConnectionType) return false;
    return true;
  });

  const sortedProxies = [...filteredProxies].sort((a, b) => {
    switch (sortOrder) {
      case 'newest': return parseInt(b.proxyId) - parseInt(a.proxyId);
      case 'oldest': return parseInt(a.proxyId) - parseInt(b.proxyId);
      case 'cost_high': return b.monthlyCost - a.monthlyCost;
      case 'cost_low': return a.monthlyCost - b.monthlyCost;
      default: return 0;
    }
  });

  const activeCount = stats.active;
  const expiringCount = stats.expiring_soon;
  const inactiveCount = stats.inactive;
  const totalMonthlyCost = stats.total_monthly_cost;

  const toggleSelect = (id: string) => {
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

  // Tab change handler
  const handleTabChange = (tab: 'active' | 'expiring' | 'inactive') => {
    setActiveTab(tab);
    setSelectedIds(new Set());
  };

  // Order modal: fetch order options
  const openOrderModal = async () => {
    setShowOrderModal(true);
    setPriceData(null);
    setOrderCountry('');
    setOrderIsp('');
    setOrderQuantity(1);
    setOrderDuration(1);
    setOrderCoupon('');
    setOrderOptions(null);
    try {
      const result = await window.electronAPI.extProxyOrderOptions('static-residential-ipv4', 'standard');
      console.log('[OrderOptions] Raw API response:', JSON.stringify(result, null, 2));
      // Normalize the response - API may return data directly or nested
      const data = result?.data || result;
      const normalized: OrderOptions = {
        countries: data?.countries || {},
        isps: data?.isps || {},
        plans: data?.plans || [],
      };
      console.log('[OrderOptions] Normalized:', JSON.stringify(normalized, null, 2));
      setOrderOptions(normalized);
      // Auto-select first country if available
      const countryKeys = Object.keys(normalized.countries);
      if (countryKeys.length > 0) {
        setOrderCountry(countryKeys[0]);
      }
    } catch (err) {
      console.error('Failed to load order options:', err);
    }
  };

  // Order modal: calculate price
  const handleCalculatePrice = async () => {
    try {
      setPriceLoading(true);
      const result = await window.electronAPI.extProxyCalculatePrice({
        service_type: 'static-residential-ipv4',
        plan_id: 'standard',
        quantity: orderQuantity,
        duration: orderDuration,
        country: orderCountry,
        ...(orderIsp ? { isp_id: orderIsp } : {}),
        ...(orderCoupon ? { coupon_code: orderCoupon } : {}),
      });
      console.log('[CalculatePrice] Raw API response:', JSON.stringify(result, null, 2));
      // Normalize - API may return data nested or with different field names
      const data = result?.data || result;
      const normalized: PriceData = {
        unitPrice: parseFloat(data?.unit_price ?? data?.unitPrice ?? 0),
        unitPriceAfterDiscount: parseFloat(data?.unit_price_after_discount ?? data?.unitPriceAfterDiscount ?? 0),
        totalPrice: parseFloat(data?.total_price ?? data?.totalPrice ?? 0),
        finalPrice: parseFloat(data?.final_price ?? data?.finalPrice ?? data?.total ?? 0),
        discount: parseFloat(data?.discount ?? data?.discount_amount ?? 0),
        discountPercentage: parseFloat(data?.discount_percentage ?? data?.discountPercentage ?? 0),
        currency: data?.currency || 'USD',
      };
      console.log('[CalculatePrice] Normalized:', normalized);
      setPriceData(normalized);
    } catch (err) {
      console.error('Failed to calculate price:', err);
    } finally {
      setPriceLoading(false);
    }
  };

  // Auto-parse Quick Input for Add Proxy modal
  useEffect(() => {
    if (!quickInput.trim()) return;
    
    // Parse format: IP:Port:Username:Password
    const parts = quickInput.trim().split(':');
    if (parts.length >= 4) {
      setAddProxyIp(parts[0]);
      setAddProxyPort(parts[1]);
      setAddProxyUsername(parts[2]);
      setAddProxyPassword(parts.slice(3).join(':')); // In case password contains ':'
      setAddProxyHttpPort(parts[1]); // Use same port for HTTP by default
    } else if (parts.length === 2) {
      // Just IP:Port
      setAddProxyIp(parts[0]);
      setAddProxyPort(parts[1]);
      setAddProxyHttpPort(parts[1]);
    }
  }, [quickInput]);

  // Auto-calculate price when order params change
  useEffect(() => {
    if (!showOrderModal || !orderCountry) return;
    const timer = setTimeout(() => {
      handleCalculatePrice();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderCountry, orderIsp, orderQuantity, orderDuration, showOrderModal]);

  // Order modal: place order
  const handlePlaceOrder = async () => {
    if (!confirm('This will place a real order and charge your account. Continue?')) return;
    try {
      setOrderLoading(true);
      await window.electronAPI.extProxyOrder({
        service_type: 'static-residential-ipv4',
        plan_id: 'standard',
        quantity: orderQuantity,
        duration: orderDuration,
        country: orderCountry,
        ...(orderIsp ? { isp_id: orderIsp } : {}),
        ...(orderCoupon ? { coupon_code: orderCoupon } : {}),
      });
      setShowOrderModal(false);
      // Sync and refresh after order
      try { await window.electronAPI.extProxySync(); } catch (_) {}
      await Promise.all([fetchProxies(), fetchStats()]);
    } catch (err: any) {
      alert(err.message || 'Order failed');
    } finally {
      setOrderLoading(false);
    }
  };

  // Add manual proxy via external API (v2)
  const handleAddManualProxy = async () => {
    if (!addProxyIp || !addProxyPort || !addProxyUsername || !addProxyPassword) {
      alert('Please fill in all required fields (Connect IP, Port, Username, Password)');
      return;
    }
    try {
      const data: any = {
        location: addProxyLocation || 'US',
        isp: addProxyIsp || 'Unknown',
        expires: addProxyExpires ? addProxyExpires.split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        connect_ip: addProxyIp,
        proxy_username: addProxyUsername,
        proxy_password: addProxyPassword,
        http_port: parseInt(addProxyHttpPort || addProxyPort) || 8080,
      };
      if (addProxyNotes) data.notes = addProxyNotes;
      
      await window.electronAPI.extProxyAddManual(data);
      setShowAddModal(false);
      // Reset fields
      setQuickInput(''); setAddProxyIp(''); setAddProxyPort(''); setAddProxyUsername(''); setAddProxyPassword('');
      setAddProxyLocation(''); setAddProxyIsp(''); setAddProxyExpires(''); setAddProxyHttpPort(''); setAddProxyNotes('');
      // Refresh list
      try { await window.electronAPI.extProxySync(); } catch (_) {}
      await Promise.all([fetchProxies(), fetchStats()]);
    } catch (err: any) {
      alert(err.message || 'Failed to add manual proxy');
    }
  };

  // Update proxy note via external API (v2)
  const handleUpdateNote = async (proxyId: string, notes: string) => {
    try {
      await window.electronAPI.extProxyUpdateNote(proxyId, notes);
      // Update local state
      setProxies(prev => prev.map(p => p.proxyId === proxyId ? { ...p, notes } : p));
      if (selectedProxy && selectedProxy.proxyId === proxyId) {
        setSelectedProxy({ ...selectedProxy, notes });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update note');
    }
  };

  // Open extend modal for a proxy
  const openExtendModal = (proxy: Proxy) => {
    setExtendProxy(proxy);
    setExtendPeriod(0);
    setExtendCoupon('');
    setExtendPrice(null);
    setShowExtendModal(true);
  };

  // Fetch extension price
  const handleExtensionPrice = async () => {
    if (!extendProxy || !extendPeriod) return;
    try {
      setExtendPriceLoading(true);
      const result = await window.electronAPI.extProxyExtensionPrice(extendProxy.proxyId, extendPeriod);
      console.log('[ExtendPrice] Raw result:', JSON.stringify(result));
      // Handle nested data: API returns finalPrice, priceNoDiscounts, unitPrice, etc.
      const inner = result?.data ?? result;
      const price = parseFloat(inner?.finalPrice ?? inner?.price ?? inner?.total_price ?? 0);
      const currency = inner?.currency || inner?.priceInCurrency || 'USD';
      const discount = parseFloat(inner?.discount ?? 0);
      const priceNoDiscounts = parseFloat(inner?.priceNoDiscounts ?? 0);
      console.log('[ExtendPrice] Parsed:', { price, currency, discount, priceNoDiscounts });
      setExtendPrice({ price, currency });
    } catch (err: any) {
      console.error('Failed to get extension price:', err);
      alert('Failed to calculate extension price: ' + (err.message || 'Unknown error'));
      setExtendPrice(null);
    } finally {
      setExtendPriceLoading(false);
    }
  };

  // Auto-fetch extension price when period changes
  useEffect(() => {
    if (!showExtendModal || !extendProxy || !extendPeriod) return;
    const timer = setTimeout(() => {
      handleExtensionPrice();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extendPeriod, showExtendModal]);

  // Execute extend proxy
  const handleExtendProxy = async () => {
    if (!extendProxy || !extendPeriod) return;
    if (!confirm(`This will extend proxy ${extendProxy.proxyId} by ${extendPeriod} month(s) and charge $${extendPrice?.price?.toFixed(2) || '?'}. Continue?`)) return;
    try {
      setExtendLoading(true);
      await window.electronAPI.extProxyExtend(extendProxy.proxyId, extendPeriod, extendCoupon || undefined);
      setShowExtendModal(false);
      // Refresh list
      await Promise.all([fetchProxies(), fetchStats()]);
    } catch (err: any) {
      alert(err.message || 'Failed to extend proxy');
    } finally {
      setExtendLoading(false);
    }
  };

  // Delete proxy via external API (v2, Admin only)
  const handleDeleteProxy = async (proxyId: string) => {
    if (!confirm('Are you sure you want to delete this proxy? This action is irreversible.')) return;
    try {
      await window.electronAPI.extProxyDelete(proxyId);
      setSelectedProxy(null);
      await Promise.all([fetchProxies(), fetchStats()]);
    } catch (err: any) {
      alert(err.message || 'Failed to delete proxy');
    }
  };

  // ─── Extend Proxy Modal (shared between list & detail views) ───
  const renderExtendModal = () => {
    if (!showExtendModal || !extendProxy) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowExtendModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
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
            {/* Proxy Info */}
            <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-400">
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Proxy ID</span>
                  <span className="text-sm font-bold text-gray-900 font-mono">{extendProxy.proxyId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Current Expires</span>
                  <span className="text-sm font-semibold text-gray-800">{extendProxy.expires || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    extendProxy.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    extendProxy.status === 'expiring' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {extendProxy.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Extension Period */}
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

            {/* Coupon Code */}
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

            {/* Price Display */}
            {extendPrice && (
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-orange-700">Extension Cost:</span>
                  <span className="text-lg font-bold text-orange-900">${extendPrice.price.toFixed(2)} {extendPrice.currency}</span>
                </div>
                <p className="text-[11px] text-orange-500 mt-1">For {extendPeriod} month{extendPeriod > 1 ? 's' : ''} extension</p>
              </div>
            )}

            {/* Loading indicator */}
            {extendPriceLoading && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                Calculating price...
              </div>
            )}
          </div>

          {/* Footer */}
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
    );
  };

  if (loading && proxies.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500 mr-2" />
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

              <button onClick={() => openExtendModal(p)} className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors">
                <Clock className="w-4 h-4" />
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
        {/* Extend Modal (rendered inside detail view) */}
        {renderExtendModal()}
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
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Proxy
          </button>
          <button
            onClick={openOrderModal}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-xs font-medium"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Order Proxy
          </button>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b bg-gray-50/50">
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleTabChange('active')}
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
            onClick={() => handleTabChange('expiring')}
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
            onClick={() => handleTabChange('inactive')}
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

      {/* Error Banner */}
      {error && (
        <div className="px-6 py-2 bg-red-50 border-b border-red-200 flex items-center justify-between">
          <span className="text-xs text-red-600">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

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
          {isAdmin && (
            <div className="grid grid-cols-4 gap-4">
              {/* Seller - Admin only */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Seller</label>
                <select value={filterSeller} onChange={(e) => setFilterSeller(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                  <option value="all">All Sellers</option>
                  {sellersList.map((s) => (
                    <option key={s.userName} value={s.userName}>{s.fullName || s.userName}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">{sortedProxies.length} result(s)</span>
            <div className="flex items-center gap-2">
              <button onClick={() => { clearAllFilters(); fetchProxies(); fetchStats(); }} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                Clear all filters
              </button>
              <button onClick={() => { setShowFilters(false); fetchProxies(); fetchStats(); }} className="px-4 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium">
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
                {isAdmin && <th className="w-[130px] px-2 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Name</th>}
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
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base flex-shrink-0" title={proxy.country || 'Unknown'}>{getCountryFlag(proxy.country)}</span>
                      <span className="text-xs font-medium text-gray-900 truncate" title={proxy.proxyId}>{proxy.proxyId}</span>
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-2 py-2.5">
                      <span className="text-xs text-gray-700 truncate block">{proxy.sellerFullName}</span>
                    </td>
                  )}
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-orange-600 font-medium">{proxy.publicIp}</span>
                      <button onClick={(e) => { e.stopPropagation(); copyToClipboard(proxy.publicIp); }} className="text-gray-300 hover:text-orange-500 transition-colors flex-shrink-0" title="Copy IP">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    {editingNoteId === proxy.proxyId ? (
                      <input
                        type="text"
                        value={editingNoteValue}
                        onChange={(e) => setEditingNoteValue(e.target.value)}
                        onBlur={async () => {
                          await handleUpdateNote(proxy.proxyId, editingNoteValue);
                          setEditingNoteId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          } else if (e.key === 'Escape') {
                            setEditingNoteId(null);
                          }
                        }}
                        autoFocus
                        className="w-full px-2 py-1 text-xs border border-orange-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="Add note..."
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setEditingNoteId(proxy.proxyId);
                          setEditingNoteValue(proxy.notes || '');
                        }}
                        className="text-xs text-gray-500 truncate block cursor-text hover:text-gray-700 transition-colors"
                        title="Click to edit note"
                      >
                        {proxy.notes || <span className="text-gray-400 italic">Add note...</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">
                      {proxy.network}
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
                          <button onClick={() => { setEditingNoteId(proxy.proxyId); setEditingNoteValue(proxy.notes || ''); setShowActionMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Edit className="w-3 h-3" /> Notes
                          </button>
                          <button onClick={() => { openExtendModal(proxy); setShowActionMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <RefreshCw className="w-3 h-3" /> Extend
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
                  <select value={addProxyLocation} onChange={(e) => setAddProxyLocation(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white">
                    <option value="">Select Location</option>
                    {Object.entries(countryNames)
                      .filter(([code]) => code !== 'GB')
                      .sort((a, b) => a[1].localeCompare(b[1]))
                      .map(([code, name]) => (
                        <option key={code} value={code}>{countryFlags[code] || getCountryFlag(code)} {name}</option>
                      ))
                    }
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">ISP <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={addProxyIsp}
                    onChange={(e) => setAddProxyIsp(e.target.value)}
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
                    value={addProxyExpires}
                    onChange={(e) => setAddProxyExpires(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Connect IP <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={addProxyIp}
                    onChange={(e) => setAddProxyIp(e.target.value)}
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
                    value={addProxyUsername}
                    onChange={(e) => setAddProxyUsername(e.target.value)}
                    className="w-full px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="username"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={addProxyPassword}
                    onChange={(e) => setAddProxyPassword(e.target.value)}
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
                    value={addProxyHttpPort}
                    onChange={(e) => setAddProxyHttpPort(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="8080"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Notes</label>
                  <textarea
                    rows={2}
                    value={addProxyNotes}
                    onChange={(e) => setAddProxyNotes(e.target.value)}
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
              <button onClick={handleAddManualProxy} className="flex items-center gap-1.5 px-5 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium">
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
              {!orderOptions && (
                <div className="flex items-center justify-center py-4 text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading order options...
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Country <span className="text-red-500">*</span></label>
                  <select
                    value={orderCountry}
                    onChange={(e) => { setOrderCountry(e.target.value); setOrderIsp(''); }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select Country</option>
                    {orderOptions?.countries && (
                      Array.isArray(orderOptions.countries)
                        ? (orderOptions.countries as any[]).map((c: any) => {
                            // Handle both string array ["US","UK",...] and object array [{code,name},...]
                            const code = typeof c === 'string' ? c : (c.code || c.id || c.value || '');
                            const name = typeof c === 'string' ? (countryNames[c] || c) : (c.name || c.label || code);
                            return <option key={code} value={code}>{countryFlags[code] || ''} {name}</option>;
                          })
                        : Object.entries(orderOptions.countries).map(([code, name]) => (
                            <option key={code} value={code}>{countryFlags[code] || ''} {typeof name === 'string' ? name : (name as any)?.name || countryNames[code] || code}</option>
                          ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">ISP Provider</label>
                  <select
                    value={orderIsp}
                    onChange={(e) => { setOrderIsp(e.target.value); }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                  >
                    <option value="">Any ISP</option>
                    {(() => {
                      const isps = orderOptions?.isps;
                      if (!isps || !orderCountry) return null;
                      // isps could be: { countryCode: [...] } or flat array
                      let ispList: any[] = [];
                      if (Array.isArray(isps)) {
                        ispList = isps;
                      } else if (isps[orderCountry]) {
                        ispList = Array.isArray(isps[orderCountry]) ? isps[orderCountry] : [];
                      } else if (isps[orderCountry.toUpperCase()]) {
                        ispList = Array.isArray(isps[orderCountry.toUpperCase()]) ? isps[orderCountry.toUpperCase()] : [];
                      } else if (isps[orderCountry.toLowerCase()]) {
                        ispList = Array.isArray(isps[orderCountry.toLowerCase()]) ? isps[orderCountry.toLowerCase()] : [];
                      }
                      return ispList.map((isp: any) => {
                        const id = isp.id || isp.isp_id || isp.value || '';
                        const name = isp.label || isp.name || isp.isp_name || id;
                        return <option key={id} value={id}>{name}</option>;
                      });
                    })()}
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
                    value={orderQuantity}
                    onChange={(e) => { setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1)); }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Duration <span className="text-red-500">*</span></label>
                  <select
                    value={orderDuration}
                    onChange={(e) => { setOrderDuration(parseInt(e.target.value)); }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                  >
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
                      value={orderCoupon}
                      onChange={(e) => { setOrderCoupon(e.target.value); }}
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Enter coupon code"
                    />
                    <button
                      onClick={handleCalculatePrice}
                      disabled={priceLoading}
                      className="flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50"
                    >
                      {priceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Apply
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
                    <span className="text-gray-700">${priceData?.unitPrice?.toFixed(2) ?? '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Price (No Discounts):</span>
                    <span className="text-gray-700">${priceData?.totalPrice?.toFixed(2) ?? '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Discount ({priceData?.discountPercentage ?? 0}%):</span>
                    <span className="text-green-600">-${priceData?.discount?.toFixed(2) ?? '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="text-gray-700">${((priceData?.totalPrice ?? 0) - (priceData?.discount ?? 0)).toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex justify-between mt-3 pt-2 border-t text-sm font-bold">
                  <span className="text-gray-800">Total Price:</span>
                  <span className="text-gray-900">${priceData?.finalPrice?.toFixed(2) ?? '0.00'} {priceData?.currency ?? 'USD'}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowOrderModal(false)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={handlePlaceOrder}
                disabled={orderLoading || !priceData}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {orderLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                Place Order
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Extend Proxy Modal ─── */}
      {renderExtendModal()}
    </div>
  );
}
