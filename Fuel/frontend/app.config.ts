import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Fuel',
  slug: 'fuel',
  scheme: 'fuel',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: { bundleIdentifier: 'com.harshacodex.fuel', supportsTablet: false, usesAppleSignIn: true },
  android: { package: 'com.harshacodex.fuel' },
  web: { bundler: 'metro', output: 'single', favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    ['expo-camera', { cameraPermission: 'Fuel uses the camera to scan food barcodes.', microphonePermission: false, recordAudioAndroid: false }],
    // Needs the reversed iOS client ID at build time; skipped when unset so web, CI and screenshots still build.
    ...(process.env.GOOGLE_IOS_URL_SCHEME
      ? [['@react-native-google-signin/google-signin', { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME }] as [string, object]]
      : []),
  ],
};

export default config;
