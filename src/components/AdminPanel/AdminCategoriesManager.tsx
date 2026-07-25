import React, { useState } from 'react';
import { FolderPlus, Trash2, FolderOpen, Code, FileText, Music, Archive, Gamepad2, Image } from 'lucide-react';
import { Category } from '../../types.js';
import { api } from '../../services/api.js';

interface AdminCategoriesManagerProps {
  categories: Category[];
  onRefreshCategories: () => void;
}

export const AdminCategoriesManager: React.FC<AdminCategoriesManagerProps> = ({
  categories,
  onRefreshCategories,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Folder');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.createCategory(name, description, icon);
      setName('');
      setDescription('');
      setCreating(false);
      onRefreshCategories();
    } catch (e: any) {
      setCreating(false);
      alert(e.message || 'Failed creating category');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete category?')) return;
    try {
      await api.deleteCategory(id);
      onRefreshCategories();
    } catch (e: any) {
      alert(e.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-xl font-extrabold text-white">Categories Manager</h2>
        <p className="text-xs text-zinc-400">Organize file taxonomy, add custom categories and view file volume counters</p>
      </div>

      {/* Create Category Card */}
      <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-purple-400" /> Create New Category
        </h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category Name (e.g. E-Books)"
            className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
            required
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description..."
            className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30"
          >
            {creating ? 'Saving...' : 'Add Category'}
          </button>
        </form>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((c) => (
          <div key={c.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-zinc-100 text-sm truncate">{c.name}</h4>
                <p className="text-xs text-zinc-400 font-medium">{c.fileCount || 0} Files</p>
              </div>
            </div>
            <button
              onClick={() => handleDelete(c.id)}
              className="p-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-xl transition"
              title="Delete Category"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
