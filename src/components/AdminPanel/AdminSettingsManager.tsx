import React, { useEffect, useState } from 'react';
import { Settings, Save, HardDrive, ShieldAlert, CheckCircle, Clock } from 'lucide-react';
import { WebsiteSettings } from '../../types.js';
import { api } from '../../services/api.js';

export const AdminSettingsManager: React.FC = () => {
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then((data) => {
      setSettings(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);

    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-xs text-zinc-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl">
      <div>
        <h2 className="text-xl font-extrabold text-white">Website & Storage Settings</h2>
        <p className="text-xs text-zinc-400">Global site configuration, download timers, upload rules, and cloud storage drivers</p>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>Website settings saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-5">
        
        {/* Basic Brand Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">General Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Site Title</label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Header Announcement Notice</label>
              <input
                type="text"
                value={settings.headerNotice}
                onChange={(e) => setSettings({ ...settings, headerNotice: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Site Description</label>
            <textarea
              rows={2}
              value={settings.siteDescription}
              onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100"
            />
          </div>
        </div>

        {/* Upload & Download Limits */}
        <div className="space-y-4 pt-4 border-t border-zinc-800">
          <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Upload Rules & Download Timers</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Max Upload File Size (MB)</label>
              <input
                type="number"
                value={settings.maxUploadSizeMb}
                onChange={(e) => setSettings({ ...settings, maxUploadSizeMb: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Download Countdown Timer (Seconds)</label>
              <input
                type="number"
                value={settings.defaultDownloadTimer}
                onChange={(e) => setSettings({ ...settings, defaultDownloadTimer: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Active Storage Driver</label>
              <select
                value={settings.storageProvider}
                onChange={(e: any) => setSettings({ ...settings, storageProvider: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200"
              >
                <option value="local">Local Disk Server</option>
                <option value="r2">Cloudflare R2 Storage</option>
                <option value="s3">Amazon Web Services S3</option>
                <option value="gdrive">Google Drive Cloud API</option>
                <option value="dropbox">Dropbox API Storage</option>
                <option value="onedrive">Microsoft OneDrive API</option>
              </select>
            </div>
          </div>
        </div>

        {/* System Flags */}
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-300 font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Maintenance Mode
            </span>
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
              className="w-4 h-4 accent-purple-600 rounded"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-300 font-bold">Require User Login to Download</span>
            <input
              type="checkbox"
              checked={settings.requireLoginToDownload}
              onChange={(e) => setSettings({ ...settings, requireLoginToDownload: e.target.checked })}
              className="w-4 h-4 accent-purple-600 rounded"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

      </form>
    </div>
  );
};
