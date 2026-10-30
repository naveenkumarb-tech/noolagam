import { apiClient } from "./client";
import type { SessionTokens } from "./tokenStorage";

export type User = {
  id: number;
  name: string;
  email: string;
};

export async function getCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>("/users/me");
  return data;
}

export async function updateProfile(name: string): Promise<User> {
  const { data } = await apiClient.patch<User>("/users/me", { name });
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<SessionTokens> {
  const { data } = await apiClient.post<SessionTokens>("/users/me/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
}
