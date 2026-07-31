import React, { useEffect, useState } from 'react';
import { User } from '../../types.js';
import { api } from '../../services/api.js';
import { Search, ShieldAlert, ShieldCheck, UserCheck, UserX, RefreshCw, Users, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

interface AdminUsersManagerProps {
  currentUser?: User | null;
}

export const AdminUsersManager: React.FC<AdminUsersManagerProps> = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
      setActionMessage({ type: 'error', text: 'Failed to load user accounts.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'banned' : 'active';
    setUpdatingUserId(user.id);
    setActionMessage(null);
    try {
      const updated = await api.updateUser(user.id, { status: newStatus });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: updated.status } : u));
      setActionMessage({
        type: 'success',
        text: `User ${user.username} account is now ${newStatus.toUpperCase()}`
      });
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to update user status'
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleToggleRole = async (user: User) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    setUpdatingUserId(user.id);
    setActionMessage(null);
    try {
      const updated = await api.updateUser(user.id, { role: newRole });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: updated.role } : u));
      setActionMessage({
        type: 'success',
        text: `User ${user.username} role changed to ${newRole.toUpperCase()}`
      });
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to update user role'
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    const usernameStr = (u.username || '').toLowerCase();
    const emailStr = (u.email || '').toLowerCase();
    const idStr = (u.id || '').toLowerCase();

    const matchesSearch =
      usernameStr.includes(query) ||
      emailStr.includes(query) ||
      idStr.includes(query);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter || (statusFilter === 'active' && !u.status);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalUsers = users.length;
  const activeCount = users.filter(u => u.status === 'active' || !u.status).length;
  const bannedCount = users.filter(u => u.status === 'banned').length;
  const adminCount = users.filter(u => u.role === 'admin').length;

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Page Title & Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-white tracking-tight">Registered Accounts</h2>
            <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Management
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">Manage user roles, ban/activate accounts, and inspect registration details.</p>
        </div>

        <button
          onClick={loadUsers}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
          actionMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3.5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Total Users</p>
            <p className="text-base font-extrabold text-white">{totalUsers}</p>
          </div>
        </div>

        <div className="p-3.5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Active</p>
            <p className="text-base font-extrabold text-emerald-400">{activeCount}</p>
          </div>
        </div>

        <div className="p-3.5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl flex items-center gap-3">
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20 shrink-0">
            <UserX className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Banned</p>
            <p className="text-base font-extrabold text-rose-400">{bannedCount}</p>
          </div>
        </div>

        <div className="p-3.5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20 shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Admins</p>
            <p className="text-base font-extrabold text-purple-300">{adminCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls Bar */}
      <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-2xl flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="flex-1 md:flex-none bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admins Only</option>
            <option value="user">Regular Users</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="flex-1 md:flex-none bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="banned">Banned Only</option>
          </select>
        </div>
      </div>

      {/* Mobile Card List View (visible on mobile screens) */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-900 border border-zinc-800 rounded-2xl">
            Loading user directory...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-900 border border-zinc-800 rounded-2xl">
            No matching user accounts found.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isUpdating = updatingUserId === u.id;
            const isRootAdmin = u.id === 'usr-admin-1' || u.email === 'dipen8717@gmail.com';
            return (
              <div key={u.id} className="p-3.5 bg-zinc-900 border border-zinc-800/90 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={u.username}
                      className="w-10 h-10 rounded-xl object-cover border border-zinc-700 shrink-0"
                    />
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                        <span>{u.username}</span>
                        {isRootAdmin && (
                          <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold border border-purple-500/30">ROOT</span>
                        )}
                      </h3>
                      <p className="text-xs text-zinc-400 break-all">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                      u.role === 'admin'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {u.role.toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                      u.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {u.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/60">
                  <span>Joined: {new Date(u.createdAt).toLocaleDateString()}</span>
                  <span>ID: {u.id.substring(0, 10)}</span>
                </div>

                {/* Mobile Action Buttons */}
                {!isRootAdmin && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleToggleStatus(u)}
                      disabled={isUpdating}
                      className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        u.status === 'active'
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20'
                      }`}
                    >
                      {u.status === 'active' ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      <span>{u.status === 'active' ? 'Ban User' : 'Activate'}</span>
                    </button>

                    <button
                      onClick={() => handleToggleRole(u)}
                      disabled={isUpdating}
                      className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                    >
                      <Shield className="w-3.5 h-3.5 text-purple-400" />
                      <span>{u.role === 'admin' ? 'Make User' : 'Make Admin'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View (visible on medium+ screens) */}
      <div className="hidden md:block bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">Loading user accounts...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">No user accounts matched your search.</td>
                </tr>
              ) : filteredUsers.map((u) => {
                const isUpdating = updatingUserId === u.id;
                const isRootAdmin = u.id === 'usr-admin-1' || u.email === 'dipen8717@gmail.com';
                return (
                  <tr key={u.id} className="hover:bg-zinc-800/40 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={u.username}
                          className="w-8 h-8 rounded-xl object-cover border border-zinc-700"
                        />
                        <div>
                          <p className="font-bold text-zinc-100 flex items-center gap-1.5">
                            <span>{u.username}</span>
                            {isRootAdmin && (
                              <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-bold border border-purple-500/30">ROOT</span>
                            )}
                          </p>
                          <p className="text-[10px] text-zinc-500">{u.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-zinc-300">{u.email}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md ${
                        u.role === 'admin'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md ${
                        u.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {u.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      {!isRootAdmin ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={isUpdating}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                              u.status === 'active'
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20'
                            }`}
                          >
                            {u.status === 'active' ? 'Ban' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleToggleRole(u)}
                            disabled={isUpdating}
                            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[11px] font-bold transition border border-zinc-700/60"
                          >
                            {u.role === 'admin' ? 'Make User' : 'Make Admin'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-500 italic">Protected</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

