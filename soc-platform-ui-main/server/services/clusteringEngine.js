/**
 * clusteringEngine.js
 * Multi-factor Hybrid Incident Clustering & Deduplication Engine.
 * Combines entity extraction (CVE, threat actor, ransomware family, vendor/product)
 * with TF-IDF cosine similarity, time-window proximity, and canonical URL normalization.
 */

// Known Threat Actors & Malware Families
const KNOWN_ENTITIES = [
    { name: 'LockBit 3.0', type: 'ransomware', aliases: ['lockbit', 'lockbit 3.0', 'lockbit black'] },
    { name: 'Akira', type: 'ransomware', aliases: ['akira ransomware', 'akira group', 'akira'] },
    { name: 'BlackCat / ALPHV', type: 'ransomware', aliases: ['blackcat', 'alphv'] },
    { name: 'Clop', type: 'ransomware', aliases: ['clop ransomware', 'cl0p'] },
    { name: 'Lumma Stealer', type: 'malware', aliases: ['lumma', 'lumma stealer', 'lummac2'] },
    { name: 'RedLine Stealer', type: 'malware', aliases: ['redline', 'redline stealer'] },
    { name: 'Cobalt Strike', type: 'tool', aliases: ['cobalt strike', 'beaconing'] },
    { name: 'Volt Typhoon', type: 'actor', aliases: ['volt typhoon', 'bronze silhouette'] },
    { name: 'Salt Typhoon', type: 'actor', aliases: ['salt typhoon', 'ghostemperor'] },
];

const KNOWN_PRODUCTS = [
    'Palo Alto PAN-OS',
    'Ivanti Connect Secure',
    'Ivanti Policy Secure',
    'Cisco ISE',
    'Fortinet FortiOS',
    'Microsoft Exchange',
    'Apache Log4j',
    'Atlassian Confluence',
    'Citrix NetScaler',
    'Windows Kernel',
];

const STOP_WORDS = new Set([
    'this', 'that', 'with', 'from', 'have', 'been', 'were', 'they',
    'their', 'them', 'there', 'then', 'than', 'will', 'would', 'could',
    'should', 'about', 'which', 'when', 'where', 'what', 'more', 'into',
    'also', 'after', 'over', 'such', 'some', 'each', 'most', 'both',
    'through', 'during', 'before', 'between', 'under', 'while', 'security',
    'cyber', 'threat', 'report', 'advisory', 'update', 'alert'
]);

/**
 * Normalizes and cleans a URL to canonical form for duplicate detection
 */
export function getCanonicalUrl(urlStr = '') {
    try {
        const u = new URL(urlStr);
        u.searchParams.delete('utm_source');
        u.searchParams.delete('utm_medium');
        u.searchParams.delete('utm_campaign');
        u.searchParams.delete('utm_content');
        u.searchParams.delete('utm_term');
        u.searchParams.delete('ref');
        u.hash = '';
        return u.toString().toLowerCase();
    } catch {
        return (urlStr || '').split('?')[0].toLowerCase();
    }
}

/**
 * Extracts entities (CVEs, threat actors, products) from text
 */
export function extractEntities(text = '') {
    const lower = text.toLowerCase();
    
    // 1. CVEs
    const cveMatches = text.match(/\bCVE-\d{4}-\d{4,7}\b/gi) || [];
    const cves = Array.from(new Set(cveMatches.map(c => c.toUpperCase())));

    // 2. Actors & Malware
    const matchedEntities = [];
    for (const entity of KNOWN_ENTITIES) {
        if (entity.aliases.some(alias => lower.includes(alias))) {
            matchedEntities.push(entity.name);
        }
    }

    // 3. Products
    const matchedProducts = [];
    for (const prod of KNOWN_PRODUCTS) {
        if (lower.includes(prod.toLowerCase())) {
            matchedProducts.push(prod);
        }
    }

    return {
        cves,
        threatEntities: matchedEntities,
        products: matchedProducts,
        all: [...cves, ...matchedEntities, ...matchedProducts],
    };
}

/**
 * Tokenizes text for TF-IDF similarity
 */
function tokenize(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 3 && !STOP_WORDS.has(t));
}

function computeTFIDF(docs) {
    const N = docs.length || 1;
    const tokenizedDocs = docs.map(tokenize);
    const dfMap = new Map();

    for (const tokens of tokenizedDocs) {
        const seen = new Set(tokens);
        for (const token of seen) {
            dfMap.set(token, (dfMap.get(token) || 0) + 1);
        }
    }

    return tokenizedDocs.map(tokens => {
        const vec = new Map();
        const total = tokens.length || 1;
        const freqMap = new Map();
        for (const token of tokens) freqMap.set(token, (freqMap.get(token) || 0) + 1);
        for (const [token, freq] of freqMap) {
            const tf = freq / total;
            const idf = Math.log(N / (dfMap.get(token) || 1));
            vec.set(token, tf * idf);
        }
        return vec;
    });
}

function cosineSimilarity(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    for (const [term, valA] of vecA) {
        const valB = vecB.get(term) || 0;
        dot += valA * valB;
        normA += valA * valA;
    }
    for (const val of vecB.values()) normB += val * val;
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
}

/**
 * Clusters a list of articles using evidence-based entity & semantic matching
 */
