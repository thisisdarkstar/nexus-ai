import { describe, it, expect } from 'vitest';
import { evidenceVault } from '../domain/evidence/EvidenceVault';

describe('Cryptographic Evidence Vault', () => {
  it('computes consistent 64-character hex SHA-256 hash for identical content', async () => {
    const rawTrace = `GET /api/v2/transactions/98231 HTTP/1.1\nHost: bank.acme-financial.com\nAuthorization: Bearer token123`;
    const hash1 = await evidenceVault.computeSha256(rawTrace);
    const hash2 = await evidenceVault.computeSha256(rawTrace);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);
  });

  it('generates different SHA-256 hashes when content changes even by one character', async () => {
    const textA = 'GET /api/v1/user?id=100';
    const textB = 'GET /api/v1/user?id=101';

    const hashA = await evidenceVault.computeSha256(textA);
    const hashB = await evidenceVault.computeSha256(textB);

    expect(hashA).not.toBe(hashB);
  });

  it('records tamper-evident evidence item into IndexedDB with timestamp and hash', async () => {
    const evidence = await evidenceVault.recordEvidence({
      projectId: 'proj-audit',
      title: 'HTTP Trace: BOLA / IDOR Verification',
      type: 'http_trace',
      content: 'HTTP/1.1 200 OK\nContent-Type: application/json\n\n{"account_balance": 5000000}',
    });

    expect(evidence.id).toContain('ev-');
    expect(evidence.sha256Hash.length).toBe(64);
    expect(evidence.projectId).toBe('proj-audit');

    const allRecords = await evidenceVault.getEvidence('proj-audit');
    expect(allRecords.length).toBeGreaterThan(0);
    expect(allRecords.find((r) => r.id === evidence.id)).toBeDefined();
  });
});

