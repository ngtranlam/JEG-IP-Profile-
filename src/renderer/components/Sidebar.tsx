import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Cloud, Settings, FolderOpen, LogOut, User } from 'lucide-react';
import iegLogo from '../assets/ieg_logo.png';

interface User {
  id: string;
  userName: string;
  fullName: string;
  email: string;
  roles: string;
}

interface SidebarProps {
  activeView: 'dashboard' | 'profiles' | 'folders';
  onViewChange: (view: 'dashboard' | 'profiles' | 'folders') => void;
  onLogout?: () => void;
  currentUser?: User | null;
}

export function Sidebar({ activeView, onViewChange, onLogout, currentUser }: SidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Check if user is Admin (roles="1")
  const isAdmin = currentUser?.roles === '1';
  
  // Base menu items
  const baseMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profiles', label: 'Profiles', icon: Cloud },
  ];
  
  // Add Folders tab only for Admin
  const menuItems = isAdmin 
    ? [...baseMenuItems, { id: 'folders', label: 'Folders', icon: FolderOpen }]
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
                  onClick={() => onViewChange(item.id as 'dashboard' | 'profiles' | 'folders')}
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
        {/* User Info */}
        {currentUser && (
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-100 rounded-full p-2">
                <User className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {currentUser.fullName}
                </p>
                <p className="text-xs text-gray-500">
                  {currentUser.roles === '1' ? 'Admin' : 'Seller'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="mr-3 h-4 w-4" />
            Logout
          </button>
        )}
        
        <div className="text-xs text-muted-foreground">
          Version 1.0.0
        </div>
      </div>

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
    </div>
  );
}
