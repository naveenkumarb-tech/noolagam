import type { CapacitorConfig } from "@capacitor/cli";

// Android blocks plain http:// by default. Testing against a laptop on the same Wi-Fi needs it allowed,
// and the app's own pages must be http too, or the WebView refuses to call the API. An https:// API needs neither.
const usesPlainHttp = (process.env.VITE_API_URL ?? "").startsWith("http://");

const config: CapacitorConfig = {
  appId: "com.noolagam.app",
  appName: "Noolagam",
  webDir: "dist",
  server: usesPlainHttp ? { androidScheme: "http", cleartext: true } : undefined,
};

export default config;
