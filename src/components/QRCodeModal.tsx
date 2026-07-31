import React, { useEffect, useState } from 'react';
import { X, QrCode, Smartphone, Download, Copy } from 'lucide-react';
import { FileItem } from '../types.js';
import { api } from '../services/api.js';

interface QRCodeModalProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ file, isOpen, onClose }) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (file && isOpen) {
      api.getQRCode(file.id).then((res) => {
        setQrCodeDataUrl(res.qrCode);
        setDownloadUrl(res.url);
      }).catch(() => {});
    }
  }, [file?.id, isOpen]);

  if (!isOpen || !file) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(downloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 text-center space-y-5 shadow-2xl">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
            <Smartphone className="w-5 h-5" /> Mobile Scan Download
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-300">
          Scan this QR Code with your phone camera to instantly download <strong className="text-indigo-400">{file.originalName}</strong> on mobile.
        </p>

        {qrCodeDataUrl ? (
          <div className="p-4 bg-white rounded-2xl inline-block border-4 border-indigo-500/30 shadow-xl">
            <img src={qrCodeDataUrl} alt="QR Code" className="w-52 h-52 mx-auto" />
          </div>
        ) : (
          <div className="w-52 h-52 mx-auto bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500">
            Generating QR...
          </div>
        )}

        <div className="flex items-center gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 text-xs">
          <span className="truncate flex-1 text-zinc-400">{downloadUrl}</span>
          <button
            onClick={handleCopy}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg flex items-center gap-1 shrink-0"
          >
            <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
};
