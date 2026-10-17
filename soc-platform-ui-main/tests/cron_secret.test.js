import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../server/server.js';

test('CRON_SECRET fail-closed: empty/missing secret rejects ingestion triggers with 401', async () => {
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    const oldCron = process.env.CRON_SECRET;
    const oldIngest = process.env.INGEST_API_KEY;
    const oldAdmin = process.env.ADMIN_API_KEY;

    try {
        delete process.env.CRON_SECRET;
        delete process.env.INGEST_API_KEY;
        delete process.env.ADMIN_API_KEY;

        // 1. news refresh fails closed with 401
        const resNews = await fetch(`${base}/api/news/refresh`, { method: 'POST' });
        assert.equal(resNews.status, 401, 'Should fail closed with 401 when CRON_SECRET is empty');
        const newsBody = await resNews.json();
        assert.equal(newsBody.code, 'UNAUTHORIZED');

        // 2. sources refresh fails closed with 401
        const resSources = await fetch(`${base}/api/sources/refresh`, { method: 'POST' });
        assert.equal(resSources.status, 401, 'Should fail closed with 401 when CRON_SECRET is empty');
        const sourcesBody = await resSources.json();
        assert.equal(sourcesBody.code, 'UNAUTHORIZED');

        // 3. Configure valid CRON_SECRET
        process.env.CRON_SECRET = 'tacticlens_secret_test_key_123';

        // 3a. Invalid secret returns 401
        const resBad = await fetch(`${base}/api/news/refresh`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer wrong_secret' }
        });
        assert.equal(resBad.status, 401);

        // 3b. Valid secret via Bearer header passes authentication
        const resBearer = await fetch(`${base}/api/sources/refresh`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer tacticlens_secret_test_key_123' }
        });
        assert.equal(resBearer.status, 200);

        // 3c. Valid secret via x-cron-secret header passes authentication
        const resHeader = await fetch(`${base}/api/sources/refresh`, {
            method: 'POST',
            headers: { 'x-cron-secret': 'tacticlens_secret_test_key_123' }
        });
        assert.equal(resHeader.status, 200);

    } finally {
        if (oldCron !== undefined) process.env.CRON_SECRET = oldCron; else delete process.env.CRON_SECRET;
        if (oldIngest !== undefined) process.env.INGEST_API_KEY = oldIngest; else delete process.env.INGEST_API_KEY;
        if (oldAdmin !== undefined) process.env.ADMIN_API_KEY = oldAdmin; else delete process.env.ADMIN_API_KEY;
        await new Promise(resolve => server.close(resolve));
    }
});
