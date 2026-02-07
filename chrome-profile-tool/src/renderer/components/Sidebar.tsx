import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Cloud, Settings, FolderOpen, LogOut, User, Users, KeyRound, ChevronDown, UserCog, Shield, Mail, Calendar, Eye, EyeOff } from 'lucide-react';
import iegLogo from '../assets/Layer2.png';
import { TwoFactorSetup } from './TwoFactorSetup';

interface User {
  id: string;
  userName: string;
  fullName: string;
  email: string;
  roles: string;
}

interface SidebarProps {
  activeView: 'dashboard' | 'profiles' | 'folders' | 'users';
  onViewChange: (view: 'dashboard' | 'profiles' | 'folders' | 'users') => void;
  onLogout?: () => void;
  currentUser?: User | null;
}

export function Sidebar({ activeView, onViewChange, onLogout, currentUser }: SidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  // Check if user is Admin (roles="1")
  const isAdmin = currentUser?.roles === '1';

  // Check 2FA status from currentUser
  useEffect(() => {
    if (currentUser) {
      console.log('[Sidebar] Current user:', currentUser);
      console.log('[Sidebar] is2FAEnabled value:', (currentUser as any).is2FAEnabled);
      setIs2FAEnabled((currentUser as any).is2FAEnabled === true);
    }
  }, [currentUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChangePassword = async () => {
    setErrorMessage('');

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    try {
      await window.electronAPI.auth.changePassword(oldPassword, newPassword);
      alert('Password changed successfully');
      setShowChangePassword(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMessage('');
    } catch (error: any) {
      // Extract clean error message, removing "Error invoking remote method" prefix
      let errorMsg = error.message || 'Failed to change password';
      if (errorMsg.includes('Error:')) {
        errorMsg = errorMsg.split('Error:').pop()?.trim() || errorMsg;
      }
      setErrorMessage(errorMsg);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('Are you sure you want to disable Two-Factor Authentication? This will make your account less secure.')) {
      return;
    }

    try {
      await window.electronAPI.auth.disable2FA();
      setIs2FAEnabled(false);
      alert('Two-Factor Authentication has been disabled successfully');
    } catch (error: any) {
      let errorMsg = error.message || 'Failed to disable 2FA';
      if (errorMsg.includes('Error:')) {
        errorMsg = errorMsg.split('Error:').pop()?.trim() || errorMsg;
      }
      alert('Error: ' + errorMsg);
    }
  };
  
  // Base menu items
  const baseMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profiles', label: 'Profiles', icon: Cloud },
  ];
  
  // Add Folders and Users tabs only for Admin
  const menuItems = isAdmin 
    ? [...baseMenuItems, 
       { id: 'folders', label: 'Folders', icon: FolderOpen },
       { id: 'users', label: 'Users', icon: Users }
      ]
    : baseMenuItems;

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border flex justify-center">
        <img 
          src={iegLogo} 
          alt="JEG Logo" 
          className="h-24 w-auto object-contain"
        />
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id as 'dashboard' | 'profiles' | 'folders' | 'users')}
                  className={`w-full flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-border space-y-3">
        {/* User Info with Dropdown Menu */}
        {currentUser && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full bg-gray-50 rounded-lg p-3 mb-3 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-100 rounded-full p-2">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {currentUser.fullName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {currentUser.roles === '1' ? 'Admin' : 'Seller'}
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowAccountSettings(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <UserCog className="h-4 w-4" />
                  Account Settings
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowChangePassword(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                >
                  <KeyRound className="h-4 w-4" />
                  Change Password
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-200"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          Version 1.0.0
        </div>
      </div>

      {/* Account Settings Modal */}
      {showAccountSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="bg-indigo-100 rounded-full p-2 mr-3">
                  <UserCog className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Account Settings
                </h3>
              </div>
              <button
                onClick={() => setShowAccountSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            {/* Account Information Section */}
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Personal Information
                </h4>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <div className="w-32 text-sm text-gray-600">Full Name:</div>
                    <div className="flex-1 text-sm font-medium text-gray-900">
                      {currentUser?.fullName}
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-32 text-sm text-gray-600">Username:</div>
                    <div className="flex-1 text-sm font-medium text-gray-900">
                      {currentUser?.userName}
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-32 text-sm text-gray-600">
                      <Mail className="h-3 w-3 inline mr-1" />
                      Email:
                    </div>
                    <div className="flex-1 text-sm font-medium text-gray-900">
                      {currentUser?.email || 'Not set'}
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="w-32 text-sm text-gray-600">Role:</div>
                    <div className="flex-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        currentUser?.roles === '1' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {currentUser?.roles === '1' ? 'Administrator' : 'Seller'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Section - 2FA */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <Shield className="h-4 w-4 mr-2" />
                  Security Settings
                </h4>
                
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <h5 className="text-sm font-medium text-gray-900">Two-Factor Authentication (2FA)</h5>
                      {is2FAEnabled && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Enabled
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (!is2FAEnabled) {
                          // Open setup modal when enabling
                          setShow2FASetup(true);
                        } else {
                          // Call handler to disable 2FA
                          handleDisable2FA();
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        is2FAEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          is2FAEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowAccountSettings(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-full p-2 mr-3">
                  <KeyRound className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Change Password
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowChangePassword(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setErrorMessage('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showOldPassword ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onMouseDown={() => setShowOldPassword(true)}
                    onMouseUp={() => setShowOldPassword(false)}
                    onMouseLeave={() => setShowOldPassword(false)}
                    onTouchStart={() => setShowOldPassword(true)}
                    onTouchEnd={() => setShowOldPassword(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showOldPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onMouseDown={() => setShowNewPassword(true)}
                    onMouseUp={() => setShowNewPassword(false)}
                    onMouseLeave={() => setShowNewPassword(false)}
                    onTouchStart={() => setShowNewPassword(true)}
                    onTouchEnd={() => setShowNewPassword(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onMouseDown={() => setShowConfirmPassword(true)}
                    onMouseUp={() => setShowConfirmPassword(false)}
                    onMouseLeave={() => setShowConfirmPassword(false)}
                    onTouchStart={() => setShowConfirmPassword(true)}
                    onTouchEnd={() => setShowConfirmPassword(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowChangePassword(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setErrorMessage('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4 shadow-xl">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 rounded-full p-2 mr-3">
                <LogOut className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Confirm Logout
              </h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to logout? You will need to login again to access the application.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout?.();
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two-Factor Setup Modal */}
      {show2FASetup && (
        <TwoFactorSetup
          onSetupComplete={() => {
            setShow2FASetup(false);
            setIs2FAEnabled(true);
            setShowAccountSettings(false);
          }}
          onCancel={() => setShow2FASetup(false)}
        />
      )}
    </div>
  );
}
