import React from 'react';
import { LayoutDashboard, Cloud, Settings, FolderOpen } from 'lucide-react';
import iegLogo from '../assets/ieg_logo.png';

interface SidebarProps {
  activeView: 'dashboard' | 'profiles' | 'folders';
  onViewChange: (view: 'dashboard' | 'profiles' | 'folders') => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profiles', label: 'Profiles', icon: Cloud },
    { id: 'folders', label: 'Folders', icon: FolderOpen },
  ];

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
      
      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground">
          Version 1.0.0
        </div>
      </div>
    </div>
  );
}
