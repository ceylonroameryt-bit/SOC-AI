import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRiskScore, SEVERITY_BANDS } from '../server/services/riskScore.js';

test('Risk Score Engine Verification Suite', async (t) => {
    await t.test('1. Baseline empty / zero inputs produces 0 risk and Informational/Low severity', () => {
        const res = calculateRiskScore();
        assert.equal(res.risk, 0);
        assert.equal(res.autoCaseP1, false);
        assert.equal(res.reasons.cvss.points, 0);
        assert.equal(res.reasons.kev.points, 0);
        assert.equal(res.reasons.epss.points, 0);
        assert.equal(res.reasons.stackMatch.points, 0);
        assert.equal(res.reasons.internetFacing.points, 0);
        assert.equal(res.reasons.clusterVolume.bonusPoints, 0);
    });

    await t.test('2. Critical CVE (CVSS 10.0), KEV=true, EPSS=1.0, stack_match=1, internet_facing=true hits 100 max clamp with autoCaseP1', () => {
        const res = calculateRiskScore({
            cvss: 10.0,
            isKev: true,
            epss: 1.0,
            stackMatch: 1.0,
            isInternetFacing: true,
            articleCount: 16 // log2(16) = 4 bonus
        });
        // 35 + 25 + 15 + 15 + 10 + 4 = 104 -> clamped to 100
        assert.equal(res.risk, 100);
        assert.equal(res.autoCaseP1, true);
        assert.equal(res.severity, SEVERITY_BANDS.CRITICAL);
        assert.equal(res.reasons.cvss.points, 35);
        assert.equal(res.reasons.kev.points, 25);
        assert.equal(res.reasons.epss.points, 15);
        assert.equal(res.reasons.stackMatch.points, 15);
        assert.equal(res.reasons.internetFacing.points, 10);
        assert.equal(res.reasons.clusterVolume.bonusPoints, 4);
    });

    await t.test('3. AutoCaseP1 requires all three: KEV=1, stack_match=1.0, and internet_facing=1', () => {
        // Missing internet_facing
        const r1 = calculateRiskScore({ cvss: 9.8, isKev: true, stackMatch: 1.0, isInternetFacing: false });
        assert.equal(r1.autoCaseP1, false);

        // Missing KEV
        const r2 = calculateRiskScore({ cvss: 9.8, isKev: false, stackMatch: 1.0, isInternetFacing: true });
        assert.equal(r2.autoCaseP1, false);

        // Sector match only (0.5), not direct product match
        const r3 = calculateRiskScore({ cvss: 9.8, isKev: true, stackMatch: 0.5, isInternetFacing: true });
        assert.equal(r3.autoCaseP1, false);

        // All 3 present
        const r4 = calculateRiskScore({ cvss: 9.8, isKev: true, stackMatch: 1.0, isInternetFacing: true });
        assert.equal(r4.autoCaseP1, true);
    });

    await t.test('4. Sector match grants half stack points (7.5 pts)', () => {
        const res = calculateRiskScore({
            cvss: null,
            stackMatch: 0.5
        });
        assert.equal(res.reasons.stackMatch.points, 7.5);
        assert.equal(res.risk, 8); // 7.5 rounds to 8
    });

    await t.test('5. Non-CVE threats use deterministic category rule table, not AI', () => {
        const r1 = calculateRiskScore({ fallbackCategory: 'Ransomware' });
        assert.equal(r1.severity, SEVERITY_BANDS.HIGH);

        const r2 = calculateRiskScore({ fallbackCategory: 'Vulnerability Research' });
        assert.equal(r2.severity, SEVERITY_BANDS.LOW);
    });

    await t.test('6. Article bonus capped at 5 points', () => {
        const res = calculateRiskScore({ articleCount: 1024 }); // log2(1024) = 10 -> capped at 5
        assert.equal(res.reasons.clusterVolume.bonusPoints, 5);
    });
});
