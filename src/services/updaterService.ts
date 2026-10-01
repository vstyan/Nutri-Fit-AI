import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isNativeAndroid } from './healthBridge';
import { APP_VERSION } from '../types';

export interface RemoteVersionInfo {
  version: string;
  releaseDate?: string;
  notes?: string;
  checksum?: string;
}

const GITHUB_RAW_VERSION_URL = 'https://raw.githubusercontent.com/vstyan/Nutri-Fit-AI/main/public/version.json';

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
 * Checks GitHub repository for newer published version.
 */
export async function checkForRemoteUpdate(): Promise<RemoteVersionInfo | null> {
  try {
    const url = isNativeAndroid()
      ? `${GITHUB_RAW_VERSION_URL}?t=${Date.now()}`
      : `./version.json?t=${Date.now()}`;

    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) return null;
    const data: RemoteVersionInfo = await res.json();
    if (data.version && data.version !== APP_VERSION) {
      return data;
    }
    return null;
  } catch (err) {
    console.warn('[NutriFit Updater] Check remote version notice:', err);
    return null;
  }
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

  const bundle = await CapacitorUpdater.download(downloadOptions);

  // Activate the newly downloaded bundle immediately (reloads webview into new code)
  await CapacitorUpdater.set({ id: bundle.id });
}
