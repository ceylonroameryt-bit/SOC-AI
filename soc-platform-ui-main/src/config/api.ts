// API Base URL - automatically resolves for both dev and production
// In development (Vite on any port except 3000): uses http://localhost:3000
// In production (Azure, same-origin): uses relative URLs (empty string)
const isDev = ['5173', '5174', '5175', '5176', '4173'].includes(window.location.port);
export const API_BASE = isDev ? 'http://localhost:3000' : '';
