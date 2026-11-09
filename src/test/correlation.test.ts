import { describe, it, expect } from 'vitest';
import { correlationService } from '../domain/intelligence/CorrelationService';
import type { ReconAsset } from '../types';

describe('Security Intelligence Correlation Service', () => {
  it('correlates Spring Boot Actuator endpoint with correct CWE and high confidence when 200 OK', () => {
    const asset: ReconAsset = {
      id: 'asset-spring-1',
      url: 'https://dev.target.com/actuator/env',
      host: 'dev.target.com',
      statusCode: 200,
      highInterestFlags: ['Spring Actuator Exposure'],
      technologies: ['Spring Boot', 'Java'],
    };

    const observations = correlationService.correlateAsset(asset);
    expect(observations.length).toBeGreaterThan(0);

    const springObs = observations.find((o) => o.advisory.id === 'ADV-SPRING-ACTUATOR');
    expect(springObs).toBeDefined();
    expect(springObs?.advisory.cweId).toBe('CWE-200');
    expect(springObs?.confidence).toBe('high_confidence');
    expect(springObs?.remediation).toContain('management.endpoints.web.exposure.include');
  });

  it('marks heuristic SSRF parameter anomalies as tentative rather than confirmed', () => {
    const asset: ReconAsset = {
      id: 'asset-ssrf-1',
      url: 'https://files.target.com/preview?url=http://example.com',
      host: 'files.target.com',
      statusCode: 200,
      highInterestFlags: ['SSRF Candidate Param'],
      technologies: ['Node.js'],
    };

    const observations = correlationService.correlateAsset(asset);
    const ssrfObs = observations.find((o) => o.advisory.id === 'ADV-SSRF-PARAM');

    expect(ssrfObs).toBeDefined();
    expect(ssrfObs?.advisory.cweId).toBe('CWE-918');
    // Critical: Never represent a heuristic observation as a confirmed vulnerability
    expect(ssrfObs?.confidence).toBe('tentative');
    expect(ssrfObs?.suggestedCheck).toContain('strict domain whitelist');
  });

  it('correlates exposed .env configuration leak with critical severity and confirmed status on 200 OK', () => {
    const asset: ReconAsset = {
      id: 'asset-env-1',
      url: 'https://backup.target.com/.env',
      host: 'backup.target.com',
      statusCode: 200,
      highInterestFlags: ['Exposed Config / Source File'],
    };

    const observations = correlationService.correlateAsset(asset);
    const envObs = observations.find((o) => o.advisory.id === 'ADV-EXPOSED-CONFIG');

    expect(envObs).toBeDefined();
    expect(envObs?.advisory.severity).toBe('critical');
    expect(envObs?.confidence).toBe('confirmed');
  });
});

