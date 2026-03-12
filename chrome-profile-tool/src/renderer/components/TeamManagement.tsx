import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, X, Save, Users, UserPlus, UserMinus, Crown, ChevronDown, ChevronRight, Search, Globe, FileText } from 'lucide-react';

interface User {
  id: number;
  userName: string;
  fullName: string;
  email: string;
  roles: string;
  status: string;
}

interface Team {
  id: number;
  name: string;
  leaderId: number | null;
  leaderName?: string;
  memberCount?: number;
  created_at?: string;
}

interface TeamMember {
  id: number;
  userId: number;
  userName: string;
  fullName: string;
  email: string;
  roles: string;
  isLeader: boolean;
}

interface TeamManagementProps {
  currentUser?: any;
}

export function TeamManagement({ currentUser }: TeamManagementProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<Record<number, TeamMember[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<number | null>(null);

  // Modal states
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState({ name: '', leaderId: '' });

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberTeamId, setAddMemberTeamId] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [totalProfiles, setTotalProfiles] = useState(0);

  const isAdmin = currentUser?.roles === '1';
  const isLeader = currentUser?.roles === '2';

  const loadTeams = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.teamsGetList();
      setTeams(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Failed to load teams:', error);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const result = await window.electronAPI.localDataGetUsers();
      setUsers(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  useEffect(() => {
    loadTeams();
    loadUsers();
  }, [loadTeams, loadUsers]);

  // Load total profiles count for leader
  useEffect(() => {
    if (isLeader && !isAdmin) {
      (async () => {
        try {
          const result = await window.electronAPI.localDataGetProfiles(1, 1);
          setTotalProfiles(result?.total || 0);
        } catch (e) {
          setTotalProfiles(0);
        }
      })();
    }
  }, [isLeader, isAdmin]);

  const loadTeamMembers = async (teamId: number) => {
    try {
      setLoadingMembers(teamId);
      const members = await window.electronAPI.teamsGetMembers(teamId);
      setTeamMembers(prev => ({ ...prev, [teamId]: Array.isArray(members) ? members : [] }));
    } catch (error) {
      console.error('Failed to load team members:', error);
      setTeamMembers(prev => ({ ...prev, [teamId]: [] }));
    } finally {
      setLoadingMembers(null);
    }
  };

  const toggleTeam = (teamId: number) => {
    if (expandedTeamId === teamId) {
      setExpandedTeamId(null);
    } else {
      setExpandedTeamId(teamId);
      if (!teamMembers[teamId]) {
        loadTeamMembers(teamId);
      }
    }
  };

  // Team CRUD
  const handleCreateTeam = () => {
    setEditingTeam(null);
    setTeamForm({ name: '', leaderId: '' });
    setShowTeamModal(true);
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamForm({ name: team.name, leaderId: team.leaderId?.toString() || '' });
    setShowTeamModal(true);
  };

  const handleSaveTeam = async () => {
    if (!teamForm.name.trim()) {
      alert('Team name is required');
      return;
    }
    try {
      const data: any = { name: teamForm.name.trim() };
      if (teamForm.leaderId) data.leaderId = parseInt(teamForm.leaderId);

      if (editingTeam) {
        await window.electronAPI.teamsUpdate(editingTeam.id, data);
      } else {
        await window.electronAPI.teamsCreate(data);
      }
      setShowTeamModal(false);
      await loadTeams();
    } catch (error: any) {
      alert(error.message || 'Failed to save team');
    }
  };

  const handleDeleteTeam = async (teamId: number) => {
    if (!confirm('Are you sure you want to delete this team? All members will be removed.')) return;
    try {
      await window.electronAPI.teamsDelete(teamId);
      if (expandedTeamId === teamId) setExpandedTeamId(null);
      await loadTeams();
    } catch (error: any) {
      alert(error.message || 'Failed to delete team');
    }
  };

  // Member management
  const handleOpenAddMember = (teamId: number) => {
    setAddMemberTeamId(teamId);
    setMemberSearch('');
    setSelectedMemberIds([]);
    setShowAddMemberModal(true);
  };

  const toggleSelectMember = (userId: number) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleConfirmAddMembers = async () => {
    if (!addMemberTeamId || selectedMemberIds.length === 0) return;
    setAddingMembers(true);
    try {
      const errors: string[] = [];
      for (const userId of selectedMemberIds) {
        try {
          await window.electronAPI.teamsAddMember(addMemberTeamId, userId);
        } catch (err: any) {
          errors.push(err.message || `Failed to add user ${userId}`);
        }
      }
      await loadTeamMembers(addMemberTeamId);
      await loadTeams();
      setShowAddMemberModal(false);
      if (errors.length > 0) {
        alert(`Some members could not be added:\n${errors.join('\n')}`);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to add members');
    } finally {
      setAddingMembers(false);
    }
  };

  const handleRemoveMember = async (teamId: number, userId: number) => {
    if (!confirm('Remove this member from the team?')) return;
    try {
      await window.electronAPI.teamsRemoveMember(teamId, userId);
      await loadTeamMembers(teamId);
      await loadTeams();
    } catch (error: any) {
      alert(error.message || 'Failed to remove member');
    }
  };

  const handleSetLeader = async (teamId: number, userId: number) => {
    try {
      await window.electronAPI.teamsUpdate(teamId, { leaderId: userId });
      await loadTeams();
      await loadTeamMembers(teamId);
    } catch (error: any) {
      alert(error.message || 'Failed to set leader');
    }
  };


  // Get users that are not in any team (available to add)
  const getAvailableUsers = () => {
    const membersInTeams = new Set<number>();
    Object.values(teamMembers).forEach(members => {
      members.forEach(m => membersInTeams.add(m.userId || m.id));
    });
    // Also check teams' leader IDs
    teams.forEach(t => { if (t.leaderId) membersInTeams.add(t.leaderId); });

    return users.filter(u => {
      if (u.roles === '1') return false; // Don't add admin to teams
      if (membersInTeams.has(u.id)) return false;
      if (memberSearch) {
        const search = memberSearch.toLowerCase();
        return u.fullName.toLowerCase().includes(search) || u.userName.toLowerCase().includes(search);
      }
      return true;
    });
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case '1': return 'Admin';
      case '2': return 'Leader';
      case '3': return 'Seller';
      default: return 'Member';
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

  const renderAddMemberModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">Add Team Members</h2>
          <button onClick={() => setShowAddMemberModal(false)} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Search users..."
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {getAvailableUsers().length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No available users to add</p>
            ) : (
              getAvailableUsers().map(user => {
                const isSelected = selectedMemberIds.includes(user.id);
                return (
                  <label
                    key={user.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectMember(user.id)}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{user.fullName}</span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
        <div className="flex justify-between items-center p-5 border-t">
          <span className="text-xs text-gray-500">{selectedMemberIds.length} user(s) selected</span>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddMemberModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAddMembers}
              disabled={selectedMemberIds.length === 0 || addingMembers}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              {addingMembers ? 'Adding...' : `Add ${selectedMemberIds.length > 0 ? selectedMemberIds.length + ' ' : ''}Member${selectedMemberIds.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading teams...</div>
      </div>
    );
  }

  // Leader Dashboard View
  if (isLeader && !isAdmin) {
    const myTeam = teams[0]; // Leader typically has one team
    const myMembers = myTeam ? (teamMembers[myTeam.id] || []) : [];

    // Auto-load members for leader's team
    if (myTeam && !teamMembers[myTeam.id] && loadingMembers !== myTeam.id) {
      loadTeamMembers(myTeam.id);
    }

    const memberCount = myTeam?.memberCount || myMembers.length;

    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Team</h1>
            </div>

            {!myTeam ? (
              <div className="text-center py-16 text-gray-500">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">You are not leading any team</p>
                <p className="text-sm mt-1">Contact admin to assign you a team</p>
              </div>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white shadow-lg shadow-orange-200/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <Crown className="w-5 h-5 text-orange-200" />
                        <span className="text-sm font-medium text-orange-100">Team</span>
                      </div>
                      <p className="text-2xl font-bold">{myTeam.name}</p>
                      <p className="text-orange-200 text-xs mt-1">You are the leader</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-orange-50 p-2 rounded-lg">
                        <Users className="w-4 h-4 text-orange-600" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mb-0.5">Members</p>
                    <p className="text-3xl font-bold text-gray-900">{memberCount}</p>
                    <p className="text-xs text-gray-400 mt-1">Team members</p>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-orange-50 p-2 rounded-lg">
                        <FileText className="w-4 h-4 text-orange-600" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mb-0.5">Total Profiles</p>
                    <p className="text-3xl font-bold text-gray-900">{totalProfiles}</p>
                    <p className="text-xs text-gray-400 mt-1">Team profiles</p>
                  </div>

                </div>

                {/* Team Members */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">Team Members</h2>
                    <button
                      onClick={() => handleOpenAddMember(myTeam.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Add Member
                    </button>
                  </div>
                  {loadingMembers === myTeam.id ? (
                    <div className="px-5 py-8 text-sm text-gray-500 text-center">Loading members...</div>
                  ) : myMembers.length === 0 ? (
                    <div className="px-5 py-8 text-sm text-gray-400 text-center">
                      <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      No members yet. Add your first team member.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {myMembers.map((member) => (
                        <div key={member.userId || member.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                              member.isLeader ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {(member.fullName || member.userName || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{member.fullName || member.userName}</span>
                                {member.isLeader && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                                    <Crown className="w-3 h-3" /> Leader
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!member.isLeader && (
                              <button
                                onClick={() => handleRemoveMember(myTeam.id, member.userId || member.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove from team"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Modals */}
        {showAddMemberModal && renderAddMemberModal()}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-6 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Team Management</h1>
        </div>
        {isAdmin && (
          <button
            onClick={handleCreateTeam}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Team
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {teams.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No teams yet</p>
            {isAdmin && <p className="text-sm mt-1">Create your first team to get started</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => {
              const isExpanded = expandedTeamId === team.id;
              const members = teamMembers[team.id] || [];
              const isLoadingThis = loadingMembers === team.id;

              return (
                <div key={team.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Team Header */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleTeam(team.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <div className="bg-orange-100 rounded-lg p-2">
                        <Users className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{team.name}</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          {team.leaderName && (
                            <span className="flex items-center gap-1">
                              <Crown className="w-3 h-3 text-orange-500" />
                              {team.leaderName}
                            </span>
                          )}
                          <span>{team.memberCount || 0} members</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {(isAdmin || isLeader) && (
                        <button
                          onClick={() => handleOpenAddMember(team.id)}
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Add member"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      )}
                      {(isAdmin || (isLeader && team.leaderId === currentUser?.id)) && (
                        <button
                          onClick={() => handleEditTeam(team)}
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Edit team"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete team"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Team Members */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {isLoadingThis ? (
                        <div className="px-5 py-4 text-sm text-gray-500 text-center">Loading members...</div>
                      ) : members.length === 0 ? (
                        <div className="px-5 py-4 text-sm text-gray-400 text-center">No members in this team</div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {members.map((member) => (
                            <div key={member.userId || member.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                  member.isLeader ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {(member.fullName || member.userName || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900">{member.fullName || member.userName}</span>
                                    {member.isLeader && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                                        <Crown className="w-3 h-3" /> Leader
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {(isAdmin || (isLeader && !member.isLeader)) && (
                                  <button
                                    onClick={() => handleRemoveMember(team.id, member.userId || member.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove from team"
                                  >
                                    <UserMinus className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {editingTeam ? 'Edit Team' : 'Create New Team'}
              </h2>
              <button onClick={() => setShowTeamModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Name *</label>
                <input
                  type="text"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter team name"
                />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team Leader</label>
                  <select
                    value={teamForm.leaderId}
                    onChange={(e) => setTeamForm({ ...teamForm, leaderId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">-- Select Leader --</option>
                    {users
                      .filter(u => u.roles !== '1' && u.status === '1')
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.fullName} ({u.userName})</option>
                      ))
                    }
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button
                onClick={() => setShowTeamModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTeam}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                {editingTeam ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && renderAddMemberModal()}

    </div>
  );
}
