/**
 * Frontend env config - single source for API base URL.
 * Dev: /api/v1 (Vite proxy to backend).
 * Prod: VITE_API_BASE_URL or /api/v1 (same-origin proxy).
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  '/api/v1';
