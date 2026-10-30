import { apiClient } from "./client";
import { tokenStorage } from "./tokenStorage";

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  refresh_token?: string;
};

export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/login", credentials);
  return data;
}

// Registering also logs the user in, so a new user goes straight to Home.
export async function register(account: RegisterRequest): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/register", account);
  return data;
}

export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post("/auth/forgot-password", { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await apiClient.post("/auth/reset-password", { token, password });
}

export async function logout(): Promise<void> {
  const refreshToken = await tokenStorage.getRefreshToken();
  await apiClient.post("/auth/logout", refreshToken ? { refresh_token: refreshToken } : undefined);
}
