// Same-origin API in production and Vite development. Optional separate backend.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function readJson(response: Response) {
    if (!response.ok) throw new Error(`Data request failed (${response.status}). Please retry.`);
    if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('The API returned an unexpected response. Please retry.');
    }
    return response.json();
}
