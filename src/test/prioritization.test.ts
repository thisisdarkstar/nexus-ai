import { describe, it, expect } from 'vitest';
import { PrioritizationEngine } from '../domain/prioritization/PrioritizationEngine';
import type { GraphNode } from '../domain/graph/types';
import type { VulnerabilityFinding } from '../types';

describe('PrioritizationEngine (Explainable Risk Scoring)', () => {
  const engine = PrioritizationEngine.getInstance();

  const sampleEndpointNode: GraphNode = {
    id: 'ep:https://api.acme.corp/admin/actuator/env',
    projectId: 'proj-1',
    type: 'http_endpoint',
    label: '/admin/actuator/env',
    inScope: true,
    riskScore: 80,
    confidence: 'confirmed',
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now(),
    attributes: { statusCode: 200 },
    evidenceIds: [],
  };

  const sampleFinding: VulnerabilityFinding = {
    id: 'f-1',
    title: 'Spring Boot Actuator Exposed RCE',
    severity: 'critical',
    cweId: 'CWE-78',
    targetEndpoint: 'https://api.acme.corp/admin/actuator/env',
    description: 'Actively exploited command injection vector via environment configuration injection.',
    remediation: 'Disable actuator exposure.',
    status: 'open',
  };

  it('computes high composite priority score for in-scope endpoint with critical actively exploited finding', () => {
    const result = engine.prioritizeEndpoint(sampleEndpointNode, [sampleFinding]);

    expect(result.compositeScore).toBeGreaterThanOrEqual(80);
    expect(result.priorityLevel).toBe('critical');
    expect(result.rationales.some((r) => r.includes('Critical Finding Associated'))).toBe(true);
    expect(result.rationales.some((r) => r.includes('CISA KEV'))).toBe(true);
    expect(result.rationales.some((r) => r.includes('/admin') || r.includes('/actuator'))).toBe(true);
  });

  it('assigns 0 score to out-of-scope targets regardless of findings', () => {
    const outOfScopeNode: GraphNode = {
      ...sampleEndpointNode,
      inScope: false,
    };

    const result = engine.prioritizeEndpoint(outOfScopeNode, [sampleFinding]);
    expect(result.compositeScore).toBe(0);
    expect(result.priorityLevel).toBe('low');
    expect(result.rationales[0]).toContain('Out of scope');
  });
});
