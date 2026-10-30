import { apiClient } from "./client";

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
};

export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/login", credentials);
  return data;
}

// Registering also logs the user in: unverified users can use the app and see a "verify your email" banner.
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
  await apiClient.post("/auth/logout");
}

export async function verifyEmail(token: string): Promise<void> {
  await apiClient.post("/auth/verify-email", { token });
}

export async function resendVerification(email: string): Promise<void> {
  await apiClient.post("/auth/resend-verification", { email });
}
