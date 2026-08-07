import { apiFetch, getBackendUrl } from "./client";
import type { ApiSuccess, PublicUser } from "@saas/shared";

/**
 * The user shape is defined once, in the shared package. This alias keeps the
 * existing `User` name working across the frontend.
 *
 * Note `name` is `string | null` — the backend's displayName is optional, so
 * anywhere that renders it must handle null. The old local type claimed
 * `string`, which is why `null` could reach the UI unnoticed.
 */
export type User = PublicUser;

export async function fetchCurrentUser(): Promise<ApiSuccess<User>> {
  return apiFetch<User>("/auth/me");
}

export function getGoogleLoginUrl(): string {
  return `${getBackendUrl()}/auth/google`;
}
