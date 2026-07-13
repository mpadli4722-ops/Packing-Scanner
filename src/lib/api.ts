/// <reference types="vite/client" />

// API configuration and URL resolution helpers
export const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

/**
 * Resolves a relative API path to a fully qualified URL if VITE_API_URL is set,
 * or returns the relative path for unified routing.
 * @param path The relative endpoint path (e.g. "/api/auth/login")
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