export function clusterArticles(articles = [], minClusterSize = 2) {
    const rawArticleCount = articles.length;
    if (rawArticleCount === 0) {
        return {
            clusters: [],
            rawArticleCount: 0,
            uniqueArticleCount: 0,
            duplicatesSuppressed: 0,
            deduplicationRate: 0,
        };
    }

    // Precompute entities and vectors
    const texts = articles.map(a => `${a.title || ''} ${a.contentSnippet || ''}`);
    const vectors = computeTFIDF(texts);
    const entitiesList = articles.map(a => extractEntities(`${a.title || ''} ${a.contentSnippet || ''}`));

    const assigned = new Set();
    const clusters = [];

    for (let i = 0; i < articles.length; i++) {
        if (assigned.has(i)) continue;

        const baseArticle = articles[i];
        const baseEntities = entitiesList[i];
        const clusterItems = [baseArticle];
        const sharedEntitiesSet = new Set(baseEntities.all);
        const articleSources = new Set([baseArticle.source].filter(Boolean));
        let highestConfidence = 0.85;
        let clusterReason = 'Shared narrative and indicator context';

        for (let j = i + 1; j < articles.length; j++) {
            if (assigned.has(j)) continue;

            const candidate = articles[j];
            const candEntities = entitiesList[j];

            // Condition 1: Same CVE (High Confidence)
            const sharedCves = baseEntities.cves.filter(c => candEntities.cves.includes(c));
            
            // Condition 2: Same Threat Actor / Malware Family (High Confidence)
            const sharedActors = baseEntities.threatEntities.filter(e => candEntities.threatEntities.includes(e));

            // Condition 3: Semantic similarity
            const sim = cosineSimilarity(vectors[i], vectors[j]);

            // Time proximity check: within 7 days (604800000 ms)
            const timeDiffMs = Math.abs(new Date(candidate.pubDate || 0).getTime() - new Date(baseArticle.pubDate || 0).getTime());
            const withinTimeWindow = isNaN(timeDiffMs) || timeDiffMs < 7 * 24 * 60 * 60 * 1000;

            let matches = false;
            let matchConfidence = 0;
            let matchReason = '';

            if (sharedCves.length > 0) {
                matches = true;
                matchConfidence = 0.95;
                matchReason = `Multiple independent reports tracking exploitation of ${sharedCves.join(', ')}`;
            } else if (sharedActors.length > 0 && (sim >= 0.20 || (withinTimeWindow && (sim >= 0.08 || baseArticle.sourceCategory === candidate.sourceCategory)))) {
                matches = true;
                matchConfidence = 0.90;
                matchReason = `Coordinated campaign activity associated with ${sharedActors.join(', ')}`;
            } else if (sim >= 0.65 && withinTimeWindow && (baseEntities.all.length > 0 || candEntities.all.length > 0)) {
                matches = true;
                matchConfidence = Math.round(sim * 100) / 100;
                matchReason = 'High semantic similarity and overlapping entity context';
            }

            if (matches && matchConfidence >= 0.70) {
                clusterItems.push(candidate);
                assigned.add(j);
                highestConfidence = Math.max(highestConfidence, matchConfidence);
                clusterReason = matchReason;
                if (candidate.source) articleSources.add(candidate.source);
                candEntities.all.forEach(e => sharedEntitiesSet.add(e));
            }
        }

        // Only emit if it reached minimum cluster size
        if (clusterItems.length >= minClusterSize) {
            assigned.add(i);
            const sortedByDate = [...clusterItems].sort((a, b) => new Date(a.pubDate || 0) - new Date(b.pubDate || 0));

            // Generate representative headline
            let headline = baseArticle.title;
            if (baseEntities.threatEntities.length > 0) {
                headline = `${baseEntities.threatEntities[0]} Campaign Waves`;
            } else if (baseEntities.cves.length > 0) {
                headline = `${baseEntities.cves[0]} Active Exploitation Cluster`;
            }

            clusters.push({
                id: `cluster-${i}-${Date.now()}`,
                headline,
                confidence: highestConfidence,
                sharedEntities: Array.from(sharedEntitiesSet),
                clusteringReason: clusterReason,
                itemCount: clusterItems.length,
                articleIds: clusterItems.map((_, idx) => `art-${idx}`),
                sources: Array.from(articleSources),
                firstSeen: sortedByDate[0]?.pubDate || new Date().toISOString(),
                lastSeen: sortedByDate[sortedByDate.length - 1]?.pubDate || new Date().toISOString(),
                severity: clusterItems.some(item => item.severity === 'Critical') ? 'Critical' : (clusterItems.some(item => item.severity === 'High') ? 'High' : 'Medium'),
                category: clusterItems[0]?.category || 'General',
                items: clusterItems.slice(0, 5)
            });
        }
    }

    // Calculate unique stories and deduplication statistics accurately
    const clusteredArticlesCount = clusters.reduce((sum, c) => sum + c.itemCount, 0);
    const unclusteredArticlesCount = rawArticleCount - clusteredArticlesCount;
    const uniqueArticleCount = clusters.length + unclusteredArticlesCount;
    const duplicatesSuppressed = Math.max(0, rawArticleCount - uniqueArticleCount);
    const deduplicationRate = rawArticleCount > 0
        ? Math.round(((rawArticleCount - uniqueArticleCount) / rawArticleCount) * 1000) / 10
        : 0;

    return {
        clusters,
        rawArticleCount,
        uniqueArticleCount,
        duplicatesSuppressed,
        deduplicationRate,
        generatedAt: new Date().toISOString(),
    };
}
