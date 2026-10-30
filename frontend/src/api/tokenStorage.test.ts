import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logout } from "./auth";
import { apiClient, refreshAccessToken, refreshClient } from "./client";
import { tokenStorage } from "./tokenStorage";

vi.mock("@capacitor/preferences", () => {
  const saved = new Map<string, string>();
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({ value: saved.get(key) ?? null })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => void saved.set(key, value)),
      remove: vi.fn(async ({ key }: { key: string }) => void saved.delete(key)),
    },
  };
});

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown = {}) {
  const response = { status, data, headers: {}, config, statusText: "", request: {} } as AxiosResponse;
  if (status >= 400) {
    return Promise.reject(new AxiosError("failed", undefined, config, null, response));
  }
  return Promise.resolve(response);
}

describe("sessions in the Android app", () => {
  const originalApi = apiClient.defaults.adapter;
  const originalRefresh = refreshClient.defaults.adapter;
  let refreshAdapter: ReturnType<typeof vi.fn<AxiosAdapter>>;
  let apiAdapter: ReturnType<typeof vi.fn<AxiosAdapter>>;

  beforeEach(async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    await tokenStorage.clearSession();
    refreshAdapter = vi.fn<AxiosAdapter>((config) =>
      respond(config, 200, { access_token: "new-access", refresh_token: "new-refresh" }),
    );
    apiAdapter = vi.fn<AxiosAdapter>((config) => respond(config, 200));
    refreshClient.defaults.adapter = refreshAdapter;
    apiClient.defaults.adapter = apiAdapter;
  });

  afterEach(async () => {
    apiClient.defaults.adapter = originalApi;
    refreshClient.defaults.adapter = originalRefresh;
    await tokenStorage.clearSession();
    vi.restoreAllMocks();
  });

  it("keeps the refresh token on the device, so it survives closing the app", async () => {
    await tokenStorage.saveSession({ access_token: "access", refresh_token: "refresh" });

    expect(await tokenStorage.getRefreshToken()).toBe("refresh");
    expect(Preferences.set).toHaveBeenCalledWith({ key: "refresh_token", value: "refresh" });
    expect(tokenStorage.getAccessToken()).toBe("access");
  });

  it("restores the session from the saved token and saves the rotated one", async () => {
    await tokenStorage.saveSession({ access_token: "old", refresh_token: "saved-refresh" });
    tokenStorage.setAccessToken(null);

    await refreshAccessToken();

    expect(JSON.parse(refreshAdapter.mock.calls[0][0].data)).toEqual({ refresh_token: "saved-refresh" });
    expect(tokenStorage.getAccessToken()).toBe("new-access");
    expect(await tokenStorage.getRefreshToken()).toBe("new-refresh");
  });

  it("doesn't call the server when nothing is saved, such as on first launch", async () => {
    await expect(refreshAccessToken()).rejects.toThrow("No saved session");

    expect(refreshAdapter).not.toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it("forgets a saved token the server has rejected", async () => {
    await tokenStorage.saveSession({ access_token: "old", refresh_token: "rejected" });
    refreshAdapter.mockImplementation((config) => respond(config, 401));

    await expect(refreshAccessToken()).rejects.toThrow();

    expect(await tokenStorage.getRefreshToken()).toBeNull();
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it("keeps the saved token when only the connection failed", async () => {
    await tokenStorage.saveSession({ access_token: "old", refresh_token: "still-good" });
    refreshAdapter.mockRejectedValue(new AxiosError("Network Error", AxiosError.ERR_NETWORK));

    await expect(refreshAccessToken()).rejects.toThrow();

    expect(await tokenStorage.getRefreshToken()).toBe("still-good");
  });

  it("identifies itself as the app on API requests", async () => {
    await apiClient.post("/auth/login", {});

    expect(apiAdapter.mock.calls[0][0].headers["X-Client-Type"]).toBe("native");
  });

  it("sends the saved token when logging out", async () => {
    await tokenStorage.saveSession({ access_token: "access", refresh_token: "to-revoke" });

    await logout();

    expect(JSON.parse(apiAdapter.mock.calls[0][0].data)).toEqual({ refresh_token: "to-revoke" });
  });

  it("removes everything when the session ends", async () => {
    await tokenStorage.saveSession({ access_token: "access", refresh_token: "refresh" });

    await tokenStorage.clearSession();

    expect(await tokenStorage.getRefreshToken()).toBeNull();
    expect(tokenStorage.getAccessToken()).toBeNull();
  });
});

describe("sessions on the web", () => {
  it("never stores a refresh token, because the browser keeps it in a cookie", async () => {
    await tokenStorage.saveSession({ access_token: "access", refresh_token: "should-be-ignored" });

    expect(await tokenStorage.getRefreshToken()).toBeNull();
    expect(Preferences.set).not.toHaveBeenCalledWith({ key: "refresh_token", value: "should-be-ignored" });

    await tokenStorage.clearSession();
  });
});
