import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, Sparkles, X } from 'lucide-react';

export const UpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        // Periodically check for new updates every 30 minutes
        setInterval(() => {
          registration.update().catch((err) => {
            console.warn('[NutriFit PWA] Periodic update check failed:', err);
          });
        }, 30 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[NutriFit PWA] Service worker registration error:', error);
    },
  });

  // Check for updates when app tab/window becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.update().catch((err) => {
              console.warn('[NutriFit PWA] Visibility update check failed:', err);
            });
          })
          .catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!needRefresh) {
    return null;
  }

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
                Update Available
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                  New
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                A new version of NutriFit AI is ready with improvements!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition shrink-0"
            title="Dismiss"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-md shadow-cyan-500/20 flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh & Update</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
