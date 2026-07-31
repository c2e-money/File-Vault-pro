import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Lock,
  Trash2,
} from 'lucide-react';
import { FileItem, Category } from '../../types.js';
import { api } from '../../services/api.js';
import { formatBytes, getFileIcon } from '../FileCard.js';
import { DeleteConfirmationModal } from '../DeleteConfirmationModal.js';

interface AdminFilesManagerProps {
  categories: Category[];
  onOpenUpload?: () => void;
}

export const AdminFilesManager: React.FC<AdminFilesManagerProps> = ({ categories }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await api.getFiles({ limit: 100, scope: 'admin' });
      setFiles(res.files);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async (f: FileItem) => {
    await api.deleteFile(f.id);
    await loadFiles();
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const filteredFiles = files.filter(f => {
    const matchesSearch = f.originalName.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'all' || f.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-white">Uploaded Files Management</h2>
          </div>
          <p className="text-xs text-zinc-400">View file information, category, size, downloads, and manage or delete files</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file name..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none"
        >
          <option value="all">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">File Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Size</th>
                <th className="p-4">Downloads</th>
                <th className="p-4">Status</th>
                <th className="p-4">Upload Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">Loading files...</td>
                </tr>
              ) : filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">No files found matching filter.</td>
                </tr>
              ) : (
                filteredFiles.map((f) => (
                  <tr key={f.id} className="hover:bg-zinc-800/40 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 shrink-0">
                          {getFileIcon(f.mimeType, f.originalName)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-zinc-100 truncate max-w-xs">{f.originalName}</h4>
                          <p className="text-[11px] text-zinc-500">By {f.uploaderName}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 font-semibold text-zinc-400">{f.category}</td>
                    <td className="p-4 font-mono text-zinc-300">{formatBytes(f.fileSize)}</td>
                    <td className="p-4 font-bold text-emerald-400">{f.downloadsCount || 0}</td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {f.isPasswordProtected && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold rounded flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        )}
                        {f.isFeatured && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold rounded flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Featured
                          </span>
                        )}
                        {f.isDraft && (
                          <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold rounded">
                            Draft
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-zinc-500 whitespace-nowrap">
                      {new Date(f.createdAt).toLocaleDateString()}
                    </td>

                    <td className="p-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setFileToDelete(f)}
                        className="p-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 rounded-xl transition border border-rose-800/50 hover:border-rose-600 inline-flex items-center gap-1.5 text-xs font-semibold"
                        title="Delete File"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={!!fileToDelete}
        file={fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
