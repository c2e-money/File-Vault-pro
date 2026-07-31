import { Advertisement } from '../types.js';
import { api } from '../services/api.js';

const loadedScriptUrls = new Set<string>();

/**
 * Extracts raw script URL from code snippets or direct URLs.
 */
export function extractScriptUrl(code?: string): string | null {
  if (!code) return null;
  const trimmed = code.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
    return trimmed.startsWith('//') ? 'https:' + trimmed : trimmed;
  }
  const match = trimmed.match(/src=["']([^"']+)["']/i);
  if (match && match[1]) {
    let url = match[1];
    if (url.startsWith('//')) url = 'https:' + url;
    return url;
  }
  return null;
}

/**
 * Loads a global ad script (e.g. Popunder or Socialbar) cleanly ONCE without duplicate DOM elements or spam re-renders.
 */
export function injectGlobalAdScript(ad?: Advertisement): void {
  if (!ad || !ad.isEnabled || !ad.code) return;

  const scriptUrl = extractScriptUrl(ad.code);
  if (!scriptUrl) return;

  // Prevent multiple injections of the same script URL
  if (loadedScriptUrls.has(scriptUrl) || document.querySelector(`script[data-fv-ad-url="${encodeURIComponent(scriptUrl)}"]`)) {
    return;
  }

  try {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.setAttribute('data-fv-ad-url', encodeURIComponent(scriptUrl));
    document.head.appendChild(script);

    loadedScriptUrls.add(scriptUrl);
    api.trackAdEvent(ad.id, 'impression');
  } catch (e) {
    console.warn('Failed injecting global ad script:', e);
  }
}

/**
 * Helper to register all active background ad scripts (popunder, socialbar) safely.
 */
export function registerBackgroundAds(ads: Advertisement[]): void {
  if (!ads || !Array.isArray(ads)) return;

  const popunderAd = ads.find((a) => a.isEnabled && a.type === 'popunder');
  if (popunderAd) {
    injectGlobalAdScript(popunderAd);
  }

  const socialBarAd = ads.find((a) => a.isEnabled && a.type === 'socialbar');
  if (socialBarAd) {
    injectGlobalAdScript(socialBarAd);
  }
}
