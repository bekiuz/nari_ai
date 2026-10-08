import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uz.bekiuz.zuxrash',
  appName: 'Zuxrash AI',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
    },
  },
};

export default config;
