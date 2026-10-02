import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportBackupFile } from '../services/backupExportService';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as storageService from '../services/storageService';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn()
  }
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: vi.fn()
  },
  Directory: {
    Cache: 'CACHE'
  },
  Encoding: {
    UTF8: 'utf8'
  }
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn()
  }
}));

describe('backupExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(storageService, 'exportAllDataAsJson').mockResolvedValue('{"test":"data"}');
    delete (globalThis as any).navigator;
    delete (globalThis as any).window;
  });

  it('exports via native Filesystem and Share when running on Android native platform', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Filesystem.writeFile).mockResolvedValue({ uri: 'file:///cache/nutrifit-backup.json' });
    vi.mocked(Share.share).mockResolvedValue({ activityType: 'com.google.android.apps.docs' });

    const result = await exportBackupFile();

    expect(result.success).toBe(true);
    expect(result.canceled).toBeUndefined();
    expect(result.message).toContain('Choose where to save your file');
    expect(Filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        data: '{"test":"data"}',
        directory: 'CACHE'
      })
    );
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: ['file:///cache/nutrifit-backup.json'],
        dialogTitle: 'Select Where to Save Backup'
      })
    );
  });

  it('handles user cancellation of native share gracefully', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Filesystem.writeFile).mockResolvedValue({ uri: 'file:///cache/nutrifit-backup.json' });
    vi.mocked(Share.share).mockRejectedValue(new Error('Share canceled'));

    const result = await exportBackupFile();

    expect(result.success).toBe(true);
    expect(result.canceled).toBe(true);
    expect(result.message).toBe('Export canceled.');
  });

  it('supports Web Share API with files in mobile PWA', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    const shareSpy = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).navigator = {
      share: shareSpy,
      canShare: vi.fn().mockReturnValue(true)
    };
    (globalThis as any).File = class MockFile {
      constructor(public parts: any[], public name: string, public options: any) {}
    };
    (globalThis as any).Blob = class MockBlob {
      constructor(public parts: any[], public options: any) {}
    };

    const result = await exportBackupFile();

    expect(result.success).toBe(true);
    expect(shareSpy).toHaveBeenCalled();
    expect(result.message).toContain('Choose where to save your file');
  });

  it('falls back to browser download', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    const clickSpy = vi.fn();
    const mockAnchor = {
      href: '',
      download: '',
      style: { display: '' },
      click: clickSpy
    };
    const appendSpy = vi.fn();
    const removeSpy = vi.fn();

    (globalThis as any).document = {
      createElement: vi.fn().mockReturnValue(mockAnchor),
      body: {
        appendChild: appendSpy,
        removeChild: removeSpy
      }
    };
    (globalThis as any).URL = {
      createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
      revokeObjectURL: vi.fn()
    };
    (globalThis as any).Blob = class MockBlob {
      constructor(public parts: any[], public options: any) {}
    };

    const result = await exportBackupFile();

    expect(result.success).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalledWith(mockAnchor);
    expect(removeSpy).toHaveBeenCalledWith(mockAnchor);
    expect(result.message).toContain('downloaded successfully');
  });
});
