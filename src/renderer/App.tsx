import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { GoLoginProfileList } from './components/GoLoginProfileList';
import { FolderList } from './components/FolderList';
import { Sidebar } from './components/Sidebar';

type ActiveView = 'dashboard' | 'profiles' | 'folders';

function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [loading, setLoading] = useState(true);
  const [goLoginStats, setGoLoginStats] = useState({
    totalProfiles: 0,
    runningProfiles: 0,
    connectionStatus: false
  });

  useEffect(() => {
    loadGoLoginData();
  }, []);

  const loadGoLoginData = async () => {
    try {
      setLoading(true);
      // Test connection
      const connectionStatus = await window.electronAPI.gologinTestConnection();
      
      // Get profile stats
      const profilesData = await window.electronAPI.gologinListProfiles(1);
      
      setGoLoginStats({
        totalProfiles: profilesData.total || 0,
        runningProfiles: 0, // TODO: Track running profiles
        connectionStatus
      });
    } catch (error) {
      console.error('Failed to load GoLogin data:', error);
      setGoLoginStats(prev => ({ ...prev, connectionStatus: false }));
    } finally {
      setLoading(false);
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
        return <Dashboard goLoginStats={goLoginStats} onRefresh={loadGoLoginData} />;
      case 'profiles':
        return (
          <GoLoginProfileList
            onProfileLaunch={(profileId) => console.log('GoLogin profile launched:', profileId)}
            onRefresh={loadGoLoginData}
          />
        );
      case 'folders':
        return (
          <FolderList
            onFolderSelect={(folderId) => console.log('Folder selected:', folderId)}
          />
        );
      default:
        return <Dashboard goLoginStats={goLoginStats} onRefresh={loadGoLoginData} />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
