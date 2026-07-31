import React, { useState } from 'react';
import {
  LayoutDashboard,
  Files,
  Users,
  Download,
  ArrowLeft,
  Shield,
  LogOut,
  Menu,
  X,
  Upload,
  Settings,
} from 'lucide-react';
import { AdminOverview } from './AdminOverview.js';
import { AdminFilesManager } from './AdminFilesManager.js';
import { AdminUsersManager } from './AdminUsersManager.js';
import { AdminLogsManager } from './AdminLogsManager.js';
import { AdminSettingsManager } from './AdminSettingsManager.js';
import { User, Category, Advertisement } from '../../types.js';

interface AdminPanelProps {
  currentUser: User | null;
  categories: Category[];
  ads: Advertisement[];
  onBackToSite: () => void;
  onAdminLogout?: () => void;
  onRefreshCategories: () => void;
  onRefreshAds: () => void;
  onOpenUpload: () => void;
}

export type AdminTab =
  | 'overview'
  | 'files'
  | 'users'
  | 'logs'
  | 'settings';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  categories,
  ads,
  onBackToSite,
  onAdminLogout,
  onRefreshCategories,
  onRefreshAds,
  onOpenUpload,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'overview' as AdminTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'users' as AdminTab, label: 'Users', icon: Users },
    { id: 'files' as AdminTab, label: 'Files', icon: Files },
    { id: 'logs' as AdminTab, label: 'Logs', icon: Download },
    { id: 'settings' as AdminTab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row font-sans antialiased">
      
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 md:hidden">
        <div className="px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-600 text-white shadow-md shadow-purple-600/30">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-extrabold text-xs text-white tracking-tight">Admin Console</h1>
              <p className="text-[9px] text-purple-400 font-bold uppercase tracking-wider">FileVault OS</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenUpload}
              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] rounded-lg flex items-center gap-1 shadow transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 bg-zinc-800 text-zinc-200 rounded-lg border border-zinc-700/60 active:scale-95 transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Horizontal Touch Scrollable Navigation Bar for Mobile */}
        <div className="px-3 pb-2.5 pt-1 overflow-x-auto scrollbar-none flex items-center gap-1.5 border-t border-zinc-800/60 bg-zinc-950/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition shrink-0 active:scale-95 ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-zinc-950/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-2xl p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-xs text-white">Admin Controls</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 bg-zinc-800 rounded-lg text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onBackToSite();
                }}
                className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-zinc-700/60"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Public Website
              </button>
              {onAdminLogout && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onAdminLogout();
                  }}
                  className="w-full py-3 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-rose-500/30"
                >
                  <LogOut className="w-4 h-4" /> Log Out Admin Panel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex w-64 bg-zinc-900 border-r border-zinc-800 p-4 shrink-0 flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-6 mb-4 border-b border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-600/30">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-extrabold text-sm text-white tracking-tight">Admin Console</h1>
                <p className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">FileVault OS</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Back to Public Site & Logout */}
        <div className="pt-4 border-t border-zinc-800 mt-6 space-y-2">
          <button
            onClick={onBackToSite}
            className="w-full py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition border border-zinc-700/60"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Public Site
          </button>
          {onAdminLogout && (
            <button
              onClick={onAdminLogout}
              className="w-full py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition border border-rose-500/20"
            >
              <LogOut className="w-4 h-4" /> Log Out Admin
            </button>
          )}
        </div>
      </aside>

      {/* Main Admin Tab View Content - Mobile Optimized Padding */}
      <main className="flex-1 px-3 py-4 sm:p-6 md:p-8 max-w-7xl mx-auto overflow-y-auto w-full">
        {activeTab === 'overview' && <AdminOverview onOpenUpload={onOpenUpload} />}
        {activeTab === 'files' && <AdminFilesManager categories={categories} onOpenUpload={onOpenUpload} />}
        {activeTab === 'users' && <AdminUsersManager currentUser={currentUser} />}
        {activeTab === 'logs' && <AdminLogsManager />}
        {activeTab === 'settings' && <AdminSettingsManager />}
      </main>

    </div>
  );
};
