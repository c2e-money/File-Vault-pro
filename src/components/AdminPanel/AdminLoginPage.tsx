import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowLeft, KeyRound, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.js';
import { User } from '../../types.js';

interface AdminLoginPageProps {
  onAdminAuthenticated: (adminUser: User) => void;
  onBackToSite: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onAdminAuthenticated,
  onBackToSite,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please provide your admin email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.adminLogin(email, password);
      setLoading(false);
      onAdminAuthenticated(res.user);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Authentication failed. Invalid admin credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        
        {/* Back to Public Site Link */}
        <button
          onClick={onBackToSite}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition group"
        >
          <ArrowLeft className="w-4 h-4 text-purple-400 group-hover:-translate-x-1 transition-transform" />
          <span>Return to Public Website</span>
        </button>

        {/* Login Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-6">
          
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 p-0.5 shadow-xl shadow-purple-600/20 flex items-center justify-center">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                <Shield className="w-7 h-7 text-purple-400" />
              </div>
            </div>

            <h1 className="text-2xl font-black text-white tracking-tight">Admin Console</h1>
            <p className="text-xs text-zinc-400">
              Restricted Portal. Authorized Administrators Only.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-purple-400" /> Admin Email / Username
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dipen8717@gmail.com"
                required
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-purple-400" /> Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/25 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Authenticate Admin</span>
                </>
              )}
            </button>

          </form>

          <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl text-[11px] text-purple-300/80 leading-relaxed text-center space-y-0.5">
            <p className="font-semibold text-purple-200">🔒 System Administrator Portal</p>
            <p>Access restricted to authorized administrators. Encrypted token authentication active.</p>
          </div>

        </div>

      </div>

    </div>
  );
};
