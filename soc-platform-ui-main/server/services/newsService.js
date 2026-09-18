import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';
import { fileURLToPath } from 'url';
import { insertThreat, insertIOCs, isDbConnected } from '../db/db.js';
import { extractIOCs } from './enrichmentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/news.json');

const parser = new Parser();

const SOURCES_FILE = path.join(__dirname, '../data/sources.json');

const getFeeds = () => {
    try {
        if (fs.existsSync(SOURCES_FILE)) {
            const data = fs.readFileSync(SOURCES_FILE, 'utf8');
            const sources = JSON.parse(data);
            return sources.map(s => s.url).filter(url => url);
        }
    } catch (err) {
        console.error('Error reading sources file:', err);
    }
    return [];
};

// Keywords for severity tagging
const SEVERITY_KEYWORDS = {
    CRITICAL: ['zero-day', 'rce', 'remote code execution', 'critical', 'exploit', 'unpatched', 'active exploitation'],
    HIGH: ['ransomware', 'breach', 'leak', 'vulnerability', 'attack', 'malware', 'backdoor', 'trojan', 'apt'],
    MEDIUM: ['patch', 'update', 'warning', 'advisory', 'phishing', 'scam', 'botnet', 'ddos']
};

const CATEGORY_KEYWORDS = {
    'Ransomware': ['ransomware', 'encrypt', 'extortion', 'lockbit', 'clop', 'blackcat', 'royal'],
    'Data Breach': ['breach', 'leak', 'database', 'exposed', 'records', 'dump', 'stolen'],
    'Vulnerability': ['vulnerability', 'cve', 'zero-day', 'exploit', 'bug', 'patch', 'rce'],
    'Malware': ['malware', 'trojan', 'virus', 'spyware', 'backdoor', 'loader', 'botnet'],
    'Phishing': ['phishing', 'scam', 'credential', 'harvesting', 'social engineering'],
    'Government': ['cisa', 'fbi', 'nsa', 'nist', 'directive', 'act', 'regulation'],
    'Dark Web': ['dark web', 'onion', 'tor', 'market', 'underground', 'forum']
};

const determineSeverity = (title, snippet) => {
    const text = `${title} ${snippet}`.toLowerCase();

    if (SEVERITY_KEYWORDS.CRITICAL.some(k => text.includes(k))) return 'Critical';
    if (SEVERITY_KEYWORDS.HIGH.some(k => text.includes(k))) return 'High';
    if (SEVERITY_KEYWORDS.MEDIUM.some(k => text.includes(k))) return 'Medium';
    return 'Low';
};

const determineCategory = (title, snippet) => {
    const text = `${title} ${snippet}`.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(k => text.includes(k))) return category;
    }
    return 'General Info';
};

// IN-MEMORY CACHE
let NEWS_CACHE = [];

const loadNewsData = () => {
    if (NEWS_CACHE && NEWS_CACHE.length > 0) return NEWS_CACHE;

    if (!fs.existsSync(DATA_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        if (!data || !data.trim()) return NEWS_CACHE || [];
        NEWS_CACHE = JSON.parse(data);
        return NEWS_CACHE;
    } catch (err) {
        console.error('Error reading news data:', err.message);
        return NEWS_CACHE || [];
    }
};

const saveNewsData = (data) => {
    // Update Cache Immediately
    NEWS_CACHE = data;

    // Atomic write via temp file prevents concurrent reads from hitting partial JSON
    const tmpFile = `${DATA_FILE}.${process.pid}.tmp`;
    try {
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
        fs.renameSync(tmpFile, DATA_FILE);
    } catch (err) {
        try {
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        } catch (writeErr) {
            console.error('Error saving news data to disk:', writeErr.message);
        }
        if (fs.existsSync(tmpFile)) {
            try { fs.unlinkSync(tmpFile); } catch {}
        }
    }
};

// Initialize Cache on Module Load
loadNewsData();

export const fetchAndProcessNews = async () => {
    // Use Cache directly
    let existingNews = NEWS_CACHE.length > 0 ? NEWS_CACHE : loadNewsData();
    let newItemsCount = 0;

    try {
        const feeds = getFeeds();
        console.log(`Fetching from ${feeds.length} sources...`);

        // Process in chunks to avoid overwhelming the network
        const CHUNK_SIZE = 10;

        for (let i = 0; i < feeds.length; i += CHUNK_SIZE) {
            const chunk = feeds.slice(i, i + CHUNK_SIZE);
            console.log(`Processing chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(feeds.length / CHUNK_SIZE)}...`);
            const chunkPromises = chunk.map(feed => parser.parseURL(feed).catch(err => null));
            const chunkResults = await Promise.all(chunkPromises);

            // Process and save chunk immediately
            const validChunk = chunkResults.filter(feed => feed !== null);
            let chunkNewItems = 0;

            validChunk.forEach(feed => {
                (feed.items || []).forEach(item => {
                    if (!item || !item.link || !item.title) return;
                    const exists = existingNews.some(n => n.link === item.link);
                    if (!exists) {
                        const severity = determineSeverity(item.title, item.contentSnippet || '');
                        const category = determineCategory(item.title, item.contentSnippet || '');
                        const newItem = {
                            title: item.title,
                            link: item.link,
                            pubDate: item.pubDate || new Date().toISOString(),
                            contentSnippet: item.contentSnippet || '',
                            source: feed.title || 'Unknown Source',
                            severity: severity,
                            category: category,
                            fetchedAt: new Date().toISOString()
                        };
                        existingNews.push(newItem);
                        chunkNewItems++;
                        newItemsCount++;

                        // Asynchronously persist to PostgreSQL if connected
                        if (isDbConnected()) {
                            insertThreat(newItem).then(threatId => {
                                if (threatId) {
                                    const text = `${newItem.title} ${newItem.contentSnippet || ''}`;
                                    const extracted = extractIOCs(text);
                                    insertIOCs(threatId, extracted);
                                }
                            }).catch(() => {});
                        }
                    }
                });
            });

            if (chunkNewItems > 0) {
                // Note: final sort + save happens once after all chunks complete
                console.log(`Processed ${chunkNewItems} new items from chunk ${i / CHUNK_SIZE + 1}.`);
            }
        }

        if (newItemsCount > 0) {
            // Sort by date descending
            existingNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            saveNewsData(existingNews);
            console.log(`Added ${newItemsCount} new news items.`);
        }

        return existingNews;
    } catch (error) {
        console.error('Error in fetchAndProcessNews:', error);
        return existingNews;
    }
};

export const getNews = () => {
    return NEWS_CACHE.length > 0 ? NEWS_CACHE : loadNewsData();
};

export const getSeverityStats = () => {
    const news = loadNewsData();
    const now = new Date();
    // Fix: avoid mutating `now` with setDate(); compute 30 days ago safely
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
        Critical: 0,
        High: 0,
        Medium: 0,
        Low: 0
    };

    news.forEach(item => {
        const itemDate = new Date(item.pubDate);
        if (itemDate >= thirtyDaysAgo) {
            if (stats[item.severity] !== undefined) {
                stats[item.severity]++;
            } else {
                stats['Low']++; // Default fallback
            }
        }
    });

    // Format for Recharts
    return Object.keys(stats).map(key => ({
        name: key,
        count: stats[key]
    }));
};
