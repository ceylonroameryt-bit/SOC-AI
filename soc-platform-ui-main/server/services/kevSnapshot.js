const CATALOG_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

// Cache successful catalog responses; failed refreshes retain their original timestamp.
export function createKevReader(fetcher = fetch, clock = Date.now) {
    let cached = null;
    let attemptedAt = null;
    let pending = null;
    return async function readCatalog() {
        const now = clock();
        if (attemptedAt !== null && now - attemptedAt < (cached?.status === 'available' ? 3600000 : 60000)) {
            return cached;
        }
        if (pending) return pending;
        pending = (async () => {
            try {
                const response = await fetcher(CATALOG_URL, { signal: AbortSignal.timeout(5000) });
                if (!response.ok) throw new Error('Catalog request failed');
                const data = await response.json();
                if (!Array.isArray(data.vulnerabilities)) throw new Error('Invalid catalog');
                cached = {
                    status: 'available', total: data.vulnerabilities.length,
                    lastUpdated: data.dateReleased || null, retrievedAt: new Date(now).toISOString(),
                    sourceUrl: CATALOG_URL,
                    featured: [...data.vulnerabilities].sort((a, b) => String(b.dateAdded).localeCompare(String(a.dateAdded))).slice(0, 5).map(v => ({
                        id: v.cveID, description: v.vulnerabilityName || v.shortDescription,
                        vendor: v.vendorProject, dateAdded: v.dateAdded, isKEV: true,
                        cvss: null, epss: null,
                    })),
                };
            } catch {
                cached = cached && cached.total !== null ? { ...cached, status: 'stale' }
                    : { total: null, lastUpdated: null, retrievedAt: null, featured: [], status: 'unavailable', sourceUrl: CATALOG_URL };
            } finally {
                attemptedAt = clock();
                pending = null;
            }
            return cached;
        })();
        return pending;
    };
}

export const getKevSnapshot = createKevReader();
