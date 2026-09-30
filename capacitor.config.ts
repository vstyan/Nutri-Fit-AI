import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nutrifit.ai',
  appName: 'NutriFit AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
