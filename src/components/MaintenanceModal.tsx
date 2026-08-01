import React from 'react';
import { ShieldAlert, Wrench, Clock, MessageSquare, ExternalLink, ShieldCheck, Lock } from 'lucide-react';
import { WebsiteSettings } from '../types.js';

interface MaintenanceModalProps {
  isOpen: boolean;
  settings: WebsiteSettings | null;
  isAdmin?: boolean;
  onOpenAdminPanel?: () => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  isOpen,
  settings,
  isAdmin = false,
  onOpenAdminPanel,
}) => {
  if (!isOpen) return null;

  const siteTitle = settings?.siteName || 'FileVault';
  const whatsappNum = settings?.whatsappNumber || '+918811896374';
  const cleanWhatsapp = whatsappNum.replace(/[^0-9]/g, '');
  const telegramUrl = settings?.telegramChannelUrl || 'https://t.me/+cOVh2XrT7nBlYTE1';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-950 border border-amber-500/40 rounded-3xl shadow-2xl p-6 space-y-6 text-center overflow-hidden">
        
        {/* Glowing Background Light */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Maintenance Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
          <Wrench className="w-8 h-8 animate-bounce" />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> System Maintenance Mode
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {siteTitle} is Under Maintenance
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
            {settings?.siteDescription
              ? `${settings.siteDescription} is currently undergoing essential updates.`
              : 'We are currently performing scheduled server upgrades and maintenance to improve speed and security.'}
            <br />
            <span className="text-amber-300/90 font-semibold mt-1 block">
              Downloads and uploads are temporarily paused.
            </span>
          </p>
        </div>

        {/* Support Channels Card */}
        <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl space-y-3 text-left">
          <span className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-wider block border-b border-zinc-800 pb-2">
            Need Urgent Assistance?
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cleanWhatsapp && (
              <a
                href={`https://wa.me/${cleanWhatsapp}?text=Hello%20Support,%20I%20have%20a%20query%20during%20maintenance`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/30 rounded-xl flex items-center gap-2 transition group"
              >
                <div className="w-7 h-7 rounded-lg bg-[#25D366]/20 flex items-center justify-center text-[#25D366] shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block group-hover:text-emerald-300">WhatsApp</span>
                  <span className="text-[10px] text-zinc-400 truncate block">{whatsappNum}</span>
                </div>
              </a>
            )}

            {telegramUrl && (
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-sky-950/50 hover:bg-sky-900/50 border border-sky-500/30 rounded-xl flex items-center gap-2 transition group"
              >
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                  <ExternalLink className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block group-hover:text-sky-300">Telegram Channel</span>
                  <span className="text-[10px] text-zinc-400 truncate block">Join VIP Updates</span>
                </div>
              </a>
            )}
          </div>
        </div>

        {/* Admin Bypass Notification */}
        {isAdmin && (
          <div className="p-3 bg-indigo-950/80 border border-indigo-500/40 rounded-2xl text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Administrator Mode Active</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              As an administrator, you can continue managing the platform and turn off maintenance mode in Settings.
            </p>
            {onOpenAdminPanel && (
              <button
                onClick={onOpenAdminPanel}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition"
              >
                Open Admin Panel Settings
              </button>
            )}
          </div>
        )}

        <div className="text-[10px] text-zinc-500 font-medium">
          Please check back in a few minutes. Thank you for your patience!
        </div>

      </div>
    </div>
  );
};
