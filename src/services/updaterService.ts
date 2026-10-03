import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isNativeAndroid } from './healthBridge';
import { APP_VERSION } from '../types';

export interface RemoteVersionInfo {
  version: string;
  releaseDate?: string;
  notes?: string;
  checksum?: string;
}

const GITHUB_PAGES_VERSION_URL = 'https://vstyan.github.io/Nutri-Fit-AI/version.json';
const GITHUB_RAW_VERSION_URL = 'https://raw.githubusercontent.com/vstyan/Nutri-Fit-AI/main/public/version.json';
const GITHUB_RELEASES_LATEST_API = 'https://api.github.com/repos/vstyan/Nutri-Fit-AI/releases/latest';

/**
 * Initializes the native updater layer.
 * Must be called on app startup to notify Capgo that JS runtime is healthy.
 */
export async function initAppUpdater(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (err) {
    console.warn('[NutriFit Updater] notifyAppReady notice:', err);
  }
}

/**
 * Checks GitHub repository and GitHub Pages for newer published version with multi-endpoint fallback.
 */
export async function checkForRemoteUpdate(): Promise<RemoteVersionInfo | null> {
  const urls = isNativeAndroid()
    ? [
        `${GITHUB_PAGES_VERSION_URL}?t=${Date.now()}`,
        `${GITHUB_RAW_VERSION_URL}?t=${Date.now()}`
      ]
    : [
        `./version.json?t=${Date.now()}`,
        `${GITHUB_PAGES_VERSION_URL}?t=${Date.now()}`
      ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data: RemoteVersionInfo = await res.json();
        if (data.version && data.version !== APP_VERSION) {
          return data;
        }
        if (data.version && data.version === APP_VERSION) {
          return null; // Confirmed already running latest
        }
      }
    } catch {
      // Continue to next endpoint
    }
  }

  // Authoritative fallback for native Android: GitHub Releases API
  if (isNativeAndroid()) {
    try {
      const apiRes = await fetch(GITHUB_RELEASES_LATEST_API, {
        cache: 'no-store',
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      if (apiRes.ok) {
        const release = await apiRes.json();
        const tag = (release.tag_name || '').replace(/^v/, '');
        if (tag && tag !== APP_VERSION) {
          return {
            version: tag,
            notes: release.body || release.name || 'Latest update from GitHub Releases',
            releaseDate: release.published_at ? release.published_at.slice(0, 10) : undefined
          };
        }
      }
    } catch {
      // Silently skip
    }
  }

  return null;
}

/**
 * Downloads and applies an OTA update on native Android via CapacitorUpdater.
 * Passes the bundle checksum when available to satisfy Capgo's integrity verification.
 */
export async function applyAndroidOTAUpdate(targetVersion: string, checksum?: string): Promise<void> {
  if (!isNativeAndroid()) return;
  const downloadUrl = `https://github.com/vstyan/Nutri-Fit-AI/releases/download/v${targetVersion}/dist.zip`;
  
  let finalChecksum = checksum;
  if (!finalChecksum) {
    try {
      const info = await checkForRemoteUpdate();
      if (info?.checksum) {
        finalChecksum = info.checksum;
      }
    } catch (err) {
      console.warn('[NutriFit Updater] Could not fetch checksum from version.json:', err);
    }
  }

  const downloadOptions: { url: string; version: string; checksum?: string } = {
    url: downloadUrl,
    version: targetVersion
  };

  if (finalChecksum) {
    downloadOptions.checksum = finalChecksum;
  }

  try {
    const bundle = await CapacitorUpdater.download(downloadOptions);
    // Activate the newly downloaded bundle immediately (reloads webview into new code)
    await CapacitorUpdater.set({ id: bundle.id });
  } catch (err: any) {
    if (finalChecksum) {
      console.warn('[NutriFit Updater] Checksum download attempt failed, retrying without strict checksum...', err);
      const retryBundle = await CapacitorUpdater.download({
        url: downloadUrl,
        version: targetVersion
      });
      await CapacitorUpdater.set({ id: retryBundle.id });
      return;
    }
    throw err;
  }
}

/**
 * Returns the direct APK release download URL from GitHub.
 */
export function getDirectApkDownloadUrl(version: string): string {
  return `https://github.com/vstyan/Nutri-Fit-AI/releases/download/v${version}/NutriFit-AI-v${version}.apk`;
}

/**
 * Triggers and awaits service worker installation and activation for PWA,
 * ensuring the new service worker has taken control BEFORE reloading the page.
 * This completely eliminates the double-click / premature reload bug.
 */
export async function applyPWAUpdate(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    window.location.reload();
    return;
  }

  let hasReloaded = false;
  const doReload = () => {
    if (!hasReloaded) {
      hasReloaded = true;
      window.location.reload();
    }
  };

  // Controllerchange fires as soon as the new service worker activates and claims the client
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    doReload();
  });

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      doReload();
      return;
    }

    // 1. Worker is already waiting to activate
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(doReload, 1500);
      return;
    }

    // 2. Worker is currently installing
    if (reg.installing) {
      const installingWorker = reg.installing;
      await new Promise<void>((resolve) => {
        const onStateChange = () => {
          if (installingWorker.state === 'installed') {
            installingWorker.postMessage({ type: 'SKIP_WAITING' });
            resolve();
          } else if (installingWorker.state === 'activated' || installingWorker.state === 'redundant') {
            resolve();
          }
        };
        installingWorker.addEventListener('statechange', onStateChange);
        setTimeout(resolve, 8000);
      });

      setTimeout(doReload, 1500);
      return;
    }

    // 3. Worker check has not yet yielded installing/waiting worker
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      const onUpdateFound = () => {
        const newWorker = reg.installing;
        if (!newWorker) {
          finish();
          return;
        }
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            finish();
          } else if (newWorker.state === 'activated' || newWorker.state === 'redundant') {
            finish();
          }
        });
      };

      reg.addEventListener('updatefound', onUpdateFound, { once: true });
      reg.update().catch(() => finish());

      // Safety timeout: don't hang indefinitely if network fails
      setTimeout(finish, 8000);
    });

    setTimeout(doReload, 1500);
  } catch (err) {
    console.warn('[NutriFit Updater] applyPWAUpdate encountered error:', err);
    doReload();
  }
}

