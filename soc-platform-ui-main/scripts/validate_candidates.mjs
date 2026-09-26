import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    validateCandidate,
    loadValidationState,
    saveValidationState
} from '../server/services/candidateValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGISTRY_PATH = path.join(__dirname, '../server/data/sources_registry.json');
const SOURCES_PATH = path.join(__dirname, '../server/data/sources.json');
const HEALTH_PATH = path.join(__dirname, '../server/data/feed_health.json');

// Parse CLI Args
const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

const concurrencyArg = args.find(a => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 8;

const isDryRun = args.includes('--dry-run');

async function main() {
    console.log(`\n========================================================`);
    console.log(`🔍 NO ENTRY SOC — Resumable Candidate Validation Worker`);
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Options: limit=${limit}, concurrency=${CONCURRENCY}, dryRun=${isDryRun}`);
    console.log(`========================================================\n`);

    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const sources = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8'));
    const health = JSON.parse(fs.readFileSync(HEALTH_PATH, 'utf8'));
    const state = loadValidationState();

    // Find pending candidates not yet processed in validation state
    const candidates = registry.filter(s =>
        s.reviewState === 'candidate' &&
        !state.processedIds[s.id]
    );

    console.log(`Found ${candidates.length} unprocessed candidate feeds in backlog.`);
    const batch = candidates.slice(0, limit);

    if (batch.length === 0) {
        console.log(`🎉 No pending candidates in this batch.`);
        return;
    }

    console.log(`Processing batch of ${batch.length} candidates with bounded pool (${CONCURRENCY})...\n`);

    let passedCount = 0;
    let rejectedCount = 0;
    const batchBreakdown = {};

    let index = 0;
    const workers = Array(CONCURRENCY).fill(null).map(async (_, workerId) => {
        while (index < batch.length) {
            const currentIdx = index++;
            const candidate = batch[currentIdx];

            const result = await validateCandidate(candidate);

            state.attempted++;
            state.processedIds[candidate.id] = {
                timestamp: new Date().toISOString(),
                approved: result.approved,
                httpStatus: result.httpStatus,
                errorCategory: result.errorCategory,
                rejectionReason: result.rejectionReason
            };

            const regIndex = registry.findIndex(s => s.id === candidate.id);

            if (result.approved) {
                passedCount++;
                state.approved++;
                console.log(`  [✅ PROMOTED] ${candidate.name} (${candidate.id}) - ${result.itemCount} items, latest: ${result.latestPublicationAt?.slice(0, 10) || 'N/A'}`);

                if (regIndex !== -1) {
                    registry[regIndex].reviewState = 'approved';
                    registry[regIndex].enabled = true;
                    registry[regIndex].lastValidationAt = new Date().toISOString();
                    registry[regIndex].lastSuccessAt = new Date().toISOString();
                    registry[regIndex].lastAttemptAt = new Date().toISOString();
                    registry[regIndex].latestPublicationAt = result.latestPublicationAt;
                    registry[regIndex].etag = result.etag;
                    registry[regIndex].lastModified = result.lastModified;
                    registry[regIndex].consecutiveFailures = 0;

                    // Add to active sources.json if not present
                    if (!sources.some(s => s.id === candidate.id)) {
                        sources.push({
                            id: candidate.id,
                            name: candidate.name,
                            feedUrl: candidate.feedUrl,
                            canonicalUrl: candidate.canonicalUrl,
                            websiteUrl: candidate.websiteUrl,
                            category: candidate.category,
                            language: candidate.language || 'en',
                            publisherDomain: candidate.publisherDomain,
                            provenance: candidate.provenance,
                            reviewState: 'approved',
                            enabled: true
                        });
                    }

                    // Add to feed_health.json
                    const hIndex = health.findIndex(h => h.sourceId === candidate.id);
                    const healthEntry = {
                        sourceId: candidate.id,
                        status: 'healthy',
                        lastAttemptAt: new Date().toISOString(),
                        lastSuccessAt: new Date().toISOString(),
                        lastHttpStatus: 200,
                        consecutiveFailures: 0,
                        averageLatencyMs: result.latencyMs,
                        itemsLast24Hours: 0,
                        itemsTotal: result.itemCount,
                        latestPublicationAt: result.latestPublicationAt,
                        lastError: null,
                        errorCategory: null,
                        nextRetryAt: null
                    };

                    if (hIndex !== -1) {
                        health[hIndex] = healthEntry;
                    } else {
                        health.push(healthEntry);
                    }
                }
            } else {
                rejectedCount++;
                state.rejected++;
                const cat = result.errorCategory || 'OTHER';
                batchBreakdown[cat] = (batchBreakdown[cat] || 0) + 1;
                state.rejectionBreakdown[cat.toLowerCase()] = (state.rejectionBreakdown[cat.toLowerCase()] || 0) + 1;

                console.log(`  [❌ REJECTED] ${candidate.name} (${candidate.id}) - ${result.rejectionReason}`);

                if (regIndex !== -1) {
                    registry[regIndex].reviewState = 'rejected';
                    registry[regIndex].enabled = false;
                    registry[regIndex].lastValidationAt = new Date().toISOString();
                    registry[regIndex].lastAttemptAt = new Date().toISOString();
                    registry[regIndex].lastHttpStatus = result.httpStatus;
                    registry[regIndex].errorCategory = result.errorCategory;
                    registry[regIndex].rejectionReason = result.rejectionReason;

                    // Update health entry to rejected/failed
                    const hIndex = health.findIndex(h => h.sourceId === candidate.id);
                    const healthEntry = {
                        sourceId: candidate.id,
                        status: 'failed',
                        lastAttemptAt: new Date().toISOString(),
                        lastSuccessAt: null,
                        lastHttpStatus: result.httpStatus,
                        consecutiveFailures: 1,
                        averageLatencyMs: result.latencyMs,
                        itemsLast24Hours: 0,
                        itemsTotal: 0,
                        latestPublicationAt: null,
                        lastError: result.rejectionReason,
                        errorCategory: result.errorCategory,
                        nextRetryAt: null
                    };
                    if (hIndex !== -1) {
                        health[hIndex] = healthEntry;
                    } else {
                        health.push(healthEntry);
                    }
                }
            }
        }
    });

    await Promise.all(workers);

    if (!isDryRun) {
        fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
        fs.writeFileSync(SOURCES_PATH, JSON.stringify(sources, null, 2), 'utf8');
        fs.writeFileSync(HEALTH_PATH, JSON.stringify(health, null, 2), 'utf8');
        saveValidationState(state);
    }

    const totalApproved = registry.filter(s => s.reviewState === 'approved' && s.enabled).length;
    const totalRemainingCandidates = registry.filter(s => s.reviewState === 'candidate').length;
    const remainingGap = Math.max(0, 1000 - totalApproved);

    console.log(`\n--------------------------------------------------------`);
    console.log(`📊 Validation Batch Results:`);
    console.log(`Batch Processed:     ${batch.length}`);
    console.log(`Promoted to Approved: ${passedCount}`);
    console.log(`Rejected:            ${rejectedCount}`);
    console.log(`Rejection Categories:`, batchBreakdown);
    console.log(`Cumulative State:`);
    console.log(`  Total Approved Active:   ${totalApproved}`);
    console.log(`  Remaining Candidates:   ${totalRemainingCandidates}`);
    console.log(`  Remaining Gap to 1,000:  ${remainingGap}`);
    console.log(`--------------------------------------------------------\n`);
}

main().catch(err => {
    console.error('Fatal Validation Error:', err);
    process.exit(1);
});
