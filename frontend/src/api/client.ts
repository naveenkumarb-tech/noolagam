import axios, { isAxiosError, type InternalAxiosRequestConfig } from "axios";

import { isNativeApp, tokenStorage, type SessionTokens } from "./tokenStorage";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
};

const clientConfig = {
  baseURL: `${import.meta.env.VITE_API_URL ?? ""}/api/v1`,
  // Lets the browser send and store the httpOnly refresh cookie.
  withCredentials: true,
};

export const apiClient = axios.create(clientConfig);

// Has no interceptors, so a failed refresh cannot trigger another refresh.
export const refreshClient = axios.create(clientConfig);

let refreshInFlight: Promise<string> | null = null;

function withRefreshLock<T>(refresh: () => Promise<T>): Promise<T> {
  // Tabs take turns, because refreshing rotates the token and reusing an old one ends every session.
  // navigator.locks needs HTTPS or localhost, so a phone on plain http:// over the LAN goes without it.
  return navigator.locks ? navigator.locks.request("noolagam-refresh", refresh) : refresh();
}

async function requestNewTokens(): Promise<SessionTokens> {
  if (!isNativeApp()) {
    const { data } = await refreshClient.post<SessionTokens>("/auth/refresh");
    return data;
  }
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error("No saved session");
  }
  const { data } = await refreshClient.post<SessionTokens>("/auth/refresh", { refresh_token: refreshToken });
  return data;
}

export function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= withRefreshLock(async () => {
    try {
      const tokens = await requestNewTokens();
      await tokenStorage.saveSession(tokens);
      return tokens.access_token;
    } catch (error) {
      // Only a rejected session logs the user out; a dropped connection may recover.
      if (isAxiosError(error) && error.response?.status === 401) {
        await tokenStorage.clearSession();
      }
      throw error;
    }
  }).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (isNativeApp()) {
    // Asks for the refresh token in the response, as an app has nowhere to keep a cookie between launches.
    config.headers["X-Client-Type"] = "native";
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

apiClient.interceptors.response.use(undefined, async (error: unknown) => {
  if (!isAxiosError(error) || error.response?.status !== 401 || !error.config) {
    throw error;
  }
  const config: RetriableConfig = error.config;
  // A 401 from an auth endpoint means wrong credentials, not an expired access token.
  if (config._retried || config.url?.startsWith("/auth/")) {
    throw error;
  }
  config._retried = true;
  await refreshAccessToken();
  return apiClient(config);
});
