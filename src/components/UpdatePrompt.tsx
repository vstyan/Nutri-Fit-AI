import React, { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, Sparkles, X, ShieldCheck, Download } from 'lucide-react';
import { APP_VERSION } from '../types';
import { isNativeAndroid } from '../services/healthBridge';
import { checkForRemoteUpdate, applyAndroidOTAUpdate, getDirectApkDownloadUrl } from '../services/updaterService';

interface VersionInfo {
  version: string;
  releaseDate?: string;
  notes?: string;
  checksum?: string;
}

const PWAUpdatePromptContent: React.FC = () => {
  const [remoteVersionInfo, setRemoteVersionInfo] = useState<VersionInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('[NutriFit PWA] Service worker registration error:', error);
    },
  });

  // Check version.json safely without triggering background service worker downloads
  useEffect(() => {
    let isMounted = true;

    const checkRemoteVersion = async () => {
      try {
        const res = await fetch('./version.json?t=' + Date.now(), { 
          cache: 'no-store',
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) return;
        const data: VersionInfo = await res.json();
        
        if (!isMounted) return;

        // If remote version is different from currently running build
        if (data.version && data.version !== APP_VERSION) {
          const deferredVersion = localStorage.getItem('nutrifit_deferred_version');
          if (deferredVersion !== data.version) {
            setRemoteVersionInfo(data);
            // Proactively trigger service worker update in background so it's ready on 1st click
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistration().then(reg => {
                reg?.update().catch(() => {});
              }).catch(() => {});
            }
          }
        }
      } catch (e) {
        // Offline or network error - silently skip
      }
    };

    checkRemoteVersion();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDeferUpdate = () => {
    if (remoteVersionInfo?.version) {
      localStorage.setItem('nutrifit_deferred_version', remoteVersionInfo.version);
    }
    setIsDismissed(true);
    setNeedRefresh(false);
  };

  const handleAcceptUpdate = async () => {
    setIsUpdating(true);
    localStorage.removeItem('nutrifit_deferred_version');

    let reloaded = false;
    const reloadOnce = () => {
      if (!reloaded) {
        reloaded = true;
        window.location.reload();
      }
    };

    try {
      if ('serviceWorker' in navigator) {
        // Reload as soon as the new service worker activates and claims control
        navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true });

        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          // Case 1: Service worker is already waiting in background
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            setTimeout(reloadOnce, 1500);
            return;
          }

          // Case 2: Service worker is currently downloading/installing
          if (reg.installing) {
            const installing = reg.installing;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed') {
                installing.postMessage({ type: 'SKIP_WAITING' });
              }
            });
            setTimeout(reloadOnce, 3000);
            return;
          }

          // Case 3: Need to fetch update and wait for install
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          }, { once: true });

          await reg.update().catch(() => {});

          const postWaiting = (reg as any).waiting;
          if (postWaiting) {
            postWaiting.postMessage({ type: 'SKIP_WAITING' });
            setTimeout(reloadOnce, 1500);
            return;
          }
        }
      }

      await updateServiceWorker(true).catch(() => {});
    } catch (err) {
      console.warn('Update trigger encountered an issue:', err);
    }

    // Safety fallback: Clean caches and reload if controllerchange hasn't fired after 2.5s
    setTimeout(async () => {
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch {}
      reloadOnce();
    }, 2500);
  };

  // Only show if user has not dismissed this version AND (remote update is detected OR service worker is waiting)
  const shouldShow = !isDismissed && (Boolean(remoteVersionInfo) || needRefresh);

  if (!shouldShow) {
    return null;
  }

  const targetVersion = remoteVersionInfo?.version || 'new version';
  const releaseNotes = remoteVersionInfo?.notes || 'Includes stability improvements and latest features.';

  return (
    <aside 
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 fade-in duration-300"
      style={{
        marginBottom: 'max(0px, env(safe-area-inset-bottom, 0px))'
      }}
      role="alert"
      aria-live="assertive"
    >
      <div className="bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-4 shadow-2xl shadow-cyan-950/60 flex flex-col gap-3 ring-1 ring-cyan-500/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20 shrink-0">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                Update Available (v{targetVersion})
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                  Manual Approval
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {releaseNotes}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDeferUpdate}
            disabled={isUpdating}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition shrink-0"
            title="Keep Current Version"
            aria-label="Keep Current Version"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl px-2.5 py-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>You are on <strong>v{APP_VERSION}</strong>. NutriFit will never update without your explicit permission.</span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleDeferUpdate}
            disabled={isUpdating}
            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
          >
            Keep Current Version
          </button>
          <button
            type="button"
            onClick={handleAcceptUpdate}
            disabled={isUpdating}
            className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition shadow-md shadow-cyan-500/20 flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Installing Update...' : 'Accept & Install'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

