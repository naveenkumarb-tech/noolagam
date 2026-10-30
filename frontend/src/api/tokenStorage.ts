import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const REFRESH_TOKEN_KEY = "refresh_token";

// The access token lives in memory only. The refresh token is an httpOnly cookie on the web, which
// JavaScript never sees, and is kept in the app's private storage on Android.
let accessToken: string | null = null;
const listeners = new Set<() => void>();

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export type SessionTokens = {
  access_token: string;
  refresh_token?: string;
};

export const tokenStorage = {
  getAccessToken: () => accessToken,
  setAccessToken: (token: string | null) => {
    accessToken = token;
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getRefreshToken: async (): Promise<string | null> => {
    if (!isNativeApp()) return null;
    const { value } = await Preferences.get({ key: REFRESH_TOKEN_KEY });
    return value;
  },

  /** Saves the refresh token before announcing the session, so that it is never lost if the app closes. */
  saveSession: async ({ access_token, refresh_token }: SessionTokens) => {
    if (isNativeApp() && refresh_token) {
      await Preferences.set({ key: REFRESH_TOKEN_KEY, value: refresh_token });
    }
    tokenStorage.setAccessToken(access_token);
  },

  clearSession: async () => {
    if (isNativeApp()) {
      await Preferences.remove({ key: REFRESH_TOKEN_KEY });
    }
    tokenStorage.setAccessToken(null);
  },
};
