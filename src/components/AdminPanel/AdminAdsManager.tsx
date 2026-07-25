import React, { useState } from 'react';
import {
  Megaphone,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Eye,
  Code,
  Sparkles,
  MousePointer,
  BarChart2,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-react';
import { Advertisement, AdType } from '../../types.js';
import { api } from '../../services/api.js';
import { AdDisplay } from '../AdDisplay.js';

interface AdminAdsManagerProps {
  ads: Advertisement[];
  onRefreshAds: () => void;
}

export const AdminAdsManager: React.FC<AdminAdsManagerProps> = ({ ads, onRefreshAds }) => {
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AdType>('banner');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('header_top');
  const [isEnabled, setIsEnabled] = useState(true);

  const [saving, setSaving] = useState(false);

  const adTypeOptions: { type: AdType; label: string; desc: string }[] = [
    { type: 'banner', label: 'Banner Ads', desc: 'Header, Footer & Sidebar 728x90 / 300x250 leaderboards' },
    { type: 'native', label: 'Native Ads', desc: 'Blends seamlessly into download pages and file grids' },
    { type: 'sticky', label: 'Sticky Banner', desc: 'Floats persistently at the bottom of the user viewport' },
    { type: 'popunder', label: 'Popunder Ads', desc: 'Triggers clean background window under main app' },
    { type: 'smartlink', label: 'Smart Link', desc: 'Monetized direct download redirect links' },
    { type: 'socialbar', label: 'Social Bar', desc: 'Push notification style alert cards' },
    { type: 'interstitial', label: 'Interstitial Ads', desc: 'Full-screen overlay before download unlock' },
    { type: 'popup', label: 'Popup Ads', desc: 'Modal dialog sponsor overlays' },
  ];

  const applyAdsterraTemplate = (templateType: AdType) => {
    setType(templateType);
    if (templateType === 'banner') {
      setTitle('Banner Unit (468x60)');
      setLocation('download_page_top');
      setCode(`<script type="text/javascript">
\tatOptions = {
\t\t'key' : '7e7c02ee62652ec8bf5c47225c4cddec',
\t\t'format' : 'iframe',
\t\t'height' : 60,
\t\t'width' : 468,
\t\t'params' : {}
\t};
</script>
<script type="text/javascript" src="https://rightyrely.com/7e7c02ee62652ec8bf5c47225c4cddec/invoke.js"></script>`);
    } else if (templateType === 'popunder') {
      setTitle('Popunder Script');
      setLocation('download_page');
      setCode('<script src="https://rightyrely.com/0a/44/b9/0a44b90796d94943a2537dad9f2592d0.js"></script>');
    } else if (templateType === 'socialbar') {
      setTitle('Social Bar Unit');
      setLocation('download_page');
      setCode('<script src="https://rightyrely.com/96/b3/8d/96b38d2a9c3702f149bd60e4800e311b.js"></script>');
    } else if (templateType === 'smartlink') {
      setTitle('Smart Link Direct URL');
      setLocation('download_button');
      setCode('https://rightyrely.com/cu96f0bz3h?key=09cf79c98298c393e20ad910f6953bf7');
    } else if (templateType === 'native') {
      setTitle('Native Banner Unit');
      setLocation('download_page_middle');
      setCode(`<script async="async" data-cfasync="false" src="https://rightyrely.com/dbaf6128171b01f81aaa66b44edd673e/invoke.js"></script>
<div id="container-dbaf6128171b01f81aaa66b44edd673e"></div>`);
    } else if (templateType === 'sticky') {
      setTitle('Sticky Footer Smart Link Banner');
      setLocation('global_sticky_bottom');
      setCode(`<div class="p-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between text-xs text-zinc-200">
  <span>⚡ <strong>High-Speed Cloud Mirror:</strong> Premium Resume Storage Node</span>
  <a href="https://rightyrely.com/cu96f0bz3h?key=09cf79c98298c393e20ad910f6953bf7" target="_blank" class="px-3 py-1 bg-amber-500 text-zinc-950 font-bold rounded-lg">Download Mirror</a>
</div>`);
    }
  };

  const handleOpenNew = () => {
    setSelectedAd(null);
    setTitle('New ' + type.toUpperCase() + ' Ad Unit');
    setCode('<div className="p-4 bg-zinc-800 border border-zinc-700 rounded-xl text-center text-xs text-zinc-300"><strong>Sponsor Banner</strong> - Click to visit offer!</div>');
    setLocation('general');
    setIsEnabled(true);
    setIsEditing(true);
  };

  const handleSelectAd = (ad: Advertisement) => {
    setSelectedAd(ad);
    setTitle(ad.title);
    setType(ad.type);
    setCode(ad.code);
    setLocation(ad.location);
    setIsEnabled(ad.isEnabled);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !code) return;
    setSaving(true);

    try {
      if (selectedAd) {
        await api.updateAd(selectedAd.id, { title, type, code, location, isEnabled });
      } else {
        await api.createAd({ title, type, code, location, isEnabled });
      }
      setSaving(false);
      setIsEditing(false);
      onRefreshAds();
    } catch (e: any) {
      setSaving(false);
      alert(e.message || 'Saving ad failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this ad unit?')) return;
    try {
      await api.deleteAd(id);
      setIsEditing(false);
      onRefreshAds();
    } catch (e: any) {
      alert(e.message || 'Delete failed');
    }
  };

  const handleToggleEnabled = async (ad: Advertisement) => {
    try {
      await api.updateAd(ad.id, { isEnabled: !ad.isEnabled });
      onRefreshAds();
    } catch (e: any) {
      alert('Toggle failed');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-white">Realtime Ad Network Manager</h2>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30 rounded uppercase tracking-wider">
              Instant Sync
            </span>
          </div>
          <p className="text-xs text-zinc-400">Configure ad networks, banner scripts, popunders & smart links with live real-time updates</p>
        </div>

        <button
          onClick={handleOpenNew}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> Create Ad Unit
        </button>
      </div>

      {/* Ad Types Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {adTypeOptions.map((opt) => (
          <button
            key={opt.type}
            onClick={() => {
              setType(opt.type);
              if (!isEditing) handleOpenNew();
            }}
            className={`p-3 rounded-2xl text-left border transition ${
              type === opt.type
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <div className="font-bold text-xs uppercase tracking-wider">{opt.label}</div>
            <p className="text-[10px] text-zinc-500 mt-1 line-clamp-1">{opt.desc}</p>
          </button>
        ))}
      </div>

      {/* Main Layout: List vs Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ads List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-emerald-400" /> Existing Ad Units ({ads.length})
          </h3>

          <div className="space-y-2">
            {ads.map((ad) => (
              <div
                key={ad.id}
                onClick={() => handleSelectAd(ad)}
                className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                  selectedAd?.id === ad.id
                    ? 'bg-zinc-800 border-emerald-500/50 shadow-lg'
                    : 'bg-zinc-900 border-zinc-800/80 hover:bg-zinc-800/50'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-emerald-400 rounded uppercase">
                      {ad.type}
                    </span>
                    <h4 className="font-bold text-xs text-zinc-100 truncate">{ad.title}</h4>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-2">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-indigo-400" /> {ad.impressions || 0}</span>
                    <span className="flex items-center gap-1"><MousePointer className="w-3 h-3 text-emerald-400" /> {ad.clicks || 0}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleEnabled(ad);
                  }}
                  className={`text-xl ${ad.isEnabled ? 'text-emerald-400' : 'text-zinc-600'}`}
                  title={ad.isEnabled ? 'Enabled (Click to Disable)' : 'Disabled (Click to Enable)'}
                >
                  {ad.isEnabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Ad Unit Editor & Live Preview */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Code className="w-4 h-4 text-emerald-400" />
                  {selectedAd ? 'Edit Ad Unit' : 'Create New Ad Unit'}
                </h3>

                {selectedAd && (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedAd.id)}
                    className="p-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-lg text-xs flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Ad Unit Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Header Leaderboard Ad"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Placement Location Tag</label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200"
                  >
                    <option value="header_top">Header Top Banner</option>
                    <option value="download_page_top">Download Page Top</option>
                    <option value="download_page_middle">Download Page Middle Native</option>
                    <option value="global_sticky_bottom">Global Sticky Bottom Bar</option>
                    <option value="bottom_right_popup">Bottom Right Social Bar</option>
                    <option value="general">General Placement</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">HTML / JS Embed Code</label>
                  
                  {/* Quick Adsterra Template Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="text-zinc-400 font-bold flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" /> Presets:
                    </span>
                    <button
                      type="button"
                      onClick={() => applyAdsterraTemplate('banner')}
                      className="px-2 py-0.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 rounded font-bold cursor-pointer"
                    >
                      Banner (300x250)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyAdsterraTemplate('native')}
                      className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 rounded font-bold cursor-pointer"
                    >
                      Native Banner
                    </button>
                    <button
                      type="button"
                      onClick={() => applyAdsterraTemplate('popunder')}
                      className="px-2 py-0.5 bg-purple-950 hover:bg-purple-900 border border-purple-700/50 text-purple-300 rounded font-bold cursor-pointer"
                    >
                      Popunder
                    </button>
                    <button
                      type="button"
                      onClick={() => applyAdsterraTemplate('socialbar')}
                      className="px-2 py-0.5 bg-amber-950 hover:bg-amber-900 border border-amber-700/50 text-amber-300 rounded font-bold cursor-pointer"
                    >
                      Social Bar
                    </button>
                    <button
                      type="button"
                      onClick={() => applyAdsterraTemplate('smartlink')}
                      className="px-2 py-0.5 bg-rose-950 hover:bg-rose-900 border border-rose-700/50 text-rose-300 rounded font-bold cursor-pointer"
                    >
                      Smart Link
                    </button>
                  </div>
                </div>

                <textarea
                  rows={5}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="<script>...</script> or https://..."
                  className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {/* Realtime Live Preview Box */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Live Realtime Adsterra Preview
                </span>
                <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden min-h-[100px] flex items-center justify-center">
                  <AdDisplay
                    ads={[{
                      id: selectedAd?.id || 'preview',
                      title,
                      type,
                      code,
                      location,
                      isEnabled: true,
                      clicks: 0,
                      impressions: 0,
                      createdAt: new Date().toISOString()
                    }]}
                    location={location}
                    type={type}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  Enable Ad Unit Immediately
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30"
                >
                  {saving ? 'Saving...' : 'Save Changes Instantly'}
                </button>
              </div>
            </form>
          ) : (
            <div className="py-20 text-center space-y-3 text-zinc-500">
              <Megaphone className="w-10 h-10 mx-auto text-zinc-700" />
              <p className="text-xs font-semibold">Select an existing ad unit from the left or click "Create Ad Unit"</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
                
