import { StatusBar, Style } from '@capacitor/status-bar';
import { isNativeAndroid } from '../services/healthBridge';
import { ThemeMode } from '../types';

/**
 * Applies theme CSS classes to the document root, updates the meta theme-color,
 * and dynamically synchronizes native Android status bar background and icon appearance (light vs dark).
 */
export function applyThemeToDOM(theme: ThemeMode) {
  const root = document.documentElement;
  const metaThemeColor = document.getElementById('app-theme-color');
  root.classList.remove('theme-pure-black', 'theme-midnight', 'theme-teal-breeze', 'theme-nordic-teal', 'theme-apple');

  const isLight = theme === 'teal_breeze' || (theme as string) === 'nordic_teal';
  const bgColor = isLight ? '#F0FDFA' : (theme === 'midnight_slate' ? '#020617' : '#000000');

  if (isLight) {
    root.classList.add('theme-teal-breeze');
    if (metaThemeColor) metaThemeColor.setAttribute('content', '#F0FDFA');
  } else if (theme === 'midnight_slate') {
    root.classList.add('theme-midnight');
    if (metaThemeColor) metaThemeColor.setAttribute('content', '#020617');
  } else {
    root.classList.add('theme-pure-black');
    if (metaThemeColor) metaThemeColor.setAttribute('content', '#000000');
  }

  // Dynamically synchronize the native Android status bar
  if (isNativeAndroid()) {
    try {
      // In @capacitor/status-bar:
      // Style.Light = Dark text/icons for light backgrounds (Teal Breeze)
      // Style.Dark  = Light/white text/icons for dark backgrounds (Midnight Slate / Pure Black)
      StatusBar.setStyle({
        style: isLight ? Style.Light : Style.Dark
      }).catch(() => {});

      StatusBar.setBackgroundColor({
        color: bgColor
      }).catch(() => {});
    } catch (err) {
      console.warn('[ThemeUtils] Failed to sync native status bar:', err);
    }
  }
}
