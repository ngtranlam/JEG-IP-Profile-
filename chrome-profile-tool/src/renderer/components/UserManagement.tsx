import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Save, UserCheck, UserX, Lock, Unlock } from 'lucide-react';

interface User {
  id: number;
  userName: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  roles: string;
  status: string;
  created_at: string;
}

interface UserManagementProps {
  currentUser?: any;
}

export function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    userName: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
    address: '',
    roles: '3'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.localDataGetUsers();
      setUsers(result);
    } catch (error) {
      console.error('Failed to load users:', error);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setFormData({
      userName: '',
      password: '',
      fullName: '',
      email: '',
      phone: '',
      address: '',
      roles: '3'
    });
    setShowModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      userName: user.userName,
      password: '',
      fullName: user.fullName,
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      roles: user.roles
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingUser) {
        // Update user
        await window.electronAPI.localDataUpdateUser({
          id: editingUser.id,
          ...formData
        });
        alert('User updated successfully');
      } else {
        // Create user
        if (!formData.password) {
          alert('Password is required for new users');
          return;
        }
        await window.electronAPI.localDataCreateUser(formData);
        alert('User created successfully');
      }
      setShowModal(false);
      loadUsers();
    } catch (error: any) {
      console.error('Failed to save user:', error);
      alert(error.message || 'Failed to save user');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await window.electronAPI.localDataDeleteUser(userId);
      alert('User deleted successfully');
      loadUsers();
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      alert(error.message || 'Failed to delete user');
    }
  };

  const handleToggleStatus = async (userId: number) => {
    try {
      await window.electronAPI.localDataToggleUserStatus(userId);
      loadUsers();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      alert('Failed to toggle user status');
    }
  };

  const handleToggleLock = async (userId: number, currentStatus: string) => {
    const action = currentStatus === '1' ? 'lock' : 'unlock';
    if (!confirm(`Are you sure you want to ${action} this user's access?`)) return;

    try {
      // Optimistically update UI
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === userId 
            ? { ...u, status: u.status === '1' ? '0' : '1' }
            : u
        )
      );

      await window.electronAPI.localDataToggleUserStatus(userId);
      
      // Reload to ensure sync with backend
      await loadUsers();
    } catch (error: any) {
      console.error('Failed to toggle user lock:', error);
      alert(error.message || 'Failed to toggle user lock');
      // Reload on error to revert optimistic update
      await loadUsers();
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case '1': return 'Admin';
      case '2': return 'Leader';
      case '3': return 'Seller';
      default: return 'Unknown';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case '1': return 'bg-purple-100 text-purple-800';
      case '2': return 'bg-orange-100 text-orange-800';
      case '3': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-6 pb-4">
        <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
        <button
          onClick={handleCreateUser}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add User
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Full Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user, index) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.fullName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.userName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(user.roles)}`}>
                      {getRoleName(user.roles)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.status === '1' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.status === '1' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleToggleLock(user.id, user.status)}
                        disabled={user.id === currentUser?.id}
                        className={`${
                          user.status === '1' 
                            ? 'text-green-600 hover:text-green-900' 
                            : 'text-red-600 hover:text-red-900'
                        } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={user.status === '1' ? 'Lock user access' : 'Unlock user access'}
                      >
                        {user.status === '1' ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit user"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={user.id === currentUser?.id}
                        className={`text-red-600 hover:text-red-900 ${
                          user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Delete user"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={formData.userName}
                  onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {!editingUser && '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? 'Leave blank to keep current password' : ''}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  value={formData.roles}
                  onChange={(e) => setFormData({ ...formData, roles: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="1">Admin</option>
                  <option value="2">Leader</option>
                  <option value="3">Seller</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Save className="w-5 h-5" />
                {editingUser ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
