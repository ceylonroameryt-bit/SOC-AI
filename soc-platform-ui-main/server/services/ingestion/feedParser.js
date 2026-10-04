/**
 * server/services/ingestion/feedParser.js
 * Multi-format feed parser supporting RSS 2.0, Atom 1.0, and JSON feeds.
 * Safely resolves Atom link arrays, attributes, and extracts full content.
 */

import Parser from 'rss-parser';
import { ERROR_CATEGORIES } from './types.js';

const parser = new Parser({
    customFields: {
        item: [
            ['content:encoded', 'contentEncoded'],
            ['dc:date', 'dcDate'],
            ['link', 'link']
        ]
    }
});

/**
 * Safely extracts a clean URL string from diverse RSS/Atom link structures.
 * Prevents "raw.link.trim is not a function" crashes on Atom array links.
 * @param {any} rawItem 
 * @returns {string|null} Resolved link or null
 */
export function extractItemLink(rawItem) {
    if (!rawItem) return null;

    // 1. Direct string link
    if (typeof rawItem.link === 'string' && rawItem.link.trim()) {
        return rawItem.link.trim();
    }

    // 2. Atom link array: [{ $: { rel: 'alternate', href: '...' } }, ...]
    if (Array.isArray(rawItem.link)) {
        // Priority: rel="alternate"
        const alternate = rawItem.link.find(l => {
            if (typeof l === 'string') return true;
            const rel = l?.$?.rel || l?.rel;
            return rel === 'alternate';
        });

        if (alternate) {
            const url = alternate?.$?.href || alternate?.href || (typeof alternate === 'string' ? alternate : null);
            if (url && typeof url === 'string') return url.trim();
        }

        // Fallback to first valid href in array
        for (const l of rawItem.link) {
            const url = l?.$?.href || l?.href || (typeof l === 'string' ? l : null);
            if (url && typeof url === 'string' && url.trim()) {
                return url.trim();
            }
        }
    }

    // 3. Atom link object: { $: { href: '...' } } or { href: '...' }
    if (rawItem.link && typeof rawItem.link === 'object') {
        const url = rawItem.link?.$?.href || rawItem.link?.href;
        if (url && typeof url === 'string' && url.trim()) {
            return url.trim();
        }
    }

    // 4. Guid fallback if it is a valid HTTP/HTTPS URL
    if (typeof rawItem.guid === 'string' && (rawItem.guid.startsWith('http://') || rawItem.guid.startsWith('https://'))) {
        return rawItem.guid.trim();
    }

    // 5. Id fallback if valid URL
    if (typeof rawItem.id === 'string' && (rawItem.id.startsWith('http://') || rawItem.id.startsWith('https://'))) {
        return rawItem.id.trim();
    }

    return null;
}

/**
 * Parses raw XML/RSS/Atom content into normalized feed object.
 * @param {string} xmlContent 
 * @returns {Promise<{ items: Array, feedTitle: string, isEmpty: boolean }>}
 */
export async function parseFeedXml(xmlContent) {
    if (!xmlContent || typeof xmlContent !== 'string') {
        const err = new Error('Empty XML content received');
        err.errorCategory = ERROR_CATEGORIES.EMPTY_FEED;
        throw err;
    }

    try {
        const parsed = await parser.parseString(xmlContent);
        const rawItems = parsed?.items || [];

        const normalizedItems = [];
        for (const raw of rawItems) {
            if (!raw) continue;

            const title = (raw.title || '').trim();
            const link = extractItemLink(raw);

            // Skip entries missing required title or link
            if (!title || !link) continue;

            const pubDate = raw.pubDate || raw.isoDate || raw.dcDate || raw.published || raw.updated || null;
            const content = raw.contentEncoded || raw.content || raw.contentSnippet || raw.summary || '';
            const contentSnippet = raw.contentSnippet || raw.summary || content.slice(0, 300);

            normalizedItems.push({
                title,
                link,
                pubDate,
                content,
                contentSnippet: typeof contentSnippet === 'string' ? contentSnippet.trim() : '',
                guid: raw.guid || raw.id || link,
                author: raw.creator || raw.author || null,
                categories: Array.isArray(raw.categories) ? raw.categories : []
            });
        }

        return {
            items: normalizedItems,
            feedTitle: parsed.title || '',
            isEmpty: normalizedItems.length === 0
        };
    } catch (err) {
        const parseErr = new Error(`Feed parsing failure: ${err.message}`);
        parseErr.errorCategory = ERROR_CATEGORIES.INVALID_XML;
        throw parseErr;
    }
}
