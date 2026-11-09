import { describe, it, expect } from 'vitest';
import { scannerAdapterRegistry, NucleiAdapter, SemgrepAdapter } from '../adapters';

describe('Scanner Adapters (Open-Source Tool Ingestion)', () => {
  const sampleNucleiJsonl = JSON.stringify({
    'template-id': 'cve-2021-41773-apache-path-traversal',
    info: {
      name: 'Apache 2.4.49 - Path Traversal & RCE',
      severity: 'critical',
      description: 'A flaw was found in a change made to path normalization in Apache HTTP Server 2.4.49.',
      classification: {
        'cwe-id': ['CWE-22'],
        'cvss-score': 9.8,
      },
    },
    type: 'http',
    host: 'api.acme.corp',
    'matched-at': 'https://api.acme.corp/icons/.%%32%65/.%%32%65/.%%32%65/etc/passwd',
    'curl-command': 'curl -i -s -k "https://api.acme.corp/icons/.%%32%65/.%%32%65/.%%32%65/etc/passwd"',
  });

  const sampleSemgrepSarif = JSON.stringify({
    version: '2.1.0',
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'semgrep',
            rules: [
              {
                id: 'python.sqlalchemy.security.injection.sql-injection',
                name: 'SQL Injection in SQLAlchemy',
                shortDescription: { text: 'Untrusted user input concatenated into query string' },
                properties: { tags: ['CWE-89', 'OWASP-A03:2021'] },
                help: { markdown: 'Use parameterized text() or bind parameters.' },
              },
            ],
          },
        },
        results: [
          {
            ruleId: 'python.sqlalchemy.security.injection.sql-injection',
            level: 'error',
            message: { text: 'Detected SQL statement formatted with untrusted input' },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: 'services/user_service.py' },
                  region: { startLine: 42, endLine: 43 },
                },
              },
            ],
          },
        ],
      },
    ],
  });

  it('NucleiAdapter parses streaming JSONL output into graph nodes, findings, and edges', async () => {
    const adapter = new NucleiAdapter();
    expect(adapter.canParse(sampleNucleiJsonl)).toBe(true);

    const result = await adapter.parse(sampleNucleiJsonl, { projectId: 'proj-1' });

    expect(result.findings.length).toBe(1);
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[0].cweId).toBe('CWE-22');
    expect(result.findings[0].title).toContain('Apache 2.4.49');

    expect(result.nodes.length).toBe(2); // endpoint + finding
    expect(result.edges.length).toBe(1); // exhibits_finding
    expect(result.edges[0].relationship).toBe('exhibits_finding');
  });

  it('SemgrepAdapter parses SARIF 2.1 into source file nodes and findings', async () => {
    const adapter = new SemgrepAdapter();
    expect(adapter.canParse(sampleSemgrepSarif)).toBe(true);

    const result = await adapter.parse(sampleSemgrepSarif, { projectId: 'proj-1' });

    expect(result.findings.length).toBe(1);
    expect(result.findings[0].cweId).toBe('CWE-89');
    expect(result.findings[0].file).toBe('services/user_service.py');
    expect(result.findings[0].lineStart).toBe(42);

    expect(result.nodes.some((n) => n.type === 'source_file')).toBe(true);
    expect(result.edges[0].relationship).toBe('defined_in');
  });

  it('ScannerAdapterRegistry auto-detects correct adapter by payload signature', () => {
    const detectedNuclei = scannerAdapterRegistry.detectAdapter(sampleNucleiJsonl);
    expect(detectedNuclei).toBeDefined();
    expect(detectedNuclei?.id).toBe('nuclei-adapter');

    const detectedSemgrep = scannerAdapterRegistry.detectAdapter(sampleSemgrepSarif);
    expect(detectedSemgrep).toBeDefined();
    expect(detectedSemgrep?.id).toBe('semgrep-adapter');
  });
});
