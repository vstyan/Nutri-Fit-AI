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
}

/**
 * Exports all local NutriFit data (settings, profile, meals, activities, weight, lipid logs)
 * to a standardized .json backup file.
 * 
 * - On Native Android (APK):
 *   Writes the file to app cache and triggers the native Android System Share / Save sheet,
 *   allowing the user to select "Save to device" (pick any folder) or "Save to Google Drive".
 * 
 * - On Web / PWA (Browser):
 *   Uses File System Access API (showSaveFilePicker) or Web Share where available to let the
 *   user pick where to save, falling back to standard browser download (which prompts if
 *   "Ask where to save files" is enabled in browser settings).
 */
export async function exportBackupFile(): Promise<ExportResult> {
  const jsonStr = await exportAllDataAsJson();
  const filename = `nutrifit-backup-${getLocalDateString()}.json`;

  // 1. Native Capacitor Android / iOS (APK)
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
        text: `NutriFit AI backup: ${filename}`,
        files: [writeResult.uri],
        dialogTitle: 'Select Where to Save Backup'
      });

      return {
        success: true,
        filename,
        message: 'Backup exported! Choose where to save your file.'
      };
    } catch (err: any) {
      const errStr = String(err?.message || err || '').toLowerCase();
      if (errStr.includes('cancel') || errStr.includes('dismiss')) {
        return {
          success: true,
          canceled: true,
          filename,
          message: 'Export canceled.'
        };
      }
      console.warn('[BackupService] Native file export failed, falling back to web download:', err);
    }
  }

  // 2. Desktop Chrome / Edge: Native "Save As..." folder picker
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'NutriFit JSON Backup',
          accept: { 'application/json': ['.json'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
      return {
        success: true,
        filename,
        message: `Saved backup as "${filename}" in your selected folder.`
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
      console.warn('[BackupService] showSaveFilePicker failed, trying share/download:', pickerErr);
    }
  }

  // 3. Mobile Web / PWA: Android Share Sheet (Save to Drive / Files)
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof (navigator as any).canShare === 'function' &&
    typeof File !== 'undefined'
  ) {
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], filename, { type: 'text/plain' });
      if ((navigator as any).canShare({ files: [file] })) {
        await navigator.share({
          title: 'NutriFit AI Backup',
          text: `NutriFit AI backup: ${filename}`,
          files: [file]
        });
        return {
          success: true,
          filename,
          message: 'Backup exported! Choose where to save your file.'
        };
      }
    } catch (shareErr: any) {
      const errStr = String(shareErr?.message || shareErr || '').toLowerCase();
      if (errStr.includes('cancel') || errStr.includes('abort') || errStr.includes('dismiss')) {
        return {
          success: true,
          canceled: true,
          filename,
          message: 'Export canceled.'
        };
      }
      console.warn('[BackupService] Web share failed, falling back to download link:', shareErr);
    }
  }

  // 4. Standard Browser Download (The original PWA behavior)
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
      message: `Backup "${filename}" downloaded successfully.`
    };
  } catch (webErr: any) {
    console.error('[BackupService] Browser download failed:', webErr);
    throw new Error(webErr?.message || 'Failed to trigger file download.');
  }
}