const NativeAndroidUpdatePromptContent: React.FC = () => {
  const [remoteVersionInfo, setRemoteVersionInfo] = useState<VersionInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    checkForRemoteUpdate().then(data => {
      if (!isMounted || !data) return;
      const deferredVersion = localStorage.getItem('nutrifit_deferred_version');
      if (deferredVersion !== data.version) {
        setRemoteVersionInfo(data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDeferUpdate = () => {
    if (remoteVersionInfo?.version) {
      localStorage.setItem('nutrifit_deferred_version', remoteVersionInfo.version);
    }
    setIsDismissed(true);
  };

  const handleAcceptUpdate = async () => {
    if (!remoteVersionInfo?.version) return;
    setIsUpdating(true);
    setUpdateError(null);
    localStorage.removeItem('nutrifit_deferred_version');

    try {
      await applyAndroidOTAUpdate(remoteVersionInfo.version, remoteVersionInfo.checksum);
    } catch (err: any) {
      console.error('[NutriFit Updater] Failed to apply OTA update:', err);
      setUpdateError(err?.message || 'Failed to download update bundle. Please try again.');
      setIsUpdating(false);
    }
  };

  if (isDismissed || !remoteVersionInfo) {
    return null;
  }

  const targetVersion = remoteVersionInfo.version;
  const releaseNotes = remoteVersionInfo.notes || 'Includes stability improvements, calorie sync fixes, and latest features.';

  return (
    <aside 
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 fade-in duration-300"
      style={{
        marginBottom: 'max(0px, env(safe-area-inset-bottom, 0px))'
      }}
      role="alert"
      aria-live="assertive"
    >
      <div className="bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-4 shadow-2xl shadow-cyan-950/60 flex flex-col gap-3 ring-1 ring-cyan-500/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20 shrink-0">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                Update Available (v{targetVersion})
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                  In-App OTA
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {releaseNotes}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDeferUpdate}
            disabled={isUpdating}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition shrink-0 cursor-pointer"
            title="Keep Current Version"
            aria-label="Keep Current Version"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {updateError && (
          <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-500/30 rounded-xl p-2.5 space-y-2">
            <div>{updateError}</div>
            <a
              href={getDirectApkDownloadUrl(targetVersion)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download v{targetVersion} APK Directly</span>
            </a>
          </div>
        )}

        <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl px-2.5 py-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>You are on <strong>v{APP_VERSION}</strong>. NutriFit will apply updates seamlessly without reinstalling.</span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
          <button
            type="button"
            onClick={handleDeferUpdate}
            disabled={isUpdating}
            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
          >
            Keep Current Version
          </button>
          <a
            href={getDirectApkDownloadUrl(targetVersion)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:bg-slate-800/80 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            title="Download APK directly from GitHub"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download APK</span>
          </a>
          <button
            type="button"
            onClick={handleAcceptUpdate}
            disabled={isUpdating}
            className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition shadow-md shadow-cyan-500/20 flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Updating in App...' : 'Accept & Install'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export const UpdatePrompt: React.FC = () => {
  if (isNativeAndroid()) {
    return <NativeAndroidUpdatePromptContent />;
  }
  return <PWAUpdatePromptContent />;
};
