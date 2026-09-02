import type { CapacitorConfig } from '@capacitor/cli';

// Bundle local par défaut (conforme Apple guideline 4.2).
// Mises à jour OTA via @capgo/capacitor-updater (guideline 4.5.5).
// Pour développement local avec server.url, exporter CAP_SERVER_URL.
const remoteUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.marque.gestion',
  appName: 'OpenPulse Gestion',
  webDir: 'dist',
  ...(remoteUrl
    ? {
        server: {
          url: remoteUrl,
          cleartext: false,
        },
      }
    : {}),
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    CapacitorUpdater: {
      autoUpdate: true,
      // Voir https://capgo.app pour configurer CAPGO_APP_ID + CAPGO_API_KEY
      // côté secrets CI/CD pour les uploads de bundles OTA.
    },
  },
};

export default config;
