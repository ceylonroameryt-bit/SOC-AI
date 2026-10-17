import test from 'node:test';
import assert from 'node:assert/strict';
import { compileTQL, tokenizeTQL, ALLOWED_FIELDS } from '../server/services/tqlCompiler.js';

test('TQL Compiler Verification & Security Suite', async (t) => {
    await t.test('1. Compiles canonical master example without errors', () => {
        const query = 'severity:(critical OR high) AND stack:true AND (kev:true OR epss>0.5) | sort risk desc | dedup cluster';
        const res = compileTQL(query);

        assert.equal(res.errors.length, 0);
        assert.ok(res.whereSql.includes('LOWER(a.severity) = $1 OR LOWER(a.severity) = $2'));
        assert.ok(res.whereSql.includes('COALESCE(cve.epss, 0) > $5'));
        assert.equal(res.params[0], 'critical');
        assert.equal(res.params[1], 'high');
        assert.equal(res.params[2], true); // stack:true
        assert.equal(res.params[3], true); // kev:true
        assert.equal(res.params[4], 0.5);  // epss > 0.5
        assert.equal(res.orderBySql, 'ORDER BY COALESCE(r.risk_score, 0) DESC');
    });

    await t.test('2. Protects against SQL injection attempts via parameterized bindings', () => {
        const malicious = "vendor:' OR 1=1 --; DROP TABLE users;' AND cvss>=9.0";
        const res = compileTQL(malicious);

        // SQL query MUST NOT contain unescaped injected strings
        assert.ok(!res.whereSql.includes('DROP TABLE'));
        assert.ok(!res.whereSql.includes('1=1 --'));
        // Injected payload is treated strictly as an isolated parameter value
        assert.ok(res.params.some(p => typeof p === 'string' && p.toLowerCase().includes('drop table users')));
    });

    await t.test('3. Rejects unknown fields securely', () => {
        const badFieldQuery = 'hacker_field:exploit AND risk>80';
        const res = compileTQL(badFieldQuery);
        assert.ok(res.errors.length > 0);
        assert.ok(res.errors[0].includes('Unknown field: "hacker_field"'));
    });

    await t.test('4. Handles pipe sort and limit safely', () => {
        const q = 'kev:true | sort cvss desc | limit 25';
        const res = compileTQL(q);

        assert.equal(res.errors.length, 0);
        assert.equal(res.orderBySql, 'ORDER BY COALESCE(cve.cvss_v31, 0) DESC');
        assert.equal(res.limitSql, 'LIMIT 25');
    });

    await t.test('5. Limits maximum allowed limit to 500', () => {
        const q = 'kev:true | limit 999999';
        const res = compileTQL(q);
        assert.equal(res.limitSql, 'LIMIT 500');
    });

    await t.test('6. Empty or blank query safely defaults to 1=1 without errors', () => {
        const res = compileTQL('');
        assert.equal(res.errors.length, 0);
        assert.equal(res.whereSql, '1=1');
        assert.equal(res.params.length, 0);
    });
});
