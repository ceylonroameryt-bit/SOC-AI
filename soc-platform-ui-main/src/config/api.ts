// API Base URL - automatically resolves for both dev and production
// In development (any localhost / 127.0.0.1 port): proxies to backend on http://localhost:3000
// In production (same-origin deployment): uses relative URLs (empty string)
const host = window.location.hostname;
const isDev = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
export const API_BASE = isDev ? 'http://localhost:3000' : '';
