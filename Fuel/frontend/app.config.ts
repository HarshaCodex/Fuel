import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Fuel',
  slug: 'fuel',
  scheme: 'fuel',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: { bundleIdentifier: 'com.harshacodex.fuel', supportsTablet: false },
  android: { package: 'com.harshacodex.fuel' },
  web: { bundler: 'metro', output: 'single', favicon: './assets/favicon.png' },
  plugins: ['expo-router', 'expo-secure-store'],
};

export default config;
