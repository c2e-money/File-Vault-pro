import React from 'react';
import { HardDriveUpload, Shield, FileText, Lock, Globe, Server } from 'lucide-react';

interface FooterProps {
  totalFiles: number;
  totalDownloads: number;
  onOpenAdmin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ totalFiles, totalDownloads, onOpenAdmin }) => {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-900 text-zinc-400 text-sm mt-16 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                <HardDriveUpload className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                File<span className="text-indigo-400">Vault</span>
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              High-speed public & private file hosting platform. Drag, upload, share, and stream downloads with maximum speed, encryption, and reliability.
            </p>
            <div className="flex items-center gap-4 text-xs font-semibold text-zinc-300">
              <div className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                <span>10Gbps Edge Nodes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>SSL Encrypted</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Platform Stats</h4>
            <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Total Files Hosted:</span>
                <span className="font-bold text-indigo-400">{totalFiles.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Total Downloads Served:</span>
                <span className="font-bold text-emerald-400">{totalDownloads.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Uptime Guarantee:</span>
                <span className="font-bold text-zinc-200">99.98%</span>
              </div>
            </div>
          </div>

          {/* Legal & DMCA */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Legal & Compliance</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#dmca" onClick={(e) => { e.preventDefault(); alert('DMCA Policy: FileVault respects intellectual property rights. Contact admin@filevault.com for copyright takedown requests.'); }} className="hover:text-indigo-400 transition flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" /> DMCA Takedown Policy
                </a>
              </li>
              <li>
                <a href="#tos" onClick={(e) => { e.preventDefault(); alert('Terms of Service: Uploading illegal malware, viruses, or non-licensed copyright materials is strictly prohibited.'); }} className="hover:text-indigo-400 transition flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" /> Terms of Service
                </a>
              </li>
              <li>
                <a href="#privacy" onClick={(e) => { e.preventDefault(); alert('Privacy Policy: All files are encrypted at rest. We do not sell user metadata.'); }} className="hover:text-indigo-400 transition flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" /> Privacy & Encryption
                </a>
              </li>
            </ul>
          </div>

          {/* Storage Technology */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Supported Storage Drivers</h4>
            <p className="text-xs text-zinc-400">
              Compatible with local storage, Cloudflare R2, Amazon S3, Google Drive, OneDrive & Dropbox integration.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['Local Disk', 'Cloudflare R2', 'AWS S3', 'Google Drive', 'OneDrive'].map(s => (
                <span key={s} className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300 font-medium rounded-md">
                  {s}
                </span>
              ))}
            </div>
          </div>

        </div>

        <div className="pt-8 mt-8 border-t border-zinc-900 text-center text-xs text-zinc-500 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} FileVault Inc. All rights reserved. Production File Storage Engine.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live Server Online
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
