import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gogadanelia.plate',
  appName: 'Plate',
  webDir: 'dist',
  // Plate's dark background, shown while the app starts instead of a white flash.
  backgroundColor: '#101210',
  ios: {
    backgroundColor: '#101210',
  },
};

export default config;
