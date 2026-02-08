import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clipduel.app',
  appName: 'ClipDuel',
  webDir: 'dist',
  server: {
    // In dev, load from Vite dev server instead of built files
    // url: 'http://192.168.x.x:5173',
    // cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_clipduel',
      iconColor: '#f59e0b',
      sound: 'timer_done.wav'
    }
  }
};

export default config;
