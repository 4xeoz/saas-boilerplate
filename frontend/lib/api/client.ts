/**
 * API Client - Base HTTP utilities for backend communication
 * All API calls should use these helpers for consistent error handling
 */

const DEFAULT_BACKEND_URL = "http://localhost:4000";


export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL;
}


/**
 * Build a full SSE URL from a path.
 * Uses the same backend URL as regular API calls.
 */
export function getSseUrl(path: string): string {
  return `${getBackendUrl()}${path}`;
}

/**
 * The envelope types live in the shared package, so backend and frontend can
 * never drift. Re-exported here because every existing import points at this
 * file.
 *
 * ApiResponse<T> is the union of both shapes — what the wire actually carries.
 * ApiSuccess<T> is the success branch alone, and it is what apiFetch returns:
 * apiFetch throws on failure, so by the time a caller holds a value it can
 * only be the success shape. Typing it that way means callers read
 * `response.data` with no narrowing and no lie.
 */
export type { ApiResponse, ApiSuccess, ApiError } from "@saas/shared";

import type { ApiResponse, ApiSuccess } from "@saas/shared";

/**
 * The refresh request currently in flight, or null when none is running.
 *
 * A page routinely fires several requests at once, and when the 15 minute
 * access token has expired they all get a 401 together. Holding the promise
 * (rather than a boolean "someone is refreshing" flag) means the later callers
 * can await the same refresh and then retry, instead of giving up and throwing
 * an error on a session that is perfectly valid.
 */
let refreshPromise: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise === null) {
    refreshPromise = fetch(`${getBackendUrl()}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * Core fetch wrapper. Returns the full ApiResponse<T> from the backend.
 * Throws on non-OK HTTP status or when json.success === false.
 *
 * Use this in the API layer when you want the raw response shape.
 *
 * isRetry is internal: it marks the single retry that follows a successful
 * token refresh, so a retry can never trigger another refresh and recurse.
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  isRetry: boolean = false
): Promise<ApiSuccess<T>> {
  const url = `${getBackendUrl()}${endpoint}`;

  const headers: Record<string, string> = {
    ...(options?.body ? { "Content-Type": "application/json" } : {}),
    ...(options?.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });

  const shouldTryRefresh =
    response.status === 401 && endpoint !== "/auth/refresh" && !isRetry;

  if (shouldTryRefresh) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      // Retry once. isRetry stops this attempt from refreshing again, so a
      // request that keeps returning 401 fails instead of looping forever.
      return apiFetch<T>(endpoint, options, true);
    }

    throw new Error("Session expired.");
  }

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const errorJson = await response.json();
      errorMessage =
        (typeof errorJson.error === "string" && errorJson.error) ||
        (typeof errorJson.message === "string" && errorJson.message) ||
        errorMessage;
    } catch {
      const errorText = await response.text();
      if (errorText) errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }

  const json: ApiResponse<T> = await response.json();

  // A 200 carrying success:false should not happen, but the union makes the
  // possibility explicit — so handle it here instead of letting a caller read
  // `.data` and get undefined. After this check TypeScript knows the value is
  // ApiSuccess<T>, which is what the signature promises.
  if (!json.success) {
    throw new Error(json.message || json.error);
  }

  return json;
}


// /**
//  * Convenience wrapper that returns only the data payload.
//  * Use this in the intermediary layer or in components that don't need
//  * the full ApiResponse wrapper (success flag, message).
//  *
//  * Errors are still thrown — always wrap in try/catch.
//  */
// export async function apiFetchData<T>(
//   endpoint: string,
//   options?: RequestInit
// ): Promise<T> {
//   const response = await apiFetch<T>(endpoint, options);
//   return response.data;
// }
