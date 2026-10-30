import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient, refreshAccessToken, refreshClient } from "./client";
import { tokenStorage } from "./tokenStorage";

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown = {}) {
  const response = { status, data, headers: {}, config, statusText: "", request: {} } as AxiosResponse;
  if (status >= 400) {
    return Promise.reject(new AxiosError("failed", undefined, config, null, response));
  }
  return Promise.resolve(response);
}

describe("apiClient", () => {
  const originalApiAdapter = apiClient.defaults.adapter;
  const originalRefreshAdapter = refreshClient.defaults.adapter;
  let refreshAdapter: ReturnType<typeof vi.fn<AxiosAdapter>>;
  let seenTokens: (string | undefined)[];

  // Accepts only the token named "fresh", like an API whose current access token has expired.
  const apiAdapter: AxiosAdapter = (config) => {
    const header = config.headers.Authorization as string | undefined;
    seenTokens.push(header);
    return respond(config, header === "Bearer fresh" ? 200 : 401, { ok: true });
  };

  beforeEach(() => {
    seenTokens = [];
    refreshAdapter = vi.fn<AxiosAdapter>((config) => respond(config, 200, { access_token: "fresh" }));
    apiClient.defaults.adapter = apiAdapter;
    refreshClient.defaults.adapter = refreshAdapter;
    tokenStorage.setAccessToken("expired");
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalApiAdapter;
    refreshClient.defaults.adapter = originalRefreshAdapter;
    tokenStorage.setAccessToken(null);
  });

  it("sends the access token", async () => {
    tokenStorage.setAccessToken("fresh");

    await apiClient.get("/books");

    expect(seenTokens).toEqual(["Bearer fresh"]);
  });

  it("refreshes once on a 401 and retries with the new token", async () => {
    const response = await apiClient.get("/books");

    expect(response.data).toEqual({ ok: true });
    expect(seenTokens).toEqual(["Bearer expired", "Bearer fresh"]);
    expect(refreshAdapter).toHaveBeenCalledTimes(1);
    expect(tokenStorage.getAccessToken()).toBe("fresh");
  });

  it("shares one refresh between requests that fail together", async () => {
    await Promise.all([apiClient.get("/books"), apiClient.get("/books/counts"), apiClient.get("/users/me")]);

    expect(refreshAdapter).toHaveBeenCalledTimes(1);
  });

  it("logs the user out when the refresh token is rejected", async () => {
    refreshAdapter.mockImplementation((config) => respond(config, 401));

    await expect(apiClient.get("/books")).rejects.toThrow();

    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it("keeps the session when the refresh fails because of the network", async () => {
    refreshAdapter.mockRejectedValue(new AxiosError("Network Error", AxiosError.ERR_NETWORK));

    await expect(apiClient.get("/books")).rejects.toThrow();

    expect(tokenStorage.getAccessToken()).toBe("expired");
  });

  it("does not refresh for a 401 from an auth endpoint", async () => {
    await expect(apiClient.post("/auth/login", {})).rejects.toThrow();

    expect(refreshAdapter).not.toHaveBeenCalled();
    expect(seenTokens).toHaveLength(1);
  });

  it("does not retry forever if the new token is rejected too", async () => {
    refreshAdapter.mockImplementation((config) => respond(config, 200, { access_token: "also-rejected" }));

    await expect(apiClient.get("/books")).rejects.toThrow();

    expect(seenTokens).toHaveLength(2);
    expect(refreshAdapter).toHaveBeenCalledTimes(1);
  });

  it("allows a new refresh after the previous one finished", async () => {
    await refreshAccessToken();
    await refreshAccessToken();

    expect(refreshAdapter).toHaveBeenCalledTimes(2);
  });
});
