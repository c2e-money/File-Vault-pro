import React, { useState, useRef } from 'react';
import { X, Edit3, Save, RefreshCw, Lock, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { FileItem, Category } from '../types.js';
import { api } from '../services/api.js';

interface FileEditModalProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSaveSuccess: () => void;
}

export const FileEditModal: React.FC<FileEditModalProps> = ({
  file,
  isOpen,
  onClose,
  categories,
  onSaveSuccess,
}) => {
  if (!isOpen || !file) return null;

  const [originalName, setOriginalName] = useState(file.originalName);
  const [category, setCategory] = useState(file.category);
  const [description, setDescription] = useState(file.description || '');
  const [tags, setTags] = useState((file.tags || []).join(', '));
  const [isPasswordProtected, setIsPasswordProtected] = useState(file.isPasswordProtected);
  const [password, setPassword] = useState(file.password || '');
  const [isDraft, setIsDraft] = useState(file.isDraft);
  const [isFeatured, setIsFeatured] = useState(file.isFeatured);
  const [scheduledAt, setScheduledAt] = useState(file.scheduledAt ? file.scheduledAt.slice(0, 16) : '');

  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    try {
      await api.editFile(file.id, {
        originalName,
        category,
        description,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        isPasswordProtected,
        password,
        isDraft,
        isFeatured,
        scheduledAt: scheduledAt || null,
      });

      setSaving(false);
      setMsg({ type: 'success', text: 'File details updated successfully!' });
      onSaveSuccess();
      setTimeout(onClose, 800);
    } catch (err: any) {
      setSaving(false);
      setMsg({ type: 'error', text: err.message || 'Failed saving updates' });
    }
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const replacement = e.target.files[0];

    setReplacing(true);
    setMsg(null);

    try {
      await api.replaceFileContent(file.id, replacement);
      setReplacing(false);
      setMsg({ type: 'success', text: `File content replaced with ${replacement.name}` });
      onSaveSuccess();
    } catch (err: any) {
      setReplacing(false);
      setMsg({ type: 'error', text: err.message || 'Replacement failed' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Edit File Details</h2>
              <p className="text-xs text-zinc-400">Modify metadata, password, status or replace file content</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {msg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                msg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
          )}

          {/* Replace File Button */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-zinc-200">Replace Physical File</h4>
              <p className="text-[11px] text-zinc-400">Upload a new binary version while keeping statistics intact.</p>
            </div>
            <input
              ref={replaceInputRef}
              type="file"
              onChange={handleReplaceFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              disabled={replacing}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${replacing ? 'animate-spin' : ''}`} />
              {replacing ? 'Replacing...' : 'Replace File'}
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">File Name</label>
            <input
              type="text"
              value={originalName}
              onChange={(e) => setOriginalName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-200 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-200 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-200 focus:outline-none"
            />
          </div>

          {/* Password & Features */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300 font-medium flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-400" /> Password Protected
              </span>
              <input
                type="checkbox"
                checked={isPasswordProtected}
                onChange={(e) => setIsPasswordProtected(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded"
              />
            </div>

            {isPasswordProtected && (
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Access password"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-100"
              />
            )}

            <div className="flex flex-wrap gap-4 pt-2 border-t border-zinc-800">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                Featured File
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDraft}
                  onChange={(e) => setIsDraft(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
                Draft Mode
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
