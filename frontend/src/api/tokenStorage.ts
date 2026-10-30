// The access token lives in memory only; the refresh token never reaches JavaScript on the web.
let accessToken: string | null = null;
const listeners = new Set<() => void>();

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
};
