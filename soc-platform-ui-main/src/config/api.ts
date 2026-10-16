// API Base URL - empty string routes requests to current origin (/api)
// In development, Vite dev server proxies /api -> http://localhost:3001
// In production, same-origin relative URLs (/api) are handled directly by the server
export const API_BASE = '';
