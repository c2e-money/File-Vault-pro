import React, { useState } from 'react';
import { X, UserCheck, Shield, KeyRound, Mail, User as UserIcon, AlertCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { User } from '../types.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { user } = await api.login(email, password);
        setLoading(false);
        onAuthSuccess(user);
        onClose();
      } else {
        const { user } = await api.register(username, email, password);
        setLoading(false);
        onAuthSuccess(user);
        onClose();
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {mode === 'login' ? 'Account Login' : 'Register Account'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              mode === 'login' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              mode === 'register' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Username</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="john_doe"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Email or Username</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

      </div>
    </div>
  );
};
