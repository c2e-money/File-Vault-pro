import React, { useState } from 'react';
import {
  HardDriveUpload,
  Search,
  Upload,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  Sun,
  Moon,
  FolderOpen,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { User, Category } from '../types.js';

interface NavbarProps {
  user: User | null;
  onOpenUpload: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  categories: Category[];
  isDark: boolean;
  toggleTheme: () => void;
  onGoHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onOpenUpload,
  onOpenAuth,
  onLogout,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  categories,
  isDark,
  toggleTheme,
  onGoHome,
}) => {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3 transition-colors">
      <div className="flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <button
          onClick={onGoHome}
          className="flex items-center gap-2.5 text-left focus:outline-none group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-0.5 shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <HardDriveUpload className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          <div>
            <span className="text-base font-black tracking-tight text-white flex items-center gap-1">
              File<span className="text-indigo-400">Vault</span>
              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold px-1.5 py-0.2 rounded uppercase">
                App
              </span>
            </span>
          </div>
        </button>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-xl transition border ${
              showSearch || searchQuery
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
            }`}
            title="Toggle Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Quick Upload Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-xl transition"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>

          {/* User Profile or Auth */}
          {user ? (
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-zinc-800">
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1 hover:opacity-80 transition"
                title="Account Details"
              >
                <img
                  src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt={user.username}
                  className="w-7 h-7 rounded-lg object-cover border border-zinc-700"
                />
              </button>
              <button
                onClick={onLogout}
                className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg transition"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-semibold rounded-xl transition"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Search Input & Category Pills */}
      {(showSearch || searchQuery) && (
        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2.5 animate-in fade-in slide-in-from-top-1">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files by name..."
              className="w-full pl-9 pr-8 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition border ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              All Files
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition border ${
                  selectedCategory === cat.name
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
