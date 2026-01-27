import React, { useState, useEffect } from 'react';
import { FolderOpen, Plus, Edit3, Trash2, Folder, RefreshCw, Search, X, User } from 'lucide-react';

interface FolderItem {
  folder_id: string;
  name: string;
  seller_id?: number;
  seller_name?: string;
  profilesCount: number;
  created_at: string;
  updated_at: string;
  synced_at: string;
}

interface Seller {
  id: number;
  userName: string;
  fullName?: string;
  email?: string;
}

interface FolderListProps {
  onFolderSelect?: (folderId: string) => void;
  currentUser?: any;
}

export function FolderList({ onFolderSelect }: FolderListProps) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');

  const folderColors = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-purple-100 text-purple-800',
    'bg-yellow-100 text-yellow-800',
    'bg-red-100 text-red-800',
    'bg-indigo-100 text-indigo-800',
    'bg-pink-100 text-pink-800',
    'bg-gray-100 text-gray-800',
  ];

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const foldersData = await window.electronAPI.gologinListFolders();
      
      // Transform API data to match our interface
      const transformedFolders: FolderItem[] = (foldersData || []).map((folder: any, index: number) => ({
        id: folder.id || folder._id || `folder-${index}`,
        name: folder.name || folder.title || `Folder ${index + 1}`,
        description: folder.description || folder.notes || '',
        profilesCount: folder.profilesCount || folder.profileCount || folder.profiles?.length || 0,
        color: folderColors[index % folderColors.length],
        createdAt: folder.createdAt || folder.created_at || new Date().toISOString(),
        updatedAt: folder.updatedAt || folder.updated_at || new Date().toISOString(),
      }));
      
      setFolders(transformedFolders);
      
      // If no folders from API, show default
      if (transformedFolders.length === 0) {
        setFolders([
          {
            id: 'default',
            name: 'Default Folder',
            description: 'Default folder for organizing profiles',
            profilesCount: 0,
            color: folderColors[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
      // Show default folder on error
      setFolders([
        {
          id: 'default',
          name: 'Default Folder',
          description: 'Default folder for organizing profiles',
          profilesCount: 0,
          color: folderColors[0],
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
      await loadFolders();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await window.electronAPI.gologinCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setNewFolderDescription('');
      setShowCreateModal(false);
      await loadFolders();
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder. Please try again.');
    }
  };

  const handleEditFolder = (folder: FolderItem) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
    setNewFolderDescription(folder.description || '');
    setShowEditModal(true);
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) return;

    try {
      // Note: GoLogin API might not have update folder endpoint, this is a placeholder
      console.log('Updating folder:', editingFolder.id, newFolderName);
      
      // Update local state for now
      setFolders(prev => prev.map(f => 
        f.id === editingFolder.id 
          ? { ...f, name: newFolderName, description: newFolderDescription, updatedAt: new Date().toISOString() }
          : f
      ));
      
      setNewFolderName('');
      setNewFolderDescription('');
      setEditingFolder(null);
      setShowEditModal(false);
    } catch (error) {
      console.error('Failed to update folder:', error);
      alert('Failed to update folder. Please try again.');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder? This action cannot be undone.')) return;

    try {
      // Note: GoLogin API might not have delete folder endpoint, this is a placeholder
      console.log('Deleting folder:', folderId);
      
      // Update local state for now
      setFolders(prev => prev.filter(f => f.id !== folderId));
      
      if (selectedFolder === folderId) {
        setSelectedFolder('');
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
      alert('Failed to delete folder. Please try again.');
    }
  };

  const handleFolderSelect = (folderId: string) => {
    setSelectedFolder(folderId);
    if (onFolderSelect) {
      onFolderSelect(folderId);
    }
  };

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    folder.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading folders...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Folders</h1>
          <p className="text-gray-600 mt-1">Organize your GoLogin profiles into folders</p>
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Folder
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-6 border-b bg-gray-50">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search folders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Folder List */}
      <div className="flex-1 overflow-auto p-6">
        {filteredFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FolderOpen className="w-16 h-16 mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchTerm ? 'No folders match your search' : 'No folders found'}
            </h3>
            <p className="text-center mb-4">
              {searchTerm 
                ? 'Try adjusting your search terms.' 
                : 'Create your first folder to organize your profiles.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Folder
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredFolders.map((folder) => (
              <div
                key={folder.id}
                className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                  selectedFolder === folder.id ? 'ring-2 ring-blue-500 border-blue-200' : ''
                }`}
                onClick={() => handleFolderSelect(folder.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${folder.color}`}>
                      <Folder className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {folder.name}
                      </h3>
                      <div className="text-sm text-gray-500">
                        {folder.profilesCount} profiles
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditFolder(folder);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 rounded"
                      title="Edit folder"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      title="Delete folder"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {folder.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {folder.description}
                  </p>
                )}

                <div className="text-xs text-gray-500">
                  Updated {new Date(folder.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create New Folder</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Folder Name *
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  placeholder="Enter folder description (optional)"
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Folder Modal */}
      {showEditModal && editingFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Folder</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Folder Name *
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  placeholder="Enter folder description (optional)"
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Update Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
