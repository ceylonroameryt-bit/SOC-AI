import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const UI_DIR = path.join(ROOT_DIR, 'soc-platform-ui-main');
const DATA_DIR = path.join(UI_DIR, 'server', 'data');
const RESULTS_DIR = path.join(ROOT_DIR, 'results');

if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Formula Injection Safe CSV Field Escaper
 * Follows P0 Item 6 rule: prefixes values starting with =, +, -, @, \t, \r with single quote
 */
function escapeCsv(val) {
    if (val === null || val === undefined) return '';
    let str = String(val);
    if (str.length > 0 && /^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes("'")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

console.log('Generating SOC-AI Results CSV files in:', RESULTS_DIR);

// ==============================================================================
// 1. THREAT DETECTION & ALERTS RESULTS CSV
// ==============================================================================
const threatsPath = path.join(DATA_DIR, 'threats.json');
let threatsCount = 0;
if (fs.existsSync(threatsPath)) {
    const threats = JSON.parse(fs.readFileSync(threatsPath, 'utf8'));
    threatsCount = threats.length;
    
    let csv = 'ID,Timestamp,Severity,Type,Source,Description,Malicious_IPs,C2_Domains,SHA256,CVEs,External_Ingestion,Is_Simulated\n';
    for (const t of threats) {
        const ips = t.ioc?.ip_addresses ? t.ioc.ip_addresses.join('; ') : '';
        const domains = t.ioc?.domains ? t.ioc.domains.join('; ') : '';
        const sha256 = t.ioc?.sha256 || '';
        const cves = t.ioc?.cves ? t.ioc.cves.join('; ') : '';
        const ext = t.externalIngestion ? 'true' : 'false';
        const sim = t.isSimulated ? 'true' : 'false';
        
        csv += [
            escapeCsv(t.id),
            escapeCsv(t.timestamp),
            escapeCsv(t.severity),
            escapeCsv(t.type),
            escapeCsv(t.source),
            escapeCsv(t.description),
            escapeCsv(ips),
            escapeCsv(domains),
            escapeCsv(sha256),
            escapeCsv(cves),
            escapeCsv(ext),
            escapeCsv(sim)
        ].join(',') + '\n';
    }
    
    const outThreats = path.join(RESULTS_DIR, 'soc_ai_threat_detection_results.csv');
    fs.writeFileSync(outThreats, csv, 'utf8');
    console.log(`[1/4] Generated ${outThreats} (${threatsCount} records)`);
}

// ==============================================================================
// 2. FEED HEALTH & TELEMETRY RESULTS CSV
// ==============================================================================
const healthPath = path.join(DATA_DIR, 'feed_health.json');
const sourcesPath = path.join(DATA_DIR, 'sources.json');
let healthCount = 0;

if (fs.existsSync(healthPath)) {
    const healthRecords = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
    const sourceRecords = fs.existsSync(sourcesPath) ? JSON.parse(fs.readFileSync(sourcesPath, 'utf8')) : [];
    
    // Create map of sources for metadata
    const sourceMap = new Map();
    for (const s of sourceRecords) {
        sourceMap.set(s.id, s);
    }
    
    healthCount = healthRecords.length;
    let csv = 'Source_ID,Name,Category,Status,Review_State,Publisher_Domain,Feed_URL,Items_24h,Items_Total,Avg_Latency_ms,Last_HTTP_Status,Consecutive_Failures,Last_Success_At,Latest_Publication_At,Last_Error\n';
    
    for (const h of healthRecords) {
        const src = sourceMap.get(h.sourceId) || {};
        csv += [
            escapeCsv(h.sourceId),
            escapeCsv(h.name || src.name),
            escapeCsv(h.category || src.category),
            escapeCsv(h.status || 'unknown'),
            escapeCsv(h.reviewState || src.reviewState || 'approved'),
            escapeCsv(h.publisherDomain || src.publisherDomain),
            escapeCsv(h.feedUrl || src.feedUrl),
            escapeCsv(h.itemsLast24Hours ?? 0),
            escapeCsv(h.itemsTotal ?? 0),
            escapeCsv(h.averageLatencyMs ?? 0),
            escapeCsv(h.lastHttpStatus ?? ''),
            escapeCsv(h.consecutiveFailures ?? 0),
            escapeCsv(h.lastSuccessAt || ''),
            escapeCsv(h.latestPublicationAt || ''),
            escapeCsv(h.lastError || '')
        ].join(',') + '\n';
    }
    
    const outHealth = path.join(RESULTS_DIR, 'soc_ai_feed_health_results.csv');
    fs.writeFileSync(outHealth, csv, 'utf8');
    console.log(`[2/4] Generated ${outHealth} (${healthCount} records)`);
}

// ==============================================================================
// 3. TEST SUITE VERIFICATION RESULTS CSV
// ==============================================================================
try {
    console.log('[3/4] Running test suite to capture verification results...');
    const tapOutput = execSync('node --test --test-reporter=tap tests/security_fixes.test.js tests/feed_reliability.test.js tests/platform_verification.test.js', {
        cwd: UI_DIR,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
    });

    const lines = tapOutput.split('\n');
    let currentSuite = 'General';
    const testCases = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('# Subtest:')) {
            const suiteCandidate = line.replace('# Subtest:', '').trim();
            // Check if this is a top-level suite
            currentSuite = suiteCandidate;
        } else if (line.startsWith('ok ') || line.startsWith('not ok ')) {
            const isPass = line.startsWith('ok ');
            // ok 1 - test description
            const match = line.match(/^(?:ok|not ok) \d+ - (.+)$/);
            if (match) {
                const testName = match[1].trim();
                let duration = '';
                // check following lines for duration_ms
                for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                    const dMatch = lines[j].match(/duration_ms:\s*([0-9.]+)/);
                    if (dMatch) {
                        duration = dMatch[1];
                        break;
                    }
                }
                testCases.push({
                    suite: currentSuite,
                    testName,
                    status: isPass ? 'PASS' : 'FAIL',
                    duration_ms: duration
                });
            }
        }
    }

    let csv = 'Suite,Test_Name,Status,Duration_ms\n';
    for (const tc of testCases) {
        csv += [
            escapeCsv(tc.suite),
            escapeCsv(tc.testName),
            escapeCsv(tc.status),
            escapeCsv(tc.duration_ms)
        ].join(',') + '\n';
    }

    const outTests = path.join(RESULTS_DIR, 'soc_ai_test_verification_results.csv');
    fs.writeFileSync(outTests, csv, 'utf8');
    console.log(`[3/4] Generated ${outTests} (${testCases.length} test records)`);
} catch (err) {
    console.error('Error generating test results CSV:', err.message);
}

// ==============================================================================
// 4. INTELLIGENCE NEWS RESULTS CSV (TOP RECENT SAMPLES)
// ==============================================================================
const newsPath = path.join(DATA_DIR, 'news.json');
if (fs.existsSync(newsPath)) {
    console.log('[4/4] Parsing intelligence news stream...');
    const news = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
    // Export top 500 recent intelligence items to keep CSV high value and manageable
    const exportSample = news.slice(0, 500);
    
    let csv = 'Date,Severity,Category,Source,Title,Link,Snippet\n';
    for (const n of exportSample) {
        csv += [
            escapeCsv(n.pubDate),
            escapeCsv(n.severity),
            escapeCsv(n.category || 'General'),
            escapeCsv(n.source),
            escapeCsv(n.title),
            escapeCsv(n.link),
            escapeCsv(n.contentSnippet)
        ].join(',') + '\n';
    }
    
    const outNews = path.join(RESULTS_DIR, 'soc_ai_intelligence_news_results.csv');
    fs.writeFileSync(outNews, csv, 'utf8');
    console.log(`[4/4] Generated ${outNews} (${exportSample.length} recent news records)`);
}

console.log('Finished generating all SOC-AI results CSV files successfully.');
