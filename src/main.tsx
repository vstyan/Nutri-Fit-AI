import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { isNativeAndroid } from './services/healthBridge';
import { initAppUpdater } from './services/updaterService';

// On native Android (Capacitor APK), notify Capgo updater that bundle initialized,
// unregister any service workers, and purge CacheStorage so fresh assets are served.
if (isNativeAndroid()) {
  initAppUpdater();
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
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
