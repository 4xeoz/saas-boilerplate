import { apiFetch, ApiResponse, getBackendUrl } from "./client";

export type User = {
  id?: string;
  email?: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
};

export async function fetchCurrentUser(): Promise<ApiResponse<User>> {
  return apiFetch<User>("/auth/me");
}

export function getGoogleLoginUrl(): string {
  return `${getBackendUrl()}/auth/google`;
}
