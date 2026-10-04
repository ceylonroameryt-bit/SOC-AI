import fs from 'fs';

const regPath = './soc-platform-ui-main/server/data/sources_registry.json';
const healthPath = './soc-platform-ui-main/server/data/feed_health.json';
const statePath = './soc-platform-ui-main/server/data/candidate_validation_state.json';

const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
const health = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { processedIds: {} };

const FAKE_TIMESTAMP = '2026-10-04T09:55:31.736Z';
let resetCount = 0;
let preservedCount = 0;

reg.forEach(r => {
  if (r.lastSuccessAt === FAKE_TIMESTAMP || r.lastValidationAt === FAKE_TIMESTAMP) {
    const p = state.processedIds ? state.processedIds[r.id] : null;
    if (p && p.timestamp && p.timestamp !== FAKE_TIMESTAMP) {
      r.lastValidationAt = p.timestamp;
      r.lastAttemptAt = p.timestamp;
      r.lastSuccessAt = p.approved ? p.timestamp : null;
      r.lastHttpStatus = p.httpStatus !== undefined ? p.httpStatus : null;
      preservedCount++;
    } else {
      r.lastValidationAt = null;
      r.lastAttemptAt = null;
      r.lastSuccessAt = null;
      r.lastHttpStatus = null;
      resetCount++;
    }
  }
});

const healthMap = new Map();
health.forEach(h => healthMap.set(h.sourceId, h));

reg.forEach(r => {
  let h = healthMap.get(r.id);
  if (!h) {
    h = { sourceId: r.id };
    healthMap.set(r.id, h);
  }
  h.name = r.name;
  h.feedUrl = r.canonicalUrl || r.feedUrl;
  h.category = r.category;
  h.publisherDomain = r.publisherDomain;
  h.reviewState = r.reviewState;
  h.enabled = r.enabled;
  h.lastAttemptAt = r.lastAttemptAt || null;
  h.lastSuccessAt = r.lastSuccessAt || null;
  h.lastHttpStatus = r.lastHttpStatus !== undefined ? r.lastHttpStatus : null;
  
  if (!r.enabled) {
    h.status = 'disabled';
  } else if (!r.lastSuccessAt) {
    h.status = 'unknown';
  } else {
    h.status = 'healthy';
  }
});

fs.writeFileSync(regPath, JSON.stringify(reg, null, 2));
fs.writeFileSync(healthPath, JSON.stringify(Array.from(healthMap.values()), null, 2));
console.log(`Reset ${resetCount} fabricated records to unknown/null. Preserved ${preservedCount} authentic validated records.`);
