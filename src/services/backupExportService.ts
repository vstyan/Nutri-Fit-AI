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
 * On Native Android (APK):
 * - Writes the JSON file to app cache via @capacitor/filesystem
 * - Triggers Android's native system Share sheet via @capacitor/share
 * - Allows the user to Save to Files / Google Drive / Email / Messaging
 * 
 * On Web / PWA:
 * - Triggers a standard browser download link
 */
export async function exportBackupFile(): Promise<ExportResult> {
  const jsonStr = await exportAllDataAsJson();
  const filename = `nutrifit-backup-${getLocalDateString()}.json`;

  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Write the backup JSON to app cache
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: jsonStr,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });

      // 2. Open native Android system share sheet
      await Share.share({
        title: 'NutriFit AI Backup',
        text: `NutriFit AI backup exported on ${getLocalDateString()}`,
        files: [writeResult.uri],
        dialogTitle: 'Save or Share Backup'
      });

      return {
        success: true,
        filename,
        message: 'Backup exported successfully!'
      };
    } catch (err: any) {
      const errStr = String(err?.message || err || '').toLowerCase();
      // If user simply closed/canceled the share sheet, treat as normal cancellation
      if (errStr.includes('cancel') || errStr.includes('dismiss')) {
        return {
          success: true,
          canceled: true,
          filename,
          message: 'Export share dismissed.'
        };
      }

      console.warn('[BackupService] Native file export failed, falling back to browser download:', err);
    }
  }

  // Web / PWA fallback
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
      message: 'Backup downloaded successfully!'
    };
  } catch (webErr: any) {
    console.error('[BackupService] Web download failed:', webErr);
    throw new Error(webErr?.message || 'Failed to trigger file download.');
  }
}
