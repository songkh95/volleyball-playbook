import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "kr.volleyball.playbook",
  appName: "배구 전술 보드",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#1a1a2e",
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#1a1a2e",
    },
  },
};

export default config;
