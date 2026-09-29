// Development falls back to the local backend. A production build with no
// VITE_API_BASE_URL uses same-origin relative URLs (the site and /api served
// from one host behind a reverse proxy) instead of silently calling
// localhost:5000 from every visitor's browser.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.PROD ? "" : "http://localhost:5000");
