import React, { useEffect, useState } from 'react';
import { Settings, Save, HardDrive, ShieldAlert, CheckCircle, Clock } from 'lucide-react';
import { WebsiteSettings } from '../../types.js';
import { api } from '../../services/api.js';

export const AdminSettingsManager: React.FC = () => {
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [driveTesting, setDriveTesting] = useState(false);
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [githubTesting, setGithubTesting] = useState(false);
  const [githubStatus, setGithubStatus] = useState<any>(null);

  const testDriveConnection = async () => {
    setDriveTesting(true);
    setDriveStatus(null);
    try {
      if (settings) {
        await api.updateSettings(settings);
      }
      const res = await fetch('/api/admin/drive-status');
      const data = await res.json();
      setDriveStatus(data);
    } catch (err: any) {
      setDriveStatus({ status: 'ERROR', error: err.message || 'Failed to reach server' });
    } finally {
      setDriveTesting(false);
    }
  };

  const testGitHubConnection = async () => {
    setGithubTesting(true);
    setGithubStatus(null);
    try {
      if (settings) {
        await api.updateSettings(settings);
      }
      const adminToken = localStorage.getItem('filevault_admin_token') || localStorage.getItem('filevault_token') || '';
      const res = await fetch('/api/admin/github-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {}),
        },
        body: JSON.stringify({
          githubToken: settings?.githubToken || '',
          githubRepo: settings?.githubRepo || '',
          githubTag: settings?.githubTag || 'uploads',
        }),
      });
      const data = await res.json();
      setGithubStatus(data);
    } catch (err: any) {
      setGithubStatus({ status: 'ERROR', error: err.message || 'Failed to reach server' });
    } finally {
      setGithubTesting(false);
    }
  };

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
      // Auto test drive connection after saving
      testDriveConnection();
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

        {/* Support & Community Links (WhatsApp / Telegram) */}
        <div className="space-y-4 pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-extrabold">💬</span> WhatsApp & Telegram Support Channels
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">Live Configuration</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.012 2c-5.506 0-9.989 4.478-9.989 9.984 0 1.758.459 3.474 1.33 4.982L2 22l5.176-1.338c1.45.79 3.097 1.222 4.836 1.222 5.506 0 9.989-4.478 9.989-9.984s-4.483-9.984-9.989-9.984zm0 18.281c-1.503 0-2.981-.403-4.275-1.168l-.307-.182-3.176.821.849-3.093-.2-.318A8.257 8.257 0 0 1 3.722 11.98c0-4.57 3.719-8.284 8.29-8.284 4.571 0 8.29 3.714 8.29 8.284 0 4.571-3.719 8.281-8.29 8.281zm4.542-6.206c-.249-.125-1.472-.726-1.7-.809-.228-.083-.394-.125-.56.125-.166.249-.643.809-.788.975-.145.166-.29.187-.539.062a6.792 6.792 0 0 1-1.998-1.233 7.488 7.488 0 0 1-1.383-1.722c-.145-.249-.016-.384.109-.508.112-.112.249-.29.373-.435.125-.145.166-.249.249-.415.083-.166.042-.311-.021-.435-.062-.125-.56-1.349-.768-1.847-.203-.486-.41-.42-.56-.427h-.477c-.166 0-.435.062-.664.311-.228.249-.871.851-.871 2.075 0 1.224.892 2.407 1.016 2.573.125.166 1.756 2.682 4.254 3.761.594.257 1.058.41 1.42.525.597.19 1.141.163 1.571.099.479-.071 1.472-.602 1.68-1.183.208-.581.208-1.079.145-1.183-.063-.104-.228-.166-.477-.291z"/>
                </svg>
                <span>WhatsApp Support Phone Number</span>
              </div>
              <input
                type="text"
                placeholder="e.g. +918811896374"
                value={settings.whatsappNumber || ''}
                onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-emerald-300 font-mono font-semibold"
              />
              <p className="text-[10px] text-zinc-500">Number with country code (e.g. +918811896374). Controls floating chat button & support cards.</p>
            </div>

            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.38-.49 1.03-.75 4.03-1.75 6.72-2.91 8.08-3.48 3.85-1.6 4.65-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.22z"/>
                </svg>
                <span>Telegram VIP Channel / Group URL</span>
              </div>
              <input
                type="text"
                placeholder="e.g. https://t.me/+cOVh2XrT7nBlYTE1"
                value={settings.telegramChannelUrl || ''}
                onChange={(e) => setSettings({ ...settings, telegramChannelUrl: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-sky-300 font-mono font-semibold"
              />
              <p className="text-[10px] text-zinc-500">Full Telegram invite link. Controls VIP Join Telegram cards on download pages.</p>
            </div>
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
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 mb-2 font-semibold"
              >
                <option value="github">🚀 GitHub Releases Storage (100% Free Lifetime Storage & Unlimited Downloads)</option>
                <option value="gdrive">Google Drive Cloud API</option>
                <option value="local">Local Disk Server</option>
                <option value="r2">Cloudflare R2 Storage</option>
                <option value="s3">Amazon Web Services S3</option>
                <option value="dropbox">Dropbox API Storage</option>
                <option value="onedrive">Microsoft OneDrive API</option>
              </select>

              {/* GitHub Releases Configuration Card */}
              <div className="mt-3 p-3.5 bg-zinc-950 border border-emerald-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                    </span>
                    <div>
                      <span className="text-xs font-bold text-white block">GitHub Releases Storage (Free Lifetime)</span>
                      <span className="text-[10px] text-emerald-400 font-medium">2GB/File • Unlimited Bandwidth & Downloads • 0$ Forever</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={testGitHubConnection}
                    disabled={githubTesting}
                    className="px-2.5 py-1 bg-emerald-900/40 border border-emerald-700/50 hover:bg-emerald-800/50 text-emerald-200 text-[11px] font-semibold rounded-lg transition"
                  >
                    {githubTesting ? 'Checking...' : 'Test Connection'}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-0.5">
                      GitHub Personal Access Token (PAT)
                    </label>
                    <input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={settings.githubToken || ''}
                      onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-emerald-300 font-mono"
                    />
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Generate at <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-indigo-400 underline">github.com/settings/tokens</a> with <code className="text-emerald-400">repo</code> scope checked.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-300 mb-0.5">
                        GitHub Repository (owner/repo)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. username/my-file-storage"
                        value={settings.githubRepo || ''}
                        onChange={(e) => setSettings({ ...settings, githubRepo: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-300 mb-0.5">
                        Release Tag Container
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. uploads (default)"
                        value={settings.githubTag || ''}
                        onChange={(e) => setSettings({ ...settings, githubTag: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {githubStatus && (
                  <div className={`p-2.5 rounded-lg text-xs font-mono space-y-1.5 ${
                    githubStatus.status === 'CONNECTED' ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300' : 'bg-red-950/60 border border-red-800/60 text-red-300'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold">
                      {githubStatus.status === 'CONNECTED' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <span>Status: {githubStatus.status}</span>
                    </div>
                    {githubStatus.message && <div className="text-[11px] text-emerald-300 font-sans">{githubStatus.message}</div>}
                    {githubStatus.error && <div className="text-[11px] text-red-300 font-semibold font-sans">{githubStatus.error}</div>}
                  </div>
                )}
              </div>

              <div className="mt-3 p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3 opacity-80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-purple-400" /> Google Drive Configuration & Status
                  </span>
                  <button
                    type="button"
                    onClick={testDriveConnection}
                    disabled={driveTesting}
                    className="px-2.5 py-1 bg-purple-900/40 border border-purple-700/50 hover:bg-purple-800/50 text-purple-200 text-[11px] font-semibold rounded-lg transition"
                  >
                    {driveTesting ? 'Checking...' : 'Test Connection'}
                  </button>
                </div>

                {/* Google Drive Credentials Form */}
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-0.5">Google Drive Folder ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 1CM0Vq7SXrfaZsTHr4u8ufxqA2RLHT3ER"
                      value={settings.gdriveFolderId || ''}
                      onChange={(e) => setSettings({ ...settings, gdriveFolderId: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-0.5">OAuth Client ID (Optional for User Storage)</label>
                    <input
                      type="text"
                      placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                      value={settings.gdriveClientId || ''}
                      onChange={(e) => setSettings({ ...settings, gdriveClientId: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-0.5">OAuth Client Secret</label>
                      <input
                        type="password"
                        placeholder="OAuth Client Secret"
                        value={settings.gdriveClientSecret || ''}
                        onChange={(e) => setSettings({ ...settings, gdriveClientSecret: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400 mb-0.5">OAuth Refresh Token</label>
                      <input
                        type="password"
                        placeholder="OAuth Refresh Token"
                        value={settings.gdriveRefreshToken || ''}
                        onChange={(e) => setSettings({ ...settings, gdriveRefreshToken: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {driveStatus && (
                  <div className={`p-2.5 rounded-lg text-xs font-mono space-y-1.5 ${
                    driveStatus.status === 'CONNECTED' ? 'bg-emerald-950/50 border border-emerald-800/50 text-emerald-300' : 'bg-red-950/50 border border-red-800/50 text-red-300'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold">
                      {driveStatus.status === 'CONNECTED' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <span>Status: {driveStatus.status}</span>
                    </div>
                    {driveStatus.message && <div className="text-[11px] text-emerald-300">{driveStatus.message}</div>}
                    {driveStatus.authType && <div>Auth Mode: {driveStatus.authType}</div>}
                    {driveStatus.folderName && <div>Folder Name: {driveStatus.folderName} ({driveStatus.folderId})</div>}
                    {driveStatus.error && <div className="text-[11px] text-red-300 font-semibold">{driveStatus.error}</div>}
                    {driveStatus.solution && <div className="text-[11px] text-amber-300 font-sans mt-1 p-2 bg-amber-950/40 border border-amber-800/50 rounded">{driveStatus.solution}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* System Flags & Maintenance Mode */}
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div>
              <span className="text-xs text-white font-extrabold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" /> Maintenance Mode (साइट मेंटेनेंस पॉपअप)
              </span>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                When enabled, visitors, users, and download page visitors will see a maintenance popup notification pausing site operations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                settings.maintenanceMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {settings.maintenanceMode ? '🚧 Maintenance Active' : '🟢 Live (Normal)'}
              </span>
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-200 font-bold">Require User Login to Download</span>
              <p className="text-[11px] text-zinc-500">Force users to log in before downloading any shared files.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.requireLoginToDownload}
              onChange={(e) => setSettings({ ...settings, requireLoginToDownload: e.target.checked })}
              className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
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
