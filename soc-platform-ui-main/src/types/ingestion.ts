/**
 * src/types/ingestion.ts
 * Unified TypeScript type contracts for the SOC-AI Threat Intelligence Ingestion System.
 */

export type SourceStatus = 'unknown' | 'healthy' | 'degraded' | 'failed' | 'stale' | 'disabled';

export type PermissionOutcome = 'permitted_for_intended_use' | 'restricted' | 'denied' | 'pending';

export interface FeedSource {
    id: string;
    name: string;
    url: string;
    category: string;
    type: string;
    isEnabled?: boolean;
    expectedIntervalMinutes?: number;
    provenance?: string;
    permissionOutcome?: PermissionOutcome;
    rules?: {
        fetchingPermitted?: boolean;
        cachingPermitted?: boolean;
        storingPermitted?: boolean;
        summarizingPermitted?: boolean;
        aiProcessingPermitted?: boolean;
        displayingPermitted?: boolean;
        exportingPermitted?: boolean;
        commercialUsePermitted?: boolean;
    };
    requirements?: {
        attributionRequired?: boolean;
        originalLinkRequired?: boolean;
        retentionDaysLimit?: number;
        rateLimitPerMinute?: number;
        maxSummaryLength?: number;
    };
}

export interface SourceHealth {
    sourceId: string;
    name: string;
    url: string;
    category: string;
    status: SourceStatus;
    expectedIntervalMinutes: number;
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastHttpStatus: number | null;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    averageLatencyMs: number;
    itemsLast24Hours: number;
    lastError: string | null;
    errorCategory: string | null;
}

export interface ParsedArticle {
    title: string;
    link: string;
    canonicalUrl?: string;
    pubDate: string | null;
    contentSnippet: string;
    content: string;
    source: string;
    sourceId: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
    category: string;
    intelCategory: string;
    evidenceStatus: string;
    dateAnomaly?: boolean;
    isSimulated?: boolean;
}

export interface FetchResult {
    sourceId: string;
    sourceName: string;
    status: 'success' | 'failed' | 'timeout' | 'empty';
    durationMs: number;
    received: number;
    inserted: number;
    duplicates: number;
    rejected: number;
    httpStatus: number | null;
    errorCategory: string | null;
    errorMessage: string | null;
}

export interface FetchError {
    sourceId: string;
    errorCategory: string;
    httpStatus?: number;
    message: string;
    timestamp: string;
}

export interface FetchJobSummary {
    runId: string | null;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    state: 'success' | 'degraded' | 'failed';
    sourcesAttempted: number;
    sourcesSucceeded: number;
    sourcesFailed: number;
    articlesReceived: number;
    articlesInserted: number;
    articlesDuplicates: number;
    articlesRejected: number;
    errors: {
        timeouts: number;
        httpFailures: number;
        parsingFailures: number;
    };
}
