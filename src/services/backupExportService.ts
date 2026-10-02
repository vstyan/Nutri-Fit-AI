import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { exportAllDataAsJson, importBackupJson } from './storageService';
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
 *    - Uses Web Share API with text/plain File type (which Chrome Android reliably accepts)
 *    - Triggers Android's native system share sheet
 * 
 * 3. File System Access API (Desktop Chrome / Edge):
 *    - Opens native "Save As..." dialog allowing user to pick exact folder
 * 
 * 4. Fallback:
 *    - Standard browser download with clear location guidance
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
  // Note: Chrome on Android rejects 'application/json' in canShare(), but fully accepts 'text/plain'
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof (navigator as any).canShare === 'function' &&
    typeof File !== 'undefined'
  ) {
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      // Use text/plain for the File object so Chrome on Android allows sharing
      const file = new File([blob], filename, { type: 'text/plain' });
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

/**
 * Copies the raw backup JSON to the clipboard for zero-friction copy/paste migration.
 */
export async function copyBackupToClipboard(): Promise<{ success: boolean; message: string }> {
  const jsonStr = await exportAllDataAsJson();
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(jsonStr);
    return {
      success: true,
      message: 'Backup JSON copied to clipboard! In your APK, tap "Paste from Clipboard" to restore.'
    };
  }

  // Fallback for older environments
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.value = jsonStr;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return {
      success: true,
      message: 'Backup JSON copied to clipboard! In your APK, tap "Paste from Clipboard" to restore.'
    };
  }

  throw new Error('Clipboard copy not supported in this browser.');
}

/**
 * Reads backup JSON from the clipboard and imports it.
 */
export async function restoreBackupFromClipboard(): Promise<{ success: boolean; message: string; requiresManualPaste?: boolean }> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().startsWith('{')) {
        const res = await importBackupJson(text);
        return {
          success: true,
          message: res.message
        };
      }
    }
  } catch (err: any) {
    console.warn('[BackupService] Clipboard readText failed:', err);
  }

  return {
    success: false,
    message: 'Could not automatically read clipboard. Please paste the JSON manually.',
    requiresManualPaste: true
  };
}
