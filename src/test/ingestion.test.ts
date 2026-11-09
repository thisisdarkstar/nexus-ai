import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingestionService } from '../services/IngestionService';

describe('Background Ingestion Service & Worker Fallback', () => {
  it('parses Httpx JSON lines and publishes recon assets', async () => {
    const sampleHttpx = JSON.stringify({
      url: 'https://api.testacme.com/v1',
      host: 'api.testacme.com',
      port: '443',
      status_code: 200,
      title: 'Acme Test API',
      webserver: 'nginx/1.22',
      tech: ['Python', 'FastAPI'],
    });

    const progressSpy = vi.fn();
    const result = await ingestionService.ingestFile(sampleHttpx, 'httpx_output.json', {
      projectId: 'test-proj',
      onProgress: progressSpy,
    });

    expect(result.sourceType).toBe('httpx');
    expect(result.reconAssets).toBeDefined();
    expect(result.reconAssets?.length).toBe(1);
    expect(result.reconAssets?.[0].host).toBe('api.testacme.com');
    expect(progressSpy).toHaveBeenCalled();
  });

  it('parses Katana/GAU endpoints list and detects anomaly parameters', async () => {
    const sampleEndpoints = `https://app.testacme.com/export?url=http://127.0.0.1:8080/internal
https://app.testacme.com/user?id=1028
https://app.testacme.com/actuator/env`;

    const result = await ingestionService.ingestFile(sampleEndpoints, 'endpoints.txt', {
      projectId: 'test-proj',
    });

    expect(result.sourceType).toBe('endpoints');
    expect(result.reconAssets?.length).toBe(3);

    const ssrfAsset = result.reconAssets?.find((a) => a.url.includes('export?url='));
    expect(ssrfAsset).toBeDefined();
    expect(ssrfAsset?.highInterestFlags).toContain('SSRF Candidate Param');

    const springAsset = result.reconAssets?.find((a) => a.url.includes('/actuator/env'));
    expect(springAsset).toBeDefined();
    expect(springAsset?.riskScore).toBe('critical');
  });

  it('handles empty or unrecognized files gracefully without throwing errors', async () => {
    const result = await ingestionService.ingestFile('some random invalid text', 'unknown.bin');
    expect(result.sourceType).toBe('unknown');
    expect(result.reconAssets?.length).toBe(0);
    expect(result.findings.length).toBe(0);
  });
});
