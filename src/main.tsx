import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { isNativeAndroid } from './services/healthBridge';
import { initAppUpdater } from './services/updaterService';
import { StatusBar } from '@capacitor/status-bar';
import { applyThemeToDOM } from './utils/themeUtils';
import { getInitialSettingsSynchronous } from './services/storageService';

// On native Android (Capacitor APK), notify Capgo updater that bundle initialized,
// dynamically configure status bar matching user's selected theme (light vs dark),
// unregister any service workers, and purge CacheStorage so fresh assets are served.
if (isNativeAndroid()) {
  initAppUpdater();
  try {
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    const initialSettings = getInitialSettingsSynchronous();
    applyThemeToDOM(initialSettings.themeMode || 'pure_black');
  } catch {}
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {});
      }
    });
  }
  if ('caches' in window) {
    caches.keys().then(keys => {
      for (const key of keys) {
        caches.delete(key).catch(() => {});
      }
    });
  }
} else {
  // On PWA (Web / Desktop), register service worker cleanly on startup
  if ('serviceWorker' in navigator) {
    import('virtual:pwa-register').then(({ registerSW }) => {
      registerSW({ immediate: true });
    }).catch(() => {});
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
