import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { isNativeAndroid } from './services/healthBridge';

// On native Android (Capacitor APK), unregister any service workers and purge CacheStorage
// so the WebView always serves freshly bundled local assets from the APK without stale caching.
if (isNativeAndroid()) {
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
