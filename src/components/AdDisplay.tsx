import React, { useEffect, useRef, useState } from 'react';
import { Advertisement } from '../types.js';
import { api } from '../services/api.js';

interface AdDisplayProps {
  ads: Advertisement[];
  location?: string;
  type?: Advertisement['type'];
  className?: string;
}

export const AdDisplay: React.FC<AdDisplayProps> = ({ ads, location, type, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);

  // Filter active and enabled ads based on location or type with intelligent fallbacks
  const matchedAds = ads.filter((a) => {
    if (!a.isEnabled) return false;
    if (!a.code || !a.code.trim()) return false;

    // Filter by type if provided
    if (type && a.type !== type) return false;

    // Filter by location if provided
    if (location) {
      if (a.location === location) return true;
      if (a.location === 'general' || a.location === 'global' || a.location === 'all') return true;
      if (location.startsWith('download') && a.location.startsWith('download')) return true;
      if (location.startsWith('header') || location.startsWith('dashboard')) {
        if (a.location.includes('header') || a.location.includes('top')) return true;
      }
      if (location.startsWith('sticky') || location.includes('bottom')) {
        if (a.location.includes('sticky') || a.location.includes('bottom')) return true;
      }
      if (type && a.type === type) return true;
      return false;
    }

    return true;
  });

  // Sort matched ads: exact location matches first
  const activeAd = matchedAds.sort((a, b) => {
    if (location && a.location === location) return -1;
    if (location && b.location === location) return 1;
    return 0;
  })[0];

  useEffect(() => {
    setHasError(false);
    if (activeAd) {
      // Record impression
      api.trackAdEvent(activeAd.id, 'impression');
    }
  }, [activeAd?.id, activeAd?.code]);

  if (!activeAd || hasError) return null;

  const rawCode = activeAd.code.trim();

  // Detect script, iframe, or Adsterra configuration tags
  const containsScript = rawCode.includes('<script') || rawCode.includes('atOptions') || rawCode.includes('<iframe');
  const isDirectJsUrl = (rawCode.startsWith('http://') || rawCode.startsWith('https://') || rawCode.startsWith('//')) && rawCode.toLowerCase().includes('.js');

  const handleClick = () => {
    api.trackAdEvent(activeAd.id, 'click');
  };

  // Render Adsterra & JavaScript-based ads inside an isolated frame context
  if (containsScript || isDirectJsUrl) {
    let scriptContent = rawCode;
    if (isDirectJsUrl) {
      let url = rawCode;
      if (url.startsWith('//')) url = 'https:' + url;
      scriptContent = `<script type="text/javascript" src="${url}"></script>`;
    }

    // Fix protocol-relative URLs (// -> https://) for reliable script fetching
    const safeContent = scriptContent
      .replace(/src="\/\//gi, 'src="https://')
      .replace(/src='\/\//gi, "src='https://");

    const iframeHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <base target="_blank">
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background: transparent;
              display: flex;
              justify-content: center;
              align-items: center;
              overflow: hidden;
              color: #ffffff;
              font-family: system-ui, -apple-system, sans-serif;
            }
          </style>
        </head>
        <body>
          ${safeContent}
        </body>
      </html>
    `;

    // Dynamic frame height calculation based on ad type
    const frameHeight =
      activeAd.type === 'sticky' ? '70px' : activeAd.type === 'banner' ? '250px' : activeAd.type === 'native' ? '180px' : '100px';

    return (
      <div
        ref={containerRef}
        onClick={handleClick}
        className={`ad-container ${
          activeAd.type === 'sticky' ? '' : 'my-3 overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-1 flex justify-center items-center shadow-lg'
        } ${className}`}
      >
        <iframe
          srcDoc={iframeHtml}
          style={{ width: '100%', height: frameHeight, border: 'none', overflow: 'hidden' }}
          title={activeAd.title || 'Adsterra Advertisement'}
          scrolling="no"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  // Render static HTML / native ad components directly
  return (
    <div
      ref={containerRef}
      className={`ad-container ${activeAd.type === 'sticky' ? '' : 'my-3 overflow-hidden rounded-2xl'} ${className}`}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: rawCode }}
    />
  );
};



