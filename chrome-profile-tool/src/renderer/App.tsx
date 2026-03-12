import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { GoLoginProfileList } from './components/GoLoginProfileList';
import { FolderListTable } from './components/FolderListTable';
import { UserManagement } from './components/UserManagement';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { ForcePasswordChange } from './components/ForcePasswordChange';
import { TwoFactorVerification } from './components/TwoFactorVerification';

type ActiveView = 'dashboard' | 'profiles' | 'folders' | 'users';

function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [require2FA, setRequire2FA] = useState(false);
  const [pendingUserName, setPendingUserName] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [goLoginStats, setGoLoginStats] = useState({
    totalProfiles: 0,
    runningProfiles: 0,
    connectionStatus: false
  });

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadGoLoginData();
    }
  }, [isAuthenticated]);

  const checkAuthentication = async () => {
    try {
      setCheckingAuth(true);
      const authenticated = await window.electronAPI.auth.isAuthenticated();
      
      if (authenticated) {
        const user = await window.electronAPI.auth.validateToken();
        if (user) {
          // Check if password change is required
          if ((user as any).requirePasswordChange) {
            console.log('Password change required on reload');
            setRequirePasswordChange(true);
            setPendingUserName((user as any).userName || '');
            setIsAuthenticated(false);
            setCurrentUser(null);
            // Logout to clear session
            await window.electronAPI.auth.logout();
          } else {
            setIsAuthenticated(true);
            setCurrentUser(user);
            console.log('User authenticated:', user);
          }
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const loadGoLoginData = async () => {
    try {
      setLoading(true);
      // Test connection
      const connectionStatus = await window.electronAPI.gologinTestConnection();
      
      // Get stats from database with role-based filtering
      const stats = await window.electronAPI.localDataGetStats();
      
      setGoLoginStats({
        totalProfiles: stats?.total_profiles || 0,
        runningProfiles: stats?.running_profiles || 0,
        connectionStatus
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      setGoLoginStats(prev => ({ ...prev, connectionStatus: false }));
    } finally {
      setLoading(false);
    }
  };


  const handleLoginSuccess = async (loginResult?: any) => {
    // Check if password change is required (first login with default password)
    if (loginResult?.requirePasswordChange) {
      setRequirePasswordChange(true);
      setPendingUserName(loginResult.userName);
      setPendingPassword(loginResult.currentPassword || '');
      return;
    }

    // Check if 2FA is required
    if (loginResult?.require2FA) {
      setRequire2FA(true);
      setPendingUserName(loginResult.userName);
      return;
    }

    // Normal login flow
    setIsAuthenticated(true);
    // Get user info after successful login - use validateToken to get full user data including is2FAEnabled
    try {
      const userData = await window.electronAPI.auth.validateToken();
      console.log('[App] Setting currentUser after login:', userData);
      console.log('[App] is2FAEnabled value:', userData?.is2FAEnabled);
      setCurrentUser(userData);
    } catch (error) {
      console.error('Failed to get current user:', error);
    }
  };

  const handlePasswordChanged = async () => {
    setRequirePasswordChange(false);
    // After password change, check if 2FA is required
    // For now, proceed to normal login
    setIsAuthenticated(true);
    try {
      const user = await window.electronAPI.auth.getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Failed to get current user:', error);
    }
  };

  const handle2FAVerified = async (loginResult?: any) => {
    setRequire2FA(false);
    setIsAuthenticated(true);
    try {
      // Use validateToken to get full user data including is2FAEnabled
      const userData = await window.electronAPI.auth.validateToken();
      console.log('[App] Setting currentUser after 2FA verification:', userData);
      console.log('[App] is2FAEnabled value:', userData?.is2FAEnabled);
      setCurrentUser(userData);
    } catch (error) {
      console.error('Failed to get current user:', error);
    }
  };

  const handleCancelAuth = () => {
    setRequirePasswordChange(false);
    setRequire2FA(false);
    setPendingUserName('');
  };

  const handleLogout = async () => {
    try {
      await window.electronAPI.auth.logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
      setActiveView('dashboard');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-lg">Loading GoLogin data...</div>
        </div>
      );
    }

    switch (activeView) {
      case 'dashboard':
        return (
          <Dashboard
            goLoginStats={goLoginStats}
            onRefresh={loadGoLoginData}
            currentUser={currentUser}
            onViewChange={(view: ActiveView) => {
              setActiveView(view);
              if (view !== 'profiles') setSelectedFolderId('');
            }}
            onSelectFolder={(folderId: string) => {
              setSelectedFolderId(folderId);
              setActiveView('profiles');
            }}
          />
        );
      case 'profiles':
        return (
          <GoLoginProfileList
            onProfileLaunch={(profileId) => console.log('GoLogin profile launched:', profileId)}
            onRefresh={loadGoLoginData}
            currentUser={currentUser}
            initialFolderId={selectedFolderId}
          />
        );
      case 'folders':
        return (
          <FolderListTable
            currentUser={currentUser}
          />
        );
      case 'users':
        return (
          <UserManagement
            currentUser={currentUser}
          />
        );
      default:
        return (
          <Dashboard
            goLoginStats={goLoginStats}
            onRefresh={loadGoLoginData}
            currentUser={currentUser}
            onViewChange={(view: ActiveView) => {
              setActiveView(view);
              if (view !== 'profiles') setSelectedFolderId('');
            }}
            onSelectFolder={(folderId: string) => {
              setSelectedFolderId(folderId);
              setActiveView('profiles');
            }}
          />
        );
    }
  };

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show force password change if required
  if (requirePasswordChange) {
    return (
      <ForcePasswordChange
        userName={pendingUserName}
        currentPassword={pendingPassword}
        onPasswordChanged={handlePasswordChanged}
        onCancel={handleCancelAuth}
      />
    );
  }

  // Show 2FA verification if required
  if (require2FA) {
    return (
      <TwoFactorVerification
        userName={pendingUserName}
        onVerificationSuccess={handle2FAVerified}
        onCancel={handleCancelAuth}
      />
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Show main app if authenticated
  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        activeView={activeView} 
        onViewChange={(view) => {
          setActiveView(view);
          setSelectedFolderId('');
        }}
        onLogout={handleLogout}
        currentUser={currentUser}
      />
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
