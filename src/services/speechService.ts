/**
 * NutriFit AI - Speech Recognition Service
 * 
 * Provides unified cross-platform voice transcription:
 * - On Native Android (Capacitor APK): Uses @capgo/capacitor-speech-recognition with native Android SpeechRecognizer
 *   and handles runtime RECORD_AUDIO permissions natively.
 * - On Web / PWA: Uses standard Web Speech API (webkitSpeechRecognition) with graceful fallback and clear error reporting.
 */

import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { isNativeAndroid } from './healthBridge';

export interface SpeechCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError: (errorMessage: string) => void;
  onStateChange?: (isListening: boolean) => void;
}

let webRecognitionInstance: any = null;
let isWebListening = false;
let isNativeListening = false;

/**
 * Checks whether speech recognition is supported on the current device / platform
 */
export async function isSpeechRecognitionSupported(): Promise<boolean> {
  if (isNativeAndroid()) {
    try {
      const avail = await SpeechRecognition.available();
      return avail.available ?? true;
    } catch {
      return true; // Assume true on Android, start() will verify
    }
  }

  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

/**
 * Ensures microphone and speech recognition permissions are granted.
 * Prompts the user on native Android if not already granted.
 */
export async function ensureMicrophonePermission(): Promise<boolean> {
  if (isNativeAndroid()) {
    try {
      const check = await SpeechRecognition.checkPermissions();
      if (check.speechRecognition === 'granted') {
        return true;
      }

      const requested = await SpeechRecognition.requestPermissions();
      return requested.speechRecognition === 'granted';
    } catch (err) {
      console.warn('[SpeechService] Permission request failed:', err);
      return false;
    }
  }

  // Web environment: test microphone permission via MediaDevices if supported
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => {
        try { track.stop(); } catch {}
      });
      return true;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return false;
      }
      // Other errors might just be device busy; let speech recognition attempt
      return true;
    }
  }

  return true;
}

/**
 * Starts speech recognition session with real-time transcript streaming
 */
export async function startListening(callbacks: SpeechCallbacks): Promise<void> {
  const isNative = isNativeAndroid();

  if (isNative) {
    try {
      // 1. Ensure permission is granted
      const hasPermission = await ensureMicrophonePermission();
      if (!hasPermission) {
        callbacks.onError('Microphone permission blocked. Please enable Microphone access in your Android device settings, or switch to typing.');
        callbacks.onStateChange?.(false);
        return;
      }

      // 2. Remove any lingering listeners
      try {
        await SpeechRecognition.removeAllListeners();
      } catch {}

      // 3. Register real-time listeners
      await SpeechRecognition.addListener('partialResults', (data) => {
        const text = data.accumulatedText || (data.matches && data.matches[0]) || '';
        if (text) {
          callbacks.onTranscript(text, false);
        }
      });

      await SpeechRecognition.addListener('listeningState', (data) => {
        if (data.status === 'stopped' || data.state === 'stopped') {
          isNativeListening = false;
          callbacks.onStateChange?.(false);
        } else if (data.status === 'started' || data.state === 'started') {
          isNativeListening = true;
          callbacks.onStateChange?.(true);
        }
      });

      await SpeechRecognition.addListener('error', (err) => {
        console.warn('[SpeechService] Native speech error:', err);
        isNativeListening = false;
        callbacks.onStateChange?.(false);

        let userMsg = 'Speech recognition encountered an issue. You can type your meal instead.';
        if (err.message && err.message.toLowerCase().includes('permission')) {
          userMsg = 'Microphone permission blocked. Please allow microphone access in device settings.';
        } else if (err.code === 'no-speech' || (err.message && err.message.toLowerCase().includes('no speech'))) {
          // Normal silence, don't show alarming error
          return;
        } else if (err.message) {
          userMsg = `${err.message}. You can also type your meal.`;
        }
        callbacks.onError(userMsg);
      });

      // 4. Start native Android recognizer
      isNativeListening = true;
      callbacks.onStateChange?.(true);

      await SpeechRecognition.start({
        language: 'en-US',
        maxResults: 5,
        partialResults: true,
        popup: false,
      });

      return;
    } catch (err: any) {
      console.warn('[SpeechService] Native SpeechRecognition start error, attempting Web Speech fallback:', err);
      isNativeListening = false;
      callbacks.onStateChange?.(false);
      // Fall through to Web Speech API fallback
    }
  }

  // Web Speech API implementation
  const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionAPI) {
    callbacks.onError('Speech recognition is not supported in this browser. Please type your meal.');
    callbacks.onStateChange?.(false);
    return;
  }

  if (webRecognitionInstance) {
    try { webRecognitionInstance.abort(); } catch {}
  }

  const recognition = new SpeechRecognitionAPI();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event: any) => {
    let currentUtterance = '';
    for (let i = 0; i < event.results.length; i++) {
      currentUtterance += event.results[i][0]?.transcript || '';
    }
    callbacks.onTranscript(currentUtterance.replace(/\s+/g, ' ').trim(), false);
  };

  recognition.onerror = (event: any) => {
    console.warn('[SpeechService] Web Speech error:', event.error);
    isWebListening = false;
    callbacks.onStateChange?.(false);

    if (event.error === 'not-allowed') {
      callbacks.onError('Microphone permission blocked. Please allow microphone access in your browser or device settings, or switch to typing.');
    } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
      callbacks.onError(`Microphone error: ${event.error}. You can also type your meal.`);
    }
  };

  recognition.onend = () => {
    isWebListening = false;
    callbacks.onStateChange?.(false);
  };

  webRecognitionInstance = recognition;
  isWebListening = true;
  callbacks.onStateChange?.(true);

  try {
    recognition.start();
  } catch (err: any) {
    console.warn('[SpeechService] Web speech start error:', err);
    isWebListening = false;
    callbacks.onStateChange?.(false);
    callbacks.onError('Could not start microphone. Please try again or type your meal.');
  }
}

/**
 * Stops any active speech recognition session
 */
export async function stopListening(): Promise<void> {
  if (isNativeAndroid() && isNativeListening) {
    try {
      await SpeechRecognition.stop();
    } catch (err) {
      console.warn('[SpeechService] Native stop error:', err);
    } finally {
      isNativeListening = false;
    }
  }

  if (webRecognitionInstance) {
    try {
      webRecognitionInstance.stop();
    } catch {}
    webRecognitionInstance = null;
    isWebListening = false;
  }
}
