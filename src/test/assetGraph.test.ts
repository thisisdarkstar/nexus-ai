import { describe, it, expect } from 'vitest';
import { AssetGraph } from '../domain/graph/AssetGraph';
import type { ReconAsset, ScopeItem } from '../types';

describe('AssetGraph (Relational Attack Surface Engine)', () => {
  const sampleFlatAssets: ReconAsset[] = [
    {
      id: 'ast-1',
      url: 'https://api.acme.corp/v1/redirect?url=https://evil.com&token=abc123',
      host: 'api.acme.corp',
      technologies: ['Spring Boot Actuator', 'Java'],
      riskScore: 'high',
      statusCode: 200,
    },
    {
      id: 'ast-2',
      url: 'https://staging.acme.corp/login?redirect=/home',
      host: 'staging.acme.corp',
      technologies: ['React', 'Nginx'],
      riskScore: 'medium',
      statusCode: 200,
    },
  ];

  const scopeRules: ScopeItem[] = [
    {
      id: 'scp-1',
      target: '*.acme.corp',
      type: 'domain',
      inScope: true,
      status: 'in_progress',
    },
  ];

  it('builds a normalized relational graph connecting domains, subdomains, routes, and params', () => {
    const graph = new AssetGraph('proj-test');
    graph.buildFromFlatAssets(sampleFlatAssets, 'proj-test', scopeRules);

    const allNodes = graph.getAllNodes();
    const allEdges = graph.getAllEdges();

    expect(allNodes.length).toBeGreaterThanOrEqual(8);
    expect(allEdges.length).toBeGreaterThanOrEqual(7);

    // Verify Apex Domain Node
    const apex = graph.getNode('dom:acme.corp');
    expect(apex).toBeDefined();
    expect(apex?.type).toBe('domain');
    expect(apex?.inScope).toBe(true);

    // Verify Subdomains
    const subApi = graph.getNode('sub:api.acme.corp');
    const subStaging = graph.getNode('sub:staging.acme.corp');
    expect(subApi).toBeDefined();
    expect(subStaging).toBeDefined();

    // Verify Resolves-To Edge
    const edgesFromApex = graph.getOutgoingEdges('dom:acme.corp', 'resolves_to');
    expect(edgesFromApex.length).toBe(2);
  });

  it('indexes technology relationships and discovers endpoints running specific stacks', () => {
    const graph = new AssetGraph('proj-test');
    graph.buildFromFlatAssets(sampleFlatAssets, 'proj-test', scopeRules);

    const actuatorEndpoints = graph.findEndpointsForTechnology('Spring Boot Actuator');
    expect(actuatorEndpoints.length).toBe(1);
    expect(actuatorEndpoints[0].id).toBe(
      'ep:https://api.acme.corp/v1/redirect?url=https://evil.com&token=abc123'
    );
  });

  it('indexes parameter relationships and queries routes accepting specific query keys', () => {
    const graph = new AssetGraph('proj-test');
    graph.buildFromFlatAssets(sampleFlatAssets, 'proj-test', scopeRules);

    const redirectEndpoints = graph.findEndpointsForParameter('redirect');
    expect(redirectEndpoints.length).toBe(1);
    expect(redirectEndpoints[0].id).toBe('ep:https://staging.acme.corp/login?redirect=/home');

    const urlEndpoints = graph.findEndpointsForParameter('url');
    expect(urlEndpoints.length).toBe(1);
  });

  it('serializes and deserializes graph state without data loss', () => {
    const graph1 = new AssetGraph('proj-test');
    graph1.buildFromFlatAssets(sampleFlatAssets, 'proj-test', scopeRules);

    const json = graph1.toJSON();
    expect(json.nodes.length).toBe(graph1.getAllNodes().length);
    expect(json.edges.length).toBe(graph1.getAllEdges().length);

    const graph2 = new AssetGraph('proj-test');
    graph2.fromJSON(json);

    expect(graph2.getAllNodes().length).toBe(graph1.getAllNodes().length);
    expect(graph2.getAllEdges().length).toBe(graph1.getAllEdges().length);
    expect(graph2.findEndpointsForTechnology('Java').length).toBe(1);
  });
});
