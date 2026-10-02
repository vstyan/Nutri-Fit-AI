import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { exportAllDataAsJson } from './storageService';
import { getLocalDateString } from '../utils/dateUtils';

export interface ExportResult {
  success: boolean;
  canceled?: boolean;
  filename: string;
  message?: string;
  pathDescription?: string;
}

/**
 * Exports all local NutriFit data (settings, profile, meals, activities, weight, lipid logs)
 * to a standardized .json backup file.
 * 
 * Flow:
 * 1. On Native Android (APK):
 *    - Writes the JSON file to app cache via @capacitor/filesystem
 *    - Triggers Android's native system Share sheet via @capacitor/share
 *    - Allows the user to select "Save to Files / Downloads" or "Save to Google Drive"
 * 
 * 2. On Mobile Web / PWA (e.g. Chrome on Android):
 *    - If Web Share API (navigator.share with files) is supported, triggers the native share sheet
 *    - If window.showSaveFilePicker is supported (desktop Chromium), opens a "Save As..." dialog
 * 
 * 3. Fallback:
 *    - Downloads the file directly to the device's Downloads folder
 *    - Informs the user exactly where the file was saved and how to pick it during restore
 */
export async function exportBackupFile(): Promise<ExportResult> {
  const jsonStr = await exportAllDataAsJson();
  const filename = `nutrifit-backup-${getLocalDateString()}.json`;

  // 1. Native Capacitor Android / iOS
  if (Capacitor.isNativePlatform()) {
    try {
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: jsonStr,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      await Share.share({
        title: 'NutriFit AI Backup',
        text: `NutriFit AI backup exported on ${getLocalDateString()}`,
        files: [writeResult.uri],
        dialogTitle: 'Save or Share Backup'
      });

      return {
        success: true,
        filename,
        message: 'Backup exported! Choose "Save to device" or Google Drive to store it.'
      };
    } catch (err: any) {
      const errStr = String(err?.message || err || '').toLowerCase();
      if (errStr.includes('cancel') || errStr.includes('dismiss')) {
        return {
          success: true,
          canceled: true,
          filename,
          message: 'Export share dismissed.'
        };
      }
      console.warn('[BackupService] Native file export failed, attempting web share/download fallback:', err);
    }
  }

  // 2. Web Share API with Files (Mobile Chrome, Android PWA, Safari iOS)
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof (navigator as any).canShare === 'function' &&
    typeof File !== 'undefined'
  ) {
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], filename, { type: 'application/json' });
      if ((navigator as any).canShare({ files: [file] })) {
        await navigator.share({
          title: 'NutriFit AI Backup',
          text: `NutriFit AI backup file: ${filename}`,
          files: [file]
        });
        return {
          success: true,
          filename,
          message: 'Backup exported! Choose "Save to device" or Google Drive to store it.'
        };
      }
    } catch (shareErr: any) {
      const errStr = String(shareErr?.message || shareErr || '').toLowerCase();
      if (errStr.includes('cancel') || errStr.includes('abort') || errStr.includes('dismiss')) {
        return {
          success: true,
          canceled: true,
          filename,
          message: 'Export share dismissed.'
        };
      }
      console.warn('[BackupService] Web share failed, trying file picker or download:', shareErr);
    }
  }

  // 3. File System Access API (Desktop Chrome / Edge "Save As..." dialog)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'NutriFit Backup JSON',
          accept: { 'application/json': ['.json'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
      return {
        success: true,
        filename,
        message: `Backup saved successfully as "${filename}" in your selected folder!`
      };
    } catch (pickerErr: any) {
      if (pickerErr?.name === 'AbortError') {
        return {
          success: true,
          canceled: true,
          filename,
          message: 'Export canceled.'
        };
      }
      console.warn('[BackupService] showSaveFilePicker failed, falling back to anchor download:', pickerErr);
    }
  }

  // 4. Standard Browser Download Fallback
  try {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    return {
      success: true,
      filename,
      message: `Saved "${filename}" to your device's Downloads folder. When restoring, look in Downloads or Recent.`
    };
  } catch (webErr: any) {
    console.error('[BackupService] Web download failed:', webErr);
    throw new Error(webErr?.message || 'Failed to trigger file download.');
  }
}
