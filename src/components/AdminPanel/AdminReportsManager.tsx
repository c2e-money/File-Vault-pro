import React, { useEffect, useState } from 'react';
import { Flag, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Report } from '../../types.js';
import { api } from '../../services/api.js';

export const AdminReportsManager: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await api.getReports();
      setReports(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleUpdateStatus = async (id: string, status: 'resolved' | 'dismissed') => {
    try {
      await api.updateReportStatus(id, status);
      setReports(reports.map(r => r.id === id ? { ...r, status } : r));
    } catch (e: any) {
      alert(e.message || 'Update failed');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-xl font-extrabold text-white">File Moderation & Abuse Reports</h2>
        <p className="text-xs text-zinc-400">Review reported copyright issues, broken links, or malware warnings submitted by users</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">Reported File</th>
                <th className="p-4">Reason</th>
                <th className="p-4">Details</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">Loading reports...</td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">No moderation reports pending!</td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-800/40 transition">
                    <td className="p-4 font-bold text-white max-w-xs truncate">{r.fileName}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold rounded uppercase">
                        {r.reason}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-300">{r.details || 'No details provided'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                        r.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : r.status === 'resolved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-500 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      {r.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleUpdateStatus(r.id, 'resolved')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(r.id, 'dismissed')}
                            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[11px] rounded-lg"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
