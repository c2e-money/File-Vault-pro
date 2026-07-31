import React, { useEffect, useState } from 'react';
import {
  Files,
  Download,
  Users,
  HardDrive,
  DollarSign,
  TrendingUp,
  Activity,
  Clock,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { AdminStats } from '../../types.js';
import { api } from '../../services/api.js';
import { formatBytes } from '../FileCard.js';

interface AdminOverviewProps {
  onOpenUpload: () => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ onOpenUpload }) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-zinc-400 font-semibold">Loading Admin Analytics...</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Total Downloads', value: stats.totalDownloads.toLocaleString(), icon: Download, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Total Files', value: stats.totalFiles.toLocaleString(), icon: Files, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Title & Refresh */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-white">Admin Dashboard</h2>
            <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Read-Only</span>
          </div>
          <p className="text-xs text-zinc-400">Read-only view for system user counts, file metrics, and download statistics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadStats}
            className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards Grid - Only 3 requested items */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="p-5 bg-zinc-900 border border-zinc-800/80 rounded-2xl space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">{c.label}</span>
                <div className={`p-2.5 rounded-xl ${c.bg} ${c.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-white">{c.value}</div>
            </div>
          );
        })}
      </div>

      {/* Analytics Chart */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-white">7-Day Download & Upload Traffic Trend</h3>
            <p className="text-xs text-zinc-400">Daily file stream counts across edge nodes</p>
          </div>
        </div>

        <div className="h-48 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-zinc-800">
          {stats.dailyDownloadsChart.map((d, i) => {
            const maxVal = Math.max(...stats.dailyDownloadsChart.map(x => x.downloads), 30);
            const heightPercent = Math.min(100, Math.round((d.downloads / maxVal) * 100));
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="text-[10px] text-indigo-400 font-bold opacity-0 group-hover:opacity-100 transition">
                  {d.downloads} dl
                </div>
                <div
                  className="w-full bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t-lg transition-all duration-500 group-hover:brightness-125"
                  style={{ height: `${Math.max(12, heightPercent)}%` }}
                />
                <span className="text-[10px] text-zinc-500 font-semibold">{d.date}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Uploads */}
        <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-purple-400" /> Recent File Uploads
          </h3>
          <div className="space-y-2">
            {stats.recentUploads.map((f) => (
              <div key={f.id} className="p-2.5 bg-zinc-950 border border-zinc-800/70 rounded-xl flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <h4 className="font-bold text-zinc-100 truncate">{f.originalName}</h4>
                  <p className="text-[11px] text-zinc-400">{formatBytes(f.fileSize)} • By {f.uploaderName}</p>
                </div>
                <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-semibold shrink-0">
                  {f.category}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Download Stream Logs */}
        <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" /> Live Download Stream Log
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {stats.recentDownloads.map((dl) => (
              <div key={dl.id} className="p-2.5 bg-zinc-950 border border-zinc-800/70 rounded-xl flex items-center justify-between text-xs">
                <div className="min-w-0">
                  <h4 className="font-bold text-zinc-200 truncate">{dl.fileName}</h4>
                  <p className="text-[11px] text-zinc-500">{dl.userName} ({dl.ipAddress})</p>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {new Date(dl.downloadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
