import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Search, Edit3, Trash2, User, X } from 'lucide-react';

interface FolderItem {
  folder_id: string;
  name: string;
  seller_id?: number;
  seller_name?: string;
  profilesCount: number;
  created_at: string;
  updated_at: string;
}

interface Seller {
  id: number;
  userName: string;
  fullName?: string;
  email?: string;
}

interface FolderListTableProps {
  currentUser?: any;
}

export function FolderListTable({ currentUser }: FolderListTableProps) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState('');
  const [editFolderName, setEditFolderName] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');

  const isAdmin = currentUser?.roles === '1';

  useEffect(() => {
    syncAndLoadData();
  }, []);

  const syncAndLoadData = async () => {
    try {
      // Sync data from GoLogin first
      console.log('Syncing folders from GoLogin...');
      await window.electronAPI.localDataSync();
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Failed to sync data:', error);
      // Continue loading even if sync fails
    }
    
    // Load data after sync
    await loadData();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load folders from database
      const foldersData = await window.electronAPI.localDataGetFolders();
      setFolders(foldersData || []);
      
      // Load sellers list if admin
      if (isAdmin) {
        const sellersData = await window.electronAPI.localDataGetSellers();
        setSellers(sellersData || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setFolders([]);
      setSellers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await window.electronAPI.localDataCreateFolder(
        newFolderName.trim(),
        selectedSellerId ? parseInt(selectedSellerId) : undefined
      );
      
      setNewFolderName('');
      setSelectedSellerId('');
      setShowCreateModal(false);
      await loadData();
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder. Please try again.');
    }
  };

  const handleAssignSeller = async () => {
    if (!selectedFolderId || !selectedSellerId) return;

    try {
      await window.electronAPI.localDataAssignSeller(
        selectedFolderId,
        parseInt(selectedSellerId)
      );
      
      setSelectedFolderId('');
      setSelectedSellerId('');
      setShowAssignModal(false);
      await loadData();
    } catch (error) {
      console.error('Failed to assign seller:', error);
      alert('Failed to assign seller. Please try again.');
    }
  };

  const handleRemoveSeller = async (folderId: string) => {
    if (!confirm('Are you sure you want to remove the seller from this folder?')) return;

    try {
      await window.electronAPI.localDataRemoveSeller(folderId);
      await loadData();
    } catch (error) {
      console.error('Failed to remove seller:', error);
      alert('Failed to remove seller. Please try again.');
    }
  };

  const openAssignModal = (folderId: string) => {
    setSelectedFolderId(folderId);
    setSelectedSellerId('');
    setShowAssignModal(true);
  };

  const openEditModal = (folder: FolderItem) => {
    setSelectedFolderId(folder.folder_id);
    setEditFolderName(folder.name);
    setShowEditModal(true);
  };

  const handleEditFolder = async () => {
    if (!editFolderName.trim() || !selectedFolderId) return;

    try {
      await window.electronAPI.localDataUpdateFolder(
        selectedFolderId,
        editFolderName.trim()
      );
      
      setEditFolderName('');
      setSelectedFolderId('');
      setShowEditModal(false);
      // Load data without syncing to preserve local changes
      await loadData();
    } catch (error) {
      console.error('Failed to update folder:', error);
      alert('Failed to update folder. Please try again.');
    }
  };

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`Are you sure you want to delete the folder "${folderName}"? This action cannot be undone.`)) return;

    try {
      await window.electronAPI.localDataDeleteFolder(folderId);
      // Load data without syncing to preserve local changes
      await loadData();
    } catch (error) {
      console.error('Failed to delete folder:', error);
      alert('Failed to delete folder. Please try again.');
    }
  };

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    folder.seller_name?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold text-gray-900">Folders Management</h1>
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
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Folder
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-6 border-b bg-gray-50">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search folders or sellers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filteredFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <h3 className="text-lg font-medium mb-2">
              {searchTerm ? 'No folders match your search' : 'No folders found'}
            </h3>
            <p className="text-center mb-4">
              {searchTerm 
                ? 'Try adjusting your search terms.' 
                : isAdmin ? 'Create your first folder to get started.' : 'No folders have been assigned to you yet.'}
            </p>
            {!searchTerm && isAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Folder
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Folder Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned Seller
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profiles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFolders.map((folder) => (
                <tr key={folder.folder_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">
                        {folder.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {folder.seller_name ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          <User className="w-3 h-3" />
                          {folder.seller_name}
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleRemoveSeller(folder.folder_id)}
                            className="text-gray-400 hover:text-red-600"
                            title="Remove seller"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Not assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{folder.profilesCount}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(folder.updated_at).toLocaleDateString()}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openAssignModal(folder.folder_id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Assign seller"
                        >
                          <User className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(folder)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Edit folder"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFolder(folder.folder_id, folder.name)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete folder"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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
                  Assign to Seller (Optional)
                </label>
                <select
                  value={selectedSellerId}
                  onChange={(e) => setSelectedSellerId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- No seller --</option>
                  {sellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.fullName || seller.userName}
                    </option>
                  ))}
                </select>
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
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Folder Modal */}
      {showEditModal && (
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
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  placeholder="Enter folder name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
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
                onClick={handleEditFolder}
                disabled={!editFolderName.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Seller Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Assign Seller to Folder</h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Seller *
                </label>
                <select
                  value={selectedSellerId}
                  onChange={(e) => setSelectedSellerId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                >
                  <option value="">-- Select a seller --</option>
                  {sellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.fullName || seller.userName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSeller}
                disabled={!selectedSellerId}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Assign Seller
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
