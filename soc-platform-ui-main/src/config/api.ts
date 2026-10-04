// API Base URL - automatically resolves for both dev and production
// When served from Express on any port or in production: uses relative URLs (empty string)
// When served from standalone Vite dev server (5173-5176): proxies to backend on VITE_API_URL or port 3001/3000
const host = typeof window !== 'undefined' ? window.location.hostname : '';
const port = typeof window !== 'undefined' ? window.location.port : '';
const isViteDev = (host === 'localhost' || host === '127.0.0.1') && ['5173', '5174', '5175', '5176'].includes(port);
export const API_BASE = isViteDev ? (import.meta.env.VITE_API_URL || 'http://localhost:3001') : '';

